<?php
/**
 * tests/backup_restore_drill_regression.php
 *
 * Kiểm thử Hồi quy & Nghiệm thu Diễn tập Sao lưu / Phục hồi Ngoại tuyến (Off-Site Backup & Restore Drill)
 * Đáp ứng điều kiện Checkpoint G3.9:
 * "Có ít nhất 1 bản backup off-site đã restore thử: Runbook có ngày, giờ, checksum"
 * 
 * Quy trình:
 * 1. Tạo gói sao lưu mã hóa AES-256-CBC PBKDF2 bằng tools/create_encrypted_backup.php
 * 2. Xác thực cấu trúc gói sao lưu ("Salted__", kích thước hợp lệ)
 * 3. Thử nghiệm giải mã với mật mã SAI -> kỳ vọng FAIL an toàn, không rò rỉ dữ liệu
 * 4. Thử nghiệm giải mã và phục hồi với mật mã ĐÚNG bằng tools/restore_encrypted_backup.php
 * 5. Xác thực tính toàn vẹn SQLite (PRAGMA integrity_check = ok), checksum SHA-256 khớp tuyệt đối
 * 6. Kiểm tra cấu trúc các bảng cốt lõi (users, songs, user_chord_sets, review_requests, practice_assignments)
 * 7. Tự động dọn dẹp sạch sẽ tài nguyên kiểm thử tạm thời
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;

function check(bool $cond, string $msg): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $passed, $failed;
    if ($cond) {
        echo "  ✅ PASS: {$msg}\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: {$msg}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY: DIỄN TẬP SAO LƯU MÃ HÓA & PHỤC HỒI OFF-SITE (CHECKPOINT G3.9) ===\n\n";

$root = dirname(__DIR__);
$phpBinary = PHP_BINARY ?: 'php';
if (PHP_OS_FAMILY === 'Windows' && file_exists('C:\\xampp\\php\\php.exe')) {
    $phpBinary = 'C:\\xampp\\php\\php.exe';
}

$tempDir = sys_get_temp_dir() . '/sheetapp_backup_drill_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
if (!is_dir($tempDir)) {
    mkdir($tempDir, 0750, true);
}

$backupEncFile = $tempDir . '/test_backup.enc';
$restoreTargetDir = $tempDir . '/restored_data';
$secretPassphrase = 'TestStrongOffsiteSecret_2026_#@!';

try {
    // ── 1. Tạo bản sao lưu mã hóa ──
    echo "[1/4] Tạo bản sao lưu toàn diện được mã hóa OpenSSL AES-256-CBC...\n";
    $createCmd = sprintf(
        '%s %s --passphrase=%s --output=%s 2>&1',
        escapeshellarg($phpBinary),
        escapeshellarg($root . '/tools/create_encrypted_backup.php'),
        escapeshellarg($secretPassphrase),
        escapeshellarg($backupEncFile)
    );

    $createOut = [];
    $createCode = 0;
    exec($createCmd, $createOut, $createCode);
    $createOutStr = implode("\n", $createOut);

    check($createCode === 0, "create_encrypted_backup.php thực thi thành công với exit code 0");
    check(is_file($backupEncFile), "Tệp sao lưu mã hóa {$backupEncFile} đã được tạo");
    check(filesize($backupEncFile) > 1000, "Kích thước tệp sao lưu hợp lệ (> 1000 bytes, thực tế: " . filesize($backupEncFile) . " bytes)");

    $encHeader = file_get_contents($backupEncFile, false, null, 0, 8);
    check($encHeader === 'Salted__', "Tệp sao lưu mang header mã hóa OpenSSL tiêu chuẩn ('Salted__')");

    // ── 2. Thử nghiệm giải mã với mật mã SAI ──
    echo "\n[2/4] Kiểm tra phòng vệ: Thử giải mã với mật mã không hợp lệ...\n";
    $wrongPassphrase = 'IncorrectPassword999!';
    $wrongCmd = sprintf(
        '%s %s --input=%s --passphrase=%s 2>&1',
        escapeshellarg($phpBinary),
        escapeshellarg($root . '/tools/restore_encrypted_backup.php'),
        escapeshellarg($backupEncFile),
        escapeshellarg($wrongPassphrase)
    );

    $wrongOut = [];
    $wrongCode = 0;
    exec($wrongCmd, $wrongOut, $wrongCode);
    $wrongOutStr = implode("\n", $wrongOut);

    check($wrongCode !== 0, "Giải mã với mật mã sai bị từ chối với exit code lỗi (exit {$wrongCode})");
    check(str_contains($wrongOutStr, 'Giải mã thất bại'), "Báo lỗi chính xác 'Giải mã thất bại' mà không làm rò rỉ dữ liệu");

    // ── 3. Diễn tập phục hồi với mật mã ĐÚNG ──
    echo "\n[3/4] Diễn tập phục hồi cơ sở dữ liệu với mật mã hợp lệ...\n";
    $restoreCmd = sprintf(
        '%s %s --input=%s --passphrase=%s --out-dir=%s 2>&1',
        escapeshellarg($phpBinary),
        escapeshellarg($root . '/tools/restore_encrypted_backup.php'),
        escapeshellarg($backupEncFile),
        escapeshellarg($secretPassphrase),
        escapeshellarg($restoreTargetDir)
    );

    $restoreOut = [];
    $restoreCode = 0;
    exec($restoreCmd, $restoreOut, $restoreCode);
    $restoreOutStr = implode("\n", $restoreOut);

    check($restoreCode === 0, "restore_encrypted_backup.php giải mã thành công với exit code 0");
    check(str_contains($restoreOutStr, 'PRAGMA integrity   : ok'), "PRAGMA integrity_check đạt 'ok'");
    check(str_contains($restoreOutStr, 'SHA-256 Checksum   : KHỚP'), "Checksum SHA-256 đối chiếu khớp hoàn toàn với manifest");
    check(is_file($restoreTargetDir . '/app.sqlite'), "Tệp cơ sở dữ liệu app.sqlite đã được phục hồi");
    check(is_file($restoreTargetDir . '/manifest.json'), "Tệp manifest.json đã được giải nén");

    // ── 4. Kiểm chứng tính toàn vẹn dữ liệu chi tiết của SQLite phục hồi ──
    echo "\n[4/4] Kiểm chứng lược đồ và dữ liệu trên bản sao lưu đã phục hồi...\n";
    $pdo = new PDO('sqlite:' . $restoreTargetDir . '/app.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tablesToCheck = [
        'users',
        'songs',
        'user_chord_sets',
        'song_versions',
        'review_requests',
        'chord_set_history',
        'practice_assignments',
        'practice_assignment_targets',
        'notification_preferences',
        'notification_deliveries',
        'domain_events'
    ];

    foreach ($tablesToCheck as $tbl) {
        $count = (int)$pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=" . $pdo->quote($tbl))->fetchColumn();
        check($count === 1, "Bảng '{$tbl}' tồn tại nguyên vẹn trong bản sao lưu đã phục hồi");
    }

    $usersCount = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $songsCount = (int)$pdo->query("SELECT COUNT(*) FROM songs")->fetchColumn();
    check($usersCount >= 3, "Số lượng người dùng hợp lệ trong bản sao lưu: {$usersCount}");
    check($songsCount >= 1, "Số lượng bài hát hợp lệ trong bản sao lưu: {$songsCount}");

} finally {
    // Dọn dẹp an toàn các tệp tạm thời
    if (is_dir($restoreTargetDir)) {
        foreach (glob($restoreTargetDir . '/*.*') ?: [] as $rf) {
            @unlink($rf);
        }
        @rmdir($restoreTargetDir);
    }
    if (is_file($backupEncFile)) {
        @unlink($backupEncFile);
    }
    if (is_dir($tempDir)) {
        @rmdir($tempDir);
    }
}

echo "\n--------------------------------------------------------\n";
echo "Kết quả kiểm thử Diễn tập Sao lưu / Phục hồi: {$passed} checks PASS, {$failed} checks FAIL\n";
echo "--------------------------------------------------------\n";

if ($failed > 0) {
    exit(1);
}

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit(0);
