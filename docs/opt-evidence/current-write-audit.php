<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = dirname(__DIR__, 2);
require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/services/ChordSetService.php';
require_once $root . '/api/services/ManagerService.php';
$dir = sys_get_temp_dir() . '/sheetapp_write_audit_' . bin2hex(random_bytes(8));
putenv('CHORD_SETS_DIR=' . $dir);
$song = '001-thanh-chua-yeu-thuong';
$before = [['measure' => 1, 'chord' => 'C']];
$after = [['measure' => 1, 'chord' => 'G']];
$results = [];
try {
    $pdo = createTestDatabase();
    DB::setPdo($pdo);
    $pdo->exec("CREATE TRIGGER reject_set_insert BEFORE INSERT ON user_chord_sets BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END");
    $ok = ChordSetService::saveSet($song, 'Personal', $after, 2, 'banhat');
    $results['database_insert_failure'] = [
        'returned_success' => $ok,
        'database_rows' => (int)$pdo->query('SELECT COUNT(*) FROM user_chord_sets')->fetchColumn(),
        'disk_contains_new_data' => json_decode((string)file_get_contents($dir . '/' . $song . '/Personal.json'), true) === $after,
    ];

    $pdo = createTestDatabase();
    DB::setPdo($pdo);
    ChordSetService::saveSet($song, 'HD', $before, 2, 'banhat');
    $pdo->beginTransaction();
    $ok = ChordSetService::writeHd($song, $after, 2, 'banhat', 'isolated audit');
    $pdo->rollBack();
    $results['outer_transaction_rollback'] = [
        'write_returned_success' => $ok,
        'database_has_original' => json_decode((string)$pdo->query("SELECT chords_json FROM user_chord_sets WHERE set_name='HD'")->fetchColumn(), true) === $before,
        'disk_has_uncommitted_data' => json_decode((string)file_get_contents($dir . '/' . $song . '/HD.json'), true) === $after,
        'history_rows_after_rollback' => (int)$pdo->query('SELECT COUNT(*) FROM chord_set_history')->fetchColumn(),
    ];

    $result = ChordSetService::forkSet($song, 'HD', 'AuditFork', 2, 'banhat');
    $results['one_fork'] = [
        'returned_success' => $result['success'],
        'created_database_set_names' => $pdo->query("SELECT set_name FROM user_chord_sets WHERE set_name <> 'HD' ORDER BY set_name")->fetchAll(PDO::FETCH_COLUMN),
    ];
    $pdo = createTestDatabase();
    DB::setPdo($pdo);
    $_SESSION = ['user_id' => 2, 'username' => 'banhat'];
    Auth::resetDbCache();
    $pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public, chords_json) VALUES (?, 2, 'banhat', 'PrivateAudit', 0, ?)")->execute([$song, json_encode($before)]);
    $id = (int)$pdo->lastInsertId();
    $saved = ManagerService::saveUserChordSet($id, ['chords' => $after, 'is_public' => 0]);
    $_SESSION = [];
    Auth::resetDbCache();
    $results['private_manager_update'] = [
        'returned_success' => $saved['success'],
        'rows' => $pdo->query('SELECT set_name, user_id, is_public FROM user_chord_sets ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
        'guest_can_load_original' => ChordSetService::loadSet($song, 'PrivateAudit') !== [],
        'guest_can_load_alias' => ChordSetService::loadSet($song, 'banhat__PrivateAudit') === $after,
    ];
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
} finally {
    DB::setPdo(null);
    foreach (glob($dir . '/*/*.json') ?: [] as $file) unlink($file);
    foreach (glob($dir . '/*', GLOB_ONLYDIR) ?: [] as $path) rmdir($path);
    if (is_dir($dir)) rmdir($dir);
    putenv('CHORD_SETS_DIR');
}
