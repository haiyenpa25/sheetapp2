<?php
/**
 * tests/library_r33_unified_taxonomy_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R3-3 (ROADMAP 5):
 * - Bộ nhãn Dịp lễ mới (Phụ lục B.1) và Chủ đề theo mục lục Thánh Ca HTTLVN (Phụ lục B.2).
 * - Một danh sách tiếng Việt duy nhất cho cả getTaxonomy() lẫn bộ lọc sidebar.
 * - Test nghiệm thu: API taxonomy và bộ lọc sidebar trả về cùng một danh sách.
 * - Tuân thủ ngân sách dòng mã: SongSearchHelper.php, includes/sidebar.php, library-ui.js (< 600 dòng).
 */

declare(strict_types=1);

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function check(bool $condition, string $description, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}\n";
    }
}

echo "=== R3-3: Unified Taxonomy API & Sidebar Filters Regression Suite ===\n\n";

$root = dirname(__DIR__);
require_once $root . '/includes/icons.php';
require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SongSearchHelper.php';
require_once $root . '/api/services/SongService.php';

// ── 1. API Taxonomy Specification Tests (Appendix B.1 & B.2) ─────────
echo "-- 1. API Taxonomy Contract (SongService::getTaxonomy()) --\n";

$tax = SongService::getTaxonomy();
check(isset($tax['seasons']) && is_array($tax['seasons']), 'API: getTaxonomy() trả về mảng seasons');
check(isset($tax['themes']) && is_array($tax['themes']), 'API: getTaxonomy() trả về mảng themes');

// Danh sách 17 dịp lễ chuẩn từ Phụ lục B.1
$b1Seasons = [
    'Lễ Giáng Sinh',
    'Năm Mới',
    'Chúa Nhật Lễ Lá',
    'Lễ Thương Khó',
    'Lễ Phục Sinh',
    'Lễ Thăng Thiên',
    'Lễ Đức Thánh Linh Giáng Lâm',
    'Lễ Cảm Tạ',
    'Lễ Báp-têm',
    'Lễ Tiệc Thánh',
    'Hôn Lễ',
    'Lễ Dâng Con',
    'Tang Lễ',
    'Lễ Cung Hiến',
    'Lễ Tấn Phong Mục Sư',
    'Tiễn Biệt',
    'Buổi Truyền Giảng'
];

$apiSeasonNames = array_column($tax['seasons'], 'name');
foreach ($b1Seasons as $seasonName) {
    check(in_array($seasonName, $apiSeasonNames, true), "B.1 Dịp lễ: API có '{$seasonName}'");
}

// Danh sách 16 chủ đề chuẩn từ Phụ lục B.2 (theo mục lục Thánh Ca HTTLVN)
$b2Themes = [
    'Thờ phượng',
    'Đức Chúa Trời',
    'Chúa Jêsus Christ',
    'Đức Thánh Linh',
    'Hội Thánh',
    'Kinh Thánh',
    'Tin Lành',
    'Đời tín đồ',
    'Thiên đàng',
    'Truyền giảng',
    'Thiếu nhi',
    'Thanh niên',
    'Đơn ca – Song ca',
    'Hợp ca',
    'Kinh tiết ca & Đoản ca',
    'Thi Thiên'
];

$apiThemeNames = array_column($tax['themes'], 'name');
foreach ($b2Themes as $themeName) {
    check(in_array($themeName, $apiThemeNames, true), "B.2 Chủ đề: API có '{$themeName}'");
}

// ── 2. Sidebar Filters Synchronization (includes/sidebar.php) ─────────
echo "\n-- 2. Sidebar Filters Synchronization Contract --\n";

$sidebarPhp = file_get_contents($root . '/includes/sidebar.php');

// Trích xuất các option trong #season-filter
preg_match('/<select id="season-filter"[^>]*>(.*?)<\/select>/s', $sidebarPhp, $mSeason);
check(!empty($mSeason[1]), 'Sidebar: Tìm thấy thẻ <select id="season-filter">');
preg_match_all('/<option value="([^"]+)">([^<]+)<\/option>/', $mSeason[1] ?? '', $seasonOptMatches);
$sidebarSeasonValues = $seasonOptMatches[1] ?? [];
$sidebarSeasonTexts  = $seasonOptMatches[2] ?? [];

// Trích xuất các option trong #theme-filter
preg_match('/<select id="theme-filter"[^>]*>(.*?)<\/select>/s', $sidebarPhp, $mTheme);
check(!empty($mTheme[1]), 'Sidebar: Tìm thấy thẻ <select id="theme-filter">');
preg_match_all('/<option value="([^"]+)">([^<]+)<\/option>/', $mTheme[1] ?? '', $themeOptMatches);
$sidebarThemeValues = $themeOptMatches[1] ?? [];
$sidebarThemeTexts  = $themeOptMatches[2] ?? [];

// Đánh giá khi render bằng PHP
ob_start();
require $root . '/includes/sidebar.php';
$evaluatedSidebarHtml = ob_get_clean();

preg_match('/<select id="season-filter"[^>]*>(.*?)<\/select>/s', $evaluatedSidebarHtml, $mSeasonEval);
preg_match_all('/<option value="([^"]+)">([^<]+)<\/option>/', $mSeasonEval[1] ?? '', $evalSeasonMatches);
$evalSeasonTexts = array_map('html_entity_decode', $evalSeasonMatches[2] ?? []);

preg_match('/<select id="theme-filter"[^>]*>(.*?)<\/select>/s', $evaluatedSidebarHtml, $mThemeEval);
preg_match_all('/<option value="([^"]+)">([^<]+)<\/option>/', $mThemeEval[1] ?? '', $evalThemeMatches);
$evalThemeTexts = array_map('html_entity_decode', $evalThemeMatches[2] ?? []);

// Nghiệm thu cốt lõi: API taxonomy và bộ lọc sidebar trả về cùng một danh sách
check($apiSeasonNames === $evalSeasonTexts, 'Nghiệm thu: API taxonomy seasons và bộ lọc sidebar #season-filter trả về cùng một danh sách tiếng Việt');
check($apiThemeNames === $evalThemeTexts, 'Nghiệm thu: API taxonomy themes và bộ lọc sidebar #theme-filter trả về cùng một danh sách tiếng Việt');

// ── 3. Catholic Vocabulary Grep Barrier on Taxonomy ───────────────────
echo "\n-- 3. Catholic Vocabulary Check in Taxonomy & Sidebar --\n";

$forbiddenWords = ['phụng vụ', 'thánh lễ', 'mùa vọng', 'mùa chay', 'thường niên', 'thánh thể', 'lĩnh xướng', 'đức mẹ'];
$taxCombined = implode(' | ', array_merge($apiSeasonNames, $apiThemeNames));
$foundForbidden = [];
foreach ($forbiddenWords as $fw) {
    if (mb_stripos($taxCombined, $fw) !== false) {
        $foundForbidden[] = $fw;
    }
}
check(empty($foundForbidden), 'Grep Barrier: Không chứa bất kỳ từ Công giáo nào trong danh sách Dịp lễ và Chủ đề');

// ── 4. Line Budget Verification (< 600 lines) ────────────────────────
echo "\n-- 4. Line Budget Disciplines (< 600 lines) --\n";

$linesHelper  = count(file($root . '/api/services/SongSearchHelper.php'));
$linesSidebar = count(file($root . '/includes/sidebar.php'));
$linesLibJs   = count(file($root . '/assets/js/library-ui.js'));

check($linesHelper < 600, "Line Budget: SongSearchHelper.php có {$linesHelper} dòng (< 600 dòng)", false);
check($linesSidebar < 600, "Line Budget: includes/sidebar.php có {$linesSidebar} dòng (< 600 dòng)", false);
check($linesLibJs < 600, "Line Budget: assets/js/library-ui.js có {$linesLibJs} dòng (< 600 dòng)", false);

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: {$totalChecks} (Behavioral: {$behavioralChecks}, Static: {$staticChecks})\n";
echo "Số kiểm tra đạt: {$passedChecks}\n";
$failed = $totalChecks - $passedChecks;
echo "Số kiểm tra lỗi: {$failed}\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA R3-3 ĐỀU ĐẠT (PASS 100%)!\n\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "❌ KẾT QUẢ: CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
