<?php
declare(strict_types=1);

/**
 * tests/ux0_11_api_upload_timeout_regression.php — UX0-11 ApiService 120s timeout for non-GET / FormData requests
 * SUITE_TYPE: behavioral
 */

$nodeBin = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$script = __DIR__ . '/js/ux0_11_api_upload_timeout.cjs';

$out = [];
$code = 0;
exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($script) . ' 2>&1', $out, $code);
foreach ($out as $line) {
    echo $line . "\n";
}
exit($code);
