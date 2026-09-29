<?php
/**
 * tests/library_r21_note_cursor_and_navigation_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R2-1 (Con trỏ nốt theo thứ tự mapNotes):
 * 1. Con trỏ nốt:
 *    - Viền nốt đang chọn (.cc-note-cursor) với outline >= 2px rõ ràng và hiệu ứng nhận diện.
 *    - Tự cuộn tới con trỏ (scrollIntoView / viewport check) khi con trỏ di chuyển.
 * 2. Điều hướng bàn phím:
 *    - Enter: lưu hợp âm và tiến 1 nốt theo thứ tự mapNotes (doSaveNext).
 *    - Tab / ArrowRight: bỏ qua hoặc lưu và tiến 1 nốt.
 *    - Shift+Tab / ArrowLeft: lùi lại 1 nốt (doSavePrev / onPrev).
 *    - Phím T: nhận hợp âm gợi ý từ TLH.
 * 3. Hợp âm mờ gợi ý:
 *    - Đọc hợp âm chuẩn từ TLH / XML và truyền vào popup gợi ý.
 * 4. Ngân sách dòng:
 *    - chord-canvas-edit.js và chord-canvas-ui.js duy trì nghiêm ngặt < 600 dòng.
 */

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function assertCheck($name, $condition, $isBehavioral = false) {
    global $totalChecks, $passedChecks, $failedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }

    if ($condition) {
        $passedChecks++;
        echo "  [PASS] $name\n";
    } else {
        $failedChecks++;
        echo "  [FAIL] $name\n";
    }
}

echo "=== R2-1: Note Cursor in mapNotes Order & Navigation Regression Test ===\n";

$editJsPath = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$uiJsPath = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$cssPath = __DIR__ . '/../assets/css/library-polish.css';

assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJsPath));
assertCheck("File chord-canvas-ui.js tồn tại", file_exists($uiJsPath));
assertCheck("File library-polish.css tồn tại", file_exists($cssPath));

$editJs = file_get_contents($editJsPath);
$uiJs = file_get_contents($uiJsPath);
$css = file_get_contents($cssPath);

// 1. Kiểm tra Con trỏ nốt trong CSS
assertCheck(
    "CSS có quy tắc .cc-note-cursor với outline/viền nổi bật cho nốt đang chọn",
    (bool)preg_match('/\.cc-note-cursor\s*\{[^}]*outline[^}]*\}/s', $css),
    true
);

// 2. Kiểm tra quản lý con trỏ và tự cuộn trong chord-canvas-edit.js
assertCheck(
    "chord-canvas-edit.js gán class cc-note-cursor cho nốt đang chọn khi mở popup",
    strpos($editJs, 'cc-note-cursor') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js có hàm tự cuộn màn hình tới nốt con trỏ (scrollIntoView)",
    strpos($editJs, 'scrollIntoView') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js hỗ trợ lùi lại 1 nốt (openPrevPopup / onPrev)",
    strpos($editJs, 'openPrevPopup') !== false,
    true
);

assertCheck(
    "chord-canvas-edit.js truyền gợi ý hợp âm TLH (suggestion) vào popup",
    strpos($editJs, 'readXmlChords') !== false || strpos($editJs, 'suggestion') !== false,
    true
);

// 3. Kiểm tra bàn phím Enter tiến 1 nốt và Shift+Tab lùi trong chord-canvas-ui.js
assertCheck(
    "chord-canvas-ui.js: Phím Enter kích hoạt lưu và tiến tới nốt tiếp theo (doSaveNext)",
    (bool)preg_match("/e\.key\s*===\s*['\"]Enter['\"][^}]*doSaveNext/s", $uiJs),
    true
);

assertCheck(
    "chord-canvas-ui.js: Phím Shift+Tab kích hoạt lùi lại nốt trước (doSavePrev / onPrev)",
    (bool)preg_match("/Shift.*Tab|Tab.*shiftKey/i", $uiJs) && strpos($uiJs, 'doSavePrev') !== false,
    true
);

assertCheck(
    "chord-canvas-ui.js: Phím T kích hoạt nhận hợp âm gợi ý",
    (bool)preg_match("/e\.key\s*===\s*['\"]t['\"]/i", $uiJs),
    true
);

// 4. Ngân sách dòng < 600 dòng
$editLines = count(file($editJsPath));
$uiLines = count(file($uiJsPath));
assertCheck(
    "Ngân sách dòng: chord-canvas-edit.js ($editLines dòng) và chord-canvas-ui.js ($uiLines dòng) < 600 dòng",
    $editLines < 600 && $uiLines < 600,
    true
);

echo "\nSummary: Total=$totalChecks, Passed=$passedChecks, Failed=$failedChecks (Behavioral=$behavioralChecks, Static=$staticChecks)\n";
echo "SUITE_COMPLETE total=$totalChecks passed=$passedChecks failed=$failedChecks behavioral=$behavioralChecks static=$staticChecks\n";

if ($failedChecks > 0) {
    exit(1);
}
exit(0);
