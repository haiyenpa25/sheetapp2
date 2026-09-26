<?php
declare(strict_types=1);

/**
 * tests/run_all_tests.php
 * 
 * Lệnh chạy test tổng hợp (Unified Test Runner & Quality Gate CI) cho SheetApp2:
 * 1. PHP Syntax Check (php -l) trên toàn bộ codebase.
 * 2. JavaScript Syntax Check (tools/check_syntax.js) & ESLint (--js / --all).
 * 3. Test Fixture & In-memory SQLite Integrity Check.
 * 4. Tự động phát hiện và thực thi tất cả Regression Test Suites (tests/**\/*_regression.php).
 * 5. Bắt buộc mỗi suite phải in dòng SUITE_COMPLETE total=<n> (K4).
 * 6. Xử lý [SKIP] khi dịch vụ phụ thuộc chưa bật; biến thành FAIL khi có cờ --strict (K4).
 * 7. Phân loại và đếm riêng checks Behavioral vs Static để tính tỷ lệ trung thực (K5).
 * 8. Giám sát và chặn rò rỉ file test vào storage/data/live_sync/.
 * 9. Kiểm thử E2E Playwright (--e2e / --all).
 * 
 * Cách dùng:
 *   php tests/run_all_tests.php [--strict] [--js] [--e2e] [--all]
 */

$startTime = microtime(true);
$root = dirname(__DIR__);
$phpBinary = PHP_BINARY ?: 'php';

// Cấu hình PATH trên Windows để nhận diện node, npx, git
if (PHP_OS_FAMILY === 'Windows') {
    $currentPath = getenv('PATH') ?: '';
    $nodeDir = 'C:\\Program Files\\nodejs';
    $gitDir = 'C:\\Program Files\\Git\\bin';
    if (!str_contains($currentPath, $nodeDir)) {
        putenv("PATH={$nodeDir};{$gitDir};" . $currentPath);
        $_ENV['PATH'] = "{$nodeDir};{$gitDir};" . $currentPath;
    }
}

// Phân tích tham số dòng lệnh CLI
$isStrict = in_array('--strict', $argv, true) || in_array('--all', $argv, true);
$runJsLint = in_array('--js', $argv, true) || in_array('--all', $argv, true);
$runE2e = in_array('--e2e', $argv, true) || in_array('--all', $argv, true);

echo "========================================================\n";
echo "   SheetApp2 — Unified Test Runner & Quality Gate CI   \n";
echo "   Chế độ: " . ($isStrict ? "[STRICT] " : "") . ($runJsLint ? "[JS-LINT] " : "") . ($runE2e ? "[E2E] " : "") . "\n";
echo "========================================================\n\n";

$failedSuites = [];
$skippedSuites = [];
$passedSuites = 0;
$totalChecksPassed = 0;
$totalBehavioralPassed = 0;
$totalStaticPassed = 0;
$totalChecksFailed = 0;

// Giám sát thư mục storage/data/live_sync/ để phát hiện rò rỉ file
$liveSyncDir = $root . '/storage/data/live_sync';
$initialLiveSyncFiles = is_dir($liveSyncDir) ? (scandir($liveSyncDir) ?: []) : [];

// ==========================================
// 1. PHP SYNTAX CHECK (LINT)
// ==========================================
echo "[1/4] Kiểm tra cú pháp PHP (php -l)... ";
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
// 1b. JAVASCRIPT SYNTAX & ESLINT CHECK
// ==========================================
echo "[1b/4] Kiểm tra cú pháp JavaScript (check:syntax)... ";
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

    if ($runJsLint) {
        echo "       → Chạy ESLint (npx eslint assets/js editor manager live-band learn)... ";
        $eslintOut = [];
        $eslintCode = 0;
        $eslintCmd = 'npx eslint assets/js editor manager live-band learn --no-error-on-unmatched-pattern';
        exec($eslintCmd . ' 2>&1', $eslintOut, $eslintCode);
        if ($eslintCode === 0) {
            echo "PASS (0 lỗi lint)\n";
        } else {
            echo "FAIL (ESLint có cảnh báo hoặc lỗi)\n";
            foreach (array_slice($eslintOut, 0, 10) as $el) {
                echo "         ↳ {$el}\n";
            }
            $failedSuites[] = "ESLint Validation";
        }
    }
}

// ==========================================
// 2. IN-MEMORY TEST FIXTURE & INTEGRITY
// ==========================================
echo "[2/4] Kiểm tra Test DB Fixture (SQLite in-memory)... ";
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
echo "[3/4] Quét và chạy toàn bộ Regression Test Suites:\n";

// Danh mục các suite phân tích tĩnh (Static Analysis: regex/file checks)
$staticAnalysisSuites = [
    'modal_a11y_regression.php',
    'modular_architecture_regression.php',
    'fetch_anti_regression.php',
    'page_performance_regression.php',
    'web_surface_regression.php',
    'xss_output_regression.php',
    'service_worker_cache_regression.php',
    'js_tooling_regression.php',
    'test_suite_hygiene_regression.php',
    'app_shell_navigation_regression.php',
    'api_contract_regression.php',
    'managed_path_regression.php',
    'response_contract_regression.php',
    'error_disclosure_regression.php',
    'auth_regression.php',
    'write_auth_regression.php',
    'practice_ownership_regression.php',
    'learning_ownership_regression.php',
    'live_sync_regression.php',
    'session_ownership_regression.php',
    'session_rate_limit_regression.php',
    'request_origin_regression.php',
    'import_ssrf_regression.php',
    'setlist_ownership_regression.php',
    'ui_bugs_regression.php',
    'shared_platform_regression.php',
    'projector_service_plan_regression.php',
    'race_condition_regression.php',
    'chord_set_guard_regression.php'
];

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
    $baseName = basename($suitePath);
    $isStaticSuite = in_array($baseName, $staticAnalysisSuites, true);

    $output = [];
    $exitCode = 0;
    exec(escapeshellcmd($phpBinary) . ' ' . escapeshellarg($suitePath) . ' 2>&1', $output, $exitCode);

    $passCount = 0;
    $behavioralCount = 0;
    $staticCount = 0;
    $failCount = 0;
    $hasWarningOrDeprecated = false;
    $hasSuiteComplete = false;
    $suiteCompleteTotal = null;
    $isSkipped = false;
    $skipReason = '';
    $errorLines = [];

    foreach ($output as $line) {
        if (preg_match('/SUITE_COMPLETE\s+total=(\d+)/i', $line, $scm)) {
            $hasSuiteComplete = true;
            $suiteCompleteTotal = (int)$scm[1];
        }
        if (preg_match('/\[SKIP\]\s*(.*)/i', $line, $skm)) {
            $isSkipped = true;
            $skipReason = trim($skm[1] ?? 'Dịch vụ phụ thuộc không khả dụng');
        }

        if (preg_match('/(?:\[PASS:B\]|PASS:B)/i', $line)) {
            $passCount++;
            $behavioralCount++;
        } elseif (preg_match('/(?:\[PASS:S\]|PASS:S)/i', $line)) {
            $passCount++;
            $staticCount++;
        } elseif (preg_match('/(?:\[PASS\]|PASS:|✅ PASS:)/i', $line)) {
            $passCount++;
            if ($isStaticSuite) {
                $staticCount++;
            } else {
                $behavioralCount++;
            }
        }

        if (preg_match('/(?:\[FAIL\]|\[FAIL:B\]|\[FAIL:S\]|FAIL:|❌ FAIL:)/i', $line)) {
            $failCount++;
            $errorLines[] = $line;
        }

        if (preg_match('/(PHP Warning|PHP Deprecated|PHP Notice|PHP Fatal error|Fatal error|Parse error)/i', $line)) {
            $hasWarningOrDeprecated = true;
            $errorLines[] = $line;
        }
    }

    // Nếu không đếm được check trực tiếp nhưng có SUITE_COMPLETE
    if ($passCount === 0 && $suiteCompleteTotal !== null && $suiteCompleteTotal > 0) {
        $passCount = $suiteCompleteTotal;
        if ($isStaticSuite) {
            $staticCount = $suiteCompleteTotal;
        } else {
            $behavioralCount = $suiteCompleteTotal;
        }
    }

    $totalChecksPassed += $passCount;
    $totalBehavioralPassed += $behavioralCount;
    $totalStaticPassed += $staticCount;
    $totalChecksFailed += $failCount;

    if ($isSkipped) {
        if ($isStrict) {
            $failedSuites[] = "{$relPath} (SKIPPED nhưng chạy với cờ --strict: {$skipReason})";
            echo "  [{$suiteIndex}/{$totalSuitesCount}] ❌ FAIL (STRICT SKIP): {$relPath} ({$skipReason})\n";
        } else {
            $skippedSuites[] = "{$relPath} ({$skipReason})";
            echo "  [{$suiteIndex}/{$totalSuitesCount}] ⚠️ SKIP: {$relPath} ({$skipReason})\n";
        }
    } else {
        $reasons = [];
        if ($exitCode !== 0) $reasons[] = "exit code {$exitCode}";
        if ($failCount > 0) $reasons[] = "{$failCount} check FAIL";
        if ($hasWarningOrDeprecated) $reasons[] = "chứa Warning/Deprecated/Error";
        if (!$hasSuiteComplete) $reasons[] = "thiếu dòng SUITE_COMPLETE total=<n> (thoát sớm hoặc lỗi ngầm)";

        $isSuccess = ($exitCode === 0 && !$hasWarningOrDeprecated && $failCount === 0 && $hasSuiteComplete);

        if ($isSuccess) {
            $countDisplay = ($passCount > 0) ? "{$passCount} checks pass" : "exit 0";
            echo "  [{$suiteIndex}/{$totalSuitesCount}] ✅ PASS: {$relPath} ({$countDisplay})\n";
            $passedSuites++;
        } else {
            $reasonStr = implode(', ', $reasons);
            echo "  [{$suiteIndex}/{$totalSuitesCount}] ❌ FAIL: {$relPath} ({$reasonStr})\n";
            foreach ($errorLines as $err) {
                echo "     ↳ " . trim($err) . "\n";
            }
            $failedSuites[] = "{$relPath} ({$reasonStr})";
        }
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
// 5. PLAYWRIGHT E2E TESTS (--e2e / --all)
// ==========================================
if ($runE2e) {
    echo "\n[5/5] Kiểm tra E2E Playwright (npx playwright test)... \n";
    $e2eOut = [];
    $e2eCode = 0;
    passthru('npx playwright test', $e2eCode);
    if ($e2eCode === 0) {
        echo "PASS (Toàn bộ kiểm thử E2E Playwright đều đạt)\n";
    } else {
        echo "FAIL (Phát hiện kiểm thử E2E thất bại)\n";
        $failedSuites[] = "Playwright E2E Tests";
    }
}

// ==========================================
// KẾT QUẢ TỔNG HỢP & GHI TEST_SUMMARY.JSON
// ==========================================
$duration = round(microtime(true) - $startTime, 2);
$isAllPass = empty($failedSuites);
$behavioralRatioPct = ($totalChecksPassed > 0) ? round(($totalBehavioralPassed / $totalChecksPassed) * 100, 1) : 0.0;

// Lưu tóm tắt kết quả kiểm thử vào storage/logs/test_summary.json (K5 SSOT)
$summaryData = [
    'timestamp' => date('Y-m-d H:i:s'),
    'duration_seconds' => $duration,
    'total_suites' => $totalSuitesCount,
    'passed_suites' => $passedSuites,
    'failed_suites' => count($failedSuites),
    'skipped_suites' => count($skippedSuites),
    'total_checks_passed' => $totalChecksPassed,
    'behavioral_checks_passed' => $totalBehavioralPassed,
    'static_checks_passed' => $totalStaticPassed,
    'behavioral_ratio_pct' => $behavioralRatioPct,
    'total_checks_failed' => $totalChecksFailed,
    'status' => $isAllPass ? 'ALL PASS' : 'FAIL'
];
@file_put_contents($root . '/storage/logs/test_summary.json', json_encode($summaryData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Unified Quality Gate CI:\n";
echo "  - Thời gian thực thi: {$duration}s\n";
echo "  - File PHP đã lint: " . count($phpFiles) . "\n";
echo "  - Regression Suites đã chạy: {$totalSuitesCount} (Pass: {$passedSuites}, Skip: " . count($skippedSuites) . ", Fail: " . count($failedSuites) . ")\n";
echo "  - Tổng số test checks ghi nhận: {$totalChecksPassed} passed, {$totalChecksFailed} failed\n";
echo "  - Phân loại kiểm thử: {$totalBehavioralPassed} Behavioral (" . $behavioralRatioPct . "%), {$totalStaticPassed} Static\n";

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
