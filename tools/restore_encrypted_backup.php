<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

/**
 * tools/restore_encrypted_backup.php
 * 
 * Giải mã, giải nén và kiểm chứng bản sao lưu SheetApp2.
 * Hỗ trợ các gói mã hóa OpenSSL AES-256-CBC PBKDF2 hoặc các gói ZIP/GZ chưa mã hóa.
 * 
 * Cách dùng:
 *   php tools/restore_encrypted_backup.php --input=path/to/backup.enc [--passphrase="..."] [--out-dir=path/to/target] [--verify-only]
 */

$options = getopt('', ['input:', 'passphrase:', 'out-dir:', 'verify-only']);
$inputPath = $options['input'] ?? ($argv[1] ?? '');
$passphrase = $options['passphrase'] ?? '';
$outDir = $options['out-dir'] ?? '';
$verifyOnly = isset($options['verify-only']);

if (empty($inputPath) || !is_file($inputPath)) {
    fwrite(STDERR, "Lỗi: Không tìm thấy tệp sao lưu tại: {$inputPath}\n");
    fwrite(STDERR, "Cú pháp: php tools/restore_encrypted_backup.php --input=path/to/backup.enc [--passphrase=\"...\"] [--out-dir=path] [--verify-only]\n");
    exit(1);
}

// Nếu không chỉ định out-dir, tạo thư mục tạm
$isTempDir = false;
if (empty($outDir)) {
    $outDir = sys_get_temp_dir() . '/sheetapp_restore_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));
    $isTempDir = true;
}

if (!is_dir($outDir)) {
    mkdir($outDir, 0750, true);
}

$raw = file_get_contents($inputPath);
if ($raw === false || strlen($raw) < 16) {
    fwrite(STDERR, "Lỗi: Tệp sao lưu rỗng hoặc bị hỏng.\n");
    exit(1);
}

$payload = $raw;

// 1. Kiểm tra định dạng mã hóa OpenSSL ("Salted__" header)
if (str_starts_with($raw, 'Salted__')) {
    if (empty($passphrase)) {
        fwrite(STDERR, "Lỗi: Tệp sao lưu đã được mã hóa bằng mật mã. Vui lòng cung cấp --passphrase=\"...\"\n");
        exit(1);
    }

    $salt = substr($raw, 8, 8);
    $ciphertext = substr($raw, 16);

    $keyIv = openssl_pbkdf2($passphrase, $salt, 48, 100000, 'sha256');
    $key = substr($keyIv, 0, 32);
    $iv  = substr($keyIv, 32, 16);

    $decrypted = openssl_decrypt($ciphertext, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    if ($decrypted === false || (!str_starts_with($decrypted, "PK\x03\x04") && !str_starts_with($decrypted, "PK\x05\x06") && !str_starts_with($decrypted, "\x1f\x8b"))) {
        fwrite(STDERR, "Lỗi: Giải mã thất bại. Mật mã sai hoặc dữ liệu bị biến đổi.\n");
        exit(1);
    }
    $payload = $decrypted;
}

// 2. Giải nén gói lưu trữ (ZIP hoặc GZ fallback)
$sqlitePath = $outDir . '/app.sqlite';
$manifestPath = $outDir . '/manifest.json';
$unpacked = false;

if (str_starts_with($payload, "PK\x03\x04") || str_starts_with($payload, "PK\x05\x06")) {
    $tempZip = $outDir . '/_temp_package.zip';
    file_put_contents($tempZip, $payload);
    
    if (class_exists('ZipArchive')) {
        $zip = new ZipArchive();
        if ($zip->open($tempZip) === true) {
            $zip->extractTo($outDir);
            $zip->close();
            $unpacked = true;
        }
    }
    @unlink($tempZip);
}

if (!$unpacked && (str_starts_with($payload, "\x1f\x8b"))) {
    $decompressed = @gzdecode($payload);
    if ($decompressed !== false) {
        $package = json_decode($decompressed, true);
        if (is_array($package) && isset($package['database'])) {
            file_put_contents($sqlitePath, base64_decode((string)$package['database']));
            if (isset($package['manifest'])) {
                file_put_contents($manifestPath, json_encode($package['manifest'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
            $unpacked = true;
        }
    }
}

if (!$unpacked) {
    fwrite(STDERR, "Lỗi: Không nhận diện được định dạng nén của gói sao lưu (hỗ trợ ZIP hoặc GZ package).\n");
    exit(1);
}

if (!is_file($sqlitePath)) {
    fwrite(STDERR, "Lỗi: Gói sao lưu không chứa file app.sqlite.\n");
    exit(1);
}

// 3. Kiểm tra tính toàn vẹn và SHA-256 checksum
$manifest = [];
if (is_file($manifestPath)) {
    $manifest = json_decode((string)file_get_contents($manifestPath), true) ?: [];
}

$actualSha256 = hash_file('sha256', $sqlitePath);
$expectedSha256 = $manifest['db_sha256'] ?? null;
$checksumMatch = ($expectedSha256 === null) || ($actualSha256 === $expectedSha256);

if (!$checksumMatch) {
    fwrite(STDERR, "CẢNH BÁO: Checksum SHA-256 không khớp!\n  Kỳ vọng: {$expectedSha256}\n  Thực tế : {$actualSha256}\n");
}

try {
    $pdo = new PDO('sqlite:' . $sqlitePath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $integrity = (string)$pdo->query('PRAGMA integrity_check')->fetchColumn();
    $songsCount = (int)$pdo->query('SELECT COUNT(*) FROM songs')->fetchColumn();
    $usersCount = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
} catch (Throwable $e) {
    fwrite(STDERR, "Lỗi kiểm tra cơ sở dữ liệu SQLite: " . $e->getMessage() . "\n");
    exit(1);
}

echo "========================================================\n";
echo "       SheetApp2 — RESTORE & VERIFICATION REPORT        \n";
echo "========================================================\n";
echo "Trạng thái giải mã : THÀNH CÔNG\n";
echo "Thư mục đích       : {$outDir}\n";
echo "PRAGMA integrity   : {$integrity}\n";
echo "SHA-256 Checksum   : " . ($checksumMatch ? "KHỚP ({$actualSha256})" : "KHÔNG KHỚP!") . "\n";
echo "Số bài hát (songs) : {$songsCount}\n";
echo "Số người dùng      : {$usersCount}\n";
echo "========================================================\n";

if ($verifyOnly || $isTempDir) {
    // Dọn dẹp thư mục tạm sau khi kiểm chứng
    @unlink($sqlitePath);
    @unlink($manifestPath);
    @rmdir($outDir);
    echo "Đã dọn dẹp thư mục tạm kiểm chứng an toàn.\n";
}

if ($integrity === 'ok' && $checksumMatch) {
    echo "KẾT LUẬN: BẢN SAO LƯU HỢP LỆ VÀ SẴN SÀNG PHỤC HỒI (SUCCESS)\n";
    exit(0);
} else {
    echo "KẾT LUẬN: BẢN SAO LƯU CÓ VẤN ĐỀ VỀ TÍNH TOÀN VẸN (FAIL)\n";
    exit(1);
}
