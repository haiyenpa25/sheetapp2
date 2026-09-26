<?php
declare(strict_types=1);

/**
 * tests/run_all_tests.php
 * 
 * Lệnh chạy test tổng hợp (Unified Test Runner) cho SheetApp2:
 * 1. PHP Syntax Check (php -l) trên toàn bộ codebase.
 * 2. Test Fixture & In-memory SQLite Integrity Check.
 * 3. Tự động phát hiện và thực thi tất cả Regression Test Suites (tests/**\/*_regression.php).
 * 4. Đếm số lượng PASS / FAIL thật từ output của từng suite.
 * 5. Bắt PHP Warning / Deprecated / Fatal error làm lỗi thất bại.
 * 6. Giám sát và chặn rò rỉ file test vào storage/data/live_sync/.
 * 
 * Cách dùng:
 *   php tests/run_all_tests.php
 */

$startTime = microtime(true);
$root = dirname(__DIR__);
$phpBinary = PHP_BINARY ?: 'php';

echo "========================================================\n";
echo "   SheetApp2 — Unified Test Runner & Quality Gate CI   \n";
echo "========================================================\n\n";

$failedSuites = [];
$passedSuites = 0;
$totalChecksPassed = 0;
$totalChecksFailed = 0;

// Giám sát thư mục storage/data/live_sync/ để phát hiện rò rỉ file
$liveSyncDir = $root . '/storage/data/live_sync';
$initialLiveSyncFiles = is_dir($liveSyncDir) ? (scandir($liveSyncDir) ?: []) : [];

// ==========================================
// 1. PHP SYNTAX CHECK (LINT)
// ==========================================
echo "[1/3] Kiểm tra cú pháp PHP (php -l)... ";
$phpFiles = [];
$scanDirs = [
    $root . '/api',
    $root . '/includes',
    $root . '/tools',
    $root . '/tests',
    $root . '/editor',
    $root . '/manager',
    $root . '/members',
    $root . '/learn',
    $root . '/live-band'
];

foreach ($scanDirs as $dir) {
    if (!is_dir($dir)) continue;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $phpFiles[] = $file->getPathname();
        }
    }
}
$phpFiles[] = $root . '/index.php';

$lintErrors = 0;
foreach ($phpFiles as $file) {
    $output = [];
    $returnVar = 0;
    exec(escapeshellcmd($phpBinary) . ' -l ' . escapeshellarg($file) . ' 2>&1', $output, $returnVar);
    if ($returnVar !== 0) {
        $lintErrors++;
        echo "\n  ❌ Lỗi cú pháp tại: " . str_replace($root . '/', '', str_replace('\\', '/', $file)) . "\n";
        echo "     " . implode("\n     ", $output) . "\n";
    }
}

if ($lintErrors === 0) {
    echo "PASS (" . count($phpFiles) . " files)\n";
    $passedSuites++;
} else {
    echo "FAIL ({$lintErrors} files có lỗi)\n";
    $failedSuites[] = "PHP Syntax Lint ({$lintErrors} errors)";
}

// ==========================================
// 1b. JAVASCRIPT SYNTAX CHECK (npm run check:syntax)
// ==========================================
echo "[1b/3] Kiểm tra cú pháp JavaScript (check:syntax)... ";
$nodeBin = null;
if (PHP_OS_FAMILY === 'Windows' && file_exists('C:\\Program Files\\nodejs\\node.exe')) {
    $nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
} else {
    $out = [];
    $code = 0;
    exec('node -v 2>&1', $out, $code);
    if ($code === 0) $nodeBin = 'node';
}

if (!$nodeBin) {
    echo "SKIP (Không tìm thấy Node.js trên hệ thống)\n";
} else {
    $syntaxScript = $root . '/tools/check_syntax.js';
    $jsOut = [];
    $jsCode = 0;
    exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($syntaxScript) . ' 2>&1', $jsOut, $jsCode);
    if ($jsCode === 0) {
        echo "PASS (Tất cả file JS cú pháp hợp lệ)\n";
    } else {
        echo "FAIL (Phát hiện lỗi cú pháp JavaScript)\n";
        foreach ($jsOut as $line) {
            echo "     ↳ {$line}\n";
        }
        $failedSuites[] = "JavaScript Syntax Lint Error";
    }
}

// ==========================================
// 2. IN-MEMORY TEST FIXTURE & INTEGRITY
// ==========================================
echo "[2/3] Kiểm tra Test DB Fixture (SQLite in-memory)... ";
try {
    require_once $root . '/tests/fixtures/test_db_fixture.php';
    $fixtureDb = createTestDatabase();
    $integrity = $fixtureDb->query('PRAGMA integrity_check')->fetchColumn();
    $fkCheck = $fixtureDb->query('PRAGMA foreign_key_check')->fetchAll(PDO::FETCH_ASSOC);
    $userCount = (int)$fixtureDb->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $songCount = (int)$fixtureDb->query('SELECT COUNT(*) FROM songs')->fetchColumn();

    if ($integrity === 'ok' && empty($fkCheck) && $userCount === 3 && $songCount === 2) {
        echo "PASS (Integrity ok, FKs ok, Seed ok)\n";
        $passedSuites++;
    } else {
        echo "FAIL (Dữ liệu fixture không khớp)\n";
        $failedSuites[] = "Test DB Fixture Validation";
    }
} catch (Throwable $e) {
    echo "FAIL (" . $e->getMessage() . ")\n";
    $failedSuites[] = "Test DB Fixture Validation (" . $e->getMessage() . ")";
}

// ==========================================
// 3. TỰ ĐỘNG QUÉT VÀ CHẠY REGRESSION SUITES
// ==========================================
echo "[3/3] Quét và chạy toàn bộ Regression Test Suites:\n";

$regressionSuites = [];
$testsDir = $root . '/tests';
if (is_dir($testsDir)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($testsDir, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->isFile() && str_ends_with($file->getFilename(), '_regression.php')) {
            $regressionSuites[] = str_replace('\\', '/', $file->getPathname());
        }
    }
}

sort($regressionSuites);
$totalSuitesCount = count($regressionSuites);
echo "  → Tìm thấy {$totalSuitesCount} bộ test regression suites.\n\n";

$suiteIndex = 0;
foreach ($regressionSuites as $suitePath) {
    $suiteIndex++;
    $relPath = str_replace(str_replace('\\', '/', $root) . '/', '', $suitePath);
    
    $output = [];
    $exitCode = 0;
    exec(escapeshellcmd($phpBinary) . ' ' . escapeshellarg($suitePath) . ' 2>&1', $output, $exitCode);

    // Đếm số check PASS và FAIL thật từ output
    $passCount = 0;
    $failCount = 0;
    $hasWarningOrDeprecated = false;
    $errorLines = [];

    foreach ($output as $line) {
        if (preg_match('/(?:\[PASS\]|PASS:|✅ PASS:)/i', $line)) {
            $passCount++;
        }
        if (preg_match('/(?:\[FAIL\]|FAIL:|❌ FAIL:)/i', $line)) {
            $failCount++;
            $errorLines[] = $line;
        }
        if (preg_match('/(PHP Warning|PHP Deprecated|PHP Notice|PHP Fatal error|Fatal error|Parse error)/i', $line)) {
            $hasWarningOrDeprecated = true;
            $errorLines[] = $line;
        }
    }

    $totalChecksPassed += $passCount;
    $totalChecksFailed += $failCount;

    $isSuccess = ($exitCode === 0 && !$hasWarningOrDeprecated && $failCount === 0);

    if ($isSuccess) {
        $countDisplay = ($passCount > 0) ? "{$passCount} checks pass" : "exit 0";
        echo "  [{$suiteIndex}/{$totalSuitesCount}] ✅ PASS: {$relPath} ({$countDisplay})\n";
        $passedSuites++;
    } else {
        $reasons = [];
        if ($exitCode !== 0) $reasons[] = "exit code {$exitCode}";
        if ($failCount > 0) $reasons[] = "{$failCount} check FAIL";
        if ($hasWarningOrDeprecated) $reasons[] = "chứa Warning/Deprecated/Error";
        $reasonStr = implode(', ', $reasons);

        echo "  [{$suiteIndex}/{$totalSuitesCount}] ❌ FAIL: {$relPath} ({$reasonStr})\n";
        foreach ($errorLines as $err) {
            echo "     ↳ " . trim($err) . "\n";
        }
        $failedSuites[] = "{$relPath} ({$reasonStr})";
    }
}

// ==========================================
// 4. KIỂM TRA RÒ RỈ FILE LIVE SYNC
// ==========================================
echo "\n[Kiểm tra rò rỉ file test vào storage/data/live_sync/]... ";
$finalLiveSyncFiles = is_dir($liveSyncDir) ? (scandir($liveSyncDir) ?: []) : [];
$leakedFiles = array_values(array_diff($finalLiveSyncFiles, $initialLiveSyncFiles));

if (!empty($leakedFiles)) {
    echo "FAIL (Phát hiện " . count($leakedFiles) . " file mới rò rỉ)\n";
    foreach ($leakedFiles as $lf) {
        echo "  ❌ Rò rỉ: storage/data/live_sync/{$lf}\n";
    }
    $failedSuites[] = "LiveSync Storage Leak (" . count($leakedFiles) . " files)";
} else {
    echo "PASS (Không có rò rỉ)\n";
}

// ==========================================
// KẾT QUẢ TỔNG HỢP
// ==========================================
$duration = round(microtime(true) - $startTime, 2);
$isAllPass = empty($failedSuites);

// Lưu tóm tắt kết quả kiểm thử vào storage/logs/test_summary.json
$summaryData = [
    'timestamp' => date('Y-m-d H:i:s'),
    'duration_seconds' => $duration,
    'total_suites' => $totalSuitesCount,
    'passed_suites' => $passedSuites,
    'failed_suites' => count($failedSuites),
    'total_checks_passed' => $totalChecksPassed,
    'total_checks_failed' => $totalChecksFailed,
    'status' => $isAllPass ? 'ALL PASS' : 'FAIL'
];
@file_put_contents($root . '/storage/logs/test_summary.json', json_encode($summaryData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử:\n";
echo "  - Thời gian thực thi: {$duration}s\n";
echo "  - File PHP đã lint: " . count($phpFiles) . "\n";
echo "  - Regression Suites đã chạy: {$totalSuitesCount}\n";
echo "  - Tổng số test checks ghi nhận: {$totalChecksPassed} passed, {$totalChecksFailed} failed\n";

if ($isAllPass) {
    echo "  - Trạng thái tổng thể: ✅ TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS)\n";
    echo "--------------------------------------------------------\n";
    exit(0);
} else {
    echo "  - Trạng thái tổng thể: ❌ CÓ " . count($failedSuites) . " HẠNG MỤC THẤT BẠI:\n";
    foreach ($failedSuites as $fail) {
        echo "    * {$fail}\n";
    }
    echo "--------------------------------------------------------\n";
    exit(1);
}
