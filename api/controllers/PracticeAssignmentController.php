<?php
/**
 * api/controllers/PracticeAssignmentController.php
 *
 * Điều phối API Giao bài & Tập bè cho ca đoàn (Epic 4.1)
 * Route: api/index.php?route=practice_assignments
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/PracticeAssignmentService.php';

class PracticeAssignmentController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? ($method === 'GET' ? 'mine' : '');

        switch ($action) {
            case 'mine':
                Auth::requireLogin();
                $userId = (int)Auth::userId();
                $assignments = PracticeAssignmentService::getMyAssignments($userId);
                Response::ok(['assignments' => $assignments]);
                break;

            case 'board':
                AuthPolicy::authorize('view_team_progress');
                $setlistId = (int)($_GET['setlist_id'] ?? 0);
                if ($setlistId <= 0) {
                    Response::error('Thiếu mã chương trình thờ phượng (setlist_id)');
                    return;
                }
                $board = PracticeAssignmentService::getTeamBoard($setlistId, (int)Auth::userId());
                Response::ok($board);
                break;

            case 'detail':
                Auth::requireLogin();
                $id = (int)($_GET['id'] ?? 0);
                if ($id <= 0) {
                    Response::error('Thiếu mã bài tập (id)');
                    return;
                }
                $isLeader = AuthPolicy::can(Auth::role(), 'assign_practice');
                $detail = PracticeAssignmentService::getDetail($id, (int)Auth::userId(), $isLeader);
                if (!$detail) {
                    Response::notFound('Không tìm thấy bài tập yêu cầu');
                    return;
                }
                Response::ok(['assignment' => $detail]);
                break;

            case 'create_from_plan':
                if ($method !== 'POST') {
                    Response::methodNotAllowed();
                    return;
                }
                AuthPolicy::authorize('assign_practice');
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $setlistId = (int)($body['setlist_id'] ?? 0);
                if ($setlistId <= 0) {
                    Response::error('Thiếu mã chương trình thờ phượng (setlist_id)');
                    return;
                }
                try {
                    $result = PracticeAssignmentService::createFromServicePlan($setlistId, (int)Auth::userId());
                    Response::ok($result);
                } catch (Throwable $e) {
                    Response::error($e->getMessage());
                }
                break;

            case 'create':
                if ($method !== 'POST') {
                    Response::methodNotAllowed();
                    return;
                }
                AuthPolicy::authorize('assign_practice');
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                try {
                    $assignmentId = PracticeAssignmentService::createAdHoc($body, (int)Auth::userId());
                    Response::ok([
                        'assignment_id' => $assignmentId,
                        'message'       => 'Đã tạo bài tập thành công'
                    ]);
                } catch (Throwable $e) {
                    Response::error($e->getMessage());
                }
                break;

            case 'mark_done':
                if ($method !== 'POST') {
                    Response::methodNotAllowed();
                    return;
                }
                Auth::requireLogin();
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $assignmentId = (int)($body['assignment_id'] ?? 0);
                if ($assignmentId <= 0) {
                    Response::error('Thiếu mã bài tập (assignment_id)');
                    return;
                }
                $success = PracticeAssignmentService::markDone($assignmentId, (int)Auth::userId());
                if (!$success) {
                    Response::error('Không tìm thấy mục tiêu bài tập của bạn');
                    return;
                }
                Response::ok(['message' => 'Đã đánh dấu hoàn thành bài tập']);
                break;

            case 'mark_excused':
                if ($method !== 'POST') {
                    Response::methodNotAllowed();
                    return;
                }
                AuthPolicy::authorize('assign_practice');
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $assignmentId = (int)($body['assignment_id'] ?? 0);
                $targetUserId = (int)($body['target_user_id'] ?? 0);
                if ($assignmentId <= 0 || $targetUserId <= 0) {
                    Response::error('Thiếu mã bài tập hoặc mã thành viên');
                    return;
                }
                $success = PracticeAssignmentService::markExcused($assignmentId, $targetUserId, (int)Auth::userId());
                if (!$success) {
                    Response::error('Không tìm thấy bài tập của thành viên');
                    return;
                }
                Response::ok(['message' => 'Đã đánh dấu miễn tập']);
                break;

            case 'archive':
                if ($method !== 'POST') {
                    Response::methodNotAllowed();
                    return;
                }
                AuthPolicy::authorize('assign_practice');
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $assignmentId = (int)($body['assignment_id'] ?? 0);
                if ($assignmentId <= 0) {
                    Response::error('Thiếu mã bài tập (assignment_id)');
                    return;
                }
                $success = PracticeAssignmentService::archive($assignmentId, (int)Auth::userId());
                if (!$success) {
                    Response::error('Không tìm thấy bài tập cần lưu trữ');
                    return;
                }
                Response::ok(['message' => 'Đã lưu trữ bài tập']);
                break;

            default:
                Response::error('Hành động không hợp lệ');
                break;
        }
    }
}
