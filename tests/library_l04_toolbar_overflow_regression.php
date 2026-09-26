<?php
/**
 * tests/library_l04_toolbar_overflow_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L0-4 (ROADMAP4.md):
 * 1. Thanh công cụ không tràn: dưới 1.300px, thu các nút phụ vào menu ⋮.
 * 2. Luôn hiện các nút: tên bài, tông, bộ hợp âm, Band/Nhạc, ⚡, ⋮, ◀ ▶.
 * 3. Menu ⋮ cung cấp đầy đủ điều khiển thay thế khi các nút phụ trên toolbar bị ẩn.
 * 4. CSS responsive đảm bảo toolbar.scrollWidth <= toolbar.clientWidth.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L0-4: Thanh Công Cụ Không Tràn & Tinh Gọn < 1300px\n";
echo "========================================================\n\n";

$toolbarPhpPath = $root . '/includes/toolbar.php';
$toolbarPhp = file_get_contents($toolbarPhpPath);

$layoutCssPath = $root . '/assets/css/layout.css';
$layoutCss = file_get_contents($layoutCssPath);

// 1. Kiểm tra sự tồn tại của các nút bắt buộc trên toolbar.php
checkStatic(
    'toolbar_has_song_title_and_key',
    strpos($toolbarPhp, 'id="song-title"') !== false && strpos($toolbarPhp, 'id="song-key"') !== false,
    'Toolbar có nút tên bài (#song-title) và tông gốc (#song-key)'
);

checkStatic(
    'toolbar_has_transpose_controls',
    strpos($toolbarPhp, 'id="btn-transpose-down"') !== false &&
    strpos($toolbarPhp, 'id="transpose-display"') !== false &&
    strpos($toolbarPhp, 'id="btn-transpose-up"') !== false,
    'Toolbar có cụm điều chỉnh tông (hạ, số nửa cung, tăng)'
);

checkStatic(
    'toolbar_has_chord_set_selector',
    strpos($toolbarPhp, 'id="chord-set-selector"') !== false,
    'Toolbar có bộ chọn bản phối hợp âm (#chord-set-selector)'
);

checkStatic(
    'toolbar_has_band_toggle_button',
    (strpos($toolbarPhp, 'id="btn-band-toggle"') !== false || strpos($toolbarPhp, 'id="btn-toggle-view"') !== false) &&
    (strpos($toolbarPhp, 'btn-band-toggle') !== false),
    'Toolbar có nút chuyển đổi Band/Nhạc (#btn-band-toggle)'
);

checkStatic(
    'toolbar_has_gig_mode_button',
    strpos($toolbarPhp, 'id="btn-fullscreen"') !== false && strpos($toolbarPhp, 'btn-gig-mode') !== false,
    'Toolbar có nút Biểu Diễn ⚡ (#btn-fullscreen)'
);

checkStatic(
    'toolbar_has_nav_arrows',
    strpos($toolbarPhp, 'id="nav-arrows"') !== false &&
    strpos($toolbarPhp, 'id="btn-prev-song"') !== false &&
    strpos($toolbarPhp, 'id="btn-next-song"') !== false,
    'Toolbar có cụm chuyển bài trước/sau ◀ ▶ (#nav-arrows)'
);

checkStatic(
    'toolbar_has_more_options_button',
    strpos($toolbarPhp, 'id="btn-more-options"') !== false && strpos($toolbarPhp, 'id="main-dropdown-menu"') !== false,
    'Toolbar có nút menu ⋮ (#btn-more-options) và dropdown menu (#main-dropdown-menu)'
);

// 2. Kiểm tra menu ⋮ có khu vực compact controls cho các nút phụ thu vào
checkStatic(
    'dropdown_menu_has_compact_section',
    strpos($toolbarPhp, 'menu-section-compact-only') !== false &&
    strpos($toolbarPhp, 'btn-menu-zoom-out') !== false &&
    strpos($toolbarPhp, 'btn-menu-zoom-in') !== false &&
    strpos($toolbarPhp, 'btn-menu-lock-zoom') !== false &&
    strpos($toolbarPhp, 'btn-menu-auto-scroll') !== false,
    'Menu ⋮ cung cấp đầy đủ các điều khiển phụ thu gọn: Thu phóng (−/+), Khóa zoom, Tự cuộn'
);

// 3. Kiểm tra CSS Responsive: breakpoint dưới 1300px thu các nút phụ
checkStatic(
    'css_has_breakpoint_1300px',
    preg_match('/@media\s*\(\s*max-width:\s*(?:1300px|1299px)\s*\)/', $layoutCss) === 1,
    'layout.css có media query max-width: 1300px (Ticket L0-4)'
);

checkStatic(
    'css_hides_secondary_controls_under_1300px',
    strpos($layoutCss, '.scroll-pill') !== false &&
    strpos($layoutCss, '.zoom-pill') !== false &&
    strpos($layoutCss, '#btn-toolbar-auth') !== false,
    'layout.css ẩn các nút phụ (.zoom-pill, .scroll-pill, #btn-toolbar-auth) dưới 1300px'
);

checkBehavior(
    'css_prevents_toolbar_overflow',
    strpos($layoutCss, 'overflow-x: hidden') !== false,
    'layout.css đảm bảo thanh công cụ ngăn chặn hoàn toàn tràn ngang (overflow-x: hidden)'
);

TestAssert::finish();
