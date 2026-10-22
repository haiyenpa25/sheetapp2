<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';
require_once __DIR__.'/../api/services/SongService.php';
$pdo=createTestDatabase();DB::setPdo($pdo);$total=0;$failed=0;
function versionCheck(bool $ok,string $msg):void{global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
$song='001-thanh-chua-yeu-thuong';
$file=glob(__DIR__.'/../storage/users/admin/thanh-ca-001/*.xml')[0];
$relative='storage/users/admin/thanh-ca-001/'.basename($file);
$pdo->prepare("INSERT INTO song_versions(song_id,user_id,username,version_name,version_slug,xml_path,is_public) VALUES (?,2,'banhat','Fixture','fixture',?,0)")->execute([$song,$relative]);$id=(int)$pdo->lastInsertId();
if(!method_exists(SongVersionHelper::class,'getVersionXml')){versionCheck(false,'Version XML service exists');}
else{
 foreach([0=>false,2=>true,3=>false,1=>true] as $actor=>$allowed){$_SESSION=$actor?['user_id'=>$actor]:[];Auth::resetDbCache();versionCheck((SongVersionHelper::getVersionXml($id)!==null)===$allowed,'Private version access actor='.$actor);}
 $_SESSION=[];Auth::resetDbCache();$pdo->exec('UPDATE song_versions SET is_public=1');versionCheck(SongVersionHelper::getVersionXml($id)===file_get_contents($file),'Public version returns exact XML through service');
 $pdo->exec("UPDATE songs SET visibility='private',is_public=0");versionCheck(SongVersionHelper::getVersionXml($id)===null,'Private song visibility also gates XML');
 $pdo->exec("UPDATE songs SET visibility='public',is_public=1");$pdo->exec("UPDATE song_versions SET xml_path='api/core/Auth.php'");versionCheck(SongVersionHelper::getVersionXml($id)===null,'Unmanaged path is denied');
}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
