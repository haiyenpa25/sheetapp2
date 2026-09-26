<?php
/**
 * api/controllers/NotificationPreferenceController.php
 *
 * Điều phối API Tùy chọn Thông báo Đa Kênh (Epic 4.4)
 * Router: route=notification_preferences
 * Actions:
 *  - get:  Lấy cấu hình tùy chọn kênh và giờ yên lặng của người dùng
 *  - save: Lưu cấu hình tùy chọn, email và giờ yên lặng
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/NotificationPreferenceService.php';

class NotificationPreferenceController {
    public function handle(string $action): void {
        Auth::requireLogin();
        $userId = Auth::userId();

        try {
            switch ($action) {
                case 'get':
                    $data = NotificationPreferenceService::getPreferences($userId);
                    Response::ok($data);
                    break;

                case 'save':
                    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

                    // 1. Cập nhật email và quiet hours nếu có
                    if (array_key_exists('email', $input) || array_key_exists('quiet_hours_start', $input)) {
                        NotificationPreferenceService::updateUserSettings(
                            $userId,
                            $input['email'] ?? null,
                            $input['quiet_hours_start'] ?? null,
                            $input['quiet_hours_end'] ?? null
                        );
                    }

                    // 2. Cập nhật ma trận tùy chọn nếu có
                    if (!empty($input['preferences']) && is_array($input['preferences'])) {
                        NotificationPreferenceService::updatePreferences($userId, $input['preferences']);
                    }

                    $fresh = NotificationPreferenceService::getPreferences($userId);
                    Response::ok($fresh, 'Đã lưu cài đặt thông báo thành công');
                    break;

                default:
                    Response::notFound('Action không hợp lệ: ' . $action);
                    break;
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Throwable $e) {
            Response::serverError($e, 'NotificationPreferences');
        }
    }
}
