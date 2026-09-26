<?php
/**
 * api/migrations/012_notification_preferences.php
 *
 * Migration cho Epic 4.4 — Tùy chọn thông báo đa kênh & Nhật ký chuyển phát:
 * 1. Bảng notification_preferences: Quản lý ma trận bật/tắt (event_type × channel) của từng người dùng.
 * 2. Bảng notification_deliveries: Hàng đợi chuyển phát và lưu vết trạng thái gửi (queued | sent | failed | skipped).
 * 3. Mở rộng bảng users với email, email_verified_at, quiet_hours_start, quiet_hours_end.
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Tạo bảng notification_preferences
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            channel TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, event_type, channel),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON notification_preferences(user_id);");

    // 2. Tạo bảng notification_deliveries
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notification_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT NULL,
            sent_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_deliv_status_channel ON notification_deliveries(status, channel);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_deliv_user ON notification_deliveries(user_id);");

    // 3. Mở rộng users với các cột liên quan đến email & giờ yên lặng
    $colsUser = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $existingUserCols = array_column($colsUser, 'name');

    if (!in_array('email', $existingUserCols, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email TEXT NULL;");
    }
    if (!in_array('email_verified_at', $existingUserCols, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL;");
    }
    if (!in_array('quiet_hours_start', $existingUserCols, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN quiet_hours_start TEXT NULL;");
    }
    if (!in_array('quiet_hours_end', $existingUserCols, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN quiet_hours_end TEXT NULL;");
    }
};
