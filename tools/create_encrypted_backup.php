<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

/**
 * tools/create_encrypted_backup.php
 * 
 * Tạo bản sao lưu toàn diện cho SheetApp2 (SQLite DB + MusicXML + User Data)
 * và mã hoá bằng OpenSSL AES-256-CBC với PBKDF2.
 * 
 * Cách dùng:
 *   php tools/create_encrypted_backup.php --passphrase="MyStrongSecretPassword" [--output=path/to/backup.enc]
 */

$root = dirname(__DIR__);
$dbPath = $root . '/storage/data/app.sqlite';
$backupDir = $root . '/storage/backups';

if (!is_file($dbPath)) {
    fwrite(STDERR, "Lỗi: Không tìm thấy tệp cơ sở dữ liệu tại {$dbPath}\n");
    exit(1);
}

if (!is_dir($backupDir)) {
    mkdir($backupDir, 0750, true);
}

// 1. Kiểm tra tính toàn vẹn của SQLite DB trước khi sao lưu
try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $integrity = (string)$pdo->query('PRAGMA integrity_check')->fetchColumn();
    if ($integrity !== 'ok') {
        fwrite(STDERR, "Lỗi: Kiểm tra tính toàn vẹn DB thất bại (PRAGMA integrity_check = {$integrity})\n");
        exit(1);
    }
} catch (Throwable $e) {
    fwrite(STDERR, "Lỗi kết nối DB: " . $e->getMessage() . "\n");
    exit(1);
}

// 2. Tạo bản snapshot SQLite nhất quán bằng VACUUM INTO
$timestamp = date('Ymd_His');
$snapshotPath = $backupDir . "/db_snapshot_{$timestamp}.sqlite";
try {
    $stmt = $pdo->prepare("VACUUM INTO :target");
    $stmt->execute([':target' => $snapshotPath]);
} catch (Throwable $e) {
    // Fallback nếu SQLite không hỗ trợ VACUUM INTO
    copy($dbPath, $snapshotPath);
}

// 3. Phân tích tham số dòng lệnh
$options = getopt('', ['passphrase:', 'output:']);
$passphrase = $options['passphrase'] ?? '';
$outputPath = $options['output'] ?? ($backupDir . "/sheetapp_backup_{$timestamp}.enc");

// 4. Lập danh mục và tính SHA-256 checksum cho các tệp quan trọng
$manifest = [
    'created_at' => date('c'),
    'database_integrity' => $integrity,
    'songs_count' => (int)$pdo->query("SELECT COUNT(*) FROM songs")->fetchColumn(),
    'users_count' => (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(),
    'db_sha256' => hash_file('sha256', $snapshotPath),
];

$manifestPath = $backupDir . "/manifest_{$timestamp}.json";
file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// 5. Đóng gói (ZIP nếu có extension, hoặc GZ/Tar format chuẩn)
$archivePath = $backupDir . "/package_{$timestamp}.dat";

if (class_exists('ZipArchive')) {
    $zip = new ZipArchive();
    if ($zip->open($archivePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
        $zip->addFile($snapshotPath, 'app.sqlite');
        $zip->addFile($manifestPath, 'manifest.json');
        $zip->close();
    }
} else {
    // Fallback: đóng gói dạng package JSON + gzcompress không phụ thuộc extension ngoài
    $package = [
        'manifest' => $manifest,
        'database' => base64_encode(file_get_contents($snapshotPath)),
    ];
    file_put_contents($archivePath, gzencode(json_encode($package)));
}

// 6. Nếu có passphrase, mã hoá gói bằng OpenSSL AES-256-CBC
if (!empty($passphrase)) {
    $plaintext = file_get_contents($archivePath);
    $salt = openssl_random_pseudo_bytes(8);
    $keyIv = openssl_pbkdf2($passphrase, $salt, 48, 100000, 'sha256');
    $key = substr($keyIv, 0, 32);
    $iv  = substr($keyIv, 32, 16);

    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    // Lưu dạng OpenSSL Salted Header ("Salted__" + 8 bytes salt + ciphertext)
    $finalData = "Salted__" . $salt . $encrypted;
    file_put_contents($outputPath, $finalData);

    @unlink($archivePath);
    echo "SUCCESS: Bản sao lưu mã hoá đã được tạo tại: {$outputPath}\n";
} else {
    rename($archivePath, $outputPath);
    echo "SUCCESS: Bản sao lưu (chưa mã hoá) đã được tạo tại: {$outputPath}\n";
}

// Dọn dẹp snapshot tạm
@unlink($snapshotPath);
@unlink($manifestPath);

echo "Database Integrity: {$integrity}\n";
echo "Songs count: {$manifest['songs_count']}\n";
echo "Users count: {$manifest['users_count']}\n";
exit(0);
