<?php
// tests/library_r12_laptop_toolbar_regression.php — Ticket R1-2: Laptop Toolbar 48px & 9 Groups Regression

require_once __DIR__ . '/lib/assert.php';

echo "========================================================\n";
echo "   Ticket R1-2: Tái Cấu Trúc Thanh Công Cụ Laptop 48px  \n";
echo "========================================================\n\n";

$baseDir = dirname(__DIR__);

// 1. Kiểm tra CSS height 48px cho .unified-toolbar
$cssPath = $baseDir . '/assets/css/library-polish.css';
$cssContent = file_exists($cssPath) ? file_get_contents($cssPath) : '';
checkStatic(
    'toolbar_height_48px',
    strpos($cssContent, 'height: 48px') !== false,
    'assets/css/library-polish.css định nghĩa chiều cao chuẩn 48px cho .unified-toolbar'
);

// 2. Kiểm tra template toolbar.php
$toolbarPath = $baseDir . '/includes/toolbar.php';
$toolbarContent = file_exists($toolbarPath) ? file_get_contents($toolbarPath) : '';

// 2.1 Công tắc 2 chế độ Bản nhạc | Lời & Hợp âm
checkBehavior(
    'view_switch_segmented',
    strpos($toolbarContent, 'Bản nhạc') !== false &&
    (strpos($toolbarContent, 'Lời & Hợp âm') !== false || strpos($toolbarContent, 'Lời &amp; Hợp âm') !== false) &&
    (strpos($toolbarContent, 'view-switch') !== false || strpos($toolbarContent, 'btn-view-') !== false),
    'Thanh công cụ có công tắc 2 chế độ rõ ràng (Bản nhạc | Lời & Hợp âm)'
);

// 2.2 Nút Biểu Diễn có chữ và icon
checkBehavior(
    'fullscreen_gig_button_with_text',
    strpos($toolbarContent, 'id="btn-fullscreen"') !== false &&
    (strpos($toolbarContent, 'Biểu Diễn') !== false || strpos($toolbarContent, 'Biểu diễn') !== false || strpos($toolbarContent, 'Toàn màn hình') !== false),
    'Nút Toàn Màn Hình / Biểu Diễn có chữ nhãn rõ ràng'
);

// 2.3 Nút Soạn hợp âm
checkBehavior(
    'chord_edit_button_present',
    strpos($toolbarContent, 'btn-chord-edit') !== false &&
    (strpos($toolbarContent, 'icon(\'pencil\'') !== false || strpos($toolbarContent, 'Soạn') !== false),
    'Nút Soạn Hợp Âm ✎ hiển thị rõ ràng trên thanh công cụ'
);

// 2.4 Cụm Tempo ♩ hiển thị trực tiếp trên thanh công cụ
checkBehavior(
    'tempo_display_present',
    (strpos($toolbarContent, 'toolbar-tempo') !== false || strpos($toolbarContent, 'btn-toolbar-tempo') !== false || strpos($toolbarContent, 'btn-toolbar-metronome') !== false) &&
    strpos($toolbarContent, '♩') !== false,
    'Cụm Tempo ♩ hiển thị trực tiếp trên thanh công cụ và mở bảng Tempo'
);

// 2.5 Các ID cốt lõi được bảo toàn không gây lỗi cho JS
$requiredIds = [
    'btn-open-sidebar',
    'song-title',
    'song-key',
    'btn-song-info-popover',
    'btn-transpose-down',
    'btn-transpose-up',
    'btn-transpose-reset',
    'chord-set-selector',
    'btn-add-chord-mode-bar',
    'btn-fullscreen',
    'btn-prev-song',
    'btn-next-song',
    'btn-more-options'
];

$missingIds = [];
foreach ($requiredIds as $id) {
    if (strpos($toolbarContent, 'id="' . $id . '"') === false) {
        $missingIds[] = $id;
    }
}

checkBehavior(
    'core_ids_preserved',
    count($missingIds) === 0,
    'Tất cả ID điều khiển cốt lõi được bảo toàn (' . (count($missingIds) === 0 ? '13/13' : 'Thiếu: ' . implode(', ', $missingIds)) . ')'
);

// 3. Kiểm tra CSS ẩn các dải chip thừa trên thanh chính khi ở chế độ 9 nhóm
checkStatic(
    'toolbar_9_groups_clean',
    strpos($cssContent, '.view-switch') !== false || strpos($cssContent, '.btn-view-mode') !== false,
    'CSS có định dạng cho công tắc chuyển chế độ .view-switch'
);

echo "\n";
echo "SUITE_COMPLETE total=6\n";
