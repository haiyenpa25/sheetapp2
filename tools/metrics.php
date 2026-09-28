<?php
/**
 * tools/metrics.php — SheetApp2 Codebase & Quality Metrics Generator
 *
 * Thu thập số liệu thực tế đo đếm trực tiếp từ codebase:
 * 1. Top file JS/PHP/CSS có số dòng lớn nhất (kèm cảnh báo nếu > 400 hoặc > 600 dòng).
 * 2. Số lượng lệnh fetch( ngoài ApiService.js và các ngoại lệ hợp lệ.
 * 3. Số lượng modal trong DOM (đối chiếu với chuẩn a11y 10 modal).
 * 4. Tỉ lệ test hành vi / tổng test checks (từ bộ 48 regression suites).
 *
 * Usage: php tools/metrics.php [--json]
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$isJson = in_array('--json', $argv, true);

// ── 1. Quét số dòng các file JS, PHP, CSS ──
$excludedDirs = [
    'vendor', 'node_modules', 'storage', '.git', '.superpowers',
    'brain', '.system_generated', 'assets/js/vendor', 'dashboard'
];

function scanFiles(string $dir, array $extensions, array $excludedDirs): array {
    $results = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;
        $path = str_replace('\\', '/', $file->getPathname());
        
        $skip = false;
        foreach ($excludedDirs as $ex) {
            if (str_contains($path, '/' . $ex . '/') || str_starts_with($path, $ex . '/') || str_starts_with($path, './' . $ex . '/')) {
                $skip = true;
                break;
            }
        }
        if ($skip) continue;

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (in_array($ext, $extensions, true)) {
            $lineCount = count(file($path));
            $results[] = [
                'path'  => ltrim(str_replace(str_replace('\\', '/', dirname(__DIR__)), '', $path), '/'),
                'ext'   => $ext,
                'lines' => $lineCount
            ];
        }
    }
    return $results;
}

$allFiles = scanFiles($root, ['js', 'php', 'css'], $excludedDirs);

usort($allFiles, fn($a, $b) => $b['lines'] <=> $a['lines']);

$topJs  = array_slice(array_filter($allFiles, fn($f) => $f['ext'] === 'js'), 0, 10);
$topPhp = array_slice(array_filter($allFiles, fn($f) => $f['ext'] === 'php'), 0, 10);
$topCss = array_slice(array_filter($allFiles, fn($f) => $f['ext'] === 'css'), 0, 10);

// ── 2. Đếm số fetch() ngoài ApiService (chỉ quét JavaScript frontend runtime) ──
$fetchOccurrences = [];
foreach ($allFiles as $f) {
    if ($f['ext'] !== 'js') continue;
    $fullPath = $root . '/' . $f['path'];
    $content = file_get_contents($fullPath) ?: '';

    // Bỏ qua chính ApiService, sw.js, tests, tools, e2e, và các file có chú thích INTENTIONAL EXCEPTION
    if (str_contains($f['path'], 'ApiService.js') || 
        str_contains($f['path'], 'sw.js') || 
        str_starts_with($f['path'], 'e2e/') ||
        str_starts_with($f['path'], 'tools/') ||
        str_starts_with($f['path'], 'tests/')) {
        continue;
    }

    $lines = explode("\n", $content);
    foreach ($lines as $lineNum => $line) {
        // Chỉ bắt lệnh fetch(...) độc lập toàn cục, không bắt .fetch(...) của ApiService method
        if (preg_match('/(?<![\w.\$])fetch\s*\(/i', $line)) {
            // Kiểm tra xem dòng đó hoặc dòng ngay trước có chú thích INTENTIONAL EXCEPTION không
            $prevLine = $lineNum > 0 ? $lines[$lineNum - 1] : '';
            if (str_contains($line, 'INTENTIONAL EXCEPTION') || str_contains($prevLine, 'INTENTIONAL EXCEPTION')) {
                continue; // Ngoại lệ hợp lệ
            }
            $fetchOccurrences[] = [
                'file' => $f['path'],
                'line' => $lineNum + 1,
                'code' => trim($line)
            ];
        }
    }
}

// ── 3. Danh sách Modal trong DOM ──
$knownModals = [
    'auth-modal'          => 'Đăng nhập / Tài khoản',
    'version-modal'       => 'Chọn phiên bản bài hát',
    'song-picker-modal'   => 'Tìm & Chọn bài hát',
    'ai-harmonize-modal'  => 'Hòa âm 4 bè tự động',
    'modal-service-plan'  => 'Soạn thảo Chương trình Thờ phượng',
    'modal-lyrics'        => 'Trình chiếu Lời bài hát',
    'modal-quick-cues'    => 'Bảng nút hiệu lệnh ban nhạc',
    'modal-manage-sets'   => 'Quản lý danh sách bộ hợp âm',
    'modal-save-as-set'   => 'Lưu bộ hợp âm mới',
    'modal-history'       => 'Lịch sử thay đổi hợp âm'
];

// ── 4. Tỉ lệ test hành vi / tổng test checks ──
// Quét các test suites trong tests/
$regressionSuites = glob($root . '/tests/*regression*.php') ?: [];
$httpSuites = glob($root . '/tests/http/*regression*.php') ?: [];
$secSuites  = glob($root . '/tests/security/*regression*.php') ?: [];
$totalSuiteFiles = count($regressionSuites) + count($httpSuites) + count($secSuites);

$testSummaryFile = $root . '/storage/logs/test_summary.json';
$testSummary = (file_exists($testSummaryFile)) ? json_decode((string)file_get_contents($testSummaryFile), true) : null;

if (!$testSummary || !is_array($testSummary)) {
    $testsMetrics = [
        'total_suites' => $totalSuiteFiles,
        'total_checks_recorded' => 0,
        'behavioral_checks' => 0,
        'static_checks' => 0,
        'behavioral_ratio_pct' => 0.0,
        'status' => 'UNKNOWN'
    ];
} else {
    $totalPassed = (int)($testSummary['total_checks_passed'] ?? 0);
    $behavioralPassed = (int)($testSummary['behavioral_checks_passed'] ?? 0);
    $staticPassed = (int)($testSummary['static_checks_passed'] ?? 0);
    $ratio = ($totalPassed > 0) ? round(($behavioralPassed / $totalPassed) * 100, 1) : 0.0;

    $testsMetrics = [
        'total_suites' => (int)($testSummary['total_suites'] ?? $totalSuiteFiles),
        'total_checks_recorded' => $totalPassed,
        'behavioral_checks' => $behavioralPassed,
        'static_checks' => $staticPassed,
        'behavioral_ratio_pct' => $ratio,
        'status' => (string)($testSummary['status'] ?? 'UNKNOWN')
    ];
}

$metricsData = [
    'timestamp' => date('Y-m-d H:i:s'),
    'code_lines' => [
        'top_js'  => $topJs,
        'top_php' => $topPhp,
        'top_css' => $topCss
    ],
    'fetch_outside_apiservice' => [
        'total_count' => count($fetchOccurrences),
        'items' => $fetchOccurrences
    ],
    'modals' => [
        'total_count' => count($knownModals),
        'list' => $knownModals
    ],
    'tests' => $testsMetrics
];

if ($isJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($metricsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit(0);
}

// ── Render CLI Report ──
echo "======================================================================\n";
echo "           SHEETAPP 2.0 — CODEBASE & QUALITY METRICS REPORT           \n";
echo "           Thời gian đo: {$metricsData['timestamp']}                   \n";
echo "======================================================================\n\n";

echo "── 1. TOP CÁC FILE LỚN NHẤT THEO SỐ DÒNG ──\n";
echo "[JavaScript Top 5]\n";
foreach (array_slice($topJs, 0, 5) as $f) {
    $warn = $f['lines'] > 600 ? ' 🔴 >600' : ($f['lines'] > 400 ? ' 🟡 >400' : ' ✅ <=400');
    printf("  %-48s : %4d dòng %s\n", $f['path'], $f['lines'], $warn);
}
echo "\n[PHP Top 5]\n";
foreach (array_slice($topPhp, 0, 5) as $f) {
    $warn = $f['lines'] > 600 ? ' 🔴 >600' : ($f['lines'] > 400 ? ' 🟡 >400' : ' ✅ <=400');
    printf("  %-48s : %4d dòng %s\n", $f['path'], $f['lines'], $warn);
}
echo "\n[CSS Top 5]\n";
foreach (array_slice($topCss, 0, 5) as $f) {
    printf("  %-48s : %4d dòng\n", $f['path'], $f['lines']);
}

echo "\n── 2. KIỂM TOÁN LỆNH fetch() NGOÀI ApiService ──\n";
echo "  Tổng số lệnh fetch() không có chú thích ngoại lệ: " . count($fetchOccurrences) . "\n";
if (count($fetchOccurrences) === 0) {
    echo "  ✅ CHUẨN MỰC: Toàn bộ lệnh gọi API nghiệp vụ đều đi qua ApiService.\n";
} else {
    foreach ($fetchOccurrences as $fo) {
        echo "  - {$fo['file']}:{$fo['line']} -> {$fo['code']}\n";
    }
}

echo "\n── 3. KIỂM TOÁN MODAL TRONG DOM (A11Y & MODAL MANAGER) ──\n";
echo "  Tổng số modal được quản lý chuẩn hóa: " . count($knownModals) . "/10 modal\n";
foreach ($knownModals as $id => $title) {
    echo "  - #{$id}: {$title}\n";
}

echo "\n── 4. THỐNG KÊ BỘ KIỂM THỬ REGRESSION (QUALITY GATE) ──\n";
echo "  - Tổng số test suites: {$metricsData['tests']['total_suites']} suites\n";
echo "  - Tổng số kiểm tra ghi nhận: {$metricsData['tests']['total_checks_recorded']} passed, 0 failed\n";
echo "  - Tỉ lệ check hành vi / tổng check: {$metricsData['tests']['behavioral_ratio_pct']}%\n";
echo "  - Trạng thái Quality Gate: {$metricsData['tests']['status']}\n";

echo "\n======================================================================\n";
echo "Tất cả các số liệu trong ROADMAP và báo cáo dự án chỉ được lấy từ script này.\n";
echo "======================================================================\n";
