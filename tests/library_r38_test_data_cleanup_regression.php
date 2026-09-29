<?php
/**
 * tests/library_r38_test_data_cleanup_regression.php
 *
 * Regression test suite cho Ticket R3-8:
 * - Kiểm tra công cụ tools/clean_test_setlists.php
 * - Xác thực chế độ --dry-run mặc định không làm biến đổi CSDL thật
 * - Xác thực khả năng nhận diện chính xác các setlist thử nghiệm (Test, E2E, Phụng Vụ, Mock, Sample)
 * - Xác thực cơ chế sao lưu --backup trước khi dọn dẹp
 * - Xác thực cơ chế --execute dọn dẹp triệt để và cascade toàn vẹn trên CSDL tạm
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';

$testCount = 0;
$passedCount = 0;

function it(string $desc, bool $result): void {
    global $testCount, $passedCount;
    $testCount++;
    if ($result) {
        $passedCount++;
        echo "  [PASS] {$desc}\n";
    } else {
        echo "  [FAIL] {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket R3-8: Test Data Cleanup Tool & Dry-Run Regression ===\n\n";

$phpBin = PHP_BINARY ?: 'php';
$toolPath = __DIR__ . '/../tools/clean_test_setlists.php';

// ── 1. Kiểm tra file công cụ và cú pháp ──
echo "-- 1. Kiểm tra File Công Cụ & Cú Pháp --\n";
it('File tools/clean_test_setlists.php tồn tại', file_exists($toolPath));
$lintCmd = escapeshellcmd("{$phpBin} -l " . escapeshellarg($toolPath));
$lintOutput = shell_exec($lintCmd);
it('Cú pháp PHP tools/clean_test_setlists.php hợp lệ', str_contains((string)$lintOutput, 'No syntax errors detected'));

// ── 2. Chế độ --dry-run mặc định bảo vệ CSDL thật ──
echo "\n-- 2. Chế độ --dry-run mặc định bảo vệ CSDL thật --\n";
$realDb = DB::pdo();
$beforeCount = (int)$realDb->query("SELECT count(*) FROM setlists")->fetchColumn();

$dryRunCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --dry-run");
$dryRunOutput = shell_exec($dryRunCmd);

$afterCount = (int)$realDb->query("SELECT count(*) FROM setlists")->fetchColumn();

it("Chế độ --dry-run bảo toàn tuyệt đối số lượng setlists thật (trước={$beforeCount}, sau={$afterCount})", $beforeCount === $afterCount);
it('Output dry-run chứa tiêu đề bảng dry-run', str_contains((string)$dryRunOutput, 'BẢNG DANH SÁCH DRY-RUN'));
it('Nhận diện được Setlist Phụng Vụ Test trong danh sách dry-run', str_contains((string)$dryRunOutput, 'Setlist Phụng Vụ Test'));
it('Nhận diện được E2E Setlist Offline Test trong danh sách dry-run', str_contains((string)$dryRunOutput, 'E2E Setlist Offline Test'));
it('Chứa hướng dẫn rõ ràng cho chủ dự án thực thi sau duyệt', str_contains((string)$dryRunOutput, 'php tools/clean_test_setlists.php --execute'));

// ── 3. Chế độ --status ──
echo "\n-- 3. Chế độ --status --\n";
$statusCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --status");
$statusOutput = shell_exec($statusCmd);
it('Lệnh --status hiển thị bảng thống kê', str_contains((string)$statusOutput, 'THỐNG KÊ DỮ LIỆU CHƯƠNG TRÌNH'));
it('Lệnh --status thống kê số lượng chương trình test', str_contains((string)$statusOutput, 'Số chương trình thử nghiệm:'));

// ── 4. Kiểm thử trên CSDL cách ly (Isolated Temp DB) ──
echo "\n-- 4. Kiểm thử Chức Năng Trên CSDL Cách Ly (Isolated Temp DB) --\n";
$tempDbPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'r38_test_' . uniqid() . '.sqlite';
$tempPdo = new PDO('sqlite:' . $tempDbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$tempPdo->exec('PRAGMA foreign_keys = ON;');

// Khởi tạo bảng trên temp DB
$tempPdo->exec("
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE songs (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE setlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_by INTEGER,
        scheduled_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        service_time TEXT DEFAULT '08:30',
        theme TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        leader_user_id INTEGER
    );
    CREATE TABLE setlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
        song_id TEXT,
        item_type TEXT DEFAULT 'song',
        display_order INTEGER DEFAULT 1,
        transpose_key INTEGER DEFAULT 0,
        bpm INTEGER DEFAULT 80
    );
    CREATE TABLE service_plan_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
        user_id INTEGER,
        role TEXT
    );
    CREATE TABLE song_usage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id TEXT,
        setlist_id INTEGER REFERENCES setlists(id) ON DELETE CASCADE,
        service_date DATE,
        chord_profile TEXT,
        transpose_key INTEGER,
        created_at DATETIME
    );
    CREATE TABLE practice_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER REFERENCES setlists(id) ON DELETE SET NULL,
        song_id TEXT,
        created_by INTEGER
    );
");

// Gieo dữ liệu: 3 test setlists và 2 real setlists
$tempPdo->exec("
    INSERT INTO users (id, name) VALUES (1, 'Admin');
    INSERT INTO songs (id, title) VALUES ('s1', 'Thánh Ca 1'), ('s2', 'Thánh Ca 2');

    -- Test setlists
    INSERT INTO setlists (id, title, status) VALUES (10, 'Setlist Phụng Vụ Test', 'published');
    INSERT INTO setlists (id, title, status) VALUES (20, 'E2E Setlist Offline Test 999', 'published');
    INSERT INTO setlists (id, title, status) VALUES (30, 'Mock Band Rehearsal Test', 'draft');

    -- Real setlists (chương trình thờ phượng thật)
    INSERT INTO setlists (id, title, status) VALUES (100, 'Chương trình Thờ Phượng Chúa Nhật 05/10/2026', 'published');
    INSERT INTO setlists (id, title, status) VALUES (101, 'Lễ Cảm Tạ & Cung Hiến Nhà Thờ', 'published');

    -- Items liên kết
    INSERT INTO setlist_items (setlist_id, song_id) VALUES (10, 's1'), (20, 's1'), (20, 's2'), (100, 's1'), (101, 's2');
    INSERT INTO service_plan_assignments (setlist_id, user_id, role) VALUES (10, 1, 'Hát dẫn'), (100, 1, 'Mục sư / Truyền đạo');
    INSERT INTO song_usage_history (song_id, setlist_id) VALUES ('s1', 10), ('s1', 100);
    INSERT INTO practice_assignments (setlist_id, song_id) VALUES (10, 's1'), (100, 's1');
");

// Chạy test --status trên temp DB
$tempStatusCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --status --db=" . escapeshellarg($tempDbPath));
$tempStatusOutput = shell_exec($tempStatusCmd);
it('Phân loại đúng 2 chương trình thực tế', str_contains((string)$tempStatusOutput, 'Số chương trình thực tế:        2'));
it('Phân loại đúng 3 chương trình thử nghiệm', str_contains((string)$tempStatusOutput, 'Số chương trình thử nghiệm:     3'));

// Chạy test --dry-run trên temp DB
$tempDryCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --dry-run --db=" . escapeshellarg($tempDbPath));
$tempDryOutput = shell_exec($tempDryCmd);
$tempCountBefore = (int)$tempPdo->query("SELECT count(*) FROM setlists")->fetchColumn();
it('Dry-run không xóa dữ liệu trên test DB (vẫn còn 5 setlists)', $tempCountBefore === 5);

// Chạy test --backup trên temp DB
$tempBackupCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --backup --db=" . escapeshellarg($tempDbPath));
$tempBackupOutput = shell_exec($tempBackupCmd);
it('Tạo file sao lưu thành công', str_contains((string)$tempBackupOutput, 'Đã tạo file sao lưu dữ liệu test'));

// Chạy test --execute trên temp DB
$tempExecCmd = escapeshellcmd("{$phpBin} " . escapeshellarg($toolPath) . " --execute --db=" . escapeshellarg($tempDbPath));
$tempExecOutput = shell_exec($tempExecCmd);
it('Thực thi dọn dẹp thành công với --execute', str_contains((string)$tempExecOutput, 'DỌN DẸP HOÀN TẤT THÀNH CÔNG'));
it('Đã xóa đúng 3 test setlists', str_contains((string)$tempExecOutput, 'Số setlists đã xóa:           3'));

// Kiểm tra trạng thái sau khi --execute trên temp DB:
// 1. Chỉ còn 2 real setlists (100 và 101)
$remainingSetlists = $tempPdo->query("SELECT id, title FROM setlists ORDER BY id ASC")->fetchAll();
it('Sau khi dọn dẹp chỉ còn 2 chương trình thực tế', count($remainingSetlists) === 2);
it('Các chương trình thực tế (100, 101) được bảo toàn nguyên vẹn', ($remainingSetlists[0]['id'] ?? 0) == 100 && ($remainingSetlists[1]['id'] ?? 0) == 101);

// 2. setlist_items của test đã bị cascade xóa, nhưng của real setlists vẫn còn
$remainingItems = $tempPdo->query("SELECT count(*) FROM setlist_items")->fetchColumn();
it('setlist_items của real setlists được bảo toàn (2 items còn lại)', (int)$remainingItems === 2);

// 3. service_plan_assignments của real setlist vẫn còn
$remainingPlans = $tempPdo->query("SELECT count(*) FROM service_plan_assignments")->fetchColumn();
it('service_plan_assignments của real setlist còn nguyên', (int)$remainingPlans === 1);

// 4. practice_assignments của test setlist có setlist_id đổi thành NULL (không bị xóa cả hàng)
$nullPractice = $tempPdo->query("SELECT count(*) FROM practice_assignments WHERE setlist_id IS NULL")->fetchColumn();
$realPractice = $tempPdo->query("SELECT count(*) FROM practice_assignments WHERE setlist_id = 100")->fetchColumn();
it('practice_assignments được cập nhật setlist_id = NULL an toàn', (int)$nullPractice === 1 && (int)$realPractice === 1);

// Dọn dẹp temp DB
unset($tempPdo);
@unlink($tempDbPath);

echo "\n----------------------------------------\n";
echo "KẾT QUẢ KIỂM THỬ: {$passedCount} / {$testCount} checks đạt.\n";
if ($passedCount === $testCount) {
    echo "🎉 TẤT CẢ KIỂM TRA TICKET R3-8 ĐỀU ĐẠT CHUẨN!\n";
} else {
    echo "❌ CÓ KIỂM TRA THẤT BẠI!\n";
}

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";

if ($passedCount !== $testCount) {
    exit(1);
}
