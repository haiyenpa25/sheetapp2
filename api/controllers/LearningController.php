<?php
/**
 * api/controllers/LearningController.php
 * Router cho API /api/?route=learning
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/LearningService.php';

class LearningController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? 'patterns';

        try {
            if ($method === 'GET') {
                if ($action === 'patterns') {
                    $family = $_GET['instrument'] ?? null;
                    $meter  = $_GET['meter'] ?? null;
                    $patterns = LearningService::getPatterns($family, $meter);
                    Response::ok(['patterns' => $patterns]);
                    return;
                }

                if ($action === 'arrangements') {
                    $songId = trim((string)($_GET['song_id'] ?? $_GET['songId'] ?? ''));
                    if ($songId === '') {
                        Response::error('Thiếu mã bài hát (song_id)', 400);
                        return;
                    }
                    $arr = LearningService::getArrangement($songId, Auth::userId() ?? 0);
                    Response::ok(['arrangement' => $arr]);
                    return;
                }
            }

            if ($method === 'POST') {
                Auth::requireLogin();
                $body = json_decode(file_get_contents('php://input'), true) ?? [];

                if ($action === 'save_arrangement') {
                    $saved = LearningService::saveArrangement($body, Auth::userId() ?? 0);
                    Response::ok(['arrangement' => $saved, 'message' => 'Lưu cấu hình luyện tập thành công']);
                    return;
                }
            }

            Response::notFound("Hành động {$action} không tồn tại.");
        } catch (Throwable $e) {
            Response::serverError($e, 'Learning');
        }
    }
}
