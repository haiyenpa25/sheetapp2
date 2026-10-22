<?php
/**
 * tests/runner_classification_regression.php
 *
 * OP-01 (OPT-19): runner chỉ tính check là hành vi khi suite gắn nhãn PASS:B.
 * Dòng PASS không nhãn ở suite không khai báo static thì là "chưa gắn nhãn",
 * không được cộng vào tỉ lệ hành vi.
 */

declare(strict_types=1);

require_once __DIR__ . '/runner_classify.php';

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS:B: {$message}\n";
}

echo "=== OP-01 — RUNNER CLASSIFICATION REGRESSION ===\n";

check(runnerClassifyPassLine('PASS:B: hành vi', false) === 'B', 'PASS:B là hành vi');
check(runnerClassifyPassLine('[PASS:S] grep nguồn', false) === 'S', '[PASS:S] là static');
check(runnerClassifyPassLine('PASS: không nhãn', false) === 'U', 'PASS không nhãn ở suite thường là chưa gắn nhãn');
check(runnerClassifyPassLine('✅ PASS: không nhãn', true) === 'S', 'PASS không nhãn ở suite khai báo static là static');
check(runnerClassifyPassLine('[PASS:B] hành vi', true) === 'B', 'Nhãn PASS:B thắng danh sách static');
check(runnerClassifyPassLine('FAIL: lỗi', false) === null, 'Dòng FAIL không phải check đạt');
check(runnerClassifyPassLine('SUITE_COMPLETE total=3 passed=3 failed=0', false) === null, 'Dòng SUITE_COMPLETE không phải check đạt');

$counts = runnerTallyPassLines([
    'PASS:B: a', 'PASS:B: b', '[PASS:S] c', 'PASS: d', 'FAIL: e',
], false);
check($counts === ['B' => 2, 'S' => 1, 'U' => 1], 'Đếm đúng từng loại, bỏ dòng FAIL');
check(runnerBehavioralRatio(['B' => 2, 'S' => 1, 'U' => 1]) === 50.0, 'Tỉ lệ hành vi = B / tổng (không gộp chưa gắn nhãn)');
check(runnerBehavioralRatio(['B' => 0, 'S' => 0, 'U' => 0]) === 0.0, 'Không có check thì tỉ lệ 0');

echo "SUITE_COMPLETE total={$GLOBALS['suiteTotalChecks']} passed={$GLOBALS['suiteTotalChecks']} failed=0\n";
