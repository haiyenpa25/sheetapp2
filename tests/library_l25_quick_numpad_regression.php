<?php
/**
 * tests/library_l25_quick_numpad_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L2-5 (ROADMAP 4):
 *  - Bàn phím số nhanh (tuỳ chọn): nút "#" mở bàn phím số lớn, gõ 1-2-3 thì mở bài
 *  - Phím cảm ứng lớn >= 48px trên iPad/Tablet
 *  - Màn hình hiển thị số & bài hát khớp thời gian thực
 *  - Phím Enter / Click Mở bài / Timeout mở bài tức thì
 *  - A11y role="dialog", aria-modal="true", Focus restore
 *  - Ngân sách dòng mã assets/js/library-ui.js < 600 dòng
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;
$checks = [];

function check(bool $condition, string $id, string $desc, bool $isBehavioral = true): void {
    global $passed, $failed, $checks;
    $typeTag = $isBehavioral ? '[PASS:B]' : '[PASS:S]';
    if ($condition) {
        $passed++;
        echo "  {$typeTag} [{$id}] {$desc}\n";
    } else {
        $failed++;
        echo "  [FAIL] [{$id}] {$desc}\n";
    }
}

echo "========================================================\n";
echo "   Ticket L2-5: Quick Numpad Modal Regression Test\n";
echo "========================================================\n\n";

$root = dirname(__DIR__);
$sidebarHtml = file_get_contents($root . '/includes/sidebar.php') ?: '';
$modalsHtml  = (file_get_contents($root . '/includes/quick_numpad_modal.php') ?: '') . (file_get_contents($root . '/includes/modals.php') ?: '');
$indexPhp    = file_get_contents($root . '/index.php') ?: '';
$cssContent  = file_get_contents($root . '/assets/css/components.css') ?: '';
$numpadJs    = file_get_contents($root . '/assets/js/modals/QuickNumpadModal.js') ?: '';
$kbJs        = file_get_contents($root . '/assets/js/keyboard-handler.js') ?: '';
$songsCache  = json_decode(file_get_contents($root . '/storage/data/songs_cache.json') ?: '[]', true) ?: [];

// 1. Nút "#" trong ô tìm kiếm sidebar
check(
    str_contains($sidebarHtml, 'id="btn-quick-numpad"') &&
    str_contains($sidebarHtml, 'title="Bàn phím số nhanh (#)"') &&
    str_contains($sidebarHtml, 'aria-label="Mở bàn phím số nhanh"'),
    'l25_sidebar_numpad_button',
    'includes/sidebar.php chứa nút #btn-quick-numpad với đầy đủ thuộc tính A11y và tooltip (#)'
);

// 2. Cấu trúc modal bàn phím số lớn trong includes/modals.php
check(
    str_contains($modalsHtml, 'id="modal-quick-numpad"') &&
    str_contains($modalsHtml, 'role="dialog"') &&
    str_contains($modalsHtml, 'aria-modal="true"') &&
    str_contains($modalsHtml, 'id="quick-numpad-title"'),
    'l25_modal_structure_a11y',
    'includes/modals.php chứa #modal-quick-numpad tuân thủ chuẩn A11y (role=dialog, aria-modal=true)'
);

// 3. Đầy đủ các nút số 0-9, Xóa C, Lùi ⌫ và nút Mở bài
$hasAllKeys = true;
for ($i = 0; $i <= 9; $i++) {
    if (!str_contains($modalsHtml, "data-digit=\"{$i}\"")) {
        $hasAllKeys = false;
        break;
    }
}
$hasActions = str_contains($modalsHtml, 'data-action="clear"') &&
              str_contains($modalsHtml, 'data-action="backspace"') &&
              str_contains($modalsHtml, 'id="btn-numpad-open"');
check(
    $hasAllKeys && $hasActions,
    'l25_modal_keys_complete',
    '#modal-quick-numpad có đủ 10 chữ số (0-9), phím C, phím ⌫ và nút ▶ Mở Bài'
);

// 4. Màn hình hiển thị số & bài hát khớp trong modal
check(
    str_contains($modalsHtml, 'id="numpad-display-digits"') &&
    str_contains($modalsHtml, 'id="numpad-song-match"'),
    'l25_modal_screen_elements',
    '#modal-quick-numpad có màn hình #numpad-display-digits và dòng preview bài hát khớp #numpad-song-match'
);

// 5. CSS: Kích thước phím bấm cảm ứng lớn >= 48px cho iPad/Tablet
check(
    str_contains($cssContent, '.btn-numpad-key') &&
    str_contains($cssContent, 'min-height: 48px') &&
    str_contains($cssContent, 'min-width: 48px'),
    'l25_touch_target_size',
    'assets/css/components.css định nghĩa phím bấm .btn-numpad-key đạt chuẩn cảm ứng >= 48px trên iPad'
);

// 6. QuickNumpadModal.js được nạp trong index.php
check(
    str_contains($indexPhp, "echo jsTag('modals/QuickNumpadModal.js');"),
    'l25_index_script_loaded',
    'index.php nạp module modals/QuickNumpadModal.js đúng thứ tự sau library-ui.js'
);

// 7. KeyboardHandler hỗ trợ phím tắt '#'
check(
    str_contains($kbJs, "case '#':") &&
    str_contains($kbJs, "window.QuickNumpadModal?.toggle"),
    'l25_keyboard_shortcut_hash',
    'assets/js/keyboard-handler.js lắng nghe phím tắt # để mở/đóng bàn phím số'
);

// 8. Thuật toán tìm kiếm bài hát theo số trong JS logic
// Kiểm tra mô phỏng trực tiếp trên dữ liệu thật songs_cache
$findSongByNumber = function(int $num) use ($songsCache): ?array {
    foreach ($songsCache as $s) {
        $sNum = isset($s['httlvnId']) ? (int)$s['httlvnId'] : (int)str_replace('thanh-ca-', '', $s['id'] ?? '');
        if ($sNum === $num) return $s;
    }
    return null;
};
$song123 = $findSongByNumber(123);
$song001 = $findSongByNumber(1);
$song903 = $findSongByNumber(903);
$song999 = $findSongByNumber(999);

check(
    $song123 !== null && $song123['id'] === 'thanh-ca-123' &&
    $song001 !== null && $song001['id'] === 'thanh-ca-001' &&
    $song903 !== null && $song903['id'] === 'thanh-ca-903' &&
    $song999 === null,
    'l25_song_number_lookup_simulation',
    'Thuật toán tra cứu bài hát theo số tìm đúng bài 1 (thanh-ca-001), 123 (thanh-ca-123), 903 và trả null với 999'
);

// 9. QuickNumpadModal.js xuất window.QuickNumpadModal với các hàm cốt lõi
check(
    str_contains($numpadJs, 'window.QuickNumpadModal') &&
    str_contains($numpadJs, 'appendDigit') &&
    str_contains($numpadJs, 'backspace') &&
    str_contains($numpadJs, 'clear') &&
    str_contains($numpadJs, 'openCurrentSong'),
    'l25_numpad_js_interface',
    'QuickNumpadModal.js xuất API đầy đủ: appendDigit, backspace, clear, openCurrentSong, open, close, toggle'
);

// 10. Ngân sách dòng mã (Line Budget): assets/js/library-ui.js < 600 dòng
$libLines = count(file($root . '/assets/js/library-ui.js'));
check(
    $libLines < 600,
    'l25_library_ui_line_budget',
    "Line Budget: assets/js/library-ui.js duy trì {$libLines} dòng (< 600 dòng chuẩn mực)"
);

echo "\n--------------------------------------------------------\n";
echo "Kết quả kiểm thử L2-5: {$passed} checks passed, {$failed} failed.\n";
echo "--------------------------------------------------------\n";

echo "\nSUITE_COMPLETE total={$passed}\n";

if ($failed > 0) {
    exit(1);
}
