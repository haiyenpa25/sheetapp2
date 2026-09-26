<?php
/**
 * api/controllers/PracticeController.php
 * Router cho API /api/?route=practice
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/PracticeService.php';

class PracticeController {
    public function handleRequest(string $method): void {
        Auth::requireLogin();
        $action = $_GET['action'] ?? 'progress';
        $userId = Auth::userId() ?: 0;

        try {
            if ($method === 'GET') {
                if ($action === 'progress') {
                    $songId = trim($_GET['song_id'] ?? $_GET['songId'] ?? '');
                    if (empty($songId)) {
                        Response::error('Thiếu mã bài hát (song_id)', 400);
                        return;
                    }
                    $progress = PracticeService::getProgress($songId, $userId);
                    Response::ok(['progress' => $progress]);
                    return;
                }

                if ($action === 'dashboard') {
                    $dashboard = PracticeService::getPersonalDashboard($userId);
                    Response::ok(['dashboard' => $dashboard]);
                    return;
                }

                if ($action === 'leader_view') {
                    // Quyền xem: Chỉ Ca Trưởng / Ban Hát hoặc Quản Trị Viên
                    if (!Auth::isBanhat() && !Auth::isAdmin()) {
                        Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền xem tiến độ ca đoàn');
                        return;
                    }

                    $songId = trim($_GET['song_id'] ?? $_GET['songId'] ?? '');
                    $leaderView = PracticeService::getLeaderView($userId, $songId ?: null);
                    Response::ok(['leader_view' => $leaderView]);
                    return;
                }
            }

            if ($method === 'POST') {
                $rawInput = file_get_contents('php://input');
                $body = json_decode($rawInput, true);
                if (!is_array($body) && !empty($_POST)) {
                    $body = $_POST;
                }
                $body = is_array($body) ? $body : [];

                if ($action === 'start') {
                    $songId   = trim((string)($body['song_id'] ?? ''));
                    $mode     = trim((string)($body['mode'] ?? 'piano'));
                    $startBpm = (int)($body['start_bpm'] ?? 76);
                    $assignmentId = isset($body['assignment_id']) && (int)$body['assignment_id'] > 0 ? (int)$body['assignment_id'] : null;

                    $session = PracticeService::startSession($userId, $songId, $mode, $startBpm, $assignmentId);
                    Response::ok(['session' => $session]);
                    return;
                }

                if ($action === 'checkpoint') {
                    $sessionId = (int)($body['session_id'] ?? 0);
                    $stats     = is_array($body['stats'] ?? null) ? $body['stats'] : [];

                    if (!Auth::isAdmin() && !PracticeService::isOwner($sessionId, $userId)) {
                        Response::forbidden('Bạn không có quyền sửa phiên luyện tập này');
                        return;
                    }

                    PracticeService::checkpoint($sessionId, $stats);
                    Response::ok(['message' => 'Checkpoint lưu thành công']);
                    return;
                }

                if ($action === 'finish') {
                    $sessionId    = (int)($body['session_id'] ?? 0);
                    $durationSec  = (int)($body['duration_seconds'] ?? 0);
                    $maxBpm       = (int)($body['max_bpm'] ?? 76);
                    $accuracy     = (float)($body['accuracy_total'] ?? 0.0);
                    $notesTotal   = (int)($body['notes_total'] ?? 0);
                    $notesCorrect = (int)($body['notes_correct'] ?? 0);
                    $timingScore  = (float)($body['timing_score'] ?? 100.0);
                    $stats        = is_array($body['stats'] ?? null) ? $body['stats'] : null;

                    if (!Auth::isAdmin() && !PracticeService::isOwner($sessionId, $userId)) {
                        Response::forbidden('Bạn không có quyền kết thúc phiên luyện tập này');
                        return;
                    }

                    PracticeService::finishSession(
                        $sessionId, 
                        $durationSec, 
                        $maxBpm, 
                        $accuracy, 
                        $notesTotal, 
                        $notesCorrect, 
                        $timingScore, 
                        $stats
                    );
                    Response::ok(['message' => 'Đã hoàn thành phiên luyện tập']);
                    return;
                }

                if ($action === 'consent') {
                    $consent = !empty($body['consent']);
                    PracticeService::setConsent($userId, $consent);
                    Response::ok([
                        'message' => $consent ? 'Đã bật chia sẻ tiến độ với Ca Trưởng' : 'Đã tắt chia sẻ tiến độ với Ca Trưởng',
                        'consent' => $consent
                    ]);
                    return;
                }
            }

            Response::notFound("Hành động {$action} không tồn tại.");
        } catch (Throwable $e) {
            Response::serverError($e, 'Practice');
        }
    }
}
