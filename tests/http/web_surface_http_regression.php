<?php
declare(strict_types=1);

/**
 * tests/http/web_surface_http_regression.php
 * 
 * Ticket T01 — Kiểm tra bề mặt web thực tế bằng HTTP curl tới Apache local
 * - URL bị chặn: tests/, *.bat, *.sh, api/migrations/, api/core/, api/services/, api/controllers/ -> 403 hoặc 404
 * - URL được mở: /, api/index.php?route=songs, storage/Thanh ca/*.xml, assets/js/app.js -> 200
 * - Nếu Apache không chạy: SKIP rõ ràng, không được PASS
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

function httpStatus(string $url, string $method = 'GET'): int {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY         => ($method === 'GET' || $method === 'HEAD'),
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}

$failures = [];

function assertBlocked(string $url, string $description): void {
    global $failures;
    $status = httpStatus($url);
    $isBlocked = in_array($status, [403, 404], true);
    if ($isBlocked) {
        echo "[PASS] BLOCKED ({$status}): {$description}\n";
    } else {
        echo "[FAIL] EXPECTED 403/404, GOT {$status}: {$description} ({$url})\n";
        $failures[] = "Blocked check failed for {$description} (HTTP {$status})";
    }
}

function assertAllowed(string $url, string $description, int $expectedStatus = 200): void {
    global $failures;
    $status = httpStatus($url);
    if ($status === $expectedStatus) {
        echo "[PASS] ALLOWED ({$status}): {$description}\n";
    } else {
        echo "[FAIL] EXPECTED {$expectedStatus}, GOT {$status}: {$description} ({$url})\n";
        $failures[] = "Allowed check failed for {$description} (HTTP {$status})";
    }
}

echo "=== T01: WEB SURFACE HTTP REGRESSION SUITE ===\n";
echo "Target Base URL: {$baseUrl}\n\n";

// A. Các URL BẮT BUỘC PHẢI BỊ CHẶN (HTTP 403 hoặc 404)
echo "-- 1. Kiểm tra các URL nhạy cảm cần bị chặn (403/404) --\n";
assertBlocked("{$baseUrl}/tests/run_all_tests.php", "tests/ runner script");
assertBlocked("{$baseUrl}/tests/security/web_surface_regression.php", "tests/ security test");
assertBlocked("{$baseUrl}/test.bat", "test.bat batch script");
assertBlocked("{$baseUrl}/sync.sh", "sync.sh bash script");
assertBlocked("{$baseUrl}/api/migrations/001_initial_schema.php", "api/migrations/ schema file");
assertBlocked("{$baseUrl}/api/core/Auth.php", "api/core/ internal class");
assertBlocked("{$baseUrl}/api/services/SongService.php", "api/services/ service class");
assertBlocked("{$baseUrl}/api/controllers/SongController.php", "api/controllers/ controller class");
assertBlocked("{$baseUrl}/api/database/migrate_learn_tables.php", "api/database/ migration file");
assertBlocked("{$baseUrl}/api/init_db.php", "api/init_db.php CLI seed script");
assertBlocked("{$baseUrl}/api/omr_worker.php", "api/omr_worker.php CLI worker script");

// B. Các URL CÔNG KHAI BẮT BUỘC PHẢI MỞ (HTTP 200)
echo "\n-- 2. Kiểm tra các URL công khai hợp lệ phải mở (200) --\n";
assertAllowed("{$baseUrl}/", "Trang chủ SheetApp (/)");
assertAllowed("{$baseUrl}/api/index.php?route=songs", "API danh sách bài hát");
assertAllowed("{$baseUrl}/assets/js/app.js", "Core JavaScript asset");
assertAllowed("{$baseUrl}/assets/css/base.css", "Core CSS asset");
assertAllowed("{$baseUrl}/storage/Thanh%20ca/001%20H%E1%BB%A0I%20TH%C3%81NH%20V%C6%AF%C6%A0NG%2C%20K%C3%8DP%20NG%E1%BB%B0%20LAI.xml", "MusicXML file trong storage/Thanh ca/");

// C. Shims công khai đang dùng (được phục vụ bởi PHP router, trả về JSON thay vì bị web server chặn)
function assertPhpJsonEndpoint(string $url, string $method, string $description, int $expectedStatus): void {
    global $failures;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => '{}',
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cType  = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    $isJson = str_contains($cType ?: '', 'application/json');
    if ($status === $expectedStatus && $isJson) {
        echo "[PASS] PHP API SHIM ({$status}, JSON): {$description}\n";
    } else {
        echo "[FAIL] EXPECTED {$expectedStatus} JSON, GOT {$status} ({$cType}): {$description}\n";
        $failures[] = "PHP API check failed for {$description}";
    }
}

assertPhpJsonEndpoint("{$baseUrl}/api/log_error.php", "POST", "api/log_error.php endpoint ghi log client", 200);
assertPhpJsonEndpoint("{$baseUrl}/api/import.php", "POST", "api/import.php legacy shim (phản hồi JSON từ router)", 403);

echo "\n----------------------------------------\n";
if (!empty($failures)) {
    echo "KẾT QUẢ: " . count($failures) . " kiểm tra THẤT BẠI.\n";
    exit(1);
}

echo "KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS).\n";
exit(0);
