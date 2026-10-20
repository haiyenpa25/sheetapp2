<?php
declare(strict_types=1);

/** Compare actual JSON contents with the published library, not local empty dirs. */
function libraryChordFilesIntact(string $root): bool {
    $manifestPath = $root . '/storage/seed/library.manifest.json';
    if (!is_file($manifestPath)) return false;
    $manifest = json_decode((string)file_get_contents($manifestPath), true);
    $files = $manifest['chord_files'] ?? [];
    if (!$files) return false;
    foreach ($files as $path => $expected) {
        $file = $root . '/' . $path;
        if (!is_file($file)) return false;
        $contents = str_replace("\r\n", "\n", (string)file_get_contents($file));
        if (!hash_equals($expected, hash('sha256', $contents))) return false;
        json_decode($contents, true);
        if (json_last_error() !== JSON_ERROR_NONE) return false;
    }
    return true;
}
