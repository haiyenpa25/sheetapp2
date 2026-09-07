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
        $action = $_GET['action'] ?? 'progress';
        $userId = Auth::userId() ?: 0;

        try {
            if ($method === 'GET') {
                if ($action === 'progress') {
                    $songId = (int)($_GET['song_id'] ?? $_GET['songId'] ?? 0);
                    if ($songId <= 0) {
                        Response::error('Thiếu mã bài hát (song_id)', 400);
                        return;
                    }
                    $progress = PracticeService::getProgress($songId, $userId);
                    Response::ok(['progress' => $progress]);
                    return;
                }
            }

            if ($method === 'POST') {
                $body = json_decode(file_get_contents('php://input'), true) ?? [];

                if ($action === 'start') {
                    $songId   = (int)($body['song_id'] ?? 0);
                    $mode     = trim($body['mode'] ?? 'piano');
                    $startBpm = (int)($body['start_bpm'] ?? 76);

                    $session = PracticeService::startSession($userId, $songId, $mode, $startBpm);
                    Response::ok(['session' => $session]);
                    return;
                }

                if ($action === 'checkpoint') {
                    $sessionId = (int)($body['session_id'] ?? 0);
                    $stats     = is_array($body['stats'] ?? null) ? $body['stats'] : [];

                    PracticeService::checkpoint($sessionId, $stats);
                    Response::ok(['message' => 'Checkpoint lưu thành công']);
                    return;
                }

                if ($action === 'finish') {
                    $sessionId   = (int)($body['session_id'] ?? 0);
                    $durationSec = (int)($body['duration_seconds'] ?? 0);
                    $maxBpm      = (int)($body['max_bpm'] ?? 76);
                    $accuracy    = (float)($body['accuracy_total'] ?? 100.0);

                    PracticeService::finishSession($sessionId, $durationSec, $maxBpm, $accuracy);
                    Response::ok(['message' => 'Đã hoàn thành phiên luyện tập']);
                    return;
                }
            }

            Response::notFound("Hành động {$action} không tồn tại.");
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
