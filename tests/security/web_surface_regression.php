<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$failures = [];

function checkSurface(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) {
        $failures[] = $message;
    }
}

function readSurfaceFile(string $path): string {
    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException("Cannot read {$path}");
    }
    return $contents;
}

$cliOnly = array_merge(
    [
        $root . '/api/init_db.php',
        $root . '/api/omr_worker.php',
        $root . '/api/database/migrate_learn_tables.php',
    ],
    glob($root . '/tools/*.php') ?: []
);

foreach ($cliOnly as $file) {
    $contents = readSurfaceFile($file);
    checkSurface(
        str_contains($contents, "PHP_SAPI !== 'cli'") || str_contains($contents, "php_sapi_name() !== 'cli'"),
        str_replace($root . '/', '', str_replace('\\', '/', $file)) . ' is CLI-only'
    );
}

$htaccess = readSurfaceFile($root . '/.htaccess');
foreach (['tools', 'docs', 'dashboard', '.ua', '.agents', '.agent-skills'] as $directory) {
    checkSurface(str_contains($htaccess, $directory), ".htaccess blocks {$directory}");
}
foreach (['md', 'bak', 'log'] as $extension) {
    checkSurface(str_contains($htaccess, $extension), ".htaccess blocks .{$extension} files");
}
checkSurface(
    str_contains($htaccess, 'storage/') && str_contains($htaccess, 'Thanh'),
    '.htaccess blocks private storage while preserving the MusicXML directory'
);

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d web-surface regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll web-surface regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
