<?php
/**
 * api/controllers/NotificationController.php
 *
 * Điều phối API Trung tâm thông báo trong ứng dụng (In-app Notification Center)
 * Route: api/index.php?route=notifications
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/NotificationService.php';

class NotificationController {
    public function handleRequest(string $method): void {
        Auth::requireLogin();
        $userId = Auth::userId();
        if (!$userId) {
            Response::unauthorized('Cần đăng nhập');
            return;
        }

        $action = $_GET['action'] ?? ($method === 'GET' ? 'list' : '');

        switch ($action) {
            case 'list':
                $limit  = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
                $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
                $data   = NotificationService::getList($userId, $limit, $offset);
                Response::ok($data);
                break;

            case 'count':
                $unread = NotificationService::getUnreadCount($userId);
                Response::ok(['unread_count' => $unread]);
                break;

            case 'mark_read':
                if ($method !== 'POST') {
                    Response::error('Method Not Allowed', 405);
                    return;
                }
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
                $id = (int)($body['id'] ?? 0);
                if (!$id) {
                    Response::error('Thiếu ID thông báo');
                    return;
                }
                NotificationService::markRead($userId, $id);
                Response::ok(['message' => 'Đã đánh dấu đã đọc']);
                break;

            case 'mark_all_read':
                if ($method !== 'POST') {
                    Response::error('Method Not Allowed', 405);
                    return;
                }
                NotificationService::markAllRead($userId);
                Response::ok(['message' => 'Đã đánh dấu tất cả đã đọc']);
                break;

            default:
                Response::error('Hành động không hợp lệ');
                break;
        }
    }
}
