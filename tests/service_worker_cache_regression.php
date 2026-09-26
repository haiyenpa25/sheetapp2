<?php
declare(strict_types=1);

/**
 * tests/service_worker_cache_regression.php
 * 
 * Kiểm thử tự động Task 1.6: Sửa cache MusicXML và offline nền tảng (Khắc phục F4)
 * - Tăng SW_VERSION lên 'v4' để dọn dẹp toàn bộ cache v3 cũ
 * - MusicXML (/storage/) sử dụng chiến lược Network First có giới hạn Quota thay vì Stale While Revalidate
 * - Giới hạn MAX_MUSICXML_CACHE_ITEMS và hàm limitCacheSize ngăn cache phình vô hạn
 * - Service Worker hỗ trợ sự kiện message 'CLEAR_XML_CACHE'
 * - ServiceWorkerManager export clearXmlCache
 * - Editor và SongLoader chủ động xóa cache file XML khi lưu bản chỉnh sửa
 */

$root = dirname(__DIR__);

$swSrc        = file_get_contents($root . '/sw.js') ?: '';
$swMgrSrc     = file_get_contents($root . '/assets/js/core/ServiceWorkerManager.js') ?: '';
$editorSrc    = file_get_contents($root . '/editor/editor.js') ?: '';
$songLoaderSrc = file_get_contents($root . '/assets/js/song-loader.js') ?: '';

$failures = [];
$total = 0;

function check(bool $condition, string $message, string $details = ''): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures, $total;
    $total++;
    if ($condition) {
        echo "  [PASS] {$message}\n";
    } else {
        $msg = "  [FAIL] {$message}" . ($details ? " -> {$details}" : "");
        echo "{$msg}\n";
        $failures[] = $msg;
    }
}

echo "========================================================\n";
echo "   SheetApp2 — Service Worker & MusicXML Cache (F4)     \n";
echo "========================================================\n\n";

// 1. SW_VERSION nâng lên tối thiểu v4 (Ticket T13 dùng v5)
$swVersionValid = str_contains($swSrc, "const SW_VERSION") && str_contains($swSrc, "'v5'");
check(
    $swVersionValid,
    'Service Worker nâng cấp SW_VERSION lên tối thiểu "v4" (hiện tại v5) để kích hoạt dọn dẹp cache cũ',
    "swVersion=" . ($swVersionValid ? 'true' : 'false')
);

// 2. Không dùng staleWhileRevalidate cho /storage/ (MusicXML)
$noStaleForStorage = !str_contains($swSrc, "url.pathname.startsWith('/storage/') {\n    event.respondWith(staleWhileRevalidate")
    && str_contains($swSrc, "networkFirstWithQuota(event.request, CACHE_MUSICXML");
check(
    $noStaleForStorage,
    'MusicXML (/storage/) chuyển sang Network First có Quota, loại bỏ Stale While Revalidate gây hiển thị XML cũ (Fix F4)',
    "noStaleForStorage=" . ($noStaleForStorage ? 'true' : 'false')
);

// 3. Giới hạn dung lượng và LRU eviction
$hasCacheQuota = str_contains($swSrc, "MAX_MUSICXML_CACHE_ITEMS")
    && str_contains($swSrc, "function limitCacheSize(cacheName, maxItems")
    && str_contains($swSrc, "toDelete.map(k => cache.delete(k))");
check(
    $hasCacheQuota,
    'Service Worker cài đặt hạn mức MAX_MUSICXML_CACHE_ITEMS (60 bài) và hàm limitCacheSize ngăn cache phình vô hạn',
    "hasCacheQuota=" . ($hasCacheQuota ? 'true' : 'false')
);

// 4. Message CLEAR_XML_CACHE
$hasClearMessage = str_contains($swSrc, "event.data.type === 'CLEAR_XML_CACHE'")
    && str_contains($swSrc, "caches.open(CACHE_MUSICXML).then(cache => cache.delete(");
check(
    $hasClearMessage,
    'Service Worker tiếp nhận sự kiện message CLEAR_XML_CACHE để xóa cache tức thì theo URL file',
    "hasClearMessage=" . ($hasClearMessage ? 'true' : 'false')
);

// 5. ServiceWorkerManager export clearXmlCache
$swMgrExportsClear = str_contains($swMgrSrc, "function clearXmlCache(url = null)")
    && str_contains($swMgrSrc, "clearXmlCache");
check(
    $swMgrExportsClear,
    'ServiceWorkerManager cung cấp hàm tiện ích clearXmlCache(url)',
    "swMgrExports=" . ($swMgrExportsClear ? 'true' : 'false')
);

// 6. Editor xóa cache khi lưu version
$editorClearsCache = (str_contains($editorSrc, "sheetapp-musicxml-v5") || str_contains($editorSrc, "__SW_CACHE__"))
    && str_contains($editorSrc, "c.delete(_currentSong.xmlPath)");
check(
    $editorClearsCache,
    'Editor chủ động xóa cache MusicXML v4 khi lưu phiên bản mới của bài hát',
    "editorClears=" . ($editorClearsCache ? 'true' : 'false')
);

// 7. SongLoader xóa cache khi lưu modified XML
$songLoaderClearsCache = (str_contains($songLoaderSrc, "sheetapp-musicxml-v5") || str_contains($songLoaderSrc, "__SW_CACHE__"))
    && str_contains($songLoaderSrc, "ServiceWorkerManager?.clearXmlCache");
check(
    $songLoaderClearsCache,
    'SongLoader chủ động xóa cache và thông báo ServiceWorkerManager khi lưu XML gốc',
    "songLoaderClears=" . ($songLoaderClearsCache ? 'true' : 'false')
);

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Service Worker Cache:\n";
echo "  - Tổng số kiểm tra: {$total}\n";
echo "  - Số kiểm tra thất bại: " . count($failures) . "\n";
if (count($failures) === 0) {
    echo "  - Trạng thái: ✅ TẤT CẢ KIỂM TRA SW CACHE ĐỀU ĐẠT (PASS)\n";
    echo "--------------------------------------------------------\n\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "  - Trạng thái: ❌ CÓ LỖI XẢY RA\n";
    echo "--------------------------------------------------------\n\n";
    exit(1);
}

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
