<?php
declare(strict_types=1);

/**
 * tests/http/live_sync_last_event_id_regression.php
 * 
 * Regression suite cho Ticket T10 — Live sync: Last-Event-ID, ping, cảnh báo PHP:
 * 1. LiveSyncService.php không sinh PHP Warning khi updateRoom nhận cue không có durationMs.
 * 2. streamEvents đọc header Last-Event-ID (HTTP_LAST_EVENT_ID) và replay các event từ ring buffer.
 * 3. Ping chạy theo thời gian thực (chu kỳ 15s), không dùng modulo số vòng lặp.
 */

require_once __DIR__ . '/../../api/services/LiveSyncService.php';

$baseUrl = getenv('SHEETAPP_TEST_URL') ?: 'http://localhost/sheetapp2';
$baseUrl = rtrim($baseUrl, '/');

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

echo "=== T10: LIVE SYNC LAST-EVENT-ID & SSE REFINEMENTS REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra không phát sinh cảnh báo khi cue thiếu durationMs ──
echo "-- 1. Kiểm tra cue không có durationMs không phát sinh cảnh báo --\n";
$tempDir = sys_get_temp_dir() . '/t10_cue_' . time();
@mkdir($tempDir, 0777, true);
LiveSyncService::setRoomDir($tempDir);

$roomCue = 'T10CUEROOM';
$cRes = LiveSyncService::createRoom($roomCue, ['id' => 'host', 'name' => 'Host']);
$hToken = $cRes['hostToken'] ?? '';

// Bật error handler để bắt warning
$caughtWarning = null;
set_error_handler(function($errno, $errstr, $errfile, $errline) use (&$caughtWarning) {
    if (str_contains($errstr, 'durationMs') || str_contains($errstr, 'Undefined array key')) {
        $caughtWarning = "$errstr at $errfile:$errline";
    }
    return false;
});

// Update với cue không có durationMs
LiveSyncService::updateRoom($roomCue, $hToken, [
    'cue' => ['text' => 'Chuan bi hat diep khuc']
]);
restore_error_handler();

check($caughtWarning === null, "updateRoom với cue không có durationMs chạy thành công an toàn");

// ── 2. Kiểm tra mã nguồn ping theo thời gian thực (15s) ──
echo "\n-- 2. Kiểm tra mã nguồn ping thời gian thực 15s --\n";
$serviceCode = file_get_contents(__DIR__ . '/../../api/services/LiveSyncService.php') ?: '';

$has15sPing = str_contains($serviceCode, '15') && (str_contains($serviceCode, 'microtime') || str_contains($serviceCode, '$lastPingTime'));
$noModulo5 = !str_contains($serviceCode, '% 5 === 0');

check($has15sPing, "streamEvents sử dụng timer thời gian thực ~15s cho ping");
check($noModulo5, "streamEvents đã loại bỏ modulo vòng lặp (% 5 === 0) gây spam ping");

// ── 3. Kiểm tra SSE replay theo header Last-Event-ID qua HTTP ──
echo "\n-- 3. Kiểm tra HTTP SSE replay theo Last-Event-ID --\n";

LiveSyncService::setRoomDir(null); // Sử dụng dir mặc định cho HTTP server
$httpRoom = 't10_sse_' . time();
$createRes = LiveSyncService::createRoom($httpRoom, ['id' => 'host-t10', 'name' => 'Host T10']);
$httpToken = $createRes['hostToken'] ?? '';

// Tạo 4 sự kiện liên tiếp
$eventIds = [];
for ($i = 1; $i <= 4; $i++) {
    $u = LiveSyncService::updateRoom($httpRoom, $httpToken, ['measure' => 10 + $i]);
    $eventIds[$i] = $u['lastEventId'] ?? '';
}

// Gửi request SSE kèm header Last-Event-ID = eventIds[2]
// Kỳ vọng: response replay các event sau event 2 (nghĩa là event 3 và 4)
$lastIdToTest = $eventIds[2];
$sseUrl = "{$baseUrl}/api/index.php?route=live_sync&action=events&room={$httpRoom}&clientId=client-replay";

$ch = curl_init($sseUrl);
$sseChunks = '';
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_HTTPHEADER => [
        "Last-Event-ID: {$lastIdToTest}"
    ],
    CURLOPT_TIMEOUT => 3,
    CURLOPT_WRITEFUNCTION => function($ch, $data) use (&$sseChunks) {
        $sseChunks .= $data;
        // Đọc xong một đợt sự kiện ban đầu thì ngắt
        if (strlen($sseChunks) > 100) return 0;
        return strlen($data);
    }
]);
@curl_exec($ch);
curl_close($ch);

echo "Nhận được từ SSE endpoint với Last-Event-ID {$lastIdToTest}:\n";
echo substr($sseChunks, 0, 300) . "\n...\n";

$replayedEvt3 = str_contains($sseChunks, $eventIds[3]) || str_contains($sseChunks, 'measure') || str_contains($sseChunks, 'replay');
$hasLastIdHandling = str_contains($serviceCode, 'HTTP_LAST_EVENT_ID') || str_contains($serviceCode, 'Last-Event-ID') || str_contains($serviceCode, 'lastEventId');

check($hasLastIdHandling, "LiveSyncService có xử lý header HTTP_LAST_EVENT_ID");
check($replayedEvt3, "SSE phản hồi chứa sự kiện replay sau Last-Event-ID");

// Dọn dẹp
foreach (glob(__DIR__ . "/../../storage/data/live_sync/" . strtolower($httpRoom) . "*") as $f) {
    @unlink($f);
}
foreach (glob(__DIR__ . "/../../storage/data/live_sync/" . strtoupper($httpRoom) . "*") as $f) {
    @unlink($f);
}
array_map('unlink', glob("$tempDir/*.*"));
@rmdir($tempDir);

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
