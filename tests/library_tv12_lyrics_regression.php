<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';
$pdo = createTestDatabase(); DB::setPdo($pdo);
$migration = require __DIR__ . '/../api/migrations/006_fts5_search_and_taxonomy.php'; $migration($pdo);
$pdo->exec('DELETE FROM songs; DELETE FROM songs_fts');
$insert = $pdo->prepare("INSERT INTO songs(id,title,httlvnId,xmlPath,lyrics_text,composer) VALUES(?,?,?,'fixture.xml',?,?)");
foreach ([['title-only', 'Yêu thương thế gian', 1, 'Bình an', ''], ['lyric', 'Vì Chúa', 259, 'Chúa yêu thương thế gian', ''], ['composer', 'Chúa', 3, 'Bình an', 'yêu thương thế gian']] as $song) {
    $insert->execute($song); SongSearchHelper::syncSongFts($song[0]);
}
$checks = 0; $failed = 0;
function checkLyrics(bool $ok, string $label): void {
    global $checks, $failed; $checks++; if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
$page = SongSearchHelper::searchPage('yeu thuong the gian', ['mode' => 'lyric']);
checkLyrics($page['total'] === 1 && array_column($page['data'], 'id') === ['lyric'], 'Lyric mode excludes title-only and composer-only matches');
checkLyrics(($page['data'][0]['match_type'] ?? '') === 'lyric', 'Lyric mode labels matches as lyric');
$page = SongSearchHelper::searchPage('259', ['mode' => 'lyric']);
checkLyrics($page['total'] === 0, 'Lyric mode does not insert an exact catalog-number result');
$insert->execute(['loose', 'Other', 4, str_repeat('yêu foo thương foo thế foo gian ', 20), '']);
SongSearchHelper::syncSongFts('loose');
$page = SongSearchHelper::searchPage('yeu thuong the gian', ['mode' => 'lyric']);
checkLyrics(($page['data'][0]['id'] ?? '') === 'lyric', 'A continuous lyric phrase ranks before scattered tokens');
$pdo->exec("DELETE FROM songs WHERE id='loose'");
$pdo->exec('DROP TABLE songs_fts');
$page = SongSearchHelper::searchPage('yêu thương thế gian', ['mode' => 'lyric']);
checkLyrics($page['total'] === 1 && array_column($page['data'], 'id') === ['lyric'], 'Fallback also searches lyrics only');
echo "SUITE_COMPLETE total={$checks}\n"; exit($failed ? 1 : 0);
