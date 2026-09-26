<?php
/**
 * api/services/NotificationPreferenceService.php
 *
 * Dịch vụ Quản lý Tùy chọn Thông báo Đa Kênh & Giờ Yên Lặng (Epic 4.4):
 * - Quản lý ma trận phân phối sự kiện × kênh (inapp, email, push).
 * - Kiểm tra trạng thái kích hoạt kênh cho từng sự kiện domain.
 * - Kiểm tra và bảo vệ khung giờ yên lặng (Quiet Hours) của người dùng.
 * - Đưa thông báo vào hàng đợi chuyển phát đa kênh (notification_deliveries).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';

class NotificationPreferenceService {
    public const CHANNELS = ['inapp', 'email', 'push'];

    public const EVENT_TYPES = [
        'plan.published'       => 'Chương trình phụng vụ mới',
        'assignment.created'   => 'Được giao bài tập mới',
        'assignment.due_soon'  => 'Nhắc bài tập sắp tới hạn',
        'review.decided'       => 'Kết quả xét duyệt hợp âm',
        'review.submitted'     => 'Có đề xuất hợp âm mới cần duyệt'
    ];

    /**
     * Lấy cấu hình mặc định cho một người dùng
     */
    public static function getDefaultPreferences(): array {
        $defaults = [];
        foreach (array_keys(self::EVENT_TYPES) as $event) {
            $defaults[$event] = [
                'inapp' => 1,
                'email' => 1,
                'push'  => 0
            ];
        }
        return $defaults;
    }

    /**
     * Lấy ma trận tùy chọn thông báo đầy đủ của người dùng
     */
    public static function getPreferences(int $userId): array {
        $pdo = DB::get();

        // 1. Lấy thông tin email và quiet hours của user
        $stmtUser = $pdo->prepare("
            SELECT email, email_verified_at, quiet_hours_start, quiet_hours_end 
            FROM users 
            WHERE id = ?
        ");
        $stmtUser->execute([$userId]);
        $userMeta = $stmtUser->fetch(PDO::FETCH_ASSOC) ?: [];

        // 2. Lấy các tùy chọn đã lưu trong DB
        $stmt = $pdo->prepare("
            SELECT event_type, channel, enabled 
            FROM notification_preferences 
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        $savedRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $savedMap = [];
        foreach ($savedRows as $r) {
            $savedMap[$r['event_type']][$r['channel']] = (int)$r['enabled'];
        }

        // 3. Hợp nhất với defaults
        $matrix = [];
        $defaults = self::getDefaultPreferences();

        foreach (self::EVENT_TYPES as $type => $label) {
            $matrix[$type] = [
                'label'    => $label,
                'channels' => []
            ];

            foreach (self::CHANNELS as $ch) {
                $enabled = $savedMap[$type][$ch] ?? ($defaults[$type][$ch] ?? 1);
                $matrix[$type]['channels'][$ch] = (int)$enabled;
            }
        }

        return [
            'user_id'           => $userId,
            'email'             => $userMeta['email'] ?? null,
            'email_verified_at' => $userMeta['email_verified_at'] ?? null,
            'quiet_hours_start' => $userMeta['quiet_hours_start'] ?? null,
            'quiet_hours_end'   => $userMeta['quiet_hours_end'] ?? null,
            'matrix'            => $matrix
        ];
    }

    /**
     * Cập nhật ma trận tùy chọn thông báo
     */
    public static function updatePreferences(int $userId, array $preferences): bool {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            INSERT INTO notification_preferences (user_id, event_type, channel, enabled, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, event_type, channel) DO UPDATE SET
                enabled = excluded.enabled,
                updated_at = CURRENT_TIMESTAMP
        ");

        foreach ($preferences as $item) {
            $eventType = $item['event_type'] ?? '';
            $channel   = $item['channel'] ?? '';
            $enabled   = !empty($item['enabled']) ? 1 : 0;

            if (isset(self::EVENT_TYPES[$eventType]) && in_array($channel, self::CHANNELS, true)) {
                $stmt->execute([$userId, $eventType, $channel, $enabled]);
            }
        }

        return true;
    }

    /**
     * Cập nhật thông tin email và khung giờ yên lặng
     */
    public static function updateUserSettings(
        int $userId,
        ?string $email,
        ?string $quietStart,
        ?string $quietEnd
    ): array {
        $pdo = DB::get();

        $cleanEmail = $email !== null ? trim($email) : null;
        if ($cleanEmail === '') $cleanEmail = null;

        if ($cleanEmail !== null && !filter_var($cleanEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("Địa chỉ email không hợp lệ");
        }

        // Validate format HH:MM
        $cleanStart = $quietStart !== null ? trim($quietStart) : null;
        if ($cleanStart === '') $cleanStart = null;
        if ($cleanStart !== null && !preg_match('/^(?:2[0-3]|[01][0-9]):[0-5][0-9]$/', $cleanStart)) {
            throw new InvalidArgumentException("Giờ bắt đầu yên lặng phải có định dạng HH:MM (VD: 22:00)");
        }

        $cleanEnd = $quietEnd !== null ? trim($quietEnd) : null;
        if ($cleanEnd === '') $cleanEnd = null;
        if ($cleanEnd !== null && !preg_match('/^(?:2[0-3]|[01][0-9]):[0-5][0-9]$/', $cleanEnd)) {
            throw new InvalidArgumentException("Giờ kết thúc yên lặng phải có định dạng HH:MM (VD: 07:00)");
        }

        $upd = $pdo->prepare("
            UPDATE users 
            SET email = ?, quiet_hours_start = ?, quiet_hours_end = ? 
            WHERE id = ?
        ");
        $upd->execute([$cleanEmail, $cleanStart, $cleanEnd, $userId]);

        return [
            'success'           => true,
            'email'             => $cleanEmail,
            'quiet_hours_start' => $cleanStart,
            'quiet_hours_end'   => $cleanEnd
        ];
    }

    /**
     * Kiểm tra xem một kênh có được bật cho loại sự kiện đối với người dùng không
     */
    public static function isChannelEnabled(int $userId, string $eventType, string $channel): bool {
        if (!in_array($channel, self::CHANNELS, true)) {
            return false;
        }

        $pdo = DB::get();

        // Với kênh email, nếu user chưa có email thì tự động coi là không bật
        if ($channel === 'email') {
            $stmtUser = $pdo->prepare("SELECT email FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userEmail = $stmtUser->fetchColumn();
            if (empty($userEmail)) {
                return false;
            }
        }

        $stmt = $pdo->prepare("
            SELECT enabled 
            FROM notification_preferences 
            WHERE user_id = ? AND event_type = ? AND channel = ?
        ");
        $stmt->execute([$userId, $eventType, $channel]);
        $val = $stmt->fetchColumn();

        if ($val !== false) {
            return (int)$val === 1;
        }

        // Lấy mặc định nếu chưa lưu
        $defaults = self::getDefaultPreferences();
        return ($defaults[$eventType][$channel] ?? 1) === 1;
    }

    /**
     * Kiểm tra thời điểm hiện tại có rơi vào khung giờ yên lặng của người dùng không
     */
    public static function isInQuietHours(int $userId, ?DateTimeInterface $now = null): bool {
        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT quiet_hours_start, quiet_hours_end FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row || empty($row['quiet_hours_start']) || empty($row['quiet_hours_end'])) {
            return false;
        }

        $startStr = $row['quiet_hours_start'];
        $endStr   = $row['quiet_hours_end'];

        $nowObj = $now ?: new DateTime('now', new DateTimeZone('Asia/Ho_Chi_Minh'));
        $currentStr = $nowObj->format('H:i');

        if ($startStr <= $endStr) {
            // Cùng trong ngày: ví dụ 13:00 đến 15:00
            return ($currentStr >= $startStr && $currentStr < $endStr);
        } else {
            // Qua đêm: ví dụ 22:00 đến 07:00
            return ($currentStr >= $startStr || $currentStr < $endStr);
        }
    }

    /**
     * Đưa thông báo vào hàng đợi chuyển phát (notification_deliveries)
     */
    public static function queueDelivery(int $notificationId, int $userId, string $channel): int {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            INSERT INTO notification_deliveries (notification_id, user_id, channel, status, attempts, created_at)
            VALUES (?, ?, ?, 'queued', 0, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([$notificationId, $userId, $channel]);
        return (int)$pdo->lastInsertId();
    }
}
