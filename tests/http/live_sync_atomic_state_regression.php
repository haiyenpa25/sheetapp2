<?php
declare(strict_types=1);

/**
 * tests/http/live_sync_atomic_state_regression.php
 * 
 * Regression suite cho Ticket T09 — Live sync: ghi trạng thái phòng nguyên tử:
 * 1. Kiểm tra cấu trúc file:
 *    - File presence được tách riêng ({room}.presence.json)
 *    - Follower ghi presence không bao giờ ghi đè vào file state của host ({room}.json)
 *    - Sử dụng flock(LOCK_EX) trên file khoá riêng và atomic rename(tmp, final)
 * 2. Đọc file hỏng (corrupted/empty) thử lại 3 lần; nếu vẫn hỏng trả active: false (closed).
 * 3. Kiểm thử đồng thời (Concurrency Test) bằng 2 tiến trình PHP chạy song song:
 *    - Tiến trình Host: cập nhật state 200 lần liên tục
 *    - Tiến trình Follower: poll & ghi presence 200 lần liên tục
 *    - Kỳ vọng: revision cuối cùng = 201 (1 khởi tạo + 200 cập nhật), không mất revision, không lùi revision.
 */

require_once __DIR__ . '/../../api/services/LiveSyncService.php';

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

echo "=== T09: LIVE SYNC ATOMIC STATE & CONCURRENCY REGRESSION SUITE ===\n\n";

$tempDir = sys_get_temp_dir() . '/t09_atomic_' . time() . '_' . bin2hex(random_bytes(3));
@mkdir($tempDir, 0777, true);
LiveSyncService::setRoomDir($tempDir);

// ── 1. Kiểm tra thiết kế mã nguồn ──
echo "-- 1. Kiểm tra mã nguồn LiveSyncService --\n";
$serviceCode = file_get_contents(__DIR__ . '/../../api/services/LiveSyncService.php') ?: '';

$hasSeparatePresence = str_contains($serviceCode, '.presence.json');
$hasAtomicRename     = str_contains($serviceCode, 'rename(');
$hasDedicatedLock    = str_contains($serviceCode, '.lock') || str_contains($serviceCode, 'lockFile');
$hasRetryRead        = str_contains($serviceCode, 'retry') || (str_contains($serviceCode, 'for ($') && str_contains($serviceCode, 'json_decode'));

check($hasSeparatePresence, "LiveSyncService tách presence ra file riêng .presence.json");
check($hasDedicatedLock, "LiveSyncService sử dụng file khoá riêng (.lock)");
check($hasAtomicRename, "LiveSyncService ghi file tạm rồi dùng rename() nguyên tử");

// ── 2. Kiểm thử đồng thời 2 tiến trình thật (Concurrency Test: 200 host vs 200 follower) ──
echo "\n-- 2. Kiểm thử đồng thời 200 Host Updates vs 200 Follower Presence Polls --\n";

$room = 'T09CONCURRENCY';
$created = LiveSyncService::createRoom($room, ['id' => 'host-user', 'name' => 'Host User']);
$hostToken = $created['hostToken'] ?? '';

check(!empty($hostToken), "Tạo phòng test $room thành công, nhận hostToken");

// Tạo script Host Worker
$hostWorkerScript = $tempDir . '/host_worker.php';
$hostCode = '<?php
require_once "'.addslashes(__DIR__ . '/../../api/services/LiveSyncService.php').'";
LiveSyncService::setRoomDir("'.addslashes($tempDir).'");
$room = $argv[1];
$hostToken = $argv[2];
$logFile = $argv[3];

$history = [];
for ($i = 1; $i <= 200; $i++) {
    $res = LiveSyncService::updateRoom($room, $hostToken, [
        "measure" => $i,
        "beat"    => ($i % 4) + 1,
        "bpm"     => 80 + ($i % 20)
    ]);
    $history[] = [
        "step" => $i,
        "success" => $res["success"] ?? false,
        "revision" => $res["revision"] ?? -1
    ];
    usleep(200); // 0.2ms
}
file_put_contents($logFile, json_encode($history));
';
file_put_contents($hostWorkerScript, $hostCode);

// Tạo script Follower Worker
$followerWorkerScript = $tempDir . '/follower_worker.php';
$followerCode = '<?php
require_once "'.addslashes(__DIR__ . '/../../api/services/LiveSyncService.php').'";
LiveSyncService::setRoomDir("'.addslashes($tempDir).'");
$room = $argv[1];

for ($i = 1; $i <= 200; $i++) {
    LiveSyncService::pollRoom($room, 0, "follower-" . ($i % 4), "singer");
    usleep(200); // 0.2ms
}
';
file_put_contents($followerWorkerScript, $followerCode);

$hostLogFile = $tempDir . '/host_history.json';
$phpBin = 'C:\\xampp\\php\\php.exe';
if (!file_exists($phpBin)) {
    $phpBin = PHP_BINARY;
}

$pHost = proc_open("\"$phpBin\" \"$hostWorkerScript\" \"$room\" \"$hostToken\" \"$hostLogFile\"", [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
], $pipesHost);

$pFollower = proc_open("\"$phpBin\" \"$followerWorkerScript\" \"$room\"", [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
], $pipesFollower);

proc_close($pHost);
proc_close($pFollower);

$hostHistory = json_decode(@file_get_contents($hostLogFile), true) ?? [];
$finalRoomFile = $tempDir . '/' . strtolower($room) . '.json';
$finalData = json_decode(@file_get_contents($finalRoomFile), true);
$finalRevision = $finalData['revision'] ?? null;

echo "Số lần Host đã cập nhật: " . count($hostHistory) . "\n";
echo "Revision cuối cùng lưu trong file phòng: " . var_export($finalRevision, true) . "\n";

// Kiểm tra tính toàn vẹn của revision:
// 1. Phải đạt chính xác 201 (1 ban đầu + 200 lần update)
check($finalRevision === 201, "Revision cuối cùng phải chính xác là 201 (thực tế: " . var_export($finalRevision, true) . ")");

// 2. Không có lần nào revision bị lùi hoặc dậm chân
$hasRegression = false;
$prevRev = 1;
foreach ($hostHistory as $entry) {
    $rev = $entry['revision'] ?? 0;
    if ($rev <= $prevRev && $entry['step'] > 1) {
        $hasRegression = true;
        break;
    }
    $prevRev = $rev;
}
check(!$hasRegression, "Chuỗi revision của Host tăng đơn điệu nghiêm ngặt (không bị lùi hay trùng do race condition)");

// ── 3. Kiểm tra tự phục hồi khi đọc trúng file lỗi ──
echo "\n-- 3. Kiểm tra khả năng tự phục hồi khi đọc file lỗi / corrupt --\n";
$corruptRoom = 'T09CORRUPT';
$createdCorrupt = LiveSyncService::createRoom($corruptRoom, ['id' => 'host', 'name' => 'Host']);
$corruptFile = $tempDir . '/' . strtolower($corruptRoom) . '.json';
// Làm hỏng file hoàn toàn
file_put_contents($corruptFile, '{invalid-json-data');

$corruptPoll = LiveSyncService::pollRoom($corruptRoom, 0);
check($corruptPoll['success'] === true && empty($corruptPoll['active']), "Khi file hỏng không thể phục hồi sau retry, trả về active: false / closed an toàn");

// Dọn dẹp thư mục test tạm
array_map('unlink', glob("$tempDir/*.*"));
@rmdir($tempDir);
LiveSyncService::setRoomDir(null); // Reset về mặc định

echo "\n----------------------------------------\n";
if (empty($failures)) {
    echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";
    echo "\nSUITE_COMPLETE total=7 passed=7 failed=0 behavioral=4 static=3\n";
    exit(0);
} else {
    echo "KẾT QUẢ: " . count($failures) . " KIỂM TRA THẤT BẠI (FAIL).\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}
