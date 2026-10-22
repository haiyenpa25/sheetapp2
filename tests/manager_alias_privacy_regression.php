<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
$dir = sys_get_temp_dir() . '/sheetapp_manager_alias_' . bin2hex(random_bytes(8));
putenv('CHORD_SETS_DIR=' . $dir);
$pdo = createTestDatabase();
DB::setPdo($pdo);
$song = '001-thanh-chua-yeu-thuong';
$chords = [['measure' => 1, 'chord' => 'G']];
$total = 0;
$failed = 0;
function aliasCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
function aliasActor(int $id): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => $id === 2 ? 'banhat' : 'admin'] : [];
    Auth::resetDbCache();
}
function aliasAccess(string $song, string $name, array $chords, bool $public): void {
    foreach ([0 => 'guest', 2 => 'owner', 3 => 'other', 1 => 'admin'] as $actor => $role) {
        aliasActor($actor);
        $allowed = $public || $actor === 2;
        aliasCheck(ChordSetService::loadSet($song, $name) === ($allowed ? $chords : []), "{$role}: {$name} chords obey privacy");
        $details = ChordSetService::getSetDetails($song, $name);
        aliasCheck(($details !== null) === $allowed, "{$role}: {$name} metadata obeys privacy");
        $listed = ChordSetService::listSets($song, $actor ?: null);
        aliasCheck(in_array($name, $listed, true) === $allowed, "{$role}: {$name} listing obeys privacy");
    }
}
try {
    aliasActor(2);
    $fork = ManagerService::forkSong(['song_id' => $song, 'set_name' => 'PrivateAudit', 'is_public' => 0]);
    aliasCheck($fork['success'] ?? false, 'Manager creates a private fork');
    $id = (int)($fork['data']['set_id'] ?? 0);
    aliasCheck(ManagerService::saveUserChordSet($id, ['chords' => $chords])['success'] ?? false, 'Owner updates private chords');
    $alias = 'banhat__PrivateAudit';
    $row = $pdo->query("SELECT user_id, username, is_public FROM user_chord_sets WHERE set_name='banhat__PrivateAudit'")->fetch(PDO::FETCH_ASSOC);
    aliasCheck((int)($row['user_id'] ?? 0) === 2 && ($row['username'] ?? '') === 'banhat' && (int)($row['is_public'] ?? 1) === 0, 'Alias retains canonical owner and private flag');
    aliasAccess($song, $alias, $chords, false);
    aliasActor(2);
    ManagerService::saveUserChordSet($id, ['is_public' => 1]);
    aliasAccess($song, $alias, $chords, true);
    aliasActor(2);
    // Simulate the legacy corrupted alias, without touching operational data.
    $pdo->exec("UPDATE user_chord_sets SET user_id=1, username='banhat', is_public=1 WHERE set_name='banhat__PrivateAudit'");
    ManagerService::saveUserChordSet($id, ['is_public' => 0]);
    aliasAccess($song, $alias, $chords, false);
    $owner = $pdo->query("SELECT user_id FROM user_chord_sets WHERE set_name='banhat__PrivateAudit'")->fetchColumn();
    aliasCheck((int)$owner === 2, 'Editing legacy alias repairs its owner in fixture');
    aliasActor(2);
    ManagerService::saveUserChordSet($id, ['is_public' => 1]);
    ManagerService::saveUserChordSet($id, ['set_name' => 'RenamedAudit', 'is_public' => 0]);
    aliasAccess($song, 'banhat__RenamedAudit', $chords, false);
    aliasAccess($song, $alias, $chords, false);
    aliasActor(1);
    ManagerService::saveUserChordSet($id, ['chords' => $chords]);
    aliasAccess($song, 'banhat__RenamedAudit', $chords, false);
    $owner = $pdo->query("SELECT user_id FROM user_chord_sets WHERE set_name='banhat__RenamedAudit'")->fetchColumn();
    aliasCheck((int)$owner === 2, 'Admin edit preserves actual owner');
    aliasCheck(json_decode((string)file_get_contents($dir . '/' . $song . '/banhat__RenamedAudit.json'), true) === $chords, 'Disk export still contains updated chords');
    aliasActor(2);
    ManagerService::saveUserChordSet($id, ['is_public' => 1]);
    $pdo->exec("CREATE TRIGGER reject_alias_update BEFORE UPDATE ON user_chord_sets WHEN OLD.set_name = 'banhat__RenamedAudit' BEGIN SELECT RAISE(ABORT, 'fixture alias failure'); END");
    $thrown = false;
    try { ManagerService::saveUserChordSet($id, ['is_public' => 0]); }
    catch (Throwable $e) { $thrown = true; }
    aliasCheck($thrown, 'Failed alias privacy write is not reported as success');
    $canonicalPublic = $pdo->query('SELECT is_public FROM user_chord_sets WHERE id=' . $id)->fetchColumn();
    aliasCheck((int)$canonicalPublic === 1, 'Failed alias write does not claim canonical row became private');
} finally {
    foreach (glob($dir . '/*/*.json') ?: [] as $file) unlink($file);
    foreach (glob($dir . '/*', GLOB_ONLYDIR) ?: [] as $path) rmdir($path);
    if (is_dir($dir)) rmdir($dir);
    DB::setPdo(null);
    putenv('CHORD_SETS_DIR');
}
echo "SUITE_COMPLETE total={$total}\n";
exit($failed ? 1 : 0);
