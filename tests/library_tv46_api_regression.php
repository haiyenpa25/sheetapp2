<?php
declare(strict_types=1);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/controllers/SongController.php';
$pdo = createTestDatabase(); DB::setPdo($pdo); $_SESSION = [];
$total = 0; $failed = 0;
function contractCheck(bool $ok, string $label): void {
    global $total, $failed; ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
$taxonomy = SongService::getTaxonomy();
contractCheck(count(array_filter($taxonomy['themes'], fn($item) => isset($item['key'], $item['label']))) === count($taxonomy['themes']), 'Taxonomy themes expose both stable key and display label');
contractCheck(!in_array('kinh-tiet-ca', array_column($taxonomy['themes'], 'key'), true), 'Taxonomy exposes only one canonical Kinh tiet ca entry');
$pdo->exec("UPDATE songs SET theme='doi-tin-do',tempo=92");
foreach ($pdo->query('SELECT id FROM songs')->fetchAll(PDO::FETCH_COLUMN) as $id) SongSearchHelper::syncSongFts($id);
contractCheck(count(SongService::search('', ['theme' => 'Đời tín đồ'])) === 2, 'Theme filter accepts Vietnamese labels');
contractCheck(count(SongService::search('Chúa', ['theme' => 'Đời tín đồ'])) === 2, 'FTS query accepts Vietnamese taxonomy labels');
$pdo->exec("UPDATE songs SET theme='kinh-tiet-ca'");
contractCheck(count(SongService::search('', ['theme' => 'kinh-tiet-ca-doan-ca'])) === 2, 'Canonical theme filter includes legacy stored alias');
$_GET = ['action' => 'get', 'id' => '001-thanh-chua-yeu-thuong']; ob_start(); (new SongController())->handleRequest('GET'); $data = json_decode(ob_get_clean(), true);
contractCheck(($data['success'] ?? false) && isset($data['data']['id']), 'Song detail returns success and data');
$pdo->exec('DROP TABLE songs_fts');
$fallback = SongService::search('Chúa');
contractCheck(count($fallback) > 0 && array_key_exists('tempo', $fallback[0]), 'LIKE fallback keeps tempo in the song contract');
contractCheck(count(SongService::search('Chúa', ['theme' => 'kinh-tiet-ca-doan-ca'])) === 2, 'LIKE fallback accepts canonical theme against legacy stored values');
$log = tempnam(sys_get_temp_dir(), 'tv46-log-'); $previousLog = ini_get('error_log'); ini_set('error_log', $log);
SongSearchHelper::syncSongFts('001-thanh-chua-yeu-thuong');
contractCheck(str_contains((string)file_get_contents($log), 'FTS'), 'FTS synchronization failures are logged');
ini_set('error_log', $previousLog); unlink($log);
echo "SUITE_COMPLETE total={$total}\n"; exit($failed ? 1 : 0);
