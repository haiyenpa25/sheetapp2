<?php
declare(strict_types=1);

/**
 * tests/ux0_15_render_error_signature_regression.php
 * UX0-15: Verify OSMDRenderCore.reportRenderError matches AppUI.showLoadError and ErrorReporter.report signatures.
 */
$script = __DIR__ . '/js/ux0_15_render_error_signature.cjs';
$cmd = 'node ' . escapeshellarg($script) . ' 2>&1';
$output = [];
$exitCode = 0;
exec($cmd, $output, $exitCode);

foreach ($output as $line) {
    echo $line . PHP_EOL;
}

if ($exitCode !== 0) {
    fwrite(STDERR, "[FAIL] ux0_15_render_error_signature.cjs exited with code {$exitCode}\n");
    exit($exitCode);
}
