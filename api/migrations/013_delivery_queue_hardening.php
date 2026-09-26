<?php
/**
 * api/migrations/013_delivery_queue_hardening.php
 *
 * Củng cố hàng đợi chuyển phát thông báo (Ticket F7):
 * - Bổ sung cột next_attempt_at để chống nghẽn kẹt hàng đợi do giờ yên lặng.
 * - Chỉ áp dụng ALTER TABLE khi cột chưa tồn tại.
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $cols = $pdo->query("PRAGMA table_info(notification_deliveries)")->fetchAll(PDO::FETCH_ASSOC);
    $existing = array_column($cols, 'name');

    if (!in_array('next_attempt_at', $existing, true)) {
        $pdo->exec("ALTER TABLE notification_deliveries ADD COLUMN next_attempt_at DATETIME NULL;");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_deliv_next_attempt ON notification_deliveries(status, next_attempt_at);");
    }
};
