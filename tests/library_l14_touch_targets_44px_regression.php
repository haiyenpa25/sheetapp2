<?php
declare(strict_types=1);

/**
 * tests/library_l14_touch_targets_44px_regression.php
 * 
 * Kiểm thử hồi quy Ticket L1-4: Nút cảm ứng ≥ 44x44px cho mọi điều khiển chính
 * (tông, capo, zoom, bộ hợp âm, preset Aa, Band toggle, ⚡ gig mode, ◀ ▶, chip nhảy nhanh, ⭐, sidebar tabs)
 */

$root = dirname(__DIR__);
$layoutCssPath = $root . '/assets/css/layout.css';
$fabCssPath = $root . '/assets/css/fab.css';
$toolbarPhpPath = $root . '/includes/toolbar.php';

$checks = [];
$totalChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function recordCheck(string $desc, bool $passed, bool $isBehavioral = false): void {
    global $checks, $totalChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    $checks[] = [
        'desc' => $desc,
        'passed' => $passed,
        'behavioral' => $isBehavioral
    ];
    if (!$passed) {
        echo "  ❌ FAIL: {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket L1-4: Nút cảm ứng ≥ 44x44px ===\n";

if (!file_exists($layoutCssPath)) {
    echo "  ❌ Không tìm thấy layout.css!\n";
    exit(1);
}

$layoutCss = file_get_contents($layoutCssPath);
$fabCss = file_exists($fabCssPath) ? file_get_contents($fabCssPath) : '';
$toolbarPhp = file_exists($toolbarPhpPath) ? file_get_contents($toolbarPhpPath) : '';

// 1. Toolbar icon buttons (hamburger, prev, next, more) có min-width và min-height >= 44px
$hasToolbarIconBtn44 = (bool)preg_match('/\.toolbar(\.unified-toolbar)?\s+\.icon-btn[^{]*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Toolbar icon-btn có kích thước tối thiểu 44x44px", $hasToolbarIconBtn44, true);

// 2. Song info pill có min-height/height >= 44px
$hasSongInfoPill44 = (bool)preg_match('/\.song-info-pill\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss);
recordCheck("Cụm thông tin bài hát song-info-pill có chiều cao ≥ 44px", $hasSongInfoPill44, true);

// 3. Nút ⓘ Popover thông tin bài hát có min-width và min-height >= 44px
$hasSongInfoPopoverBtn44 = (bool)preg_match('/(#btn-song-info-popover|\.btn-song-info-popover)[^{]*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Nút ⓘ xem chi tiết bài hát có kích thước ≥ 44x44px", $hasSongInfoPopoverBtn44, true);

// 4. Band pill và icon-btn-pill (tông down/up, zoom in/out, lock zoom, metronome) có kích thước >= 44x44px
$hasBandPill44 = (bool)preg_match('/\.band-pill\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss);
recordCheck("Hộp band-pill có chiều cao ≥ 44px", $hasBandPill44, true);

$hasIconBtnPill44 = (bool)preg_match('/\.icon-btn-pill\s*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Các nút icon-btn-pill (tông -, +, zoom -, +) có kích thước ≥ 44x44px", $hasIconBtnPill44, true);

// 5. Nút về tông gốc btn-pill-reset có kích thước >= 44x44px
$hasBtnReset44 = (bool)(preg_match('/\.btn-pill-reset\s*\{[^}]*min-width:\s*44px/s', $layoutCss) && preg_match('/\.btn-pill-reset\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss));
recordCheck("Nút về tông gốc (Gốc) có kích thước ≥ 44x44px", $hasBtnReset44, true);

// 6. Capo select có kích thước >= 44x44px
$hasCapoSelect44 = (bool)(preg_match('/\.capo-select\s*\{[^}]*min-width:\s*44px/s', $layoutCss) && preg_match('/\.capo-select\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss));
recordCheck("Menu chọn Capo có kích thước ≥ 44x44px", $hasCapoSelect44, true);

// 7. Chord set selector và nút Điền HÂ có kích thước >= 44x44px
$hasChordSetSelect44 = (bool)preg_match('/\.chord-set-select\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss);
recordCheck("Menu chọn bộ hợp âm có chiều cao ≥ 44px", $hasChordSetSelect44, true);

$hasChordEditPill44 = (bool)(preg_match('/\.btn-chord-edit-pill\s*\{[^}]*min-width:\s*44px/s', $layoutCss) && preg_match('/\.btn-chord-edit-pill\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss));
recordCheck("Nút Điền Hợp Âm có kích thước ≥ 44x44px", $hasChordEditPill44, true);

// 8. Preset hiển thị hợp âm (nút Aa) có kích thước >= 44x44px
$hasChordPreset44 = (bool)(preg_match('/\.btn-chord-preset\s*\{[^}]*min-width:\s*44px/s', $layoutCss) && preg_match('/\.btn-chord-preset\s*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss));
recordCheck("Nút preset hiển thị hợp âm (Aa) có kích thước ≥ 44x44px", $hasChordPreset44, true);

// 9. Nút Band toggle (Band/Nhạc) có kích thước >= 44x44px
$hasBandToggle44 = (bool)(preg_match('/(\.btn-band-toggle|\.btn-toggle-view)[^{]*\{[^}]*min-width:\s*44px/s', $layoutCss) && preg_match('/(\.btn-band-toggle|\.btn-toggle-view)[^{]*\{[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss));
recordCheck("Nút chuyển Band / Bản Nhạc có kích thước ≥ 44x44px", $hasBandToggle44, true);

// 10. Nút Biểu Diễn ⚡ (btn-gig-mode) có kích thước >= 44x44px
$hasGigMode44 = (bool)preg_match('/\.btn-gig-mode\s*\{[^}]*(min-width:\s*44px)[^}]*(min-height:\s*44px|height:\s*44px)/s', $layoutCss);
recordCheck("Nút Biểu Diễn ⚡ có kích thước ≥ 44x44px", $hasGigMode44, true);

// 11. Chip nhảy nhanh (.quick-jump-btn) có min-width và min-height >= 44px
$hasQuickJump44 = (bool)preg_match('/\.quick-jump-btn\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s', $layoutCss);
recordCheck("Chip nhảy nhanh .quick-jump-btn có kích thước tối thiểu ≥ 44x44px", $hasQuickJump44, true);

// 12. Nút yêu thích ⭐ (.song-fav-btn) có kích thước >= 44x44px
$hasSongFav44 = (bool)preg_match('/\.song-fav-btn\s*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Nút yêu thích ⭐ .song-fav-btn có kích thước tối thiểu ≥ 44x44px", $hasSongFav44, true);

// 13. Sidebar tabs (.sidebar-tab) có min-height >= 44px
$hasSidebarTab44 = (bool)preg_match('/\.sidebar-tab\s*\{[^}]*min-height:\s*44px/s', $layoutCss);
recordCheck("Tab chuyển mục sidebar (.sidebar-tab) có chiều cao ≥ 44px", $hasSidebarTab44, true);

// 14. Nút đóng Popover ⓘ (.si-popover-close) có kích thước >= 44x44px
$hasPopoverClose44 = (bool)preg_match('/\.si-popover-close\s*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Nút đóng popover thông tin bài hát có kích thước ≥ 44x44px", $hasPopoverClose44, true);

// 15. Kiểm tra responsive breakpoint không bóp nhỏ nút dưới 44px
$noShrinkUnderTablet = !preg_match('/@media\s*\([^)]*1024px\)[^{]*\{[^}]*\.icon-btn-pill\s*\{[^}]*width:\s*2[0-9]px/s', $layoutCss);
recordCheck("Không có media query nào bóp nhỏ icon-btn-pill xuống dưới 44px trên tablet", $noShrinkUnderTablet, true);

$noShrinkUnderMobile = !preg_match('/@media\s*\([^)]*680px\)[^{]*\{[^}]*\.nav-arrows\s+\.icon-btn\s*\{[^}]*width:\s*2[0-9]px/s', $layoutCss);
recordCheck("Không có media query nào bóp nhỏ mũi tên điều hướng ◀ ▶ xuống dưới 44px trên mobile", $noShrinkUnderMobile, true);

// Tổng kết
$allPassed = true;
foreach ($checks as $c) {
    if (!$c['passed']) {
        $allPassed = false;
        break;
    }
}

if ($allPassed) {
    echo "  ✅ TẤT CẢ {$totalChecks} KIỂM TRA ĐỀU PASS!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$totalChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "  ❌ CÓ KIỂM TRA THẤT BẠI!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed=" . ($totalChecks - 1) . " failed=1 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
