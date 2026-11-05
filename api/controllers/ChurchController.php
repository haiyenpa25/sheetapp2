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
                default           => Response::notFound('Action không hợp lệ'),
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
        Response::ok(['church' => $church, 'members' => ChurchService::members($churchId), 'invite_code' => $church['invite_code'] ?? null]);
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

    private function create(array $body): void {
        if (!Auth::isAdmin()) { Response::forbidden('Chỉ Admin hệ thống được tạo Hội Thánh'); return; }
        Response::ok(['church' => ChurchService::create((string)($body['name'] ?? ''))]);
    }

    /** Trả false (đã gửi lỗi) nếu HT không tồn tại hoặc người dùng không quản lý được. */
    private function canManage(int $churchId): bool {
        if ($churchId <= 0 || !ChurchService::find($churchId)) { Response::notFound('Hội Thánh không tồn tại'); return false; }
        if (!ChurchAccessGuard::canManageChurch($churchId)) { Response::forbidden('Bạn không phải quản trị của Hội Thánh này'); return false; }
        return true;
    }
}
