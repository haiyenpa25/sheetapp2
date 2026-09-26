<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$dbFile = sys_get_temp_dir() . '/sheetapp-setlist-' . bin2hex(random_bytes(4)) . '.sqlite';
putenv('DB_PATH=' . $dbFile);

require_once $root . '/api/services/SetlistService.php';

$pdo = DB::get();
$pdo->exec('CREATE TABLE setlists (id INTEGER PRIMARY KEY, title TEXT, created_by INTEGER)');
$pdo->exec('CREATE TABLE setlist_items (id INTEGER PRIMARY KEY, setlist_id INTEGER, song_id TEXT, display_order INTEGER)');
$pdo->exec("INSERT INTO setlists (id, title, created_by) VALUES (1, 'Owner list', 10), (2, 'Other list', 20)");
$pdo->exec("INSERT INTO setlist_items (id, setlist_id, song_id, display_order) VALUES (100, 1, 'song-a', 1), (200, 2, 'song-b', 1)");

$failures = [];
function checkOwnership(bool $condition, string $message): void {
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) $failures[] = $message;
}

checkOwnership(SetlistService::isOwner(1, 10), 'Setlist owner is recognized');
checkOwnership(!SetlistService::isOwner(2, 10), 'Another user is not treated as owner');
checkOwnership(SetlistService::isItemOwner(100, 10), 'Owner can modify an item in their setlist');
checkOwnership(!SetlistService::isItemOwner(200, 10), 'User cannot modify an item in another setlist');

$controller = file_get_contents($root . '/api/controllers/SetlistController.php') ?: '';
checkOwnership(substr_count($controller, 'Auth::requireLogin();') >= 4, 'Every setlist write path requires login');
checkOwnership(str_contains($controller, 'Auth::isAdmin()'), 'Admin override is explicit');

@unlink($dbFile);
if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d setlist ownership regression test(s) failed.\n", count($failures)));
    exit(1);
}
echo "\nAll setlist ownership regression tests passed.\n";
