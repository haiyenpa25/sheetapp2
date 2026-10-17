<?php
declare(strict_types=1);
$suiteTotalChecks = 0;

/**
 * tests/http/test_suite_hygiene_regression.php
 * 
 * Ticket T03 — Vệ sinh bộ test:
 * 1. LiveSyncService cho phép truyền thư mục lưu phòng qua biến môi trường hoặc setRoomDir().
 * 2. tests/run_all_tests.php tự động quét các file regression thay vì liệt kê tay.
 * 3. tests/run_all_tests.php đếm số pass/fail thật từ output, không in chuỗi cứng (7/7).
 * 4. tests/run_all_tests.php coi PHP Warning / Deprecated là FAIL.
 * 5. tests/run_all_tests.php kiểm tra không có file mới rò rỉ vào storage/data/live_sync/.
 * 6. members_manager_consolidation_regression.php bỏ $cannotDemoteWhenOnlyOne = true, gọi service thật.
 * 7. core_rules_regression.php bỏ (2 ?? 0) === 2 và str_contains($svc, "return;").
 * 8. Dọn sạch các file test cũ trong storage/data/live_sync/ (mục O4 đã được duyệt).
 */

$root = dirname(__DIR__, 2);
require_once $root . '/api/services/LiveSyncService.php';

$failures = [];

function check(bool $condition, string $message): void {
    global $suiteTotalChecks;
    $suiteTotalChecks++;
    global $failures;
    if ($condition) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        $failures[] = $message;
    }
}

echo "=== T03: TEST SUITE HYGIENE REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra LiveSyncService hỗ trợ custom roomDir ──
echo "-- 1. Kiểm tra LiveSyncService cấu hình thư mục lưu phòng --\n";
check(method_exists('LiveSyncService', 'setRoomDir'), "LiveSyncService có phương thức tĩnh setRoomDir()");

$tmpDir = sys_get_temp_dir() . '/sheetapp_t03_ls_' . bin2hex(random_bytes(4));
if (method_exists('LiveSyncService', 'setRoomDir')) {
    LiveSyncService::setRoomDir($tmpDir);
    $testRoom = 'T03ROOM_' . strtoupper(bin2hex(random_bytes(3)));
    $res = LiveSyncService::createRoom($testRoom, ['leader' => 'T03 Tester']);
    $expectedFile = $tmpDir . '/' . strtolower($testRoom) . '.json';
    check(file_exists($expectedFile), "Phòng Live Sync được lưu vào thư mục tạm được cấu hình: {$expectedFile}");
    if (file_exists($expectedFile)) {
        @unlink($expectedFile);
    }
    @rmdir($tmpDir);
    LiveSyncService::setRoomDir(null);
}

// ── 2. Kiểm tra tests/run_all_tests.php không hardcode danh sách và đếm số check thật ──
echo "\n-- 2. Kiểm tra tests/run_all_tests.php tự động quét & đếm check thật --\n";
$runnerSrc = file_get_contents($root . '/tests/run_all_tests.php') ?: '';

$hasDynamicScan = str_contains($runnerSrc, "glob(") || str_contains($runnerSrc, "RecursiveIteratorIterator");
$noHardcodedCounts = !str_contains($runnerSrc, "'core_rules_regression.php (CR1-a/b, CR2-a/b, CR3-a/b, CR4-a/b/c đạt 9/9)'")
    && !str_contains($runnerSrc, "'setlist_cr4_regression.php (Setlist đồng bộ profile, tông, BPM 6/6)'");
$checksWarnings = str_contains($runnerSrc, "Warning") || str_contains($runnerSrc, "Deprecated");
$checksLiveSyncLeaks = str_contains($runnerSrc, "live_sync") && (str_contains($runnerSrc, "scandir") || str_contains($runnerSrc, "glob"));

check($hasDynamicScan, "run_all_tests.php tự động quét các file regression suite");
check($noHardcodedCounts, "run_all_tests.php không in chuỗi số lượng check cứng");
check($checksWarnings, "run_all_tests.php coi Warning và Deprecated là lỗi FAIL");
check($checksLiveSyncLeaks, "run_all_tests.php kiểm tra và chặn rò rỉ file vào storage/data/live_sync/");

// ── 3. Kiểm tra các check luôn đúng đã được loại bỏ ──
echo "\n-- 3. Kiểm tra loại bỏ các check luôn đúng --\n";
$mmSrc = file_get_contents($root . '/tests/members_manager_consolidation_regression.php') ?: '';
check(!str_contains($mmSrc, '$cannotDemoteWhenOnlyOne = true;'), "members_manager_consolidation_regression.php đã bỏ '\$cannotDemoteWhenOnlyOne = true;'");

$crSrc = file_get_contents($root . '/tests/core_rules_regression.php') ?: '';
check(!str_contains($crSrc, '(2 ?? 0) === 2'), "core_rules_regression.php đã bỏ '(2 ?? 0) === 2'");
check(!str_contains($crSrc, 'str_contains($chordSvcSrc, "return;")'), "core_rules_regression.php đã bỏ 'str_contains(\$chordSvcSrc, \"return;\")'");

// ── 4. Kiểm tra thư mục storage/data/live_sync/ đã được dọn sạch file test cũ ──
echo "\n-- 4. Kiểm tra dọn sạch file test trong storage/data/live_sync/ --\n";
$liveSyncFiles = glob($root . '/storage/data/live_sync/*.json') ?: [];
$testFiles = array_filter($liveSyncFiles, function($f) {
    $base = basename($f);
    return str_starts_with($base, 'test-') || str_starts_with($base, 'regtest_') || str_starts_with($base, 'sec-');
});

check(empty($testFiles), "Không còn file test rác (test-*, regtest_*, sec-*) trong storage/data/live_sync/ (còn: " . count($testFiles) . ")");

echo "\n----------------------------------------\n";
if (!empty($failures)) {
    echo "KẾT QUẢ: " . count($failures) . " kiểm tra THẤT BẠI.\n";
    exit(1);
}

echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";

echo "\nSUITE_COMPLETE total={$suiteTotalChecks}\n";
exit(0);
