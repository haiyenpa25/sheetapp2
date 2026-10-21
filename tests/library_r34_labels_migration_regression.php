<?php
/**
 * tests/library_r34_labels_migration_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R3-4 (ROADMAP 5):
 * - Migration dữ liệu nhãn theo khoảng số bài chính thức của Thánh Ca (1–903).
 * - Điền 403 bài đang trống (501–903).
 * - Xoá triệt để nhãn 'Thường Niên' (chuyển sang NULL = quanh năm).
 * - Hỗ trợ --dry-run in bảng thay đổi và tự động backup CSDL.
 * - Kiểm tra tính toàn vẹn integrity_check = ok và 20+ bài kiểm chứng ngẫu nhiên/then chốt đúng mục lục.
 * - Line budget: tools/manage_song_labels.php < 600 dòng.
 */

declare(strict_types=1);

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function check(bool $condition, string $description, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}\n";
    }
}

echo "=== R3-4: Labels Migration & Dry-Run Regression Suite ===\n\n";

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/tests/fixtures/test_db_fixture.php';

// ── 1. Kiểm tra CLI --dry-run không làm biến đổi CSDL ──────────────────
echo "-- 1. CLI --dry-run Contract & Output Format --\n";

$dbPath = $root . '/storage/data/app.sqlite';
$hashBefore = file_exists($dbPath) ? md5_file($dbPath) : '';

$dryRunOutput = shell_exec("php " . escapeshellarg($root . '/tools/manage_song_labels.php') . " --dry-run");
check($dryRunOutput !== null && str_contains($dryRunOutput, 'DRY-RUN BẢO TRÌ NHÃN THÁNH CA HTTLVN'), 'CLI: --dry-run in tiêu đề báo cáo');
check(str_contains($dryRunOutput, '903 / 903 bài (100% mục lục)'), 'CLI: --dry-run ghi nhận 903 bài được phủ nhãn');
check(str_contains($dryRunOutput, 'integrity_check = ok'), 'CLI: --dry-run kiểm tra integrity_check = ok');
check(str_contains($dryRunOutput, 'MẪU ĐỐI CHIẾU 20 BÀI ĐIỂN HÌNH'), 'CLI: --dry-run in bảng mẫu đối chiếu 20 bài');
check(str_contains($dryRunOutput, 'Cơ sở dữ liệu HOÀN TOÀN CHƯA THAY ĐỔI'), 'CLI: --dry-run khẳng định không sửa đổi DB');

$hashAfter = file_exists($dbPath) ? md5_file($dbPath) : '';
check($hashBefore === $hashAfter, 'An toàn: CSDL giữ nguyên 100% sau khi chạy --dry-run', true);

// ── 2. Kiểm tra Logic Migration trên CSDL Test độc lập ─────────────────
echo "\n-- 2. Migration Execution & Coverage (Test DB) --\n";

// Bản sao và backup của test nằm trong thư mục tạm: test không được ghi vào storage/ thật.
$tmpDir = sys_get_temp_dir() . '/sheetapp_r34_' . getmypid();
@mkdir($tmpDir, 0775, true);
$tmpBackupDir = $tmpDir . '/backups';
$prodBackupCountBefore = count(glob($root . '/storage/backups/*.sqlite') ?: []);
$testDbFile = $tmpDir . '/test_r34_migration.sqlite';
if (file_exists($testDbFile)) {
    @unlink($testDbFile);
}
@copy($dbPath, $testDbFile);

$testPdo = new PDO('sqlite:' . $testDbFile, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// Cache danh sách bài của test DB: tool phải xoá đúng file này sau khi ghi nhãn
require_once $root . '/api/services/SongService.php';
DB::setPdo($testPdo);
$testCacheFile = SongService::cachePath();
DB::setPdo(null);
file_put_contents($testCacheFile, '[]');

// Chạy migration trên test DB
$execOutput = shell_exec("php " . escapeshellarg($root . '/tools/manage_song_labels.php') . " --seed --db=" . escapeshellarg($testDbFile) . " --backup-dir=" . escapeshellarg($tmpBackupDir));
check($execOutput !== null && str_contains($execOutput, 'Đã gắn nhãn thành công cho 903 bài hát'), 'Migration: Đã cập nhật thành công 903 bài hát trên test DB');
check(!file_exists($testCacheFile), 'Cache: --seed xoá cache danh sách bài của đúng DB vừa ghi');
@unlink($testCacheFile);

// 2.1 Xóa sạch Thường Niên
$thuongNienCount = (int)$testPdo->query("SELECT COUNT(*) FROM songs WHERE liturgical_season = 'Thường Niên'")->fetchColumn();
check($thuongNienCount === 0, 'Phụ lục A: Xoá triệt để nhãn Thường Niên (0 bài mang Thường Niên)', true);

// 2.2 Phủ kín 903 bài có Chủ đề
$totalSongs = (int)$testPdo->query("SELECT COUNT(*) FROM songs WHERE COALESCE(category_id, 1) = 1")->fetchColumn();
$withThemeCount = (int)$testPdo->query("SELECT COUNT(*) FROM songs WHERE COALESCE(category_id, 1) = 1 AND theme IS NOT NULL AND theme != ''")->fetchColumn();
check($withThemeCount === 903, "Phụ lục B.2: 100% bài hát (903/903) được gán chủ đề chuẩn mục lục (thực tế: {$withThemeCount})", true);

// 2.3 Điền 403 bài 501–903 vốn đang trống
$empty501_903 = (int)$testPdo->query("SELECT COUNT(*) FROM songs WHERE COALESCE(category_id, 1) = 1 AND httlvnId >= 501 AND httlvnId <= 903 AND (theme IS NULL OR theme = '')")->fetchColumn();
check($empty501_903 === 0, 'Mục tiêu R3-4: 403 bài (501–903) trước đây trống nay đã được điền đủ 100%', true);

// 2.4 Integrity check
$integrity = $testPdo->query("PRAGMA integrity_check")->fetchColumn();
check($integrity === 'ok', "Tính toàn vẹn CSDL: integrity_check = {$integrity}", true);

// ── 3. Đối chiếu 20+ bài then chốt theo Phụ lục B.3 ──────────────────
echo "\n-- 3. Verification of Key Hymns against Appendix B.3 --\n";

$checkKeyHymns = [
    1   => ['theme' => 'Thờ phượng'],
    38  => ['theme' => 'Thờ phượng'],
    39  => ['theme' => 'Đức Chúa Trời'],
    52  => ['theme' => 'Đức Chúa Trời'],
    53  => ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Giáng Sinh'],
    76  => ['theme' => 'Chúa Jêsus Christ', 'season' => null],
    88  => ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Thương Khó'],
    103 => ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Phục Sinh'],
    113 => ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Thăng Thiên'],
    119 => ['theme' => 'Chúa Jêsus Christ', 'season' => null],
    135 => ['theme' => 'Đức Thánh Linh', 'season' => 'Lễ Đức Thánh Linh Giáng Lâm'],
    145 => ['theme' => 'Hội Thánh'],
    150 => ['theme' => 'Kinh Thánh'],
    156 => ['theme' => 'Tin Lành'],
    206 => ['theme' => 'Đời tín đồ'],
    335 => ['theme' => 'Thiên đàng'],
    349 => ['theme' => 'Truyền giảng', 'season' => 'Buổi Truyền Giảng'],
    360 => ['theme' => 'Truyền giảng', 'season' => 'Buổi Truyền Giảng'],
    363 => ['theme' => 'Thiếu nhi'],
    374 => ['theme' => 'Thanh niên'],
    383 => ['theme' => 'Đơn ca – Song ca'],
    393 => ['season' => 'Lễ Dâng Con'],
    397 => ['season' => 'Lễ Báp-têm'],
    399 => ['season' => 'Lễ Tiệc Thánh'],
    401 => ['season' => 'Hôn Lễ'],
    404 => ['season' => 'Tang Lễ'],
    405 => ['season' => 'Năm Mới'],
    407 => ['season' => 'Tiễn Biệt'],
    409 => ['season' => 'Lễ Tấn Phong Mục Sư'],
    413 => ['theme' => 'Hợp ca'],
    432 => ['theme' => 'Kinh tiết ca & Đoản ca'],
    439 => ['theme' => 'Kinh tiết ca & Đoản ca'],
    456 => ['theme' => 'Thi Thiên'],
    510 => ['theme' => 'Thờ phượng'],
    903 => ['theme' => 'Hợp ca'],
];

foreach ($checkKeyHymns as $hId => $expected) {
    $song = $testPdo->query("SELECT httlvnId, title, liturgical_season, theme FROM songs WHERE COALESCE(category_id, 1) = 1 AND httlvnId = {$hId}")->fetch();
    check($song !== false, "Bài {$hId} tồn tại trong CSDL");
    if (isset($expected['theme'])) {
        check($song['theme'] === $expected['theme'], "Bài {$hId} ('{$song['title']}'): Theme khớp mục lục B.2 '{$expected['theme']}'");
    }
    if (array_key_exists('season', $expected)) {
        $actualSeason = $song['liturgical_season'];
        check($actualSeason === $expected['season'], "Bài {$hId} ('{$song['title']}'): Season khớp B.1/B.3 '" . ($expected['season'] ?? 'NULL') . "'");
    }
}

// ── 4. Kiểm tra sao lưu tự động (--backup) ───────────────────────────
echo "\n-- 4. Auto Backup Mechanism --\n";

$backupOutput = shell_exec("php " . escapeshellarg($root . '/tools/manage_song_labels.php') . " --backup --db=" . escapeshellarg($testDbFile) . " --backup-dir=" . escapeshellarg($tmpBackupDir));
check($backupOutput !== null && str_contains($backupOutput, 'Đã tạo bản sao lưu CSDL thành công'), 'Backup: CLI --backup tạo file thành công');

$backupFiles = glob($tmpBackupDir . '/app_before_r34_*.sqlite') ?: [];
check(!empty($backupFiles), 'Backup: File sao lưu nằm trong --backup-dir');

$backupIntegrity = '';
if (!empty($backupFiles)) {
    $bkPdo = new PDO('sqlite:' . end($backupFiles));
    $backupIntegrity = (string)$bkPdo->query('PRAGMA integrity_check')->fetchColumn();
    $bkSongs = (int)$bkPdo->query('SELECT COUNT(*) FROM songs')->fetchColumn();
    $bkPdo = null;
    check($bkSongs > 0, "Backup: bản VACUUM INTO đọc được ({$bkSongs} bài)");
}
check($backupIntegrity === 'ok', 'Backup: integrity_check của bản sao lưu = ok');

$prodBackupCountAfter = count(glob($root . '/storage/backups/*.sqlite') ?: []);
check($prodBackupCountAfter === $prodBackupCountBefore, "An toàn: storage/backups thật không thêm file ({$prodBackupCountBefore} → {$prodBackupCountAfter})");

// Dọn dẹp test file
unset($testPdo);
foreach (array_merge($backupFiles, [$testDbFile, $testDbFile . '-wal', $testDbFile . '-shm']) as $f) {
    if (file_exists($f)) @unlink($f);
}
@rmdir($tmpBackupDir);
@rmdir($tmpDir);

// ── 5. Line Budget Disciplines (< 600 lines) ────────────────────────
echo "\n-- 5. Line Budget Disciplines (< 600 lines) --\n";

$linesTool = count(file($root . '/tools/manage_song_labels.php'));
check($linesTool < 600, "Line Budget: tools/manage_song_labels.php có {$linesTool} dòng (< 600 dòng)", false);

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: {$totalChecks} (Behavioral: {$behavioralChecks}, Static: {$staticChecks})\n";
echo "Số kiểm tra đạt: {$passedChecks}\n";
$failed = $totalChecks - $passedChecks;
echo "Số kiểm tra lỗi: {$failed}\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA R3-4 ĐỀU ĐẠT (PASS 100%)!\n\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "❌ KẾT QUẢ: CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
