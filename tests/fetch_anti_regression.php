<?php
declare(strict_types=1);

/**
 * tests/fetch_anti_regression.php
 *
 * Regression suite cho Ticket T15c:
 * Chặn tái phát cuộc gọi fetch() rải rác ngoài ApiService.
 * Quy tắc:
 * 1. Chỉ ApiService.js, sw.js và các dòng có chú thích `// INTENTIONAL EXCEPTION:` mới được phép chứa `fetch(`.
 * 2. assets/js/core/EventBus.js tuyệt đối không chứa fetch() (đã tách ra core/ErrorReporter.js).
 * 3. ApiService.js cung cấp đầy đủ: songs.getVersions, songs.saveVersion, songs.deleteVersion, reportError.
 * 4. editor/editor.js và song-loader.js sử dụng ApiService thay vì fetch() trực tiếp tới API.
 */

$root = dirname(__DIR__);
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    if ($condition) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        $failures[] = $message;
    }
}

echo "=== T15c: FETCH ANTI-REGRESSION SUITE ===\n\n";

// ── 1. Kiểm tra ApiService.js hợp đồng mở rộng ──
echo "-- 1. ApiService API Contract --\n";
$apiServicePath = $root . '/assets/js/core/ApiService.js';
check(file_exists($apiServicePath), "ApiService.js tồn tại");
$apiServiceSrc = file_get_contents($apiServicePath) ?: '';

check(str_contains($apiServiceSrc, 'getVersions:'), "ApiService.songs có method getVersions");
check(str_contains($apiServiceSrc, 'saveVersion:'), "ApiService.songs có method saveVersion");
check(str_contains($apiServiceSrc, 'deleteVersion:'), "ApiService.songs có method deleteVersion");
check(str_contains($apiServiceSrc, 'reportError:'), "ApiService xuất method reportError");
check(str_contains($apiServiceSrc, 'repertoire:'), "ApiService.manager có method repertoire");
check(str_contains($apiServiceSrc, 'communityChords:'), "ApiService.manager có method communityChords");

// ── 2. Kiểm tra EventBus.js và ErrorReporter.js ──
echo "\n-- 2. Tách biệt EventBus.js & ErrorReporter.js --\n";
$eventBusPath = $root . '/assets/js/core/EventBus.js';
$eventBusSrc = file_get_contents($eventBusPath) ?: '';
check(!str_contains($eventBusSrc, 'fetch('), "EventBus.js không còn chứa bất kỳ lệnh fetch() nào");
check(!str_contains($eventBusSrc, 'window.onerror'), "EventBus.js không còn chứa window.onerror");
check(!str_contains($eventBusSrc, 'window.onunhandledrejection'), "EventBus.js không còn chứa window.onunhandledrejection");

$errorReporterPath = $root . '/assets/js/core/ErrorReporter.js';
check(file_exists($errorReporterPath), "ErrorReporter.js đã được tạo riêng biệt");
$errorReporterSrc = file_get_contents($errorReporterPath) ?: '';
check(str_contains($errorReporterSrc, 'window.ApiService'), "ErrorReporter.js gọi qua window.ApiService");

// ── 3. Quét toàn diện mã nguồn JS để bắt các cuộc gọi fetch() trái phép ──
echo "\n-- 3. Quét kiểm tra toàn bộ file JS ứng dụng --\n";

$targetDirs = [
    $root . '/assets/js',
    $root . '/editor',
    $root . '/live-band',
    $root . '/manager',
    $root . '/members'
];

$disallowedFetches = [];
$totalJsFilesScanned = 0;

foreach ($targetDirs as $dir) {
    if (!is_dir($dir)) continue;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'js') continue;
        $filePath = str_replace('\\', '/', $file->getPathname());

        // Bỏ qua thư viện bên thứ 3 (vendor)
        if (str_contains($filePath, '/assets/js/vendor/')) continue;

        // Bỏ qua chính ApiService.js
        if (str_ends_with($filePath, '/assets/js/core/ApiService.js')) continue;

        $totalJsFilesScanned++;
        $lines = file($filePath, FILE_IGNORE_NEW_LINES);
        if ($lines === false) continue;

        for ($i = 0; $i < count($lines); $i++) {
            $line = $lines[$i];

            // Tìm lệnh fetch( (không phải property accessor như .fetch() hay method)
            if (preg_match('/(?<![a-zA-Z0-9_$.])fetch\s*\(/', $line)) {
                // Kiểm tra xem dòng hiện tại hoặc 1-2 dòng trước có comment INTENTIONAL EXCEPTION không
                $hasException = false;
                if (str_contains($line, 'INTENTIONAL EXCEPTION')) {
                    $hasException = true;
                } else {
                    for ($k = max(0, $i - 2); $k < $i; $k++) {
                        if (str_contains($lines[$k], 'INTENTIONAL EXCEPTION')) {
                            $hasException = true;
                            break;
                        }
                    }
                }

                if (!$hasException) {
                    $relFile = str_replace(str_replace('\\', '/', $root) . '/', '', $filePath);
                    $lineNum = $i + 1;
                    $disallowedFetches[] = "{$relFile}:{$lineNum} -> " . trim($line);
                }
            }
        }
    }
}

// Kiểm tra riêng sw.js (được phép fetch)
check(file_exists($root . '/sw.js'), "sw.js tồn tại và là ngoại lệ hợp lệ");

check($totalJsFilesScanned >= 25, "Đã quét {$totalJsFilesScanned} file JS ứng dụng");
check(
    empty($disallowedFetches),
    empty($disallowedFetches)
        ? "Tất cả file JS tuân thủ quy tắc: Không có lệnh fetch() trái phép ngoài ApiService"
        : "Phát hiện " . count($disallowedFetches) . " lệnh fetch() trái phép:\n  " . implode("\n  ", $disallowedFetches)
);

// ── 4. Kiểm tra riêng editor.js và song-loader.js ──
echo "\n-- 4. Kiểm tra hợp đồng của editor.js & song-loader.js --\n";
$editorSrc = file_get_contents($root . '/editor/editor.js') ?: '';
check(str_contains($editorSrc, 'ApiService.songs.saveVersion'), "editor.js lưu phiên bản qua ApiService.songs.saveVersion");
check(str_contains($editorSrc, 'ApiService.songs.list'), "editor.js nạp danh sách bài qua ApiService.songs.list");
check(str_contains($editorSrc, 'ApiService.songs.getVersions'), "editor.js nạp phiên bản qua ApiService.songs.getVersions");

$songLoaderSrc = file_get_contents($root . '/assets/js/song-loader.js') ?: '';
check(str_contains($songLoaderSrc, 'ApiService.songs.getVersions'), "song-loader.js nạp danh sách phiên bản qua ApiService.songs.getVersions");

echo "\nTổng kết: " . (count($failures) === 0 ? "TẤT CẢ CHECKS PASS" : count($failures) . " CHECKS FAILED") . "\n";
if (count($failures) > 0) {
    exit(1);
}

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit(0);
