<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/SongService.php';
class CacheRaceStatement extends PDOStatement {
    public static $afterFetch = null;
    protected function __construct() {}
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array {
        $rows=parent::fetchAll($mode,...$args);
        if (self::$afterFetch && str_contains($this->queryString,'SELECT s.id, s.title')) {
            $callback=self::$afterFetch;self::$afterFetch=null;$callback();
        }
        return $rows;
    }
}
$pdo=createTestDatabase();DB::setPdo($pdo);$_SESSION=[];Auth::resetDbCache();
$pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS,[CacheRaceStatement::class,[]]);
$file=SongService::cachePath();$total=0;$failed=0;
function generationCheck(bool $ok,string $msg):void{global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
try {
 CacheRaceStatement::$afterFetch=static function()use($pdo):void{$pdo->exec("UPDATE songs SET title='New fixture title'");SongService::invalidateCache();};
 SongService::writePublicCache();
 generationCheck(SongService::publicCacheSnapshot()===null,'Catalog read before invalidation cannot republish a stale cache');
 SongService::writePublicCache();$snapshot=SongService::publicCacheSnapshot();
 generationCheck(str_contains($snapshot['json']??'','New fixture title'),'Subsequent build publishes the latest DB data');
 unlink($file.'.lock');mkdir($file.'.lock');SongService::invalidateCache();
 generationCheck(!is_file($file)&&!is_file($file.'.etag'),'Invalidation still removes stale data when lock cannot open');
 rmdir($file.'.lock');
}finally{foreach([$file,$file.'.etag',$file.'.lock']as$f)if(is_file($f))unlink($f);}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
