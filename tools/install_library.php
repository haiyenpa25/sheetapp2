<?php
declare(strict_types=1);

// Explicit first-install command. Never invoked by the web app or a git pull.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once dirname(__DIR__) . '/api/services/UserService.php';
$options = getopt('', ['db:', 'admin:', 'password-stdin']);
$root = dirname(__DIR__);
$target = $options['db'] ?? $root . '/storage/data/app.sqlite';
$username = $options['admin'] ?? 'admin';
$seed = $root . '/storage/seed/library.sqlite';
$created = false;
$pdo = null;
try {
    if (file_exists($target)) throw new RuntimeException('Database already exists; refusing to overwrite it.');
    if (!preg_match('/^[a-zA-Z0-9_-]{3,50}$/D', $username)) throw new RuntimeException('Invalid admin username.');
    $fromStdin = array_key_exists('password-stdin', $options);
    $password = $fromStdin ? rtrim(stream_get_contents(STDIN), "\r\n") : bin2hex(random_bytes(18));
    if (strlen($password) < 10 || UserService::isWeakPassword($password, $username)) {
        throw new RuntimeException('Password must have at least 10 characters and satisfy the existing password policy.');
    }
    $manifest = json_decode((string)file_get_contents($root . '/storage/seed/library.manifest.json'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_file($seed) || !hash_equals($manifest['database_sha256'], hash_file('sha256', $seed))) {
        throw new RuntimeException('Library seed checksum mismatch.');
    }
    if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0750, true)) throw new RuntimeException('Cannot create database directory.');
    // Exclusive creation also protects against concurrent installers overwriting a DB.
    $handle = @fopen($target, 'x+b');
    if (!$handle) throw new RuntimeException('Cannot exclusively create database.');
    $created = true;
    try {
        $source = fopen($seed, 'rb');
        try {
            if (stream_copy_to_stream($source, $handle) !== filesize($seed)) throw new RuntimeException('Incomplete database copy.');
        } finally { fclose($source); }
    } finally { fclose($handle); }
    $pdo = new PDO('sqlite:' . $target, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    if ($pdo->query('PRAGMA integrity_check')->fetchColumn() !== 'ok' || $pdo->query('PRAGMA foreign_key_check')->fetch()) {
        throw new RuntimeException('Library seed integrity check failed.');
    }
    $stmt = $pdo->prepare('INSERT INTO users (username,password_hash,role,display_name,status,chord_code) VALUES (?,?,?,?,?,?)');
    $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), 'admin', 'Administrator', 'active', 'ADMIN']);
    $pdo = null;
    @chmod($target, 0640);
    echo "Library installed. Admin: {$username}\n";
    if (!$fromStdin) echo "Generated password (save now): {$password}\n";
    echo "Existing server data is never replaced by this command.\n";
} catch (Throwable $error) {
    $pdo = null;
    if ($created) @unlink($target);
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
