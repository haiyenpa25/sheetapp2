<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('SHEETAPP_E2E') !== '1') {
    http_response_code(403);
    exit("Chỉ chạy qua CLI với SHEETAPP_E2E=1\n");
}

$username = $argv[1] ?? 'banhat';
$role = $argv[2] ?? null;

$sid = bin2hex(random_bytes(16));
session_id($sid);
session_start();

require_once __DIR__ . '/../api/core/DB.php';
try {
    $db = DB::get();
    $stmt = $db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($u) {
        $_SESSION['user_id'] = (int)$u['id'];
        $_SESSION['username'] = $u['username'];
        $_SESSION['role'] = $role ?? $u['role'];
        $_SESSION['display_name'] = $u['display_name'] ?? $u['username'];
        $_SESSION['instrument'] = $u['instrument'] ?? 'Guitar';
        $_SESSION['chord_code'] = $u['chord_code'] ?? '';
    } else {
        $_SESSION['user_id'] = 1;
        $_SESSION['username'] = $username;
        $_SESSION['role'] = $role ?? 'banhat';
        $_SESSION['display_name'] = 'Ca Trưởng Ban Hát';
        $_SESSION['instrument'] = 'Guitar';
        $_SESSION['chord_code'] = 'BH';
    }
} catch (Throwable $e) {
    $_SESSION['user_id'] = 1;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $role ?? 'banhat';
    $_SESSION['display_name'] = 'Ca Trưởng Ban Hát';
    $_SESSION['instrument'] = 'Guitar';
    $_SESSION['chord_code'] = 'BH';
}

session_write_close();

echo $sid;
