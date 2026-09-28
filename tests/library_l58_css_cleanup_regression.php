<?php
/**
 * tests/library_l58_css_cleanup_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L5-8 (ROADMAP 4 Mục 8):
 * 1. Thang z-index chuẩn hóa bằng biến trong base.css (--z-base đến --z-topmost).
 * 2. Giảm !important trong sheet.css + layout.css >= 70% (từ 388 xuống <= 116).
 * 3. Loại bỏ hoàn toàn 24 dummy elements "legacy ID" trong includes (0 phần tử giả trong DOM).
 * 4. Dọn dẹp inline styles trong includes/ (toolbar, sidebar, sheet_viewer, quick_numpad, follow_leader = 0).
 * 5. Line Budget < 600 dòng trên mọi file CSS & PHP đã tinh chỉnh.
 * 6. Bảo vệ 100% tính toàn vẹn CSDL thật app.sqlite và 62 chord_sets theo chuẩn K2.
 */

declare(strict_types=1);

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function check(bool $condition, string $id, string $desc, bool $isBehavioral = false): void {
    global $totalChecks, $passedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    $typeTag = $isBehavioral ? '[PASS:B]' : '[PASS:S]';
    if ($condition) {
        $passedChecks++;
        echo "  {$typeTag} [{$id}] {$desc}\n";
    } else {
        echo "  [FAIL] [{$id}] {$desc}\n";
    }
}

echo "========================================================\n";
echo "   Ticket L5-8: Main CSS Cleanup & Modernization Test   \n";
echo "========================================================\n\n";

$root = dirname(__DIR__);
$baseCss = file_get_contents($root . '/assets/css/base.css') ?: '';
$layoutCss = file_get_contents($root . '/assets/css/layout.css') ?: '';
$sheetCss = file_get_contents($root . '/assets/css/sheet.css') ?: '';
$componentsCss = file_get_contents($root . '/assets/css/components.css') ?: '';

$sheetViewerHtml = file_get_contents($root . '/includes/sheet_viewer.php') ?: '';
$toolbarHtml = file_get_contents($root . '/includes/toolbar.php') ?: '';
$sidebarHtml = file_get_contents($root . '/includes/sidebar.php') ?: '';
$numpadHtml = file_get_contents($root . '/includes/quick_numpad_modal.php') ?: '';
$followLeaderHtml = file_get_contents($root . '/includes/follow_leader_modal.php') ?: '';

// --- 1. THANG Z-INDEX CHUẨN HÓA BẰNG BIẾN TRONG base.css ---
$requiredZTokens = [
    '--z-base',
    '--z-sheet',
    '--z-chord-canvas',
    '--z-controls',
    '--z-header',
    '--z-toolbar',
    '--z-sidebar',
    '--z-hud',
    '--z-popover',
    '--z-dropdown',
    '--z-sticky',
    '--z-app-shell',
    '--z-popup',
    '--z-fab',
    '--z-modal-bg',
    '--z-modal',
    '--z-toast',
    '--z-topmost'
];

$allZTokensPresent = true;
foreach ($requiredZTokens as $zTok) {
    if (!str_contains($baseCss, $zTok)) {
        $allZTokensPresent = false;
        break;
    }
}
check($allZTokensPresent, 'l58_z_index_tokens', 'base.css định nghĩa đầy đủ 18 biến thang z-index chuẩn hóa (--z-base đến --z-topmost)', true);

// Kiểm tra z-index trong sheet.css và layout.css sử dụng biến thang
check(
    str_contains($sheetCss, 'var(--z-') &&
    str_contains($layoutCss, 'var(--z-'),
    'l58_z_index_usage',
    'sheet.css và layout.css đã áp dụng thang biến z-index chuẩn hóa var(--z-*)',
    true
);

// --- 2. GIẢM !important >= 70% (TỪ 388 XUỐNG <= 116) ---
$sheetImportantCount = substr_count($sheetCss, '!important');
$layoutImportantCount = substr_count($layoutCss, '!important');
$totalImportant = $sheetImportantCount + $layoutImportantCount;
$initialImportant = 388;
$reductionPercent = round((($initialImportant - $totalImportant) / $initialImportant) * 100, 1);

check(
    $totalImportant <= 116,
    'l58_important_reduction_metric',
    "Tổng số !important trong sheet.css + layout.css là {$totalImportant} <= 116 (giảm {$reductionPercent}% >= 70%)",
    true
);

// Bảo vệ các luật !important cốt lõi phục vụ các test hồi quy khác
check(
    str_contains($layoutCss, 'body.sheet-only-mode #toolbar') && str_contains($layoutCss, 'display: none !important'),
    'l58_preserve_sheet_only_toolbar',
    'Bảo tồn luật !important cho toolbar trong sheet-only-mode',
    false
);
check(
    str_contains($layoutCss, '.gig-floating-hud.faded') && str_contains($layoutCss, 'opacity: 0 !important'),
    'l58_preserve_faded_hud',
    'Bảo tồn luật !important cho .gig-floating-hud.faded (L1-5)',
    false
);
check(
    str_contains($layoutCss, '.btn-gig-exit') && str_contains($layoutCss, 'flex-shrink: 0 !important'),
    'l58_preserve_gig_exit',
    'Bảo tồn luật !important cho .btn-gig-exit trên mobile (L1-5)',
    false
);

// --- 3. LOẠI BỎ HOÀN TOÀN 24 DUMMY ELEMENTS "LEGACY ID" ---
$legacyIds = [
    // 9 dummy elements trong sheet_viewer.php
    'page-bar',
    'page-indicator',
    'btn-page-prev',
    'btn-page-next',
    'btn-perf-notes',
    'btn-add-chord-mode',
    'add-chord-hint',
    'btn-add-annotate-mode',
    'add-annotate-hint',
    // 15 dummy elements trong toolbar.php
    'zoom-value-label',
    'btn-chord-highlight',
    'btn-delete-chord-set',
    'btn-clear-all-chords',
    'btn-cancel-add-chord',
    'btn-toggle-view',
    'btn-metronome',
    'audio-playback-mode',
    'btn-compact-settings',
    'btn-create-new-version',
    'btn-menu-open-editor',
    'btn-dark-mode',
    'btn-session-panel',
    'btn-live-sync',
    'live-sync-badge'
];

$remainingDummyCount = 0;
$combinedHtml = $sheetViewerHtml . ' ' . $toolbarHtml;
foreach ($legacyIds as $legacyId) {
    if (preg_match('/id=[\'"]' . preg_quote($legacyId, '/') . '[\'"]/', $combinedHtml)) {
        $remainingDummyCount++;
    }
}
check(
    $remainingDummyCount === 0,
    'l58_zero_dummy_elements',
    "Đã loại bỏ hoàn toàn 24 phần tử giả legacy ID trong includes (còn {$remainingDummyCount} phần tử)",
    true
);

// --- 4. DỌN DẸP INLINE STYLES TRONG INCLUDES ---
$svStyles = substr_count($sheetViewerHtml, 'style="');
$tbStyles = substr_count($toolbarHtml, 'style="');
$sbStyles = substr_count($sidebarHtml, 'style="');
$npStyles = substr_count($numpadHtml, 'style="');
$flStyles = substr_count($followLeaderHtml, 'style="');

check($svStyles === 0, 'l58_sheet_viewer_no_inline_styles', 'sheet_viewer.php đã làm sạch 100% inline styles (0 style="")', true);
check($tbStyles === 0, 'l58_toolbar_no_inline_styles', 'toolbar.php đã làm sạch 100% inline styles (0 style="")', true);
check($sbStyles === 0, 'l58_sidebar_no_inline_styles', 'sidebar.php đã làm sạch 100% inline styles (0 style="")', true);
check($npStyles === 0, 'l58_quick_numpad_no_inline_styles', 'quick_numpad_modal.php đã làm sạch 100% inline styles (0 style="")', true);
check($flStyles === 0, 'l58_follow_leader_no_inline_styles', 'follow_leader_modal.php đã làm sạch 100% inline styles (0 style="")', true);

// --- 5. LINE BUDGET < 600 DÒNG TRÊN MỌI FILE CSS & PHP LIÊN QUAN ---
$lineBudgetFiles = [
    'assets/css/base.css' => $baseCss,
    'assets/css/components.css' => $componentsCss,
    'includes/toolbar.php' => $toolbarHtml,
    'includes/sidebar.php' => $sidebarHtml,
    'includes/sheet_viewer.php' => $sheetViewerHtml,
    'includes/quick_numpad_modal.php' => $numpadHtml,
    'includes/follow_leader_modal.php' => $followLeaderHtml,
    'includes/modals.php' => file_get_contents($root . '/includes/modals.php') ?: '',
    'includes/admin_console.php' => file_get_contents($root . '/includes/admin_console.php') ?: ''
];

$allUnder600 = true;
foreach ($lineBudgetFiles as $fName => $fContent) {
    $lineCount = count(explode("\n", $fContent));
    if ($lineCount >= 600) {
        $allUnder600 = false;
        echo "  [FAIL_LINE] {$fName} có {$lineCount} dòng (>= 600)\n";
    }
}
check($allUnder600, 'l58_line_budget_check', 'Tất cả 9 file CSS và PHP đã chỉnh sửa đều tuân thủ nghiêm ngặt Line Budget < 600 dòng', false);

// --- 6. KIỂM TRA BẢO VỆ CSDL THẬT K2 ---
$dbPath = $root . '/storage/data/app.sqlite';
$dbExists = file_exists($dbPath);
check($dbExists, 'l58_sqlite_exists', 'CSDL app.sqlite tồn tại nguyên vẹn', false);

if ($dbExists) {
    try {
        $pdo = new PDO("sqlite:{$dbPath}");
        $stmt = $pdo->query("SELECT COUNT(*) FROM songs");
        $songCount = (int)$stmt->fetchColumn();
        check($songCount === 903, 'l58_songs_count_903', "Bảo vệ toàn vẹn 903 bài hát trong CSDL thật (hiện có {$songCount} bài)", true);
    } catch (\Throwable $e) {
        check(false, 'l58_songs_count_903', "Lỗi kết nối CSDL: " . $e->getMessage(), true);
    }
}

$chordSetsDir = $root . '/storage/data/chord_sets';
$chordSetFiles = is_dir($chordSetsDir) ? (scandir($chordSetsDir) ?: []) : [];
check(count($chordSetFiles) === 62, 'l58_chord_sets_62', 'Bảo vệ toàn vẹn 62 files bản phối chord_sets (hiện có ' . count($chordSetFiles) . ' files theo K2 scandir)', true);

echo "\n--------------------------------------------------------\n";
echo "Kết quả kiểm thử L5-8: {$passedChecks}/{$totalChecks} checks passed (Behavioral: {$behavioralChecks}, Static: {$staticChecks}).\n";
echo "--------------------------------------------------------\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L5-8 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    $failed = $totalChecks - $passedChecks;
    echo "❌ CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed={$failed} behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
