<?php
/**
 * tests/library_l06_controls_and_chips_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L0-6 (ROADMAP4.md):
 * 1. Nút zoom −/+ không còn bị disabled sau khi bài được tải.
 * 2. Chip "Dùng N lần" không bị nhân đôi khi re-render nhiều lần.
 * 3. Menu ⋮ đóng sau khi chọn mục, khi chạm ra ngoài hoặc bấm Esc.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L0-6: Zoom Buttons, Usage Chip & More Menu\n";
echo "========================================================\n\n";

// 1. Kiểm tra enableControls trong assets/js/app-ui.js
$appUiPath = $root . '/assets/js/app-ui.js';
$appUiCode = file_get_contents($appUiPath);

checkStatic(
    'app_ui_enables_zoom_out_button',
    strpos($appUiCode, 'btn-zoom-out') !== false,
    'AppUI.enableControls quản lý nút btn-zoom-out'
);

checkStatic(
    'app_ui_enables_zoom_in_button',
    strpos($appUiCode, 'btn-zoom-in') !== false,
    'AppUI.enableControls quản lý nút btn-zoom-in'
);

// 2. Kiểm tra song-loader.js gọi enableControls(true) sau khi load xong
$songLoaderPath = $root . '/assets/js/song-loader.js';
$songLoaderCode = file_get_contents($songLoaderPath);

checkStatic(
    'song_loader_calls_enable_controls_true',
    strpos($songLoaderCode, 'AppUI.enableControls(true)') !== false,
    'SongLoader gọi AppUI.enableControls(true) khi bài hát hoàn tất tải'
);

// 3. Kiểm tra song-info-bar.js chống nhân đôi chip 'Dùng N lần'
$songInfoBarPath = $root . '/assets/js/song-info-bar.js';
$songInfoBarCode = file_get_contents($songInfoBarPath);

checkStatic(
    'song_info_bar_removes_old_usage_chip',
    strpos($songInfoBarCode, '.si-usage') !== false &&
    strpos($songInfoBarCode, 'remove()') !== false,
    'SongInfoBar xóa bỏ chip .si-usage cũ trước khi thêm mới để chống nhân đôi'
);

// 4. Kiểm tra includes/toolbar.php menu ⋮ đóng sau khi chọn mục, khi click ngoài hoặc ấn Esc
$toolbarPath = $root . '/includes/toolbar.php';
$toolbarCode = file_get_contents($toolbarPath);

checkStatic(
    'toolbar_menu_closes_on_escape',
    strpos($toolbarCode, "'Escape'") !== false,
    'Menu ⋮ tự đóng khi người dùng bấm phím Escape'
);

checkStatic(
    'toolbar_menu_closes_on_item_click',
    strpos($toolbarCode, "item") !== false && strpos($toolbarCode, "classList.add('hidden')") !== false,
    'Menu ⋮ tự đóng khi người dùng chọn một mục chức năng'
);

checkStatic(
    'toolbar_menu_closes_on_outside_click',
    strpos($toolbarCode, "handleOutside") !== false || strpos($toolbarCode, "!btnOptions.contains(e.target)") !== false,
    'Menu ⋮ tự đóng khi chạm/click ra ngoài vùng menu'
);

TestAssert::finish();
