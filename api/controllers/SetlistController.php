<?php
/**
 * api/controllers/SetlistController.php
 *
 * REST Controller điều phối Service Plan (Chương trình buổi nhóm) & Phân công nhân sự:
 * - GET    /api/setlists                         -> Danh sách service plans kèm thống kê
 * - GET    /api/setlists?id={id}                 -> Chi tiết 1 plan: bài hát, phân công, trạng thái
 * - GET    /api/setlists?action=song_usage&song_id={id} -> Lịch sử sử dụng bài hát
 * - POST   /api/setlists                         -> Tạo service plan mới
 * - POST   /api/setlists?action=update&id={id}   -> Cập nhật thông tin/trạng thái plan
 * - POST   /api/setlists?action=publish&id={id}  -> Phát hành plan cho toàn ban nhạc
 * - DELETE /api/setlists?id={id}                 -> Xóa service plan
 * - POST   /api/setlists?action=add_item         -> Thêm bài hát/tiết mục buổi nhóm
 * - PATCH  /api/setlists?action=update_item&id={id} -> Cập nhật tông, BPM, profile, ghi chú mục
 * - DELETE /api/setlists?action=remove_item&id={id} -> Xóa mục khỏi plan
 * - POST   /api/setlists?action=assign           -> Phân công nhân sự
 * - DELETE /api/setlists?action=remove_assignment&id={id} -> Gỡ phân công
 * - POST   /api/setlists?action=respond_assignment&id={id} -> Xác nhận/từ chối tham gia
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/SetlistService.php';

class SetlistController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? '';
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        $userId = Auth::userId();

        try {
            // ── 1. GET Requests ──────────────────────────────────────────
            if ($method === 'GET') {
                if ($action === 'song_usage') {
                    $songId = $_GET['song_id'] ?? '';
                    if (empty($songId)) {
                        Response::error('Thiếu song_id', 400);
                        return;
                    }
                    Response::ok(['data' => SetlistService::getSongUsageHistory($songId)]);
                    return;
                }

                if ($action === 'usage_report') {
                    require_once __DIR__ . '/../core/FeatureFlags.php';
                    if (!FeatureFlags::isEnabled('USAGE_REPORT')) {
                        Response::notFound('Tính năng báo cáo sử dụng bài hát hiện đang tắt');
                        return;
                    }
                    Auth::requireLeader();
                    $from = !empty($_GET['from']) ? trim($_GET['from']) : null;
                    $to = !empty($_GET['to']) ? trim($_GET['to']) : null;
                    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
                    Response::ok(['data' => SetlistService::getUsageReport($from, $to, $limit)]);
                    return;
                }

                if ($action === 'check_recent_usage') {
                    Auth::requireLogin();
                    $songId = trim($_GET['song_id'] ?? '');
                    if (empty($songId)) {
                        Response::error('Thiếu song_id', 400);
                        return;
                    }
                    $weeks = isset($_GET['weeks']) ? (int)$_GET['weeks'] : 4;
                    Response::ok(['data' => SetlistService::checkRecentUsage($songId, $weeks)]);
                    return;
                }

                if ($action === 'offline_package' || $action === 'manifest') {
                    if ($id <= 0) {
                        Response::error('Thiếu ID chương trình', 400);
                        return;
                    }
                    $package = SetlistService::getOfflinePackage($id);
                    if (!$package) {
                        Response::notFound('Chương trình không tồn tại');
                        return;
                    }
                    Response::ok(['data' => $package]);
                    return;
                }

                if ($id > 0) {
                    $setlist = SetlistService::getById($id);
                    if (!$setlist) {
                        Response::notFound('Chương trình không tồn tại');
                        return;
                    }
                    Response::ok(['data' => $setlist]);
                } else {
                    Response::ok(['data' => SetlistService::getAll($userId)]);
                }
                return;
            }

            // ── 2. POST / PUT / PATCH / DELETE Requests (Yêu cầu đăng nhập) ──
            Auth::requireLogin();
            $rawInput = file_get_contents('php://input');
            $data = !empty($rawInput) ? (json_decode($rawInput, true) ?? []) : [];

            // ── Tạo mới Service Plan ──
            if ($method === 'POST' && empty($action)) {
                Auth::requireLogin();
                $newId = SetlistService::create($data, '', $userId);
                Response::ok(['id' => $newId, 'message' => 'Đã tạo chương trình thành công']);
                return;
            }

            // ── Cập nhật thông tin Service Plan ──
            if (($method === 'POST' || $method === 'PUT' || $method === 'PATCH') && $action === 'update') {
                Auth::requireLogin();
                if ($id <= 0) { Response::error('Thiếu ID chương trình', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isLeaderOrOwner($id, (int)$userId)) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền sửa chương trình này');
                    return;
                }
                SetlistService::update($id, $data, $userId);
                Response::ok(['message' => 'Đã cập nhật chương trình']);
                return;
            }

            // ── Phát hành Service Plan ──
            if ($method === 'POST' && $action === 'publish') {
                if ($id <= 0) { Response::error('Thiếu ID chương trình', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isLeaderOrOwner($id, (int)$userId)) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền phát hành chương trình này');
                    return;
                }
                SetlistService::publish($id, $userId);
                Response::ok(['message' => 'Đã phát hành chương trình cho Ban Nhạc']);
                return;
            }

            // ── Xóa Service Plan ──
            if ($method === 'DELETE' && empty($action)) {
                Auth::requireLogin();
                if ($id <= 0) { Response::error('Thiếu ID chương trình', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isOwner($id, (int)$userId)) {
                    Response::forbidden('Bạn không có quyền xóa chương trình này');
                    return;
                }
                SetlistService::delete($id, $userId);
                Response::ok(['message' => 'Đã xóa chương trình']);
                return;
            }

            // ── Thêm bài hát / tiết mục buổi nhóm ──
            if ($method === 'POST' && $action === 'add_item') {
                Auth::requireLogin();
                $setlistId = (int)($data['setlist_id'] ?? 0);
                if ($setlistId <= 0) { Response::error('Thiếu setlist_id', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isLeaderOrOwner($setlistId, (int)$userId)) {
                    Response::forbidden('Bạn không có quyền chỉnh sửa chương trình này');
                    return;
                }

                $songId       = $data['song_id'] ?? '';
                $chordProfile = $data['chord_profile'] ?? 'HD';
                $transposeKey = isset($data['transpose_key']) ? (int)$data['transpose_key'] : 0;
                $bpm          = isset($data['bpm']) && $data['bpm'] !== '' ? (int)$data['bpm'] : null;
                $beats        = isset($data['beats_per_measure']) && $data['beats_per_measure'] !== '' ? (int)$data['beats_per_measure'] : null;

                $itemId = SetlistService::addItem($setlistId, $songId, $chordProfile, $transposeKey, $bpm, $beats, $data);
                Response::ok(['id' => $itemId, 'message' => 'Đã thêm mục vào chương trình']);
                return;
            }

            // ── Cập nhật bài hát / tiết mục ──
            if (($method === 'POST' || $method === 'PATCH') && $action === 'update_item') {
                Auth::requireLogin();
                if ($id <= 0) { Response::error('Thiếu item ID', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isItemOwner($id, (int)$userId)) {
                    Response::forbidden('Bạn không sở hữu chương trình chứa mục này');
                    return;
                }
                $updated = SetlistService::updateItem($id, $data);
                if ($updated) {
                    Response::ok(['message' => 'Đã cập nhật mục']);
                } else {
                    Response::error('Không có thông tin thay đổi', 400);
                }
                return;
            }

            // ── Xóa mục khỏi chương trình ──
            if ($method === 'DELETE' && $action === 'remove_item') {
                Auth::requireLogin();
                if ($id <= 0) { Response::error('Thiếu item ID', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isItemOwner($id, (int)$userId)) {
                    Response::forbidden('Bạn không có quyền xóa mục này');
                    return;
                }
                SetlistService::removeItem($id);
                Response::ok(['message' => 'Đã xóa mục khỏi chương trình']);
                return;
            }

            // ── Phân công nhân sự cho chương trình ──
            if ($method === 'POST' && $action === 'assign') {
                $setlistId = (int)($data['setlist_id'] ?? 0);
                $targetUserId = (int)($data['user_id'] ?? 0);
                $role = $data['role'] ?? 'vocal';
                $notes = $data['notes'] ?? null;

                if ($setlistId <= 0 || $targetUserId <= 0) {
                    Response::error('Thiếu setlist_id hoặc user_id', 400);
                    return;
                }
                if (!Auth::isAdmin() && !SetlistService::isLeaderOrOwner($setlistId, (int)$userId)) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền phân công');
                    return;
                }

                $assignId = SetlistService::assignUser($setlistId, $targetUserId, $role, $notes, $userId);
                Response::ok(['id' => $assignId, 'message' => 'Đã phân công thành viên']);
                return;
            }

            // ── Gỡ phân công ──
            if ($method === 'DELETE' && $action === 'remove_assignment') {
                if ($id <= 0) { Response::error('Thiếu assignment ID', 400); return; }
                $assignment = DB::run("SELECT setlist_id FROM service_plan_assignments WHERE id = ?", [$id])->fetch(PDO::FETCH_ASSOC);
                if (!$assignment) { Response::notFound('Không tìm thấy mục phân công'); return; }

                if (!Auth::isAdmin() && !SetlistService::isLeaderOrOwner((int)$assignment['setlist_id'], (int)$userId)) {
                    Response::forbidden('Bạn không có quyền gỡ phân công này');
                    return;
                }
                SetlistService::removeAssignment($id, $userId);
                Response::ok(['message' => 'Đã gỡ phân công thành viên']);
                return;
            }

            // ── Thành viên phản hồi phân công (Xác nhận / Báo bận) ──
            if ($method === 'POST' && $action === 'respond_assignment') {
                if ($id <= 0) { Response::error('Thiếu assignment ID', 400); return; }
                if (!Auth::isAdmin() && !SetlistService::isAssignmentOwner($id, (int)$userId)) {
                    Response::forbidden('Bạn chỉ có quyền phản hồi phân công của chính mình');
                    return;
                }

                $status = $data['status'] ?? 'confirmed';
                $notes  = $data['notes'] ?? null;

                if (!in_array($status, ['confirmed', 'declined', 'pending'], true)) {
                    Response::error('Trạng thái phản hồi không hợp lệ', 400);
                    return;
                }

                SetlistService::respondAssignment($id, (int)$userId, $status, $notes);
                Response::ok(['message' => 'Đã cập nhật trạng thái tham gia']);
                return;
            }

            Response::methodNotAllowed();

        } catch (Throwable $e) {
            Response::serverError($e, 'Setlist');
        }
    }
}
