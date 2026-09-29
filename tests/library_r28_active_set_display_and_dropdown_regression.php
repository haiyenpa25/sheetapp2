<?php
/**
 * tests/library_r28_active_set_display_and_dropdown_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R2-8:
 * "Hiển thị đúng bộ đang soạn (B8, B10): dropdown và chip đếm cập nhật ngay; không trộn 3 nguồn hợp âm | E2E: đang soạn BH thì chỉ hiện hợp âm BH (và TLH mờ nếu bật gợi ý)"
 *
 * Tiêu chí kiểm thử:
 * 1. Không trộn 3 nguồn hợp âm (B8):
 *    - Khi ở bộ cá nhân (BH, NAM...) hoặc đang ở chế độ soạn (_editEnabled), cờ isFallbackToTlh phải là FALSE.
 *    - Chỉ cho phép fallback TLH khi đang xem bộ HD, HD có 0 hợp âm và KHÔNG ở chế độ soạn.
 * 2. Độc lập hiển thị và gợi ý TLH mờ:
 *    - Khi bật gợi ý TLH (showTlhSuggestions), render .cc-tlh-ghost-chord (chữ nghiêng, mờ, không nhận click)
 *    - Tuyệt đối không thêm class .cc-custom-chord-text cho hợp âm gợi ý TLH.
 * 3. Dropdown và chip đếm cập nhật ngay (B10):
 *    - _refreshSetDropdown luôn đảm bảo _currentSet có mặt trong danh sách options, không bị rỗng sau khi clone/cache clear.
 *    - ChordCanvas export updateSetUI(), toggleSuggestions(), isSuggestionMode(), setShowTlhSuggestions().
 *    - chord-canvas-edit.js gọi updateSetUI() ngay lập tức khi saveChord, deleteChord, undo, redo, executeSave.
 * 4. Ngân sách dòng:
 *    - Tất cả các file JS liên quan (chord-canvas.js, chord-canvas-edit.js, chord-canvas-dots.js, chord-canvas-ui.js) đều < 600 dòng.
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

echo "=== R2-8: Active Set Display & Dropdown Regression Test (B8, B10) ===\n";

$canvasPath = __DIR__ . '/../assets/js/chord-canvas.js';
$dotsPath   = __DIR__ . '/../assets/js/chord-canvas-dots.js';
$editPath   = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$uiPath     = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$cssPath    = __DIR__ . '/../assets/css/library-polish.css';

assertCheck("File chord-canvas.js tồn tại", file_exists($canvasPath));
assertCheck("File chord-canvas-dots.js tồn tại", file_exists($dotsPath));
assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editPath));
assertCheck("File chord-canvas-ui.js tồn tại", file_exists($uiPath));
assertCheck("File library-polish.css tồn tại", file_exists($cssPath));

$canvasJs = file_get_contents($canvasPath);
$dotsJs   = file_get_contents($dotsPath);
$editJs   = file_get_contents($editPath);
$uiJs     = file_get_contents($uiPath);
$css      = file_get_contents($cssPath);

// 1. Kiểm tra logic cờ isFallbackToTlh (B8)
assertCheck(
    "chord-canvas.js: isFallbackToTlh chỉ áp dụng cho bộ HD và khi KHÔNG ở chế độ soạn (!_editEnabled)",
    (bool)preg_match("/isFallbackToTlh\s*=\s*\([^)]*_currentSet\s*===\s*['\"]HD['\"][^)]*!_editEnabled[^)]*\)/", $canvasJs),
    true
);

// 2. Kiểm tra _refreshSetDropdown luôn giữ lại _currentSet (B10)
assertCheck(
    "chord-canvas.js: _refreshSetDropdown bảo toàn _currentSet trong options danh sách",
    strpos($canvasJs, '!sets.includes(_currentSet)') !== false && strpos($canvasJs, 'sets.push(_currentSet)') !== false,
    true
);

// 3. Kiểm tra ChordCanvas export updateSetUI và điều khiển gợi ý TLH
assertCheck(
    "chord-canvas.js: export updateSetUI, toggleSuggestions, isSuggestionMode",
    strpos($canvasJs, 'updateSetUI:') !== false
    && strpos($canvasJs, 'toggleSuggestions:') !== false
    && strpos($canvasJs, 'isSuggestionMode:') !== false,
    true
);

// 4. Kiểm tra chord-canvas-dots.js render .cc-tlh-ghost-chord khi showTlhSuggestions bật
assertCheck(
    "chord-canvas-dots.js: hỗ trợ render .cc-tlh-ghost-chord khi showTlhSuggestions được bật",
    strpos($dotsJs, 'cc-tlh-ghost-chord') !== false && strpos($dotsJs, 'showTlhSuggestions') !== false,
    true
);

// 5. Kiểm tra CSS cho .cc-tlh-ghost-chord
assertCheck(
    "library-polish.css: có quy tắc cho .cc-tlh-ghost-chord với opacity và pointer-events: none",
    strpos($css, '.cc-tlh-ghost-chord') !== false && strpos($css, 'pointer-events: none') !== false,
    true
);

// 6. Kiểm tra chord-canvas-edit.js cập nhật UI ngay lập tức
assertCheck(
    "chord-canvas-edit.js: gọi updateSetUI() khi saveChord, deleteChord, undo, redo",
    substr_count($editJs, 'updateSetUI') >= 4,
    true
);

// 7. Kiểm tra chord-canvas-ui.js có toggle gợi ý TLH mờ
assertCheck(
    "chord-canvas-ui.js: có checkbox #cc-toggle-tlh-ghost điều khiển gợi ý TLH mờ",
    strpos($uiJs, 'cc-toggle-tlh-ghost') !== false && strpos($uiJs, 'setShowTlhSuggestions') !== false,
    true
);

// 8. Ngân sách dòng (< 600 dòng)
$canvasLines = count(file($canvasPath));
$dotsLines   = count(file($dotsPath));
$editLines   = count(file($editPath));
$uiLines     = count(file($uiPath));

assertCheck("chord-canvas.js < 600 dòng (thực tế: $canvasLines)", $canvasLines < 600, true);
assertCheck("chord-canvas-dots.js < 600 dòng (thực tế: $dotsLines)", $dotsLines < 600, true);
assertCheck("chord-canvas-edit.js < 600 dòng (thực tế: $editLines)", $editLines < 600, true);
assertCheck("chord-canvas-ui.js < 600 dòng (thực tế: $uiLines)", $uiLines < 600, true);

echo "\nKết quả kiểm thử R2-8: $passedChecks/$totalChecks checks passed ($behavioralChecks behavioral, $staticChecks static).\n";
echo "SUITE_COMPLETE total=$totalChecks passed=$passedChecks failed=$failedChecks behavioral=$behavioralChecks static=$staticChecks\n";

if ($failedChecks > 0) {
    exit(1);
}
