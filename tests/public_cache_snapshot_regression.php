<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/SongService.php';
DB::setPdo(createTestDatabase());
$file = SongService::cachePath();
register_shutdown_function(static function () use ($file): void {
    foreach ([$file, $file . '.etag', $file . '.lock'] as $path) if (is_file($path)) unlink($path);
});
$total = 0;
$failed = 0;
function cacheCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
SongService::writePublicCache([['id' => 'first', 'title' => 'Fixture']]);
cacheCheck(is_file($file . '.etag'), 'Writer stores ETag beside public cache');
if (!method_exists(SongService::class, 'publicCacheSnapshot')) {
    cacheCheck(false, 'Public cache snapshot API exists');
} else {
    $snapshot = SongService::publicCacheSnapshot();
    cacheCheck($snapshot !== null && $snapshot['etag'] === hash('sha256', $snapshot['json']), 'Snapshot ETag matches the exact response body');
    touch($file . '.etag', 1000000000);
    SongService::publicCacheSnapshot();
    clearstatcache(true, $file . '.etag');
    cacheCheck(filemtime($file . '.etag') === 1000000000, 'Repeated request reuses stored ETag');
    unlink($file . '.etag');
    $legacy = SongService::publicCacheSnapshot();
    cacheCheck($legacy === $snapshot && is_file($file . '.etag'), 'Legacy cache gets ETag without changing body');
    SongService::writePublicCache([['id' => 'other', 'title' => 'Changed']]);
    $changed = SongService::publicCacheSnapshot();
    cacheCheck($changed['etag'] !== $snapshot['etag'], 'Changed catalog receives a new ETag');
    cacheCheck($changed['etag'] === hash('sha256', $changed['json']), 'Replacement body and ETag stay consistent');
}
SongService::invalidateCache();
cacheCheck(!is_file($file) && !is_file($file . '.etag'), 'Invalidation removes both cache and ETag');
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
