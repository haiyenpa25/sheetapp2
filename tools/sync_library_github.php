<?php
/**
 * tools/sync_library_github.php
 *
 * Công cụ CLI đồng bộ kho bài hát công khai theo danh mục (storage/Thanh ca/<slug>/)
 * và gói seed (storage/seed/library.sqlite + library.manifest.json) giữa Web và Local/GitHub.
 *
 * Cách dùng:
 *   php tools/sync_library_github.php           # Chuẩn hóa thư mục XML theo danh mục + cập nhật library.sqlite & manifest
 *   php tools/sync_library_github.php --push    # Chuẩn hóa + cập nhật seed + git commit & push origin/main
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/api/services/LibrarySyncService.php';

$opts = getopt('', ['push']);
$pushGit = array_key_exists('push', $opts);

try {
    $res = LibrarySyncService::syncAll($pushGit);
    echo json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Lỗi đồng bộ thư viện: ' . $e->getMessage() . "\n");
    exit(1);
}

