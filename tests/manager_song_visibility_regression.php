<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/ManagerService.php';
$pdo=createTestDatabase();DB::setPdo($pdo);$_SESSION=[];Auth::resetDbCache();
$song='001-thanh-chua-yeu-thuong';$pdo->prepare("UPDATE songs SET visibility='private',is_public=0 WHERE id=?")->execute([$song]);
$total=0;$failed=0;function visibilityCheck(bool $ok,string $msg):void{global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
foreach(['','Thánh']as $q){$ids=array_column(ManagerRepertoireHelper::searchSongsFast($q),'id');visibilityCheck(!in_array($song,$ids,true),'Guest search excludes private song: '.$q);}
visibilityCheck(ManagerRepertoireHelper::getSongDetails($song)===[],'Guest cannot read private song detail');
$_SESSION=['user_id'=>2];Auth::resetDbCache();visibilityCheck(ManagerRepertoireHelper::getSongDetails($song)!==[],'Ban hat retains permitted internal song access');
$pdo->prepare("UPDATE songs SET visibility='admin_only' WHERE id=?")->execute([$song]);visibilityCheck(ManagerRepertoireHelper::getSongDetails($song)===[],'Ban hat cannot read admin-only detail');
$_SESSION=['user_id'=>1];Auth::resetDbCache();visibilityCheck(ManagerRepertoireHelper::getSongDetails($song)!==[],'Admin retains admin-only access');
$pdo->prepare("INSERT INTO song_versions(song_id,user_id,username,version_name,version_slug,xml_path) VALUES (?,2,'banhat','VersionFixture','fixture','storage/users/fixture.xml')")->execute([$song]);
$_SESSION=[];Auth::resetDbCache();
visibilityCheck(ManagerService::getVersionsList()['total']===0,'Guest version catalog excludes private song metadata');
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
