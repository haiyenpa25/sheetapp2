<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/SongService.php';
DB::setPdo(createTestDatabase());$dir=sys_get_temp_dir().'/sheetapp_versions_'.bin2hex(random_bytes(8));mkdir($dir);putenv('SHEETAPP_STORAGE_ROOT='.$dir);
$_SESSION=['user_id'=>2,'username'=>'banhat'];Auth::resetDbCache();$song='001-thanh-chua-yeu-thuong';$total=0;$failed=0;
function filenameCheck(bool$ok,string$msg):void{global$total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
try{
 $one=SongVersionHelper::saveVersion($song,'<v1/>','Same name')['data'];
 $two=SongVersionHelper::saveVersion($song,'<v2/>','Same name')['data'];
 $three=SongVersionHelper::saveVersion($song,'<v3/>','Same name')['data'];
 DB::run('DELETE FROM song_versions WHERE id=?',[$two['id']]);
 $four=SongVersionHelper::saveVersion($song,'<v4/>','Same name')['data'];
 $thirdFile=$dir.'/'.substr($three['xml_path'],strlen('storage/'));
 filenameCheck(file_get_contents($thirdFile)==='<v3/>','Deleting an earlier DB version cannot overwrite later XML');
 filenameCheck($four['xml_path']!==$three['xml_path'],'New version has a distinct filename');
}finally{
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($it as$f)$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());rmdir($dir);putenv('SHEETAPP_STORAGE_ROOT');
}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
