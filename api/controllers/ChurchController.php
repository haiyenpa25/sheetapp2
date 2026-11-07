<?php
declare(strict_types=1);

/**
 * api/controllers/ChurchController.php
 * Route: churches (chỉ hoạt động khi cờ MULTI_CHURCH bật — kiểm ở api/index.php)
 * Chỉ: parse request → gọi ChurchService → trả Response. Quyền quản lý đi qua ChurchAccessGuard.
 *
 * GET  (mặc định)            Các HT của tôi + HT đang làm việc (+ toàn bộ HT nếu là admin hệ thống)
 * GET  action=members        Thành viên + mã mời của một HT (church_id) — quản trị HT
 * POST action=switch         Chọn HT đang làm việc
 * POST action=join           Vào HT bằng mã mời (chờ duyệt)
 * POST action=update_member  Duyệt / đổi vai trò / khóa (church_id, user_id, role?, status?)
 * POST action=rename         Đổi tên HT
 * POST action=regenerate_code Đổi mã mời
 * POST action=create         Tạo HT mới (chỉ admin hệ thống)
 */
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/ChurchAccessGuard.php';
require_once __DIR__ . '/../services/ChurchService.php';
require_once __DIR__ . '/../services/ChurchSongService.php';

class ChurchController {
    /** Số lần nhập sai mã mời tối đa mỗi phiên, tránh dò mã. */
    private const MAX_JOIN_FAILURES = 10;

    public function handleRequest(string $method): void {
        Auth::requireLogin();
        $action = (string)($_GET['action'] ?? ($method === 'POST' ? '' : 'mine'));
        try {
            if ($method === 'GET') {
                match ($action) {
                    'mine'    => $this->mine(),
                    'members' => $this->members(),
                    'songs'   => $this->songs(),
                    default   => Response::notFound('Action không hợp lệ'),
                };
                return;
            }
            if ($method !== 'POST') { Response::methodNotAllowed(); return; }
            $body = json_decode((string)file_get_contents('php://input'), true);
            $body = is_array($body) ? $body : [];
            match ($action) {
                'switch'          => $this->switchChurch($body),
                'join'            => $this->join($body),
                'update_member'   => $this->updateMember($body),
                'rename'          => $this->rename($body),
                'regenerate_code' => $this->regenerateCode($body),
                'create'          => $this->create($body),
                'delete'          => $this->delete($body),
                'add_member'      => $this->addMember($body),
                'remove_member'   => $this->removeMember($body),
                'song_update'     => $this->songUpdate($body),
                'song_delete'     => $this->songDelete($body),
                'song_publish'    => $this->songPublish($body),
                default          => Response::notFound('Action không hợp lệ'),
            };
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (DomainException $e) {
            Response::error($e->getMessage(), 409);
        } catch (Throwable $e) {
            Response::serverError($e, 'Churches');
        }
    }

    private function mine(): void {
        $userId = (int)Auth::userId();
        $mine = ChurchService::forUser($userId);
        $pending = DB::run(
            "SELECT c.id, c.name FROM church_members m JOIN churches c ON c.id = m.church_id WHERE m.user_id = ? AND m.status = 'pending'",
            [$userId]
        )->fetchAll(PDO::FETCH_ASSOC);
        $active = ChurchAccessGuard::currentChurchFilter() ?? ChurchService::activeChurchId($userId);
        $out = ['churches' => $mine, 'pending' => $pending, 'active_church_id' => $active];
        if (Auth::isAdmin()) $out['all_churches'] = ChurchService::listAll();
        Response::ok($out);
    }

    private function members(): void {
        $churchId = (int)($_GET['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        $church = ChurchService::find($churchId);
        Response::ok(['church' => $church, 'members' => ChurchService::members($churchId), 'invite_code' => $church['invite_code'] ?? null, 'counts' => ChurchService::counts($churchId)]);
    }

    private function switchChurch(array $body): void {
        $churchId = (int)($body['church_id'] ?? 0);
        $userId = (int)Auth::userId();
        $ok = Auth::isAdmin() ? (bool)ChurchService::find($churchId) : ChurchService::memberRole($userId, $churchId) !== null;
        if (!$ok) { Response::forbidden('Bạn không thuộc Hội Thánh này'); return; }
        $_SESSION['church_id'] = $churchId;
        Response::ok(['active_church_id' => $churchId]);
    }

    private function join(array $body): void {
        if ((int)($_SESSION['church_join_failures'] ?? 0) >= self::MAX_JOIN_FAILURES) {
            Response::error('Nhập sai mã mời quá nhiều lần, hãy thử lại sau', 429);
            return;
        }
        try {
            $result = ChurchService::join((int)Auth::userId(), (string)($body['code'] ?? ''));
        } catch (InvalidArgumentException $e) {
            $_SESSION['church_join_failures'] = (int)($_SESSION['church_join_failures'] ?? 0) + 1;
            throw $e;
        }
        Response::ok(['membership' => $result]);
    }

    private function updateMember(array $body): void {
        $churchId = (int)($body['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        $role = isset($body['role']) ? (string)$body['role'] : null;
        $status = isset($body['status']) ? (string)$body['status'] : null;
        ChurchService::updateMember($churchId, (int)($body['user_id'] ?? 0), $role, $status);
        Response::ok(['members' => ChurchService::members($churchId)]);
    }

    private function rename(array $body): void {
        $churchId = (int)($body['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        ChurchService::rename($churchId, (string)($body['name'] ?? ''));
        Response::ok(['church' => ChurchService::find($churchId)]);
    }

    private function regenerateCode(array $body): void {
        $churchId = (int)($body['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        Response::ok(['invite_code' => ChurchService::regenerateInviteCode($churchId)]);
    }

    /** Có `abbr` (viết tắt) → tạo luôn 3 tài khoản banhat/bannhac/admin.<abbr>; mật khẩu chỉ trả về lần này. */
    private function create(array $body): void {
        if (!Auth::isAdmin()) { Response::forbidden('Chỉ Admin hệ thống được tạo Hội Thánh'); return; }
        $name = (string)($body['name'] ?? '');
        $abbr = trim((string)($body['abbr'] ?? ''));
        if ($abbr !== '') { Response::ok(ChurchService::createWithAccounts($name, $abbr)); return; }
        Response::ok(['church' => ChurchService::create($name)]);
    }

    /** Xóa HT: chương trình lễ + quan hệ thành viên; tài khoản, bài hát, XML giữ nguyên. Cần confirm=true. */
    private function delete(array $body): void {
        if (!Auth::isAdmin()) { Response::forbidden('Chỉ Admin hệ thống được xóa Hội Thánh'); return; }
        $churchId = (int)($body['church_id'] ?? 0);
        if (empty($body['confirm'])) {
            if (!ChurchService::find($churchId)) { Response::notFound('Hội Thánh không tồn tại'); return; }
            Response::error('Cần xác nhận xóa. Sẽ mất: ' . json_encode(ChurchService::counts($churchId)), 400);
            return;
        }
        Response::ok(['deleted' => ChurchService::delete($churchId)]);
    }

    private function addMember(array $body): void {
        if (!Auth::isAdmin()) { Response::forbidden('Chỉ Admin hệ thống được gán người vào Hội Thánh'); return; }
        $churchId = (int)($body['church_id'] ?? 0);
        ChurchService::addMember($churchId, (int)($body['user_id'] ?? 0), (string)($body['role'] ?? ChurchService::ROLE_MEMBER));
        Response::ok(['members' => ChurchService::members($churchId)]);
    }

    private function removeMember(array $body): void {
        $churchId = (int)($body['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        ChurchService::removeMember($churchId, (int)($body['user_id'] ?? 0));
        Response::ok(['members' => ChurchService::members($churchId)]);
    }

    private function songs(): void {
        $churchId = (int)($_GET['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return;
        Response::ok(['songs' => ChurchSongService::list($churchId)]);
    }

    private function songUpdate(array $body): void {
        $songId = $this->ownedSongId($body);
        if ($songId === null) return;
        ChurchSongService::update($songId, $body);
        Response::ok(['updated' => $songId]);
    }

    private function songDelete(array $body): void {
        $songId = $this->ownedSongId($body);
        if ($songId === null) return;
        ChurchSongService::delete($songId);
        $this->auditSong('church_song_delete', $songId, $body);
        Response::ok(['deleted' => $songId]);
    }

    /** Chuyển bài riêng sang danh mục công khai chung — ai cũng thấy; quay lại riêng tư phải nhờ admin hệ thống. */
    private function songPublish(array $body): void {
        $songId = $this->ownedSongId($body);
        if ($songId === null) return;
        $target = (int)($body['target_category_id'] ?? 0);
        ChurchSongService::publish($songId, $target);
        $this->auditSong('church_song_publish', $songId, $body + ['target_category_id' => $target]);
        Response::ok(['published' => $songId]);
    }

    /** Mã bài nếu người dùng quản lý HT đó VÀ bài nằm trong kho riêng của HT; ngược lại đã gửi lỗi và trả null. */
    private function ownedSongId(array $body): ?string {
        $churchId = (int)($body['church_id'] ?? 0);
        if (!$this->canManage($churchId)) return null;
        $songId = trim((string)($body['song_id'] ?? ''));
        if ($songId === '' || !ChurchSongService::owns($churchId, $songId)) {
            Response::notFound('Bài không nằm trong kho riêng của Hội Thánh này');
            return null;
        }
        return $songId;
    }

    private function auditSong(string $action, string $songId, array $body): void {
        require_once __DIR__ . '/../core/AuditLogger.php';
        AuditLogger::log($action, (int)Auth::userId(), null, ['song_id' => $songId, 'church_id' => (int)($body['church_id'] ?? 0), 'target_category_id' => $body['target_category_id'] ?? null]);
    }

    /** Trả false (đã gửi lỗi) nếu HT không tồn tại hoặc người dùng không quản lý được. */
    private function canManage(int $churchId): bool {
        if ($churchId <= 0 || !ChurchService::find($churchId)) { Response::notFound('Hội Thánh không tồn tại'); return false; }
        if (!ChurchAccessGuard::canManageChurch($churchId)) { Response::forbidden('Bạn không phải quản trị của Hội Thánh này'); return false; }
        return true;
    }
}
