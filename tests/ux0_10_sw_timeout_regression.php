<?php
declare(strict_types=1);

/**
 * tests/ux0_10_sw_timeout_regression.php — UX0-10 Service Worker 15s timeout + AbortController + navigation & versioned asset guards
 * SUITE_TYPE: behavioral
 */

$nodeBin = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$script = __DIR__ . '/js/ux0_10_sw_timeout.cjs';

$out = [];
$code = 0;
exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($script) . ' 2>&1', $out, $code);
foreach ($out as $line) {
    echo $line . "\n";
}
exit($code);
