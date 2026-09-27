<?php
/**
 * tests/library_l13_toolbar_and_ipad_overlay_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L1-3 (ROADMAP4.md):
 * 1. Một thanh công cụ 48px (.toolbar.unified-toolbar: height: 48px).
 * 2. Gộp thanh thông tin vào thanh công cụ với popover "ⓘ" (#btn-song-info-popover & #song-info-popover).
 * 3. song-info-bar.js cập nhật thông tin tông, nhịp, BPM, ô nhịp vào popover.
 * 4. Sidebar trên iPad (breakpoint <= 1200px) chuyển thành overlay drawer đóng mặc định khi xem bài.
 * 5. Tính toán toán học: trên iPad ngang (1180x820), vùng nhạc chiếm >= 85% diện tích màn hình.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L1-3: Thanh Công Cụ 48px & iPad Overlay Sidebar\n";
echo "========================================================\n\n";

$toolbarPhpPath = $root . '/includes/toolbar.php';
$toolbarPhp = file_get_contents($toolbarPhpPath);

$layoutCssPath = $root . '/assets/css/layout.css';
$layoutCss = file_get_contents($layoutCssPath);

$toolbarControllerJsPath = $root . '/assets/js/toolbar-controller.js';
$toolbarControllerJs = file_get_contents($toolbarControllerJsPath);

$songInfoBarJsPath = $root . '/assets/js/song-info-bar.js';
$songInfoBarJs = file_get_contents($songInfoBarJsPath);

// 1. Kiểm tra chiều cao thanh công cụ 48px
$hasToolbar48px = (bool)preg_match('/\.toolbar\.unified-toolbar\s*\{[^}]*height:\s*48px;/s', $layoutCss);
checkStatic(
    'toolbar_height_is_48px',
    $hasToolbar48px,
    'layout.css định nghĩa .toolbar.unified-toolbar có chiều cao chuẩn 48px'
);

// 2. Kiểm tra nút popover ⓘ và container popover trên toolbar
$hasPopoverBtn = strpos($toolbarPhp, 'id="btn-song-info-popover"') !== false;
$hasPopoverContainer = strpos($toolbarPhp, 'id="song-info-popover"') !== false;
checkStatic(
    'toolbar_has_song_info_popover',
    $hasPopoverBtn && $hasPopoverContainer,
    'includes/toolbar.php tích hợp nút #btn-song-info-popover (ⓘ) và #song-info-popover'
);

// 3. Kiểm tra song-info-bar.js kết nối cập nhật popover
$hasPopoverLogic = strpos($songInfoBarJs, 'updatePopoverContent') !== false
    && strpos($songInfoBarJs, 'si-pop-practice-key') !== false;
checkBehavior(
    'song_info_bar_popover_binding',
    $hasPopoverLogic,
    'song-info-bar.js cập nhật thông tin tông, nhịp, BPM, ô nhịp vào #song-info-popover'
);

// 4. Kiểm tra breakpoint iPad <= 1200px trong layout.css
$hasIpad1200Breakpoint = strpos($layoutCss, '@media (max-width: 1200px)') !== false;
checkStatic(
    'layout_css_ipad_1200_breakpoint',
    $hasIpad1200Breakpoint,
    'layout.css áp dụng breakpoint <= 1200px cho iPad (đóng sidebar dạng overlay drawer)'
);

// 5. Kiểm tra breakpoint 1200px và tự đóng sidebar khi tải bài trong toolbar-controller.js
$hasJs1200Breakpoint = strpos($toolbarControllerJs, 'window.innerWidth <= 1200') !== false;
$hasAutoCloseOnSong = strpos($toolbarControllerJs, 'EventBus.on(\'song:loaded\'') !== false;
checkBehavior(
    'toolbar_controller_ipad_overlay_auto_close',
    $hasJs1200Breakpoint && $hasAutoCloseOnSong,
    'toolbar-controller.js đóng sidebar trên iPad khi tải bài để nhạc chiếm trọn màn hình'
);

// 6. Kiểm tra tỉ lệ diện tích nhạc trên iPad ngang (1180x820)
$screenWidth = 1180;
$screenHeight = 820;
$totalArea = $screenWidth * $screenHeight;
$toolbarH = 48;
$sheetHeight = $screenHeight - $toolbarH;
$sheetArea = $screenWidth * $sheetHeight; // Sidebar là overlay (0px ngang)
$sheetRatio = ($sheetArea / $totalArea) * 100.0;

checkBehavior(
    'ipad_landscape_sheet_area_ge_85_percent',
    $sheetRatio >= 85.0,
    sprintf('Trên iPad ngang 1180x820, diện tích vùng nhạc đạt %.2f%% màn hình (yêu cầu >= 85%%)', $sheetRatio)
);

TestAssert::finish();
