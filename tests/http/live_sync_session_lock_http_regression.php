<?php
declare(strict_types=1);

/**
 * tests/http/live_sync_session_lock_http_regression.php
 * 
 * Regression suite cho Ticket T08 — Live sync: bỏ khoá session trong SSE:
 * 1. Với route=live_sync&action=events (hoặc sse), controller/service phải nhả khoá session
 *    bằng session_write_close() trước vòng lặp stream dài hạn và thiết lập set_time_limit(40).
 * 2. Khi 1 client đang mở stream SSE (giữ kết nối stream), một request HTTP khác từ cùng client
 *    (cùng cookie session PHPSESSID) tới route=songs KHÔNG bị block mà phải hoàn thành trong < 1.0s.
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
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    if ($condition) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        $failures[] = $message;
    }
}

echo "=== T08: LIVE SYNC SESSION UNLOCK IN SSE REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra mã nguồn phòng vệ ──
echo "-- 1. Kiểm tra mã nguồn controller & service --\n";
$controllerCode = file_get_contents(__DIR__ . '/../../api/controllers/LiveSyncController.php') ?: '';
$serviceCode    = file_get_contents(__DIR__ . '/../../api/services/LiveSyncService.php') ?: '';
$indexCode      = file_get_contents(__DIR__ . '/../../api/index.php') ?: '';

$hasSessionClose = str_contains($controllerCode, 'session_write_close') || str_contains($serviceCode, 'session_write_close');
$hasTimeLimit    = str_contains($controllerCode, 'set_time_limit(40)') || str_contains($serviceCode, 'set_time_limit(40)');

check($hasSessionClose, "LiveSyncController hoặc LiveSyncService có gọi session_write_close() trước stream");
check($hasTimeLimit, "LiveSync stream có gọi set_time_limit(40)");

// ── 2. Kiểm tra hành vi HTTP thực tế: Không bị chặn bởi Session Lock ──
echo "\n-- 2. Kiểm tra hành vi HTTP đồng thời (Concurrency Non-blocking Session) --\n";

// Bước 2.1: Lấy session cookie thực từ máy chủ
$chInit = curl_init("{$baseUrl}/api/index.php?route=auth&action=me");
$initHeaders = '';
curl_setopt_array($chInit, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADERFUNCTION => function($ch, $h) use (&$initHeaders) {
        $initHeaders .= $h;
        return strlen($h);
    }
]);
curl_exec($chInit);
curl_close($chInit);

preg_match('/Set-Cookie:\s*(PHPSESSID=[^;]+)/i', $initHeaders, $matches);
$sessionCookie = $matches[1] ?? '';
check(!empty($sessionCookie), "Máy chủ trả về session cookie hợp lệ ({$sessionCookie})");

if (empty($sessionCookie)) {
    echo "KẾT QUẢ: 1 KIỂM TRA THẤT BẠI (FAIL) do không lấy được session cookie.\n";
    exit(1);
}

// Bước 2.2: Tạo phòng live sync test tạm
require_once __DIR__ . '/../../api/services/LiveSyncService.php';
$testRoom = 't08_sess_room_' . time();
LiveSyncService::createRoom($testRoom, ['id' => 'host-t08', 'name' => 'Host T08']);

// Bước 2.3: Mở tiến trình SSE nền gửi kèm session cookie này
$tempDir = sys_get_temp_dir();
$flagFile = $tempDir . DIRECTORY_SEPARATOR . 't08_sse_flag_' . time() . '.txt';
@unlink($flagFile);

$bgWorkerScript = $tempDir . DIRECTORY_SEPARATOR . 't08_worker_' . time() . '.php';
$workerCode = '<?php
$url = $argv[1];
$cookie = $argv[2];
$flag = $argv[3];
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_COOKIE => $cookie,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_HEADERFUNCTION => function($ch, $h) use ($flag) {
        if (str_starts_with($h, "HTTP/")) {
            @file_put_contents($flag, "connected\n", FILE_APPEND);
        }
        return strlen($h);
    },
    CURLOPT_WRITEFUNCTION => function($ch, $d) use ($flag) {
        @file_put_contents($flag, "stream\n", FILE_APPEND);
        static $t0 = null;
        if ($t0 === null) $t0 = microtime(true);
        if (microtime(true) - $t0 > 8) return 0;
        return strlen($d);
    }
]);
@curl_exec($ch);
curl_close($ch);
';
file_put_contents($bgWorkerScript, $workerCode);

$sseEndpoint = "{$baseUrl}/api/index.php?route=live_sync&action=events&room={$testRoom}&rev=0&clientId=t08-client";
$phpBin = 'C:\\xampp\\php\\php.exe';
if (!file_exists($phpBin)) {
    $phpBin = PHP_BINARY;
}

$cmd = "\"{$phpBin}\" \"{$bgWorkerScript}\" \"{$sseEndpoint}\" \"{$sessionCookie}\" \"{$flagFile}\"";
$proc = proc_open($cmd, [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
], $pipes);

$sseConnected = false;
for ($i = 0; $i < 30; $i++) {
    if (file_exists($flagFile) && str_contains(file_get_contents($flagFile), 'connected')) {
        $sseConnected = true;
        break;
    }
    usleep(100000); // 100ms
}

check($sseConnected, "Tiến trình nền đã kết nối và đang stream SSE với session cookie");

// Chờ thêm 300ms đảm bảo request SSE đã chạy vào loop chính
usleep(300000);

// Bước 2.4: Trong lúc SSE đang stream, gọi route=songs với cùng sessionCookie
$startTime = microtime(true);
$chSongs = curl_init("{$baseUrl}/api/index.php?route=songs");
curl_setopt_array($chSongs, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_COOKIE => $sessionCookie,
    CURLOPT_TIMEOUT => 15
]);
$songsBody = curl_exec($chSongs);
$elapsedSec = microtime(true) - $startTime;
$songsCode = (int)curl_getinfo($chSongs, CURLINFO_HTTP_CODE);
curl_close($chSongs);

echo "Thời gian gọi route=songs khi SSE đang stream: " . round($elapsedSec, 3) . "s (HTTP {$songsCode})\n";

check($songsCode === 200, "route=songs trả về HTTP 200 thành công");
check($elapsedSec < 1.0, "route=songs hoàn thành trong < 1.0s (không bị block bởi session lock của SSE; thực tế: " . round($elapsedSec, 3) . "s)");

// Dọn dẹp tài nguyên
@proc_terminate($proc);
foreach ($pipes as $p) {
    if (is_resource($p)) @fclose($p);
}
// Chờ tiến trình nền và kết nối SSE trên Apache đóng hoàn toàn
usleep(600000);
for ($att = 0; $att < 5; $att++) {
    $rFiles = glob(__DIR__ . "/../../storage/data/live_sync/{$testRoom}*");
    if (empty($rFiles)) break;
    foreach ($rFiles as $rf) {
        @unlink($rf);
    }
    usleep(200000);
}
@unlink($flagFile);
@unlink($bgWorkerScript);

echo "\n----------------------------------------\n";
if (empty($failures)) {
    echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "KẾT QUẢ: " . count($failures) . " KIỂM TRA THẤT BẠI (FAIL).\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}
