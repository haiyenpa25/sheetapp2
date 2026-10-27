<?php
declare(strict_types=1);

/**
 * tests/ux0_23_core_edge_cases_regression.php
 * UX0-23: Verify 5 edge cases in ApiService, SafeStorage, BootRunner, ScriptLoader/ToolbarController, and Classic OSMDRenderer.
 */
$script = __DIR__ . '/js/ux0_23_core_edge_cases.cjs';
$cmd = 'node ' . escapeshellarg($script) . ' 2>&1';
$output = [];
$exitCode = 0;
exec($cmd, $output, $exitCode);

foreach ($output as $line) {
    echo $line . PHP_EOL;
}

if ($exitCode !== 0) {
    fwrite(STDERR, "[FAIL] ux0_23_core_edge_cases.cjs exited with code {$exitCode}\n");
    exit($exitCode);
}
