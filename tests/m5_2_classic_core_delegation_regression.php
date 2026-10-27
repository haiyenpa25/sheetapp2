<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral

$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$script = __DIR__ . '/js/m5_2_classic_core_delegation.cjs';
$cmd = escapeshellarg($node) . ' ' . escapeshellarg($script) . ' 2>&1';
$output = [];
$exitCode = 0;
exec($cmd, $output, $exitCode);

foreach ($output as $line) {
    echo $line . PHP_EOL;
}

if ($exitCode !== 0) {
    exit($exitCode);
}
