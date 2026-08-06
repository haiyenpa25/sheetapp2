<?php
/**
 * api/controllers/LiveSyncController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/LiveSyncService.php';

class LiveSyncController {
    public function handleRequest(string $method): void {
        try {
            if ($method === 'GET') {
                $room = trim($_GET['room'] ?? '');
                if (!$room) {
                    Response::error('Thiếu tham số room');
                    return;
                }
                $res = LiveSyncService::pollRoom($room);
                Response::ok($res);
                return;
            }

            if ($method === 'POST') {
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $room = trim($body['room'] ?? '');
                if (!$room) {
                    Response::error('Thiếu room ID');
                    return;
                }
                $res = LiveSyncService::updateRoom($room, $body);
                Response::ok($res);
                return;
            }

            Response::methodNotAllowed();
        } catch (Throwable $e) {
            Response::error('Lỗi Live Sync: ' . $e->getMessage(), 500);
        }
    }
}
