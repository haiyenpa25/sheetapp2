<?php
/**
 * tests/runner_classify.php
 * Phân loại dòng PASS cho tests/run_all_tests.php (OP-01).
 *
 * B = hành vi (nhãn PASS:B), S = static (nhãn PASS:S hoặc suite khai báo static),
 * U = chưa gắn nhãn. Chỉ B được tính vào tỉ lệ hành vi: suite tự nhận là hành vi
 * mà không gắn nhãn thì không có bằng chứng (ROADMAP luật 5).
 */

declare(strict_types=1);

function runnerClassifyPassLine(string $line, bool $isStaticSuite): ?string {
    if (preg_match('/(?:\[PASS:B\]|PASS:B)/i', $line)) return 'B';
    if (preg_match('/(?:\[PASS:S\]|PASS:S)/i', $line)) return 'S';
    if (preg_match('/(?:\[PASS\]|PASS:|✅ PASS:)/i', $line)) return $isStaticSuite ? 'S' : 'U';
    return null;
}

/** @return array{B:int,S:int,U:int} */
function runnerTallyPassLines(array $lines, bool $isStaticSuite): array {
    $counts = ['B' => 0, 'S' => 0, 'U' => 0];
    foreach ($lines as $line) {
        $kind = runnerClassifyPassLine((string)$line, $isStaticSuite);
        if ($kind !== null) $counts[$kind]++;
    }
    return $counts;
}

function runnerBehavioralRatio(array $counts): float {
    $total = ($counts['B'] ?? 0) + ($counts['S'] ?? 0) + ($counts['U'] ?? 0);
    return $total > 0 ? round(($counts['B'] / $total) * 100, 1) : 0.0;
}
