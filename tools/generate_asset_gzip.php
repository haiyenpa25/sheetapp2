<?php
/** Build transport-only sidecars; source JS/CSS stays unchanged. Run --check in CI. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = dirname(__DIR__);
$files = [
    'assets/js/vendor/opensheetmusicdisplay.min.js',
    'assets/css/sheet.css',
    'assets/css/layout.css',
    'assets/css/library-polish.css',
];
$checkOnly = in_array('--check', $argv, true);
$failed = false;
foreach ($files as $file) {
    $source = file_get_contents($root . '/' . $file);
    $target = $root . '/' . $file . '.gz';
    $matches = is_file($target) && gzdecode(file_get_contents($target)) === $source;
    if (!$matches && !$checkOnly) {
        $temporary = $target . '.tmp';
        if (file_put_contents($temporary, gzencode($source, 9), LOCK_EX) === false || !rename($temporary, $target)) {
            if (is_file($temporary)) unlink($temporary);
            fwrite(STDERR, "FAIL: Cannot publish {$file}.gz\n");
            exit(1);
        }
        $matches = true;
    }
    echo ($matches ? 'PASS' : 'FAIL') . ": {$file}.gz matches source\n";
    $failed = $failed || !$matches;
}
exit($failed ? 1 : 0);
