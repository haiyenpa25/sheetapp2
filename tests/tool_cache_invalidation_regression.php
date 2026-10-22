<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/SongService.php';
$dir = sys_get_temp_dir() . '/sheetapp_tool_cache_' . bin2hex(random_bytes(8));
mkdir($dir);
$dbFile = $dir . '/fixture.sqlite';
$pdo = createTestDatabase();
$xml = (glob(dirname(__DIR__) . '/storage/Thanh ca/*.xml') ?: [])[0] ?? '';
$pdo->prepare('UPDATE songs SET xmlPath = ?')->execute([$xml === '' ? '' : 'storage/Thanh ca/' . basename($xml)]);
$pdo->exec('VACUUM INTO ' . $pdo->quote($dbFile));
$pdo = new PDO('sqlite:' . $dbFile);
DB::setPdo($pdo);
$pdo->exec("DELETE FROM songs_fts; INSERT INTO songs_fts(rowid,song_id,title,title_unaccented,theme,liturgical_season) SELECT rowid+100,id,title,title,theme,liturgical_season FROM songs");
$cache = SongService::cachePath();
register_shutdown_function(static function () use ($dir, $cache): void {
    DB::setPdo(null);
    foreach ([$cache, $cache . '.etag', $cache . '.lock'] as $file) if (is_file($file)) @unlink($file);
    foreach (glob($dir . '/*') ?: [] as $file) @unlink($file);
    @rmdir($dir);
});
$total = 0;
$failed = 0;
function toolCacheCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
function runCacheTool(string $tool, string $arguments): void {
    global $dbFile;
    $output = [];
    $code = 0;
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__) . '/tools/' . $tool) . ' --db=' . escapeshellarg($dbFile) . ' ' . $arguments . ' 2>&1', $output, $code);
    toolCacheCheck($code === 0, $tool . ' succeeds on fixture DB');
}
SongService::writePublicCache();
runCacheTool('manage_tempos.php', '--set=001-thanh-chua-yeu-thuong --bpm=92');
toolCacheCheck((int)$pdo->query("SELECT tempo FROM songs WHERE id='001-thanh-chua-yeu-thuong'")->fetchColumn() === 92, 'Tempo CLI updates fixture row');
toolCacheCheck(!is_file($cache) && !is_file($cache . '.etag'), 'Tempo CLI invalidates fixture cache and ETag');

SongService::writePublicCache();
runCacheTool('index_lyrics.php', '--force');
toolCacheCheck((int)$pdo->query("SELECT COUNT(*) FROM songs WHERE lyrics_text IS NOT NULL AND lyrics_text != ''")->fetchColumn() > 0, 'Lyrics CLI indexes managed XML into fixture DB');
toolCacheCheck(!is_file($cache) && !is_file($cache . '.etag'), 'Lyrics CLI invalidates fixture cache and ETag');

$pdo->exec("UPDATE songs SET title = 'Fixture   ?' WHERE id='001-thanh-chua-yeu-thuong'");
SongService::writePublicCache();
runCacheTool('check_song_spelling.php', '--fix');
toolCacheCheck($pdo->query("SELECT title FROM songs WHERE id='001-thanh-chua-yeu-thuong'")->fetchColumn() === 'Fixture?', 'Spelling CLI updates fixture title');
toolCacheCheck(!is_file($cache) && !is_file($cache . '.etag'), 'Spelling CLI invalidates fixture cache and ETag');
toolCacheCheck($pdo->query("SELECT title FROM songs_fts WHERE song_id='001-thanh-chua-yeu-thuong'")->fetchColumn() === 'Fixture?', 'Spelling FTS update uses song_id when rowid differs');
runCacheTool('manage_song_labels.php', '--song=001-thanh-chua-yeu-thuong --season=FixtureSeason --theme=FixtureTheme');
toolCacheCheck($pdo->query("SELECT theme FROM songs_fts WHERE song_id='001-thanh-chua-yeu-thuong'")->fetchColumn() === 'FixtureTheme', 'Labels FTS update uses song_id when rowid differs');
toolCacheCheck($pdo->query("SELECT liturgical_season FROM songs_fts WHERE song_id='001-thanh-chua-yeu-thuong'")->fetchColumn() === 'FixtureSeason', 'FTS season also matches the correct song');
echo "SUITE_COMPLETE total={$total}\n";
$pdo = null;
exit($failed > 0 ? 1 : 0);
