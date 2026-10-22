<?php
/**
 * tools/generate_sw_manifest.php
 *
 * Sinh danh sách precache cho Service Worker (L5-6, OPT-17 / ROADMAP6 TV2-5).
 * - Danh sách lấy từ chính index.php (cssTag/jsTag/<script src>) theo đúng thứ tự nạp,
 *   cộng các module mà ScriptLoader / live-sync nạp theo nhu cầu (để mở được khi offline).
 * - Hash nội dung không phụ thuộc kiểu xuống dòng: file văn bản được chuẩn hóa CRLF → LF
 *   trước khi md5, nên checkout Windows (autocrlf) và Linux cho cùng SW_MANIFEST_HASH.
 * - Vendor cache đặt tên theo hash nội dung vendor (SW_VENDOR_HASH), không theo số 'v5' cố định.
 *
 * Cách chạy:
 *   php tools/generate_sw_manifest.php           Ghi sw.js + storage/data/sw-manifest.json
 *   php tools/generate_sw_manifest.php --check   Không ghi gì; exit 1 nếu sw.js cần sinh lại
 *   php tools/generate_sw_manifest.php --check --json   Như --check, in manifest JSON ra stdout
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

$root = dirname(__DIR__);
$argvList = $argv ?? [];
$checkOnly = in_array('--check', $argvList, true);
$jsonOut = in_array('--json', $argvList, true);

/** In log ra STDERR khi --json để stdout chỉ chứa JSON. */
function logLine(string $msg): void {
    global $jsonOut;
    fwrite($jsonOut ? STDERR : STDOUT, $msg . "\n");
}

const TEXT_EXTENSIONS = ['js', 'css', 'php', 'json', 'svg', 'html', 'txt', 'xml'];

/** Hash md5 không phụ thuộc CRLF/LF cho file văn bản; file nhị phân hash nguyên byte. */
function contentHash(string $path): string {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!in_array($ext, TEXT_EXTENSIONS, true)) {
        return md5_file($path);
    }
    return md5(str_replace("\r\n", "\n", (string) file_get_contents($path)));
}

/** Tài nguyên mà index.php nạp lúc khởi động, theo thứ tự xuất hiện. */
function startupAssets(string $indexSrc): array {
    $out = [];
    $pattern = '/cssTag\(\s*\'([^\']+)\'|jsTag\(\s*\'([^\']+)\'|<script\s+src="[^"]*?(assets\/js\/[^"?]+\.js)"/';
    preg_match_all($pattern, $indexSrc, $m, PREG_SET_ORDER);
    foreach ($m as $hit) {
        if (!empty($hit[1])) $out[] = 'assets/css/' . $hit[1];
        elseif (!empty($hit[2])) $out[] = 'assets/js/' . $hit[2];
        elseif (!empty($hit[3])) $out[] = $hit[3];
    }
    return $out;
}

/** Module được nạp theo nhu cầu (chuỗi 'assets/js/....js' trong các file loader). */
function onDemandAssets(string $root, array $loaderFiles): array {
    $out = [];
    foreach ($loaderFiles as $rel) {
        $src = @file_get_contents($root . '/' . $rel);
        if ($src === false) continue;
        preg_match_all('/[\'"](assets\/js\/[A-Za-z0-9_\/.-]+\.js)[\'"]/', $src, $m);
        foreach ($m[1] as $p) $out[] = $p;
    }
    return $out;
}

$indexSrc = (string) file_get_contents($root . '/index.php');
$scripted = array_merge(
    startupAssets($indexSrc),
    onDemandAssets($root, ['assets/js/core/ScriptLoader.js', 'assets/js/live-sync.js'])
);

$vendorScripts = [];
$appAssets = [
    '', 'index.php', 'manifest.json', 'favicon.svg', 'favicon.ico', 'assets/img/icon-192.png',
];
foreach ($scripted as $rel) {
    if (!is_file($root . '/' . $rel)) {
        logLine("  [CẢNH BÁO] Bỏ qua file không tồn tại: {$rel}");
        continue;
    }
    if (str_starts_with($rel, 'assets/js/vendor/')) {
        if (!in_array($rel, $vendorScripts, true)) $vendorScripts[] = $rel;
    } elseif (!in_array($rel, $appAssets, true)) {
        $appAssets[] = $rel;
    }
}
// Danh mục bài hát cho thư viện offline
$appAssets[] = 'api/index.php?route=songs';

$manifestItems = [];
$appHashes = [];
$vendorHashes = [];
foreach (array_merge($vendorScripts, $appAssets) as $relPath) {
    if ($relPath === '' || $relPath === 'index.php') {
        $fullPath = $root . '/index.php';
    } elseif (str_starts_with($relPath, 'api/index.php')) {
        $fullPath = $root . '/api/index.php';
    } else {
        $fullPath = $root . '/' . $relPath;
    }
    if (!file_exists($fullPath)) {
        logLine("  [CẢNH BÁO] Không tìm thấy asset: {$relPath}");
        continue;
    }
    $isVendor = in_array($relPath, $vendorScripts, true);
    // Mục API là dữ liệu động (danh mục bài), không phải mã api/index.php: chỉ đường dẫn tham gia hash,
    // để sửa backend không làm sw.js lệch.
    $hash = str_starts_with($relPath, 'api/') ? md5($relPath) : contentHash($fullPath);
    $manifestItems[$relPath] = [
        'type' => $isVendor ? 'vendor' : 'app',
        'mtime' => filemtime($fullPath),
        'size' => filesize($fullPath),
        'hash' => substr($hash, 0, 8),
    ];
    // Đường dẫn tham gia hash để thêm/bớt file cũng đổi phiên bản
    if ($isVendor) $vendorHashes[] = $relPath . ':' . $hash;
    else $appHashes[] = $relPath . ':' . $hash;
}

$vendorHash = substr(md5(implode(';', $vendorHashes)), 0, 10);
$globalHash = substr(md5(implode(';', array_merge($vendorHashes, $appHashes))), 0, 10);
$manifestData = [
    'manifest_version' => $globalHash,
    'vendor_version' => $vendorHash,
    'generated_at' => date('Y-m-d H:i:s'),
    'total_files' => count($manifestItems),
    'vendor_count' => count($vendorScripts),
    'app_count' => count($appAssets),
    'files' => $manifestItems,
];

// ── Dựng nội dung sw.js mới ──
$swPath = $root . '/sw.js';
$swOriginal = (string) file_get_contents($swPath);
$eol = str_contains($swOriginal, "\r\n") ? "\r\n" : "\n";
$sw = str_replace("\r\n", "\n", $swOriginal);

$vendorLines = array_map(fn($v) => "  '/{$v}',", $vendorScripts);
$appLines = [
    "  (SW_BASE ? `\${SW_BASE}/` : '/'),",
    "  (SW_BASE ? `\${SW_BASE}/index.php` : '/index.php'),",
];
foreach ($appAssets as $a) {
    if ($a === '' || $a === 'index.php') continue;
    $appLines[] = "  '/{$a}',";
}

$replacements = [
    '/const PRECACHE_VENDOR = \[[\s\S]*?\]\.map\(p => SW_BASE \+ p\);/' =>
        "const PRECACHE_VENDOR = [\n" . implode("\n", $vendorLines) . "\n].map(p => SW_BASE + p);",
    '/const PRECACHE_APP = \[[\s\S]*?\]\.map\(p => \(SW_BASE && !p\.startsWith\(SW_BASE\)\) \? SW_BASE \+ p : p\);/' =>
        "const PRECACHE_APP = [\n" . implode("\n", $appLines) . "\n].map(p => (SW_BASE && !p.startsWith(SW_BASE)) ? SW_BASE + p : p);",
    '/const SW_MANIFEST_HASH = \'[^\']*\';/' => "const SW_MANIFEST_HASH = '{$globalHash}';",
    '/const SW_VENDOR_HASH = \'[^\']*\';/' => "const SW_VENDOR_HASH = '{$vendorHash}';",
];
foreach ($replacements as $pattern => $replacement) {
    if (!preg_match($pattern, $sw)) {
        fwrite(STDERR, "FAIL: sw.js thiếu khối cần đồng bộ ({$pattern})\n");
        exit(2);
    }
    $sw = preg_replace_callback($pattern, fn() => $replacement, $sw, 1);
}
$swStale = $sw !== str_replace("\r\n", "\n", $swOriginal);

if ($jsonOut) {
    echo json_encode($manifestData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
}

if ($checkOnly) {
    if ($swStale) {
        logLine("FAIL: sw.js lệch manifest (hash mới {$globalHash}, vendor {$vendorHash}). Chạy: php tools/generate_sw_manifest.php");
        exit(1);
    }
    logLine("PASS: sw.js khớp manifest ({$manifestData['total_files']} files, hash {$globalHash}, vendor {$vendorHash})");
    exit(0);
}

logLine("=== SheetApp2: Sinh Precache Manifest cho Service Worker ===");
$storageManifestPath = $root . '/storage/data/sw-manifest.json';
@mkdir(dirname($storageManifestPath), 0777, true);
file_put_contents($storageManifestPath, json_encode($manifestData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
logLine("  ✓ Đã sinh manifest: storage/data/sw-manifest.json ({$manifestData['total_files']} files, hash: {$globalHash})");
if ($swStale) {
    file_put_contents($swPath, str_replace("\n", $eol, $sw));
    logLine("  ✓ Đã đồng bộ precache, SW_MANIFEST_HASH ('{$globalHash}') và SW_VENDOR_HASH ('{$vendorHash}') vào sw.js");
} else {
    logLine("  ✓ sw.js đã khớp manifest, không ghi lại");
}
exit(0);
