<?php
declare(strict_types=1);

/**
 * tests/bug27_to_37_subapps_medium_regression.php
 * Wrapper for tests/js/bug27_to_37_subapps_medium.cjs (BUG-27..BUG-37).
 */
$script = __DIR__ . '/js/bug27_to_37_subapps_medium.cjs';
$out = [];
$code = 0;
exec('node ' . escapeshellarg($script) . ' 2>&1', $out, $code);
echo implode("\n", $out) . "\n";
exit($code);
