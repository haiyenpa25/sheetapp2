<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';
$pdo = createTestDatabase();
DB::setPdo($pdo);
$migration = require __DIR__ . '/../api/migrations/006_fts5_search_and_taxonomy.php';
$migration($pdo);
$pdo->exec('DELETE FROM songs; DELETE FROM songs_fts');
$insert = $pdo->prepare("INSERT INTO songs(id,title,httlvnId,category_id,theme,lyrics_text,xmlPath) VALUES(?,?,?,?,?,?,'fixture.xml')");
for ($i = 1; $i <= 343; $i++) {
    $insert->execute(['page-' . $i, 'Ân điển ' . $i, $i, 1, 'doi-tin-do', 'Chúa yêu thương thế gian']);
    SongSearchHelper::syncSongFts('page-' . $i);
}
$insert->execute(['other', 'Ân điển ngoài tập', 1, 2, 'doi-tin-do', 'Chúa yêu thương thế gian']);
SongSearchHelper::syncSongFts('other');
$insert->execute(['private', 'Ân điển riêng', 1, 1, 'doi-tin-do', 'Chúa yêu thương thế gian']);
$pdo->exec("UPDATE songs SET visibility='private',is_public=0 WHERE id='private'");
SongSearchHelper::syncSongFts('private');
$checks = 0; $failed = 0;
function checkPage(bool $ok, string $label): void {
    global $checks, $failed;
    $checks++; if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function pageProbe(string $q, array $filters): array {
    if (method_exists('SongSearchHelper', 'searchPage')) return SongSearchHelper::searchPage($q, $filters);
    $data = SongSearchHelper::search($q, $filters);
    return ['data' => $data, 'total' => count($data)];
}
foreach (['', 'an', '1'] as $query) {
    $filters = ['category_id' => 1, 'theme' => 'doi-tin-do', 'limit' => 200];
    $first = pageProbe($query, $filters);
    $second = pageProbe($query, $filters + ['offset' => 200]);
    $ids = array_column(array_merge($first['data'], $second['data']), 'id');
    $expected = $query === '1' ? null : 343;
    if ($query === '1') checkPage($first['data'][0]['id'] === 'page-1', 'Exact catalog number is the first result');
    if ($expected !== null) {
        checkPage($first['total'] === $expected && $second['total'] === $expected, "Query '$query': total covers all filtered rows");
        checkPage(count($second['data']) === 143, "Query '$query': second page has 143 rows");
    }
    checkPage(count($ids) === count(array_unique($ids)), "Query '$query': pages do not overlap");
    checkPage(!in_array('other', $ids, true), "Query '$query': category is filtered before paging");
}
$page = pageProbe('', ['limit' => 9999]);
checkPage(count($page['data']) === 200, 'Page limit is capped at 200');
$page = pageProbe('an', ['offset' => 10000, 'category_id' => 1]);
checkPage($page['data'] === [] && $page['total'] === 343, 'Offset beyond end retains the real total');
$page = pageProbe('', ['offset' => -5, 'limit' => 1, 'category_id' => 1]);
checkPage(count($page['data']) === 1 && $page['data'][0]['id'] === 'page-1', 'Negative offset is clamped to zero');
require_once __DIR__ . '/../api/controllers/SongController.php';
$_GET = ['action' => 'search', 'q' => 'an', 'category_id' => '1', 'theme' => 'doi-tin-do', 'offset' => '200', 'limit' => '200'];
ob_start();
(new SongController())->handleRequest('GET');
$response = json_decode(ob_get_clean(), true);
checkPage(($response['total'] ?? null) === 343 && count($response['data'] ?? []) === 143, 'Controller exposes filtered total and the requested page');
$pdo->exec("UPDATE songs SET defaultKey='G'; UPDATE songs SET defaultKey='F' WHERE id IN ('page-1','page-2')");
$page = pageProbe('an', ['category_id' => 1, 'key' => 'F', 'limit' => 1, 'offset' => 1]);
checkPage($page['total'] === 2 && $page['data'][0]['id'] === 'page-2', 'Key filter runs before paging');
$page = pageProbe('', ['category_id' => 1, 'sort' => 'title', 'limit' => 2]);
checkPage(array_column($page['data'], 'id') === ['page-1', 'page-10'], 'Title sorting applies to the entire result set');
$pdo->exec('DROP TABLE songs_fts');
$page = pageProbe('Ân', ['category_id' => 1, 'limit' => 200, 'offset' => 200]);
checkPage($page['total'] === 343 && count($page['data']) === 143, 'Fallback search keeps pagination, total and visibility');
echo "SUITE_COMPLETE total={$checks}\n";
exit($failed ? 1 : 0);
