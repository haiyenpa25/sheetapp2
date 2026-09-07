<?php
/**
 * tools/create_hd_sets.php
 * Migration: Tạo bộ hợp âm "HD" rỗng cho tất cả bài hát trong database.
 * Chạy 1 lần từ command line: php tools/create_hd_sets.php
 * Hoặc mở trình duyệt: http://localhost/sheetapp/tools/create_hd_sets.php
 */

// Cho phép chạy trên browser
if (php_sapi_name() !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';
$pdo = DB::get();

$BASE_DIR    = ChordSetService::BASE_DIR;
$SET_NAME    = 'HD';
$EMPTY_JSON  = '[]';

echo "=== Tạo bộ hợp âm HD cho tất cả bài hát ===\n\n";

// Lấy danh sách tất cả song ID
$stmt = $pdo->query("SELECT id FROM songs ORDER BY id ASC");
$songs = $stmt->fetchAll(PDO::FETCH_COLUMN);
$total = count($songs);

echo "Tổng số bài: $total\n\n";

$created = 0;
$skipped = 0;
$errors  = 0;

foreach ($songs as $songId) {
    // Tạo tên thư mục an toàn (giống chord_sets.php)
    $safeSong = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
    $dir      = $BASE_DIR . '/' . $safeSong;

    // Tạo thư mục nếu chưa có
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            echo "  [ERROR] Không tạo được thư mục: $dir\n";
            $errors++;
            continue;
        }
    }

    // Tên file: HD.json (HD không có ký tự đặc biệt, giữ nguyên)
    $file = $dir . '/' . $SET_NAME . '.json';

    if (file_exists($file)) {
        echo "  [SKIP]  $songId — HD.json đã tồn tại\n";
        $skipped++;
        continue;
    }

    // Tạo file rỗng
    if (file_put_contents($file, $EMPTY_JSON) !== false) {
        echo "  [OK]    $songId — HD.json đã tạo\n";
        $created++;
    } else {
        echo "  [ERROR] $songId — Không ghi được file\n";
        $errors++;
    }
}

echo "\n=== KẾT QUẢ ===\n";
echo "  Tạo mới : $created\n";
echo "  Bỏ qua  : $skipped (đã tồn tại)\n";
echo "  Lỗi     : $errors\n";
echo "  Tổng    : $total bài\n";
echo "\nHoàn thành!\n";
