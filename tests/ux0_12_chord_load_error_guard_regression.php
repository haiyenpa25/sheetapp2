<?php
declare(strict_types=1);

/**
 * tests/ux0_12_chord_load_error_guard_regression.php — UX0-12 Guard against silent chord set load failure overwriting HD
 * SUITE_TYPE: behavioral
 */

$nodeBin = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$script = __DIR__ . '/js/ux0_12_chord_load_error_guard.cjs';

$out = [];
$code = 0;
exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($script) . ' 2>&1', $out, $code);
foreach ($out as $line) {
    echo $line . "\n";
}
exit($code);
