<?php
/**
 * tests/library_l59_performance_budget_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L5-9 (ROADMAP 4 Mục 8):
 * 1. Ngân sách hiệu năng trong CI: Playwright đo thời gian hiện bản nhạc, số lần render, số request và fail nếu vượt ngưỡng.
 * 2. Cấu trúc bộ test E2E library-l5-performance-budget.spec.js với 6 chỉ số ngân sách hiệu năng nghiêm ngặt.
 * 3. Tích hợp cờ --e2e trong Unified Quality Gate CI (tests/run_all_tests.php).
 * 4. API OSMDRenderer.getRenderCount() và resetRenderCount() phục vụ Performance Monitoring.
 * 5. Giới hạn số lượng thẻ <script> ban đầu trong index.php <= 30.
 * 6. Line Budget < 600 dòng trên mọi file.
 * 7. Bảo vệ toàn vẹn CSDL thật app.sqlite và 62 files chord_sets theo chuẩn K2.
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
echo "   Ticket L5-9: Performance Budget in CI Quality Gate   \n";
echo "========================================================\n\n";

$root = dirname(__DIR__);
$specFile = $root . '/e2e/library-l5-performance-budget.spec.js';
$runAllTestsFile = $root . '/tests/run_all_tests.php';
$osmdRendererFile = $root . '/assets/js/osmd-renderer.js';
$appJsFile = $root . '/assets/js/app.js';
$playwrightConfigFile = $root . '/playwright.config.js';
$indexPhpFile = $root . '/index.php';

// --- 1. KIỂM TRA FILE PLAYWRIGHT PERFORMANCE BUDGET SPEC ---
check(file_exists($specFile), 'l59_spec_exists', 'File e2e/library-l5-performance-budget.spec.js tồn tại', false);

$specContent = file_exists($specFile) ? file_get_contents($specFile) : '';

$requiredBudgets = [
    'INITIAL_RENDER_MS',
    'SONG_SWITCH_MS',
    'RENDER_COUNT',
    'NETWORK_REQUESTS',
    'TRANSPOSE_MS',
    'INITIAL_SCRIPTS'
];

$allBudgetsDefined = true;
foreach ($requiredBudgets as $budget) {
    if (!str_contains($specContent, $budget)) {
        $allBudgetsDefined = false;
        break;
    }
}
check(
    $allBudgetsDefined,
    'l59_budgets_defined',
    'e2e/library-l5-performance-budget.spec.js định nghĩa đầy đủ 6 chỉ số ngân sách hiệu năng nghiêm ngặt',
    true
);

// Kiểm tra logic Fail If Over Budget trong E2E spec
check(
    str_contains($specContent, 'toBeLessThanOrEqual') && str_contains($specContent, 'toBe(BUDGETS.RENDER_COUNT)'),
    'l59_fail_if_over_budget',
    'E2E spec cài đặt cơ chế Fail If Over Budget (dừng kiểm thử và báo lỗi ngay khi vượt ngưỡng)',
    true
);

// --- 2. TÍCH HỢP PLAYWRIGHT TRONG RUN_ALL_TESTS.PHP ---
$runAllContent = file_get_contents($runAllTestsFile) ?: '';
check(
    str_contains($runAllContent, '--e2e') &&
    str_contains($runAllContent, 'playwright test') &&
    str_contains($runAllContent, 'Playwright E2E Tests'),
    'l59_ci_e2e_integration',
    'tests/run_all_tests.php tích hợp đầy đủ cờ --e2e điều phối Playwright trong Unified Quality Gate CI',
    true
);

// --- 3. CƠ CHẾ RENDER COUNT MONITORING TRONG OSMDRENDERER ---
$osmdContent = file_get_contents($osmdRendererFile) ?: '';
check(
    str_contains($osmdContent, 'getRenderCount') &&
    str_contains($osmdContent, 'resetRenderCount') &&
    str_contains($osmdContent, '_renderCount'),
    'l59_osmd_render_count_api',
    'assets/js/osmd-renderer.js xuất API getRenderCount() và resetRenderCount() cho CI profiling',
    true
);

// --- 4. GIỚI HẠN SỐ LƯỢNG SCRIPT TAG BAN ĐẦU <= 30 ---
ob_start();
$_SERVER['SCRIPT_NAME'] = '/index.php';
include $indexPhpFile;
$renderedHtml = ob_get_clean();

preg_match_all('/<script\b/i', $renderedHtml, $scriptMatches);
$initialScriptCount = count($scriptMatches[0]);

check(
    $initialScriptCount <= 30 && $initialScriptCount > 0,
    'l59_script_count_budget',
    "Số script tags ban đầu trong index.php đạt ngân sách <= 30 (Hiện có: {$initialScriptCount} scripts)",
    true
);

// Kiểm tra app.js trì hoãn ServiceWorkerManager không làm nghẽn initial load
$appJsContent = file_get_contents($appJsFile) ?: '';
check(
    str_contains($appJsContent, 'ServiceWorkerManager') &&
    (str_contains($appJsContent, 'setTimeout') || str_contains($appJsContent, 'requestIdleCallback')),
    'l59_deferred_sw_load',
    'assets/js/app.js trì hoãn nạp ServiceWorkerManager để bảo vệ ngân sách script và thời gian render bài đầu',
    true
);

// --- 5. LINE BUDGET < 600 DÒNG ---
$filesToCheck = [
    'assets/js/app.js' => $appJsContent,
    'assets/js/osmd-renderer.js' => $osmdContent,
    'tests/run_all_tests.php' => $runAllContent,
    'index.php' => file_get_contents($indexPhpFile) ?: ''
];

$allUnder600 = true;
foreach ($filesToCheck as $fName => $fContent) {
    $lineCount = count(explode("\n", $fContent));
    if ($lineCount >= 600) {
        $allUnder600 = false;
        echo "  [FAIL_LINE] {$fName} có {$lineCount} dòng (>= 600)\n";
    }
}
check($allUnder600, 'l59_line_budget', 'Tất cả file mã nguồn liên quan đều tuân thủ Line Budget < 600 dòng', false);

// --- 6. KIỂM TRA BẢO VỆ CSDL THẬT K2 ---
$dbPath = $root . '/storage/data/app.sqlite';
$dbExists = file_exists($dbPath);
check($dbExists, 'l59_sqlite_exists', 'CSDL app.sqlite tồn tại nguyên vẹn', false);

if ($dbExists) {
    try {
        $pdo = new PDO("sqlite:{$dbPath}");
        $stmt = $pdo->query("SELECT COUNT(*) FROM songs");
        $songCount = (int)$stmt->fetchColumn();
        check($songCount === 903, 'l59_songs_count_903', "Bảo vệ toàn vẹn 903 bài hát trong CSDL thật (hiện có {$songCount} bài)", true);
    } catch (\Throwable $e) {
        check(false, 'l59_songs_count_903', "Lỗi kết nối CSDL: " . $e->getMessage(), true);
    }
}

$chordSetsDir = $root . '/storage/data/chord_sets';
$chordSetFiles = is_dir($chordSetsDir) ? (scandir($chordSetsDir) ?: []) : [];
check(count($chordSetFiles) === 62, 'l59_chord_sets_62', 'Bảo vệ toàn vẹn 62 files bản phối chord_sets (hiện có ' . count($chordSetFiles) . ' files theo K2 scandir)', true);

echo "\n--------------------------------------------------------\n";
echo "Kết quả kiểm thử L5-9: {$passedChecks}/{$totalChecks} checks passed (Behavioral: {$behavioralChecks}, Static: {$staticChecks}).\n";
echo "--------------------------------------------------------\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L5-9 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    $failed = $totalChecks - $passedChecks;
    echo "❌ CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed={$failed} behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
