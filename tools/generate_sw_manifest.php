<?php
/**
 * tools/generate_sw_manifest.php
 *
 * Tự động sinh danh sách precache cho Service Worker theo filemtime (Ticket L5-6, ROADMAP4.md).
 * - Quét các tài nguyên tĩnh cốt lõi cấu thành PWA App Shell hoàn chỉnh.
 * - Tính toán filemtime, dung lượng và hash MD5 của từng file.
 * - Sinh file manifest: storage/data/sw-manifest.json.
 * - Đồng bộ trực tiếp danh sách PRECACHE_APP và PRECACHE_VENDOR trong sw.js.
 *
 * Cách chạy:
 *   php tools/generate_sw_manifest.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

$root = dirname(__DIR__);

echo "=== SheetApp2: Tự động sinh Precache Manifest cho Service Worker (Ticket L5-6) ===\n";

// Danh mục tài nguyên tĩnh cốt lõi bắt buộc để App Shell chạy ngoại tuyến 100%
$vendorScripts = [
    'assets/js/vendor/opensheetmusicdisplay.min.js',
    'assets/js/vendor/tonal.min.js',
    'assets/js/vendor/Tone.js',
    'assets/js/vendor/OsmdAudioPlayer.min.js',
];

$appAssets = [
    // Shell pages & navigation
    '',
    'index.php',
    'manifest.json',
    'favicon.svg',
    'favicon.ico',
    'assets/img/icon-192.png',

    // Stylesheets
    'assets/css/base.css',
    'assets/css/layout.css',
    'assets/css/sheet.css',
    'assets/css/components.css',
    'assets/css/fab.css',
    'assets/css/app-shell.css',

    // Core JS Architecture & Engines
    'assets/js/core/ScriptLoader.js',
    'assets/js/core/FeatureFlags.js',
    'assets/js/core/SafeHtml.js',
    'assets/js/core/KeyService.js',
    'assets/js/core/ApiService.js',
    'assets/js/core/EventBus.js',
    'assets/js/core/Store.js',
    'assets/js/core/XmlDocCache.js',
    'assets/js/core/ModalManager.js',
    'assets/js/core/ModeManager.js',
    'assets/js/core/VerseManager.js',
    'assets/js/core/SongLoaderCore.js',
    'assets/js/core/OfflineSetlistManager.js',
    'assets/js/core/ServiceWorkerManager.js',

    // Renderers & UI Controllers
    'assets/js/osmd-svg-text.js',
    'assets/js/osmd-renderer.js',
    'assets/js/transpose-engine.js',
    'assets/js/display-settings.js',
    'assets/js/chord-canvas-xml.js',
    'assets/js/chord-canvas-ui.js',
    'assets/js/chord-canvas-dots.js',
    'assets/js/chord-canvas.js',
    'assets/js/song-info-bar.js',
    'assets/js/song-loader.js',
    'assets/js/library-ui.js',
    'assets/js/app-ui.js',
    'assets/js/toolbar-controller.js',
    'assets/js/keyboard-handler.js',
    'assets/js/mobile-controller.js',
    'assets/js/app.js',
    'assets/js/auth.js',

    // Data cần cho thư viện offline
    'api/index.php?route=songs',
];

$manifestItems = [];
$combinedHashes = [];

// 1. Quét và tính toán filemtime cho vendor scripts
foreach ($vendorScripts as $relPath) {
    $fullPath = $root . '/' . $relPath;
    if (file_exists($fullPath)) {
        $mtime = filemtime($fullPath);
        $size = filesize($fullPath);
        $hash = md5_file($fullPath);
        $manifestItems[$relPath] = [
            'type' => 'vendor',
            'mtime' => $mtime,
            'size' => $size,
            'hash' => substr($hash, 0, 8),
        ];
        $combinedHashes[] = $hash;
    } else {
        echo "  [CẢNH BÁO] Không tìm thấy vendor: {$relPath}\n";
    }
}

// 2. Quét và tính toán filemtime cho app assets
foreach ($appAssets as $relPath) {
    if ($relPath === '' || $relPath === 'index.php') {
        $fullPath = $root . '/index.php';
    } elseif (str_starts_with($relPath, 'api/index.php')) {
        $fullPath = $root . '/api/index.php';
    } else {
        $fullPath = $root . '/' . $relPath;
    }

    if (file_exists($fullPath)) {
        $mtime = filemtime($fullPath);
        $size = filesize($fullPath);
        $hash = md5_file($fullPath);
        $manifestItems[$relPath] = [
            'type' => 'app',
            'mtime' => $mtime,
            'size' => $size,
            'hash' => substr($hash, 0, 8),
        ];
        $combinedHashes[] = $hash;
    } else {
        echo "  [CẢNH BÁO] Không tìm thấy asset: {$relPath}\n";
    }
}

// Tính hash tổng hợp của toàn bộ manifest
$globalHash = substr(md5(implode(';', $combinedHashes)), 0, 10);
$manifestData = [
    'manifest_version' => $globalHash,
    'generated_at' => date('Y-m-d H:i:s'),
    'total_files' => count($manifestItems),
    'vendor_count' => count($vendorScripts),
    'app_count' => count($appAssets),
    'files' => $manifestItems,
];

// 3. Ghi file manifest vào storage/data/sw-manifest.json
$storageManifestPath = $root . '/storage/data/sw-manifest.json';
@mkdir(dirname($storageManifestPath), 0777, true);
file_put_contents($storageManifestPath, json_encode($manifestData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo "  ✓ Đã sinh manifest: storage/data/sw-manifest.json ({$manifestData['total_files']} files, hash: {$globalHash})\n";

// 4. Đồng bộ trực tiếp danh sách vào sw.js
$swPath = $root . '/sw.js';
if (file_exists($swPath)) {
    $swContent = file_get_contents($swPath);

    // Xây dựng chuỗi mảng PRECACHE_VENDOR
    $vendorJsLines = [];
    foreach ($vendorScripts as $v) {
        $vendorJsLines[] = "  '/{$v}',";
    }
    $vendorBlock = "// ── Tài nguyên pre-cache vendor khi install (Auto-synced by tools/generate_sw_manifest.php) ──\nconst PRECACHE_VENDOR = [\n" . implode("\n", $vendorJsLines) . "\n].map(p => SW_BASE + p);";

    // Xây dựng chuỗi mảng PRECACHE_APP
    $appJsLines = [
        "  (SW_BASE ? `\${SW_BASE}/` : '/'),",
        "  (SW_BASE ? `\${SW_BASE}/index.php` : '/index.php'),",
    ];
    foreach ($appAssets as $a) {
        if ($a === '' || $a === 'index.php') continue;
        $appJsLines[] = "  '/{$a}',";
    }
    $appBlock = "// ── Tài nguyên pre-cache app khi install (Auto-synced by tools/generate_sw_manifest.php) ──\nconst PRECACHE_APP = [\n" . implode("\n", $appJsLines) . "\n].map(p => (SW_BASE && !p.startsWith(SW_BASE)) ? SW_BASE + p : p);";

    // Cập nhật PRECACHE_VENDOR
    $swContent = preg_replace(
        '/const PRECACHE_VENDOR = \[[\s\S]*?\]\.map\(p => SW_BASE \+ p\);/',
        "const PRECACHE_VENDOR = [\n" . implode("\n", $vendorJsLines) . "\n].map(p => SW_BASE + p);",
        $swContent
    );

    // Cập nhật PRECACHE_APP
    $swContent = preg_replace(
        '/const PRECACHE_APP = \[[\s\S]*?\]\.map\(p => \(SW_BASE && !p\.startsWith\(SW_BASE\)\) \? SW_BASE \+ p : p\);/',
        "const PRECACHE_APP = [\n" . implode("\n", $appJsLines) . "\n].map(p => (SW_BASE && !p.startsWith(SW_BASE)) ? SW_BASE + p : p);",
        $swContent
    );

    // Cập nhật SW_MANIFEST_HASH
    if (strpos($swContent, 'const SW_MANIFEST_HASH') !== false) {
        $swContent = preg_replace(
            '/const SW_MANIFEST_HASH = \'[^\']*\';/',
            "const SW_MANIFEST_HASH = '{$globalHash}';",
            $swContent
        );
    } else {
        $swContent = preg_replace(
            '/(const SW_VERSION\s*=[^;]+;)/',
            "$1\nconst SW_MANIFEST_HASH = '{$globalHash}';",
            $swContent
        );
    }

    file_put_contents($swPath, $swContent);
    echo "  ✓ Đã đồng bộ mảng precache và SW_MANIFEST_HASH ('{$globalHash}') vào sw.js\n";
}

echo "=== Hoàn tất sinh precache manifest thành công! ===\n";
exit(0);
