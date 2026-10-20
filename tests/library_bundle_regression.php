<?php
declare(strict_types=1);

$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/library_storage_guard.php';
$total = 0;
function bundleCheck(bool $ok, string $label): void {
    global $total;
    ++$total;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
    if (!$ok) throw new RuntimeException($label);
}
function bundleInstall(array $args, string $input = ''): int {
    global $root;
    $process = proc_open(array_merge([PHP_BINARY, $root . '/tools/install_library.php'], $args),
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fwrite($pipes[0], $input);
    fclose($pipes[0]);
    stream_get_contents($pipes[1]); fclose($pipes[1]);
    stream_get_contents($pipes[2]); fclose($pipes[2]);
    return proc_close($process);
}
$dir = sys_get_temp_dir() . '/sheetapp-bundle-' . bin2hex(random_bytes(6));
mkdir($dir);
try {
    bundleCheck(is_file($root . '/storage/seed/library.sqlite'), 'release contains a SQLite library');
    bundleCheck(libraryChordFilesIntact($root), 'every published chord JSON matches its manifest and parses');
    mkdir($dir . '/storage/seed', 0750, true);
    $sample = $dir . '/snapshot.json';
    $sampleManifest = $dir . '/storage/seed/library.manifest.json';
    try {
        file_put_contents($sample, '[]');
        file_put_contents($sampleManifest, json_encode(['chord_files' => ['snapshot.json' => hash_file('sha256', $sample)]]));
        bundleCheck(libraryChordFilesIntact($dir), 'storage guard accepts a complete matching snapshot');
        file_put_contents($sample, '[1]');
        bundleCheck(!libraryChordFilesIntact($dir), 'storage guard detects changed chord content');
        unlink($sample);
        bundleCheck(!libraryChordFilesIntact($dir), 'storage guard detects a missing chord file');
    } finally {
        if (is_file($sample)) unlink($sample);
        unlink($sampleManifest); rmdir($dir . '/storage/seed'); rmdir($dir . '/storage');
    }
    $seed = new PDO('sqlite:' . $root . '/storage/seed/library.sqlite');
    bundleCheck($seed->query('PRAGMA integrity_check')->fetchColumn() === 'ok', 'seed is structurally valid');
    bundleCheck(!$seed->query('PRAGMA foreign_key_check')->fetch(), 'seed has no broken foreign keys');
    bundleCheck((int)$seed->query('SELECT COUNT(*) FROM songs')->fetchColumn() > 903, 'all collections extend beyond the original hymnbook');
    bundleCheck((int)$seed->query("SELECT COUNT(*) FROM songs JOIN categories ON categories.id=songs.category_id WHERE categories.slug='biet-thanh-ca'")->fetchColumn() > 0, 'special hymns include songs');
    foreach ($seed->query('SELECT xmlPath FROM songs') as $row) {
        if (!is_file($root . '/' . $row['xmlPath'])) throw new RuntimeException('Missing score: ' . $row['xmlPath']);
    }
    bundleCheck(true, 'every song resolves to a bundled score');
    bundleCheck((int)$seed->query("SELECT COUNT(*) FROM users WHERE status='active' OR password_hash!='!' OR email IS NOT NULL OR username NOT LIKE 'contributor-%'")->fetchColumn() === 0, 'source accounts are anonymized and cannot log in');
    foreach (['practice_sessions', 'practice_measure_stats', 'domain_events', 'notifications', 'notification_deliveries', 'notification_preferences', 'omr_workspace', 'learning_arrangements', 'chord_set_history'] as $table) {
        bundleCheck((int)$seed->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() === 0, $table . ' contains no personal history');
    }
    $db = $dir . '/app.sqlite';
    $password = bin2hex(random_bytes(18));
    bundleCheck(bundleInstall(['--db=' . $db, '--password-stdin'], $password . "\n") === 0, 'fresh installation succeeds with password on stdin');
    $pdo = new PDO('sqlite:' . $db);
    $admin = $pdo->query("SELECT * FROM users WHERE username='admin'")->fetch(PDO::FETCH_ASSOC);
    bundleCheck($admin && $admin['role'] === 'admin' && $admin['status'] === 'active' && password_verify($password, $admin['password_hash']), 'installed admin authenticates using the chosen password');
    bundleCheck($pdo->query('SELECT COUNT(*) FROM songs')->fetchColumn() === $seed->query('SELECT COUNT(*) FROM songs')->fetchColumn(), 'installation preserves the entire catalog');
    $pdo = null;
    $hash = hash_file('sha256', $db);
    bundleCheck(bundleInstall(['--db=' . $db, '--password-stdin'], $password . "\n") !== 0 && hash_file('sha256', $db) === $hash, 'repeat installation refuses to overwrite existing data');
    bundleCheck(bundleInstall(['--db=' . $dir . '/weak.sqlite', '--password-stdin'], "short\n") !== 0 && !file_exists($dir . '/weak.sqlite'), 'invalid password leaves no partial database');
    bundleCheck(bundleInstall(['--db=' . $dir . '/bad.sqlite', '--admin=bad/name', '--password-stdin'], $password . "\n") !== 0 && !file_exists($dir . '/bad.sqlite'), 'invalid admin name leaves no partial database');
    $pdo = new PDO('sqlite:' . $db);
    $pdo->exec('DELETE FROM songs WHERE category_id!=1');
    $pdo->exec('DELETE FROM user_chord_sets WHERE song_id NOT IN (SELECT id FROM songs)');
    $pdo->exec('DELETE FROM song_sections WHERE song_id NOT IN (SELECT id FROM songs)');
    $pdo->exec('DELETE FROM categories WHERE id!=1');
    $pdo->exec("UPDATE songs SET title='Locally edited title' WHERE id='thanh-ca-001'");
    $pdo->exec("INSERT INTO setlists (title,created_by) SELECT 'Existing program',id FROM users WHERE username='admin'");
    $beforeChords = $pdo->query("SELECT chords_json FROM user_chord_sets WHERE song_id='thanh-ca-001' AND set_name='HD'")->fetchColumn();
    $pdo = null;
    $update = static function () use ($root, $db): int {
        $process = proc_open([PHP_BINARY, $root . '/tools/update_library.php', '--apply', '--db=' . $db],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        fclose($pipes[0]); stream_get_contents($pipes[1]); fclose($pipes[1]);
        stream_get_contents($pipes[2]); fclose($pipes[2]);
        return proc_close($process);
    };
    bundleCheck($update() === 0, 'existing installation receives missing collections');
    $pdo = new PDO('sqlite:' . $db);
    bundleCheck($pdo->query('SELECT COUNT(*) FROM songs')->fetchColumn() === $seed->query('SELECT COUNT(*) FROM songs')->fetchColumn(), 'update restores full catalog');
    bundleCheck($pdo->query("SELECT title FROM songs WHERE id='thanh-ca-001'")->fetchColumn() === 'Locally edited title', 'update preserves edited song titles');
    bundleCheck($pdo->query("SELECT chords_json FROM user_chord_sets WHERE song_id='thanh-ca-001' AND set_name='HD'")->fetchColumn() === $beforeChords, 'update preserves existing chord arrangements');
    bundleCheck((int)$pdo->query("SELECT COUNT(*) FROM setlists WHERE title='Existing program'")->fetchColumn() === 1, 'update preserves programs');
    bundleCheck(password_verify($password, $pdo->query("SELECT password_hash FROM users WHERE username='admin'")->fetchColumn()), 'update preserves current admin credentials');
    bundleCheck(!$pdo->query('PRAGMA foreign_key_check')->fetch(), 'updated database retains valid foreign keys');
    bundleCheck(count(glob($db . '.before-library-*.sqlite') ?: []) === 1, 'update creates a database backup');
    $chordCount = $pdo->query('SELECT COUNT(*) FROM user_chord_sets')->fetchColumn();
    $userCount = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $pdo = null;
    bundleCheck($update() === 0, 'library update can be repeated');
    $pdo = new PDO('sqlite:' . $db);
    bundleCheck($pdo->query('SELECT COUNT(*) FROM user_chord_sets')->fetchColumn() === $chordCount, 'repeat update does not duplicate chord sets');
    bundleCheck($pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === $userCount, 'repeat update does not duplicate anonymous owners');
    $pdo = null;
    $seed = null;
    echo "SUITE_COMPLETE total={$total}\n";
} finally {
    foreach (glob($dir . '/*') ?: [] as $file) unlink($file);
    rmdir($dir);
}
