<?php
declare(strict_types=1);

/**
 * tests/http/live_sync_route_http_regression.php
 * 
 * Regression suite cho Ticket T07 — Live sync: sửa route & fallback:
 * 1. Gọi HTTP tới URL SSE route=live_sync&action=events: trả về HTTP 200 và Content-Type: text/event-stream.
 * 2. URL cũ route=livesync không tồn tại (trả 400).
 * 3. assets/js/performance/live-transport.js:
 *    - Sử dụng route=live_sync thay vì route=livesync.
 *    - Sử dụng ApiService.resolveUrl để build URL an toàn đa base path.
 *    - Bắt sự kiện EventSource.CLOSED để fallback sang PollingTransport ngay lập tức.
 */

$baseUrl = getenv('SHEETAPP_TEST_URL') ?: 'http://localhost/sheetapp2';
$baseUrl = rtrim($baseUrl, '/');

// 1. Kiểm tra liveness của Apache
function checkLiveness(string $url): ?int {
    $ch = curl_init($url . '/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY         => true,
        CURLOPT_TIMEOUT        => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    curl_exec($ch);
    $errno = curl_errno($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno !== 0 || $code === 0) {
        return null;
    }
    return $code;
}

$liveCode = checkLiveness($baseUrl);
if ($liveCode === null) {
    echo "[SKIP] Apache không chạy tại {$baseUrl}/ (không thể kết nối HTTP). Test bị bỏ qua.\n";
    exit(0);
}

$failures = [];
function check(bool $condition, string $message): void {
    global $failures;
    if ($condition) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        $failures[] = $message;
    }
}

echo "=== T07: LIVE SYNC ROUTE & FALLBACK REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra URL SSE HTTP thực tế ──
echo "-- 1. Kiểm tra endpoint SSE live_sync HTTP thật --\n";

// Tạo phòng test tạm thời trước khi test SSE
require_once __DIR__ . '/../../api/services/LiveSyncService.php';
$testRoom = 't07-sse-room-' . time();
LiveSyncService::createRoom($testRoom, ['id' => 'host-t07', 'name' => 'Host T07']);

$sseUrl = "{$baseUrl}/api/index.php?route=live_sync&action=events&room={$testRoom}&rev=0&clientId=client-test&role=follower";

// Gọi cURL kiểm tra header trả về (stream ngắt sau 1s)
$ch = curl_init($sseUrl);
$responseHeaders = '';
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_TIMEOUT        => 2,
    CURLOPT_HEADERFUNCTION => function($ch, $headerLine) use (&$responseHeaders) {
        $responseHeaders .= $headerLine;
        return strlen($headerLine);
    },
    CURLOPT_WRITEFUNCTION  => function($ch, $data) {
        // Đọc 1 chunk đầu rồi ngắt để không treo process
        return 0; // trả 0 để dừng curl_exec
    }
]);
@curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

check($httpCode === 200, "URL SSE route=live_sync trả về HTTP 200 (nhận được: {$httpCode})");
check(str_contains(strtolower($responseHeaders), 'text/event-stream'), "URL SSE trả về Content-Type: text/event-stream");

// Dọn dẹp phòng tạm (toàn bộ file json, lock, presence)
foreach (glob(__DIR__ . "/../../storage/data/live_sync/{$testRoom}*") as $rf) {
    @unlink($rf);
}

// ── 2. Kiểm tra URL cũ route=livesync bị từ chối ──
echo "\n-- 2. Kiểm tra URL cũ route=livesync --\n";
$oldUrl = "{$baseUrl}/api/index.php?route=livesync&action=events&room=dummy";
$chOld = curl_init($oldUrl);
curl_setopt_array($chOld, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 3,
]);
$oldRes = curl_exec($chOld);
$oldCode = (int)curl_getinfo($chOld, CURLINFO_HTTP_CODE);
curl_close($chOld);

check(in_array($oldCode, [400, 404], true), "URL cũ route=livesync bị từ chối với HTTP 400/404 (nhận được: {$oldCode})");

// ── 3. Kiểm tra mã nguồn live-transport.js ──
echo "\n-- 3. Kiểm tra client logic live-transport.js --\n";
$jsPath = __DIR__ . '/../../assets/js/performance/live-transport.js';
$jsContent = file_get_contents($jsPath) ?: '';

check(str_contains($jsContent, 'route=live_sync'), "live-transport.js sử dụng route=live_sync");
check(!str_contains($jsContent, 'route=livesync'), "live-transport.js đã loại bỏ hoàn toàn route=livesync cũ");
check(str_contains($jsContent, 'resolveUrl'), "live-transport.js sử dụng ApiService.resolveUrl để build URL");
check(str_contains($jsContent, 'CLOSED') && str_contains($jsContent, '_startFallback'), "live-transport.js chuyển PollingTransport ngay khi EventSource.CLOSED");

echo "\n----------------------------------------\n";
if (empty($failures)) {
    echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";
    exit(0);
} else {
    echo "KẾT QUẢ: " . count($failures) . " KIỂM TRA THẤT BẠI (FAIL).\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}
