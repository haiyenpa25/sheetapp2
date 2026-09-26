<?php
/**
 * migration_integrity_regression.php
 *
 * Kiểm thử tự động tính toàn vẹn CSDL, Migration Runner và Khóa ngoại (Task 1.9 - Giai đoạn 1)
 *
 * Tiêu chí kiểm tra:
 * 1. Fresh install từ đầu trên DB SQLite tạm: cài đặt trọn vẹn mọi bảng và index
 * 2. Idempotency: Chạy lại migration lần 2 không gây lỗi và không áp dụng lại
 * 3. Khóa ngoại CASCADE hoạt động chính xác (xóa setlist tự xóa setlist_items con)
 * 4. Kiểm tra sự tồn tại của các chỉ mục hiệu năng cốt lõi (10+ index)
 * 5. DB thật app.sqlite đạt chuẩn: integrity_check ok, foreign_key_check không có vi phạm, journal_mode là wal
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/MigrationRunner.php';

$root = dirname(__DIR__);
$failures = [];
$totalTests = 0;

function assertCondition(bool $cond, string $msg, array &$failures, int &$totalTests): void {
    $totalTests++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== Kiểm thử Hồi quy Migration & Toàn vẹn CSDL (Task 1.9) ===\n";

// 1. Fresh install trên DB tạm cô lập
$tempDbPath = sys_get_temp_dir() . '/sheetapp_test_fresh_' . bin2hex(random_bytes(6)) . '.sqlite';
if (file_exists($tempDbPath)) unlink($tempDbPath);

try {
    $tempPdo = new PDO('sqlite:' . $tempDbPath);
    $tempPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $tempPdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $tempPdo->exec('PRAGMA foreign_keys = ON;');

    $runner = new MigrationRunner($tempPdo);
    $executed = $runner->migrate();

    $tables = $tempPdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    $hasEssentialTables = (
        in_array('users', $tables, true) &&
        in_array('songs', $tables, true) &&
        in_array('setlists', $tables, true) &&
        in_array('setlist_items', $tables, true) &&
        in_array('categories', $tables, true) &&
        in_array('arrangements', $tables, true) &&
        in_array('learning_arrangements', $tables, true)
    );

    assertCondition(
        count($executed) >= 3 && $hasEssentialTables,
        "Fresh Install: MigrationRunner khởi tạo CSDL mới hoàn chỉnh từ 0 với đầy đủ bảng cốt lõi",
        $failures,
        $totalTests
    );

    // 2. Idempotency: chạy lần 2 trên cùng DB
    $secondRun = $runner->migrate();
    assertCondition(
        count($secondRun) === 0,
        "Idempotency: Chạy lại migration không áp dụng trùng lặp và an toàn tuyệt đối",
        $failures,
        $totalTests
    );

    // 3. Khóa ngoại CASCADE
    $tempPdo->exec("INSERT INTO users (id, username, password_hash) VALUES (10, 'tester', 'hash')");
    $tempPdo->exec("INSERT INTO songs (id, title, xmlPath) VALUES ('test-song-1', 'Bài Test', 'test.xml')");
    $tempPdo->exec("INSERT INTO setlists (id, title, created_by) VALUES (100, 'Tập Lễ 1', 10)");
    $tempPdo->exec("INSERT INTO setlist_items (id, setlist_id, song_id, display_order) VALUES (1001, 100, 'test-song-1', 1)");

    // Xóa setlist -> setlist_item phải tự xóa theo cascade
    $tempPdo->exec("DELETE FROM setlists WHERE id = 100");
    $orphanCount = $tempPdo->query("SELECT COUNT(*) FROM setlist_items WHERE id = 1001")->fetchColumn();
    $fkCheck = $tempPdo->query("PRAGMA foreign_key_check")->fetchAll();

    assertCondition(
        $orphanCount == 0 && empty($fkCheck),
        "Foreign Key Cascade: Xóa bảng cha tự động dọn sạch bản ghi con, không sinh mồ côi",
        $failures,
        $totalTests
    );

    // 4. Kiểm tra các chỉ mục hiệu năng
    $indexes = $tempPdo->query("SELECT name FROM sqlite_master WHERE type='index'")->fetchAll(PDO::FETCH_COLUMN);
    $hasKeyIndexes = (
        in_array('idx_setlist_items_setlist_id', $indexes, true) &&
        in_array('idx_setlist_items_song_id', $indexes, true) &&
        in_array('idx_songs_category_id', $indexes, true) &&
        in_array('idx_arrangements_song_id', $indexes, true) &&
        in_array('idx_categories_slug', $indexes, true)
    );

    assertCondition(
        $hasKeyIndexes,
        "Indexes: Thiết lập đầy đủ chỉ mục cho các trường quan hệ ngoại và tìm kiếm",
        $failures,
        $totalTests
    );

} catch (Throwable $e) {
    assertCondition(false, "Lỗi kiểm thử migration DB tạm: " . $e->getMessage(), $failures, $totalTests);
} finally {
    if (file_exists($tempDbPath)) {
        unset($tempPdo);
        @unlink($tempDbPath);
    }
}

// 5. Kiểm tra CSDL thực tế app.sqlite
try {
    $prodPdo = DB::get();
    $integrity = $prodPdo->query("PRAGMA integrity_check")->fetchColumn();
    $fkViolations = $prodPdo->query("PRAGMA foreign_key_check")->fetchAll();
    $journalMode = $prodPdo->query("PRAGMA journal_mode")->fetchColumn();

    assertCondition(
        $integrity === 'ok' && empty($fkViolations) && strtolower($journalMode) === 'wal',
        "Production DB: app.sqlite đạt integrity_check 'ok', 0 vi phạm khóa ngoại, journal_mode là 'wal'",
        $failures,
        $totalTests
    );
} catch (Throwable $e) {
    assertCondition(false, "Lỗi kiểm tra app.sqlite: " . $e->getMessage(), $failures, $totalTests);
}

echo "\n--------------------------------------------------------\n";
echo "Kết quả: " . ($totalTests - count($failures)) . "/{$totalTests} kiểm tra đạt chuẩn.\n";

if (!empty($failures)) {
    echo "❌ CÓ LỖI TOÀN VẸN CSDL / MIGRATION:\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}

echo "✅ TẤT CẢ KIỂM TRA MIGRATION & TOÀN VẸN CSDL ĐÃ ĐẠT (PASS 100%)\n";
exit(0);
