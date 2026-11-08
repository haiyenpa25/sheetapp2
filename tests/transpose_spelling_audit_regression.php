<?php
declare(strict_types=1);

/**
 * tests/transpose_spelling_audit_regression.php
 * Quét toàn bộ tổ hợp dịch giọng (hợp âm × 22 bước × useFlats, 24 giọng × 22 bước) bằng Node thật:
 * cao độ/hậu tố/bass đúng, nhãn giọng KeyService khớp họ thăng/giáng với hợp âm vẽ trên bản nhạc.
 */
$root = dirname(__DIR__);
$script = $root . '/tests/js/transpose_spelling_audit.cjs';
$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';

$output = [];
$code = 0;
exec(escapeshellarg($node) . ' ' . escapeshellarg($script) . ' 2>&1', $output, $code);

$total = 0;
$failed = 0;
foreach ($output as $line) {
    if (str_starts_with($line, 'OK ')) {
        $total++;
        echo '[PASS:B] ' . substr($line, 3) . "\n";
    } elseif (str_starts_with($line, 'FAIL ')) {
        $total++;
        $failed++;
        echo '[FAIL:B] ' . substr($line, 5) . "\n";
    }
}
if ($code !== 0 || $total === 0) {
    $total++;
    $failed++;
    echo "[FAIL:B] Script Node thoát bất thường (code {$code}): " . implode(' | ', array_slice($output, 0, 3)) . "\n";
}

echo "SUITE_COMPLETE total={$total}\n";
exit($failed === 0 ? 0 : 1);
