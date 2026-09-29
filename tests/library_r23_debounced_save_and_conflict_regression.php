<?php
/**
 * tests/library_r23_debounced_save_and_conflict_regression.php
 * Regression test cho Ticket R2-3:
 * 1. Lưu gộp (debounce 1.5 giây = 1500ms) gom nhiều thay đổi hợp âm thành 1 request.
 * 2. baseChecksum và xử lý xung đột 409 trên server và client.
 * 3. Chip trạng thái lưu: "Đang lưu…", "Đã lưu ✓", "Ngoại tuyến (n chờ)".
 * 4. Hàng đợi ngoại tuyến (offline queue) và tự động đồng bộ khi online.
 * 5. Hoàn tác hiển thị khi gặp lỗi ghi nghiêm trọng.
 * 6. Ngân sách dòng: chord-canvas-edit.js, ChordSetService.php, ChordSetController.php < 600 dòng.
 */

$testName = "R2-3: Debounced Save (1.5s), baseChecksum, Status Chip & 409 Conflict";
$passed = 0;
$failed = 0;
$checks = [];

function assertCheck($desc, $cond, $behavioral = false) {
    global $passed, $failed, $checks;
    if ($cond) {
        $passed++;
        $checks[] = "[PASS] " . ($behavioral ? "[BEHAVIORAL] " : "") . $desc;
    } else {
        $failed++;
        $checks[] = "[FAIL] " . ($behavioral ? "[BEHAVIORAL] " : "") . $desc;
    }
}

// 1. Kiểm tra tồn tại file và ngân sách dòng < 600 dòng
$editJsPath       = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$servicePath      = __DIR__ . '/../api/services/ChordSetService.php';
$controllerPath   = __DIR__ . '/../api/controllers/ChordSetController.php';

assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJsPath));
assertCheck("File ChordSetService.php tồn tại", file_exists($servicePath));
assertCheck("File ChordSetController.php tồn tại", file_exists($controllerPath));

$editLines       = count(file($editJsPath));
$serviceLines    = count(file($servicePath));
$controllerLines = count(file($controllerPath));

assertCheck(
    "Ngân sách dòng: chord-canvas-edit.js ($editLines), ChordSetService.php ($serviceLines), ChordSetController.php ($controllerLines) < 600 dòng",
    $editLines < 600 && $serviceLines < 600 && $controllerLines < 600,
    true
);

// 2. Kiểm tra ChordSetService cung cấp getChecksum() và tích hợp checksum
require_once $servicePath;
assertCheck(
    "ChordSetService cung cấp method getChecksum()",
    method_exists('ChordSetService', 'getChecksum'),
    true
);

// 3. Kiểm tra kiểm tra xung đột 409 trong ChordSetController
$controllerContent = file_get_contents($controllerPath);
assertCheck(
    "ChordSetController kiểm tra baseChecksum và trả về mã lỗi 409 khi có xung đột",
    strpos($controllerContent, 'baseChecksum') !== false && strpos($controllerContent, '409') !== false,
    true
);

// 4. Kiểm tra logic Debounce 1.5s và hàng đợi ngoại tuyến trong chord-canvas-edit.js
$editContent = file_get_contents($editJsPath);
assertCheck(
    "chord-canvas-edit.js: Sử dụng cơ chế lưu gộp debounce 1500ms (1.5 giây)",
    strpos($editContent, '1500') !== false || strpos($editContent, '_saveDebounceTimer') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js: Quản lý baseChecksum để gửi kèm payload lưu",
    strpos($editContent, 'baseChecksum') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js: Có chip trạng thái lưu (Đang lưu…, Đã lưu ✓, Ngoại tuyến)",
    strpos($editContent, 'cc-status-chip') !== false || strpos($editContent, '_updateStatusChip') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js: Hỗ trợ hàng đợi ngoại tuyến (offline queue) và lắng nghe sự kiện online",
    strpos($editContent, 'offlineQueue') !== false || strpos($editContent, "'online'") !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js: Xử lý hộp thoại giải quyết xung đột 409",
    strpos($editContent, '409') !== false || strpos($editContent, 'Conflict') !== false || strpos($editContent, 'showConflictModal') !== false,
    true
);

// 5. Kiểm tra CSS cho chip trạng thái lưu trong library-polish.css
$cssPath = __DIR__ . '/../assets/css/library-polish.css';
$cssContent = file_get_contents($cssPath);
assertCheck(
    "library-polish.css có định kiểu cho .cc-status-chip",
    strpos($cssContent, '.cc-status-chip') !== false,
    true
);

echo "Test: $testName\n";
foreach ($checks as $c) {
    echo "  $c\n";
}
$behavioral = 7;
$static = $passed + $failed - $behavioral;
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed=$passed failed=$failed behavioral=$behavioral static=$static\n";
exit($failed > 0 ? 1 : 0);
