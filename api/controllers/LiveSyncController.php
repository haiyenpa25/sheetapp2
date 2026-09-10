<?php
/**
 * api/controllers/LiveSyncController.php — Live Sync API Controller V2
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/LiveSyncService.php';

class LiveSyncController {
    public function handleRequest(string $method): void {
        try {
            $action = $_GET['action'] ?? '';

            if ($method === 'GET') {
                $room     = trim($_GET['room'] ?? '');
                $rev      = isset($_GET['rev']) ? (int)$_GET['rev'] : 0;
                $clientId = trim($_GET['clientId'] ?? '');
                $role     = trim($_GET['role'] ?? '');
                if (!$room) {
                    Response::error('Thiếu tham số room', 400);
                    return;
                }
                $res = LiveSyncService::pollRoom($room, $rev, $clientId, $role);
                Response::ok($res);
                return;
            }

            if ($method === 'POST') {
                $body      = json_decode(file_get_contents('php://input'), true) ?? [];
                $room      = trim($body['room'] ?? ($_GET['room'] ?? ''));
                $hostToken = trim($body['hostToken'] ?? ($_SERVER['HTTP_X_HOST_TOKEN'] ?? ''));

                if (!$room) {
                    Response::error('Thiếu mã phòng', 400);
                    return;
                }

                if ($action === 'create' || $action === 'create_room') {
                    $res = LiveSyncService::createRoom($room, $body);
                    Response::ok($res);
                    return;
                }

                if ($action === 'close' || $action === 'close_room') {
                    $res = LiveSyncService::closeRoom($room, $hostToken);
                    Response::ok($res);
                    return;
                }

                // Default POST: update room state
                $res = LiveSyncService::updateRoom($room, $hostToken, $body);
                if (!empty($res['error'])) {
                    Response::error($res['error'], 403);
                    return;
                }
                Response::ok($res);
                return;
            }

            Response::methodNotAllowed();
        } catch (Throwable $e) {
            Response::error('Lỗi Live Sync: ' . $e->getMessage(), 500);
        }
    }
}
