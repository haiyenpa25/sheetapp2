<?php
declare(strict_types=1);

/**
 * tests/bug22_to_24_and_38_to_41_low_regression.php
 * Wrapper for tests/js/bug22_to_24_and_38_to_41_low.cjs (BUG-22..24 and BUG-38..41).
 */
$script = __DIR__ . '/js/bug22_to_24_and_38_to_41_low.cjs';
$out = [];
$code = 0;
exec('node ' . escapeshellarg($script) . ' 2>&1', $out, $code);
echo implode("\n", $out) . "\n";
exit($code);
