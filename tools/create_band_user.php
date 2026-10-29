<?php
declare(strict_types=1);

/**
 * tools/create_band_user.php — tạo tài khoản thành viên (mặc định vai trò bannhac) bằng CLI.
 *
 * Mật khẩu lấy từ biến môi trường SHEETAPP_USER_PASSWORD (không nhận qua tham số để khỏi lọt vào
 * lịch sử lệnh/log). Mặc định chỉ chạy thử; --apply sao lưu CSDL rồi mới ghi.
 *
 *   SHEETAPP_USER_PASSWORD=... php tools/create_band_user.php --username=bannhac --chord-code=BN
 *   SHEETAPP_USER_PASSWORD=... php tools/create_band_user.php --username=bannhac --chord-code=BN --apply
 *
 * Tuỳ chọn: --role=bannhac --display-name="Ban Nhạc" --instrument="Ban nhạc" --db=<đường dẫn sqlite>
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/services/UserService.php';

const DEFAULT_ROLE = 'bannhac';
const DEFAULT_INSTRUMENT = 'Ban nhạc';

$options = getopt('', ['username:', 'role::', 'display-name::', 'instrument::', 'chord-code::', 'db::', 'apply']);
$username = trim((string)($options['username'] ?? ''));
$password = (string)getenv('SHEETAPP_USER_PASSWORD');
$role = (string)($options['role'] ?? DEFAULT_ROLE);
$displayName = (string)($options['display-name'] ?? $username);
$instrument = (string)($options['instrument'] ?? DEFAULT_INSTRUMENT);
$chordCode = isset($options['chord-code']) ? (string)$options['chord-code'] : null;
$apply = array_key_exists('apply', $options);

try {
    if ($username === '' || $password === '') {
        throw new RuntimeException('Thiếu --username hoặc biến môi trường SHEETAPP_USER_PASSWORD.');
    }
    $target = isset($options['db']) ? (string)$options['db'] : $root . '/storage/data/app.sqlite';
    if (!is_file($target)) throw new RuntimeException("Không thấy CSDL: {$target}");
    DB::setPdo(DB::createConnection($target));

    if (UserService::findByUsername($username)) {
        echo "Tài khoản '{$username}' đã tồn tại — không thay đổi gì.\n";
        exit(0);
    }
    if (UserService::isWeakPassword($password, $username)) throw new RuntimeException('Mật khẩu quá yếu.');
    UserService::assertChordCodeAvailable($chordCode !== null ? strtoupper(trim($chordCode)) : null);

    echo "Sẽ tạo: username={$username} role={$role} chord_code=" . ($chordCode ?? '-') . " display_name={$displayName}\n";
    if (!$apply) {
        echo "Chạy thử (dry-run): chưa ghi gì. Thêm --apply để tạo.\n";
        exit(0);
    }

    $backupDir = $root . '/storage/backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0775, true);
    $backup = $backupDir . '/app.before-user-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.sqlite';
    DB::get()->prepare('VACUUM INTO ?')->execute([$backup]);

    $id = UserService::createWithProfile($username, $password, $role, $displayName, $instrument, $chordCode);
    echo "Đã tạo tài khoản id={$id}. Sao lưu trước khi ghi: {$backup}\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Lỗi: ' . $e->getMessage() . "\n");
    exit(1);
}
