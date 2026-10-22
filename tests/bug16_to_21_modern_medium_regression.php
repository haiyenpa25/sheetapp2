<?php
declare(strict_types=1);

/**
 * tests/bug16_to_21_modern_medium_regression.php
 * Wrapper for tests/js/bug16_to_21_modern_medium.cjs (BUG-16..BUG-21).
 */
$script = __DIR__ . '/js/bug16_to_21_modern_medium.cjs';
$out = [];
$code = 0;
exec('node ' . escapeshellarg($script) . ' 2>&1', $out, $code);
echo implode("\n", $out) . "\n";
exit($code);
