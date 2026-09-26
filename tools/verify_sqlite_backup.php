<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$path = $argv[1] ?? '';
if ($path === '' || !is_file($path)) {
    fwrite(STDERR, "Usage: php tools/verify_sqlite_backup.php <database.sqlite>\n");
    exit(2);
}

$pdo = new PDO('sqlite:' . realpath($path));
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$integrity = (string)$pdo->query('PRAGMA integrity_check')->fetchColumn();
echo 'integrity=' . $integrity . PHP_EOL;
if ($integrity !== 'ok') exit(1);

foreach (['songs', 'users', 'user_chord_sets', 'song_versions'] as $table) {
    $exists = $pdo->query(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = " . $pdo->quote($table)
    )->fetchColumn();
    if ((int)$exists === 0) {
        echo $table . '=missing' . PHP_EOL;
        continue;
    }
    echo $table . '=' . (int)$pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn() . PHP_EOL;
}
