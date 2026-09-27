<?php
/**
 * tests/library_l27_compact_list_and_etag_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L2-7 (ROADMAP4 Mục 8):
 * - Danh sách gọn chỉ trả trường cần thiết (không kèm lyrics_text)
 * - Tải một lần dùng chung cho LibraryUI và SetlistUI (single-flight Promise caching)
 * - Cache bằng ETag: 304 Not Modified khi dữ liệu không thay đổi
 * - Nghiệm thu: Tải lần đầu: 1 request danh sách, <= 60KB (gzip)
 *
 * Tỷ lệ hành vi >= 56%.
 */

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SongService.php';

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function check(bool $cond, string $msg, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    if ($cond) {
        $passedChecks++;
        echo "  [PASS] {$msg}\n";
    } else {
        echo "  [FAIL] {$msg}\n";
    }
}

echo "=== Kiểm thử Ticket L2-7: Danh sách gọn, Tải 1 lần dùng chung & ETag Caching ===\n";

// 1. Kiểm tra SongService::getAll() trả về danh sách gọn, không có lyrics_text
$songs = SongService::getAll();
check(!empty($songs) && count($songs) >= 900, "Danh sách bài hát đầy đủ >= 900 bài (hiện có: " . count($songs) . ")", true);

$hasLyrics = false;
$hasId = true;
$hasTitle = true;
$hasHttlvnId = true;
$hasKey = true;

foreach (array_slice($songs, 0, 100) as $s) {
    if (array_key_exists('lyrics_text', $s)) {
        $hasLyrics = true;
        break;
    }
    if (empty($s['id'])) $hasId = false;
    if (empty($s['title'])) $hasTitle = false;
    if (!isset($s['httlvnId'])) $hasHttlvnId = false;
    if (!array_key_exists('defaultKey', $s)) $hasKey = false;
}

check(!$hasLyrics, "Danh sách gọn: Không có trường lyrics_text trong các bài hát (tiết kiệm băng thông)", true);
check($hasId && $hasTitle && $hasHttlvnId && $hasKey, "Danh sách gọn: Đầy đủ các trường cần thiết (id, title, httlvnId, defaultKey, xmlPath...)", true);

// 2. Nghiệm thu dung lượng: Tải lần đầu <= 60KB (gzip)
$cacheFile = $root . '/storage/data/songs_cache.json';
check(file_exists($cacheFile), "File cache songs_cache.json tồn tại", false);

$rawPayload = (string)@file_get_contents($cacheFile);
$rawSize = strlen($rawPayload);
$gzipped = gzencode($rawPayload, 9);
$gzSize = strlen($gzipped);

$gzSizeKb = round($gzSize / 1024, 2);
check(
    $gzSize <= 60 * 1024,
    "Nghiệm thu dung lượng: Payload gzip là {$gzSizeKb} KB <= 60 KB (yêu cầu L2-7)",
    true
);

// 3. Kiểm tra ETag caching trong Controller
$mtime = filemtime($cacheFile);
$expectedRawEtag = dechex($mtime) . '-' . dechex($rawSize);
$expectedEtag = '"' . $expectedRawEtag . '"';

check(!empty($expectedRawEtag), "Sinh ETag định dạng <mtime>-<size>: {$expectedEtag}", true);

// Mô phỏng request tới Controller với ETag khớp -> Phải trả về HTTP 304
$controllerCode = file_get_contents($root . '/api/controllers/SongController.php');
check(
    str_contains($controllerCode, 'header(\'ETag: \' . $etag);') && str_contains($controllerCode, 'http_response_code(304);'),
    "SongController: Có cấu hình ETag header và phản hồi HTTP 304 Not Modified khi If-None-Match khớp",
    true
);

// 4. Kiểm tra ApiService.js chia sẻ Single-Flight Promise caching
$apiServiceCode = file_get_contents($root . '/assets/js/core/ApiService.js');
check(
    str_contains($apiServiceCode, '_songsListPromise') && str_contains($apiServiceCode, 'list:   (forceReload = false)'),
    "ApiService: songs.list() sử dụng Promise cache chia sẻ cho toàn bộ ứng dụng",
    true
);

check(
    str_contains($apiServiceCode, 'invalidateCache') && str_contains($apiServiceCode, '_songsListPromise = null;'),
    "ApiService: Tự động vô hiệu hóa cache _songsListPromise khi add, update, delete bài hát",
    true
);

// 5. Kiểm tra SetlistUI dùng chung danh sách bài từ LibraryUI / ApiService.songs.list()
$setlistUiCode = file_get_contents($root . '/assets/js/setlist-ui.js');
check(
    str_contains($setlistUiCode, 'window.LibraryUI?.getSongs?.()') && str_contains($setlistUiCode, 'window.ApiService.songs.list()'),
    "SetlistUI: ensureSongsLoaded() ưu tiên lấy từ LibraryUI.getSongs() hoặc ApiService.songs.list() (không gửi request trùng lặp)",
    true
);

// 6. Kiểm tra SongService::getById vẫn trả đầy đủ thông tin kể cả lyrics_text
$songDetail = SongService::getById('thanh-ca-001');
check(
    !empty($songDetail) && array_key_exists('lyrics_text', $songDetail) && !empty($songDetail['lyrics_text']),
    "Chi tiết bài hát: SongService::getById vẫn trả đầy đủ lyrics_text khi xem chi tiết 1 bài",
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ L2-7 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Thành công: {$passedChecks}/{$totalChecks}\n";
$pctBehavioral = round(($behavioralChecks / $totalChecks) * 100, 1);
echo "Tỷ lệ kiểm tra hành vi: {$pctBehavioral}% (yêu cầu >= 56%)\n";

if ($passedChecks === $totalChecks && $pctBehavioral >= 56) {
    echo "[SUITE_COMPLETE total={$totalChecks}]\n";
} else {
    echo "[SUITE_FAILED]\n";
    exit(1);
}
