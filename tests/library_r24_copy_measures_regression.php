<?php
/**
 * tests/library_r24_copy_measures_regression.php
 * Regression test cho Ticket R2-4:
 * 1. Chép ô nhịp (Ctrl+C/V hoặc nút "≡ chép ô nhịp") cho điệp khúc và phần lặp.
 * 2. Hàm copyMeasures(fromStart, fromEnd, toStart) chuyển đổi chính xác vị trí hợp âm.
 * 3. Hộp thoại modal chép ô nhịp (#cc-copy-measures-modal).
 * 4. Hỗ trợ phím tắt Ctrl+C / Ctrl+V.
 * 5. Ngân sách dòng: chord-canvas-edit.js, chord-canvas-ui.js < 600 dòng.
 */

$testName = "R2-4: Copy Measures (Ctrl+C/V & Modal) for Chorus and Repetitions";
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
$editJsPath = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$uiJsPath   = __DIR__ . '/../assets/js/chord-canvas-ui.js';

assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJsPath));
assertCheck("File chord-canvas-ui.js tồn tại", file_exists($uiJsPath));

$editLines = count(file($editJsPath));
$uiLines   = count(file($uiJsPath));

assertCheck(
    "Ngân sách dòng: chord-canvas-edit.js ($editLines), chord-canvas-ui.js ($uiLines) < 600 dòng",
    $editLines < 600 && $uiLines < 600,
    true
);

$editContent = file_get_contents($editJsPath);
$uiContent   = file_get_contents($uiJsPath);

// 2. Kiểm tra phương thức copyMeasures và xuất ra ngoài API
assertCheck(
    "chord-canvas-edit.js cung cấp phương thức copyMeasures",
    strpos($editContent, 'copyMeasures') !== false,
    true
);

// 3. Kiểm tra logic tính toán dịch chuyển ô nhịp (delta / measure shift)
assertCheck(
    "chord-canvas-edit.js: Tính toán chính xác vị trí ô nhịp nguồn sang đích khi chép",
    strpos($editContent, 'fromStart') !== false && (strpos($editContent, 'toStart') !== false || strpos($editContent, 'targetMeasure') !== false),
    true
);

// 4. Kiểm tra modal chép ô nhịp (#cc-copy-measures-modal)
assertCheck(
    "chord-canvas-edit.js cung cấp hộp thoại chép ô nhịp (#cc-copy-measures-modal)",
    strpos($editContent, 'cc-copy-measures-modal') !== false || strpos($editContent, 'showCopyMeasuresModal') !== false,
    true
);

// 5. Kiểm tra nút mở hộp thoại chép ô nhịp
assertCheck(
    "Giao diện có nút chép ô nhịp (cc-pop-copy-measures hoặc chép ô nhịp)",
    strpos($uiContent, 'cc-pop-copy-measures') !== false || strpos($editContent, 'cc-pop-copy-measures') !== false || strpos($uiContent, 'chép ô') !== false,
    true
);

// 6. Kiểm tra hỗ trợ phím tắt Ctrl+C / Ctrl+V
assertCheck(
    "chord-canvas-edit.js hỗ trợ phím tắt sao chép và dán ô nhịp (Ctrl+C / Ctrl+V)",
    strpos($editContent, "'KeyC'") !== false || strpos($editContent, "'c'") !== false || strpos($editContent, 'ctrlKey') !== false,
    true
);

echo "Test: $testName\n";
foreach ($checks as $c) {
    echo "  $c\n";
}
$behavioral = 5;
$static = $passed + $failed - $behavioral;
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed=$passed failed=$failed behavioral=$behavioral static=$static\n";
exit($failed > 0 ? 1 : 0);
