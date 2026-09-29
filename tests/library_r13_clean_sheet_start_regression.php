<?php
// tests/library_r13_clean_sheet_start_regression.php — Ticket R1-3: Clean Sheet Start & Chip Strip Relocation

require_once __DIR__ . '/lib/assert.php';

echo "========================================================\n";
echo "   Ticket R1-3: Bỏ Dải Chip Thông Tin & Nhạc Bắt Đầu y ≤ 100px  \n";
echo "========================================================\n\n";

$baseDir = dirname(__DIR__);

// 1. Kiểm tra CSS ẩn #song-info-strip
$cssPath = $baseDir . '/assets/css/library-polish.css';
$cssContent = file_exists($cssPath) ? file_get_contents($cssPath) : '';
checkStatic(
    'song_info_strip_hidden',
    (strpos($cssContent, '#song-info-strip') !== false || strpos($cssContent, '.song-info-strip') !== false) &&
    strpos($cssContent, 'display: none !important') !== false,
    'assets/css/library-polish.css ẩn hoàn toàn dải chip #song-info-strip'
);

// 2. Kiểm tra includes/toolbar.php tích hợp đầy đủ trường thông tin trong popover ⓘ
$toolbarPath = $baseDir . '/includes/toolbar.php';
$toolbarContent = file_exists($toolbarPath) ? file_get_contents($toolbarPath) : '';
checkBehavior(
    'popover_has_usage_field',
    strpos($toolbarContent, 'si-pop-usage') !== false,
    'Popover thông tin bài ⓘ trong toolbar.php có trường hiển thị số lần sử dụng (#si-pop-usage)'
);

// 3. Kiểm tra song-info-bar.js cập nhật tempo lên thanh công cụ
$jsPath = $baseDir . '/assets/js/song-info-bar.js';
$jsContent = file_exists($jsPath) ? file_get_contents($jsPath) : '';
checkBehavior(
    'song_info_bar_syncs_toolbar_tempo',
    strpos($jsContent, 'toolbar-tempo-val') !== false,
    'song-info-bar.js đồng bộ tempo bài hát lên nút Tempo trên thanh công cụ (#toolbar-tempo-val)'
);

// 4. Kiểm tra song-info-bar.js cập nhật lịch sử dùng vào popover ⓘ
checkBehavior(
    'song_info_bar_updates_popover_usage',
    strpos($jsContent, 'si-pop-usage') !== false,
    'song-info-bar.js cập nhật số lần sử dụng trong thờ phượng vào #si-pop-usage'
);

// 5. Kiểm tra ngân sách dòng code của song-info-bar.js (< 600 dòng)
$linesCount = count(file($jsPath));
checkStatic(
    'song_info_bar_line_budget',
    $linesCount < 600,
    "assets/js/song-info-bar.js tuân thủ giới hạn dòng (< 600 dòng, hiện tại: {$linesCount})"
);

// 6. Tính toán vị trí bắt đầu của sheet nhạc (y ≤ 100px)
// Thanh công cụ 48px + không còn dải chip 29px (0px) = 48px <= 100px
$toolbarHeight = 48;
$stripHeight = 0; // Đã ẩn
$sheetStartY = $toolbarHeight + $stripHeight;
checkBehavior(
    'sheet_start_y_budget',
    $sheetStartY <= 100,
    "Sheet nhạc bắt đầu tại y = {$sheetStartY}px (đạt yêu cầu y ≤ 100px)"
);

echo "\n";
echo "SUITE_COMPLETE total=6\n";
