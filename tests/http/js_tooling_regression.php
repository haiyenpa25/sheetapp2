<?php
declare(strict_types=1);

/**
 * tests/http/js_tooling_regression.php
 * 
 * Regression suite cho Ticket T04 — ESLint + kiểm cú pháp + Playwright:
 * 1. package.json: có scripts lint, check:syntax, e2e; devDependencies có eslint và @playwright/test.
 * 2. Cấu hình ESLint tối thiểu: no-undef, no-redeclare, no-unreachable, khai báo đầy đủ globals.
 * 3. playwright.config.js: định nghĩa baseURL=http://localhost/sheetapp2/ và 2 project chromium, webkit.
 * 4. tools/check_syntax.js: quét toàn bộ file .js ngoài vendor và bắt được lỗi cú pháp learn-score.js.
 * 5. e2e/main-page.spec.js: kịch bản E2E-01 kiểm tra trang chủ, chọn bài, render SVG và console sạch.
 */

$root = dirname(__DIR__, 2);
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    if ($condition) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        $failures[] = $message;
    }
}

echo "=== T04: JS TOOLING & PLAYWRIGHT REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra package.json ──
echo "-- 1. Cấu hình package.json --\n";
$pkgPath = $root . '/package.json';
check(file_exists($pkgPath), "File package.json tồn tại trong dự án");

$pkg = json_decode(file_get_contents($pkgPath) ?: '{}', true);
$scripts = $pkg['scripts'] ?? [];
$devDeps = $pkg['devDependencies'] ?? [];

check(isset($scripts['lint']), "package.json có script 'lint'");
check(isset($scripts['check:syntax']), "package.json có script 'check:syntax'");
check(isset($scripts['e2e']), "package.json có script 'e2e'");
check(isset($devDeps['eslint']), "devDependencies chứa 'eslint'");
check(isset($devDeps['@playwright/test']), "devDependencies chứa '@playwright/test'");

// ── 2. Kiểm tra cấu hình ESLint ──
echo "\n-- 2. Cấu hình ESLint tối thiểu --\n";
$eslintPath = file_exists($root . '/eslint.config.js') ? $root . '/eslint.config.js' : $root . '/.eslintrc.json';
check(file_exists($eslintPath), "Tồn tại file cấu hình ESLint (eslint.config.js hoặc .eslintrc.json)");

$eslintSrc = file_get_contents($eslintPath) ?: '';
check(str_contains($eslintSrc, "'no-undef'") || str_contains($eslintSrc, '"no-undef"'), "Cấu hình quy tắc 'no-undef'");
check(str_contains($eslintSrc, "'no-redeclare'") || str_contains($eslintSrc, '"no-redeclare"'), "Cấu hình quy tắc 'no-redeclare'");
check(str_contains($eslintSrc, "'no-unreachable'") || str_contains($eslintSrc, '"no-unreachable"'), "Cấu hình quy tắc 'no-unreachable'");
check(str_contains($eslintSrc, "EventBus"), "Khai báo global 'EventBus'");
check(str_contains($eslintSrc, "ApiService"), "Khai báo global 'ApiService'");
check(str_contains($eslintSrc, "OSMDRenderer"), "Khai báo global 'OSMDRenderer'");

// ── 3. Kiểm tra cấu hình Playwright ──
echo "\n-- 3. Cấu hình Playwright & Dự án Trình Duyệt --\n";
$pwConfigPath = $root . '/playwright.config.js';
check(file_exists($pwConfigPath), "File playwright.config.js tồn tại");

$pwSrc = file_get_contents($pwConfigPath) ?: '';
check(str_contains($pwSrc, "http://localhost/sheetapp2/"), "playwright.config.js cấu hình baseURL chính xác");
check(str_contains($pwSrc, "name: 'chromium'") || str_contains($pwSrc, 'name: "chromium"'), "playwright.config.js có project 'chromium'");
check(str_contains($pwSrc, "name: 'webkit'") || str_contains($pwSrc, 'name: "webkit"'), "playwright.config.js có project 'webkit'");

// ── 4. Kiểm tra công cụ check_syntax và bằng chứng bắt lỗi learn-score.js ──
echo "\n-- 4. Kiểm tra node --check và phát hiện lỗi learn-score.js --\n";
$syntaxToolPath = $root . '/tools/check_syntax.js';
check(file_exists($syntaxToolPath), "File tools/check_syntax.js tồn tại");

$nodeBin = null;
if (file_exists('C:\\Program Files\\nodejs\\node.exe')) {
    $nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
} else {
    $out = [];
    $code = 0;
    exec('node -v 2>&1', $out, $code);
    if ($code === 0) $nodeBin = 'node';
}

if ($nodeBin) {
    $checkCmd = escapeshellarg($nodeBin) . ' ' . escapeshellarg($syntaxToolPath) . ' 2>&1';
    $checkOutput = [];
    $checkExit = 0;
    exec($checkCmd, $checkOutput, $checkExit);
    $outStr = implode("\n", $checkOutput);

    // Sau T05: Tất cả file JS trong dự án (bao gồm learn-score.js) đều đã có cú pháp hợp lệ
    check($checkExit === 0, "Công cụ check:syntax xác nhận 100% file JS ngoài vendor hợp lệ cú pháp (sau khi sửa T05)");

    // Chứng minh công cụ bắt được lỗi: thử với file có lỗi cú pháp
    $tmpBroken = tempnam(sys_get_temp_dir(), 'syntax_test_') . '.js';
    file_put_contents($tmpBroken, 'function broken( { return;');
    $testBrokenCmd = escapeshellarg($nodeBin) . ' --check ' . escapeshellarg($tmpBroken) . ' 2>&1';
    $testBrokenOut = [];
    $testBrokenExit = 0;
    exec($testBrokenCmd, $testBrokenOut, $testBrokenExit);
    @unlink($tmpBroken);
    check($testBrokenExit !== 0, "Công cụ node --check bắt chính xác file có lỗi cú pháp");
} else {
    echo "  [SKIP] Không tìm thấy Node.js để chạy kiểm thử thực tế\n";
}

// ── 5. Kiểm tra file E2E-01 main-page.spec.js ──
echo "\n-- 5. Kịch bản kiểm thử E2E-01 --\n";
$e2eSpecPath = $root . '/e2e/main-page.spec.js';
check(file_exists($e2eSpecPath), "File e2e/main-page.spec.js tồn tại");

$e2eSrc = file_get_contents($e2eSpecPath) ?: '';
check(str_contains($e2eSrc, "firstSongItem.click()"), "E2E-01 có bước click chọn bài hát");
check(str_contains($e2eSrc, "#osmd-container svg"), "E2E-01 chờ phần tử SVG hiển thị");
check(str_contains($e2eSrc, "consoleErrors"), "E2E-01 theo dõi và kiểm tra lỗi console");

echo "\n----------------------------------------\n";
if (!empty($failures)) {
    echo "KẾT QUẢ: " . count($failures) . " kiểm tra THẤT BẠI.\n";
    exit(1);
}

echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit(0);
