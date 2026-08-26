<?php
/**
 * api/controllers/ArrangementController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ArrangementService.php';

class ArrangementController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? '';
        $songId = trim($_GET['songId'] ?? ($_GET['song_id'] ?? ''));
        $id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        try {
            // GET ACTIONS
            if ($method === 'GET') {
                if ($action === 'sections' || empty($action)) {
                    if (!$songId) {
                        Response::error('Thiếu tham số songId', 400);
                        return;
                    }
                    $sections = ArrangementService::getSections($songId);
                    Response::ok(['data' => $sections]);
                    return;
                }

                if ($action === 'arrangements') {
                    if (!$songId) {
                        Response::error('Thiếu tham số songId', 400);
                        return;
                    }
                    $arrangements = ArrangementService::getArrangements($songId);
                    Response::ok(['data' => $arrangements]);
                    return;
                }

                if ($action === 'steps') {
                    $arrangementId = isset($_GET['arrangementId']) ? (int)$_GET['arrangementId'] : $id;
                    if ($arrangementId <= 0) {
                        Response::error('Thiếu tham số arrangementId', 400);
                        return;
                    }
                    $steps = ArrangementService::getArrangementSteps($arrangementId);
                    Response::ok(['data' => $steps]);
                    return;
                }
            }

            // POST ACTIONS
            if ($method === 'POST') {
                $body = json_decode(file_get_contents('php://input'), true) ?? [];

                if ($action === 'save_section') {
                    $secSongId = trim($body['song_id'] ?? $songId);
                    if (!$secSongId) {
                        Response::error('Thiếu mã bài hát (song_id)', 400);
                        return;
                    }
                    $body['song_id'] = $secSongId;
                    $secId = ArrangementService::upsertSection($body);
                    Response::ok(['id' => $secId, 'message' => 'Đã lưu phân đoạn']);
                    return;
                }

                if ($action === 'save_sections') {
                    $secSongId = trim($body['songId'] ?? ($body['song_id'] ?? $songId));
                    $sections  = $body['sections'] ?? [];
                    if (!$secSongId) {
                        Response::error('Thiếu mã bài hát (songId)', 400);
                        return;
                    }
                    $saved = ArrangementService::saveAllSections($secSongId, $sections);
                    Response::ok(['data' => $saved, 'message' => 'Đã lưu toàn bộ phân đoạn']);
                    return;
                }

                if ($action === 'save_arrangement') {
                    $arrSongId    = trim($body['songId'] ?? ($body['song_id'] ?? $songId));
                    $arrData      = $body['arrangement'] ?? $body;
                    $steps        = $body['steps'] ?? [];
                    if (!$arrSongId) {
                        Response::error('Thiếu mã bài hát (songId)', 400);
                        return;
                    }
                    $arrId = ArrangementService::saveArrangement($arrSongId, $arrData, $steps);
                    Response::ok(['id' => $arrId, 'message' => 'Đã lưu kịch bản biểu diễn']);
                    return;
                }
            }

            // DELETE ACTIONS
            if ($method === 'DELETE') {
                if ($action === 'delete_section') {
                    if ($id <= 0) {
                        Response::error('Thiếu ID phân đoạn', 400);
                        return;
                    }
                    ArrangementService::deleteSection($id);
                    Response::ok(['message' => 'Đã xóa phân đoạn']);
                    return;
                }

                if ($action === 'delete_arrangement') {
                    if ($id <= 0) {
                        Response::error('Thiếu ID kịch bản', 400);
                        return;
                    }
                    ArrangementService::deleteArrangement($id);
                    Response::ok(['message' => 'Đã xóa kịch bản']);
                    return;
                }
            }

            Response::notFound('Action không hợp lệ');
        } catch (Throwable $e) {
            Response::error('Lỗi Arrangement: ' . $e->getMessage(), 500);
        }
    }
}
