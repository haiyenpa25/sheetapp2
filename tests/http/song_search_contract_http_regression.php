<?php
declare(strict_types=1);

/**
 * tests/http/song_search_contract_http_regression.php
 * 
 * Regression suite cho Ticket T06 — Sửa tìm kiếm FTS5 trên UI & API contract:
 * 1. Contract HTTP: route=songs&action=search&q=chua phải trả về JSON có key 'data' là mảng list.
 * 2. Mỗi phần tử trong 'data' phải có tối thiểu 'id' và 'title'.
 * 3. Snippet (lyric_snippet) phải được escape trước và chèn thẻ <mark> quanh từ khóa khớp.
 * 4. XSS Guard: Snippet tuyệt đối không chứa HTML thô từ DB.
 * 5. Migration 006: kiểm tra hỗ trợ FTS5 mềm dẻo, không làm sập hệ thống khi thiếu module FTS5.
 */

$baseUrl = getenv('SHEETAPP_TEST_URL') ?: 'http://localhost/sheetapp2';
$baseUrl = rtrim($baseUrl, '/');

// 1. Kiểm tra liveness của Apache
function checkLiveness(string $url): ?int {
    $ch = curl_init($url . '/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY         => true,
        CURLOPT_TIMEOUT        => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    curl_exec($ch);
    $errno = curl_errno($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno !== 0 || $code === 0) {
        return null;
    }
    return $code;
}

$liveCode = checkLiveness($baseUrl);
if ($liveCode === null) {
    echo "[SKIP] Apache không chạy tại {$baseUrl}/ (không thể kết nối HTTP). Test bị bỏ qua.\n";
    exit(0);
}

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

echo "=== T06: SONG SEARCH API CONTRACT & FTS5 REGRESSION SUITE ===\n\n";

// ── 1. HTTP Contract: route=songs&action=search&q=chua ──
echo "-- 1. Kiểm tra HTTP Contract route=songs&action=search&q=chua --\n";
$searchUrl = "{$baseUrl}/api/index.php?route=songs&action=search&q=chua";

$ch = curl_init($searchUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HEADER         => true,
]);
$rawResponse = curl_exec($ch);
$httpCode    = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize  = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$headers = substr($rawResponse, 0, $headerSize);
$body    = substr($rawResponse, $headerSize);

check($httpCode === 200, "API search trả về HTTP 200 (nhận được: {$httpCode})");
check(str_contains(strtolower($headers), 'application/json'), "Content-Type là application/json");

$json = json_decode($body, true);
check(is_array($json), "Phản hồi API là cú pháp JSON hợp lệ");

// Contract yêu cầu: 'data' là mảng tuần tự (list), không phải object có key số ('0', '1'...)
$hasDataKey = isset($json['data']);
check($hasDataKey, "Phản hồi API có chứa trường 'data'");

$isDataArrayList = $hasDataKey && is_array($json['data']) && array_is_list($json['data']);
check($isDataArrayList, "Trường 'data' là một mảng tuần tự (Array list) hợp lệ");

$count = $isDataArrayList ? count($json['data']) : 0;
check($count >= 1, "Kết quả tìm kiếm 'chua' trả về ít nhất 1 bài hát (nhận được: {$count})");

if ($count >= 1) {
    $first = $json['data'][0];
    check(!empty($first['id']), "Mỗi bài hát có trường 'id' không rỗng");
    check(!empty($first['title']), "Mỗi bài hát có trường 'title' không rỗng");

    // Kiểm tra snippet chứa thẻ <mark>
    $hasMarkSnippet = false;
    foreach ($json['data'] as $s) {
        if (!empty($s['lyric_snippet']) && str_contains($s['lyric_snippet'], '<mark>')) {
            $hasMarkSnippet = true;
            break;
        }
    }
    check($hasMarkSnippet, "Tồn tại kết quả tìm kiếm có lyric_snippet chứa thẻ <mark> highlight");
}

// ── 2. Kiểm tra XSS Snippet Safety ──
echo "\n-- 2. Kiểm tra XSS Guard trên Lyric Snippet --\n";
require_once __DIR__ . '/../../api/services/SongService.php';

$xssPayload = "Ca ngợi Chúa <script>alert('xss')</script> và <img src=x onerror=alert(1)> muôn đời";
$snippet = SongService::createLyricSnippet($xssPayload, "Chúa", "chua");

check($snippet !== null, "Hàm createLyricSnippet tạo được snippet");
if ($snippet !== null) {
    check(!str_contains($snippet, '<script>'), "Snippet không chứa thẻ <script> thô");
    check(!str_contains($snippet, '<img'), "Snippet không chứa thẻ <img> thô");
    check(str_contains($snippet, '&lt;script&gt;'), "Ký tự HTML đặc biệt đã được escape thành &lt;script&gt;");
    check(str_contains($snippet, '<mark>'), "Snippet vẫn chứa thẻ <mark> an toàn quanh từ khóa");
}

// ── 3. Kiểm tra Migration 006 Fallback Guard ──
echo "\n-- 3. Kiểm tra Migration 006 FTS5 Fallback Guard --\n";
$migFile = __DIR__ . '/../../api/migrations/006_fts5_search_and_taxonomy.php';
$migSrc = file_get_contents($migFile) ?: '';
check(str_contains($migSrc, 'fts5'), "Migration 006 xử lý FTS5");
check(str_contains($migSrc, 'try') && str_contains($migSrc, 'check_fts5'), "Migration 006 có try-catch kiểm tra FTS5 trước khi tạo bảng");

echo "\n----------------------------------------\n";
if (empty($failures)) {
    echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "KẾT QUẢ: " . count($failures) . " KIỂM TRA THẤT BẠI (FAIL).\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}
