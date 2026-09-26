<?php
/**
 * tests/library_l0_window_exports_regression.php
 *
 * Kiểm tra hồi quy cho Ticket L0-1 (ROADMAP 4):
 * 1. Tất cả module IIFE trong assets/js/*.js phải gắn vào window (window.X = X).
 * 2. Cụ thể: ChordCanvas, HistoryManager, PageNav, AdminUI phải có export window.
 * 3. assets/js/song-loader.js không được gọi ChordCanvas.resetSet() khi bắt đầu loadSong.
 * 4. assets/js/chord-canvas.js resetSet() không được gọi switchSet('default').
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   SheetApp2 — Ticket L0-1: Module Window Exports Check \n";
echo "========================================================\n\n";

// 1. Kiểm tra 4 module cốt lõi được nêu cụ thể trong L0-1
$coreModules = [
    'assets/js/chord-canvas.js'    => 'ChordCanvas',
    'assets/js/history-manager.js' => 'HistoryManager',
    'assets/js/page-nav.js'        => 'PageNav',
    'assets/js/admin-ui.js'        => 'AdminUI'
];

foreach ($coreModules as $relPath => $modName) {
    $fullPath = $root . '/' . $relPath;
    checkStatic("file_exists_{$modName}", file_exists($fullPath), "File {$relPath} tồn tại");
    $content = file_get_contents($fullPath) ?: '';
    $hasWindowExport = (bool)preg_match('/window\.' . $modName . '\s*=\s*' . $modName . '/m', $content);
    checkBehavior("window_export_{$modName}", $hasWindowExport, "{$modName} được gắn tường minh vào window.{$modName}");
}

// 2. Kiểm tra chặn tái phát: mọi module IIFE trong assets/js/*.js đều phải có window.X = X
$allJsFiles = glob($root . '/assets/js/*.js');
$missingExports = [];

foreach ($allJsFiles as $jsFile) {
    $filename = basename($jsFile);
    $content = file_get_contents($jsFile) ?: '';
    if (preg_match('/^(?:const|var|let)\s+([A-Z][a-zA-Z0-9]+)\s*=\s*\(/m', $content, $m)) {
        $modName = $m[1];
        if (!preg_match('/window\.' . $modName . '\s*=/m', $content)) {
            $missingExports[] = "{$filename} ({$modName})";
        }
    }
}

checkBehavior(
    "all_iife_modules_exported_to_window",
    empty($missingExports),
    "Tất cả module IIFE trong assets/js/ đều có dòng export window (thiếu: " . implode(', ', $missingExports) . ")"
);

// 3. Kiểm tra song-loader.js không gọi ChordCanvas.resetSet()
$songLoaderSrc = file_get_contents($root . '/assets/js/song-loader.js') ?: '';
$noResetSetInSongLoader = !str_contains($songLoaderSrc, 'ChordCanvas.resetSet()') && !str_contains($songLoaderSrc, 'ChordCanvas?.resetSet');
checkBehavior(
    "song_loader_no_reset_set_call",
    $noResetSetInSongLoader,
    "song-loader.js không gọi ChordCanvas.resetSet() làm switchSet('default') khi mở bài mới"
);

// 4. Kiểm tra ChordCanvas.resetSet() không gọi switchSet('default')
$chordCanvasSrc = file_get_contents($root . '/assets/js/chord-canvas.js') ?: '';
$resetSetSafe = !preg_match('/function\s+resetSet\s*\(\)\s*\{[^}]*switchSet\([\'"]default[\'"]\)/s', $chordCanvasSrc);
checkBehavior(
    "chord_canvas_reset_set_is_safe",
    $resetSetSafe,
    "ChordCanvas.resetSet() an toàn, không gọi switchSet('default')"
);

TestAssert::finish();
