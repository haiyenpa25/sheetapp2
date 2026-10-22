<?php
declare(strict_types=1);

// Standalone suites must isolate disk state without relying on the unified runner.
if (PHP_SAPI !== 'cli') throw new RuntimeException('CLI fixture only');
$suiteStorage = sys_get_temp_dir() . '/sheetapp_suite_storage_' . bin2hex(random_bytes(12));
mkdir($suiteStorage . '/chord_sets', 0775, true);
mkdir($suiteStorage . '/mail', 0775, true);
putenv('CHORD_SETS_DIR=' . $suiteStorage . '/chord_sets');
putenv('SHEETAPP_CHORD_SETS_DIR=' . $suiteStorage . '/chord_sets');
putenv('SHEETAPP_AUDIT_LOG=' . $suiteStorage . '/audit.log');
putenv('SHEETAPP_MAIL_DIR=' . $suiteStorage . '/mail');
register_shutdown_function(static function () use ($suiteStorage): void {
    $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($suiteStorage, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($entries as $entry) {
        $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    }
    rmdir($suiteStorage);
});
