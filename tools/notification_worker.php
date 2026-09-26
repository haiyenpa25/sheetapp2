<?php
/**
 * tools/notification_worker.php
 *
 * Worker CLI xử lý hàng đợi chuyển phát thông báo đa kênh (Email & Push — Epic 4.4):
 * - Chạy định kỳ (ví dụ qua cron job mỗi 5 phút hoặc Task Scheduler trên Windows).
 * - BẢO MẬT: Chỉ được phép chạy từ dòng lệnh (CLI). Bị chặn truy cập từ web.
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Access Denied: This worker script must be executed via CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/NotificationDeliveryService.php';

$startTime = microtime(true);
echo "[" . date('Y-m-d H:i:s') . "] Starting SheetApp Notification Delivery Worker...\n";

try {
    $stats = NotificationDeliveryService::processQueue(50);
    $elapsed = round(microtime(true) - $startTime, 3);

    echo "Completed in {$elapsed}s:\n";
    echo "  - Processed : {$stats['processed']}\n";
    echo "  - Sent      : {$stats['sent']}\n";
    echo "  - Deferred  : {$stats['deferred']} (Quiet Hours)\n";
    echo "  - Skipped   : {$stats['skipped']}\n";
    echo "  - Failed    : {$stats['failed']}\n";
    exit(0);
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
