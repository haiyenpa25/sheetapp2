<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/SetlistService.php';
$pdo=createTestDatabase();DB::setPdo($pdo);$song='001-thanh-chua-yeu-thuong';$total=0;$failed=0;
function profileCheck(bool $ok,string $msg):void{global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
$pdo->prepare("INSERT INTO user_chord_sets(song_id,user_id,username,set_name,is_public,chords_json) VALUES (?,2,'banhat','Secret',0,'[{\"chord\":\"SECRET\"}]')")->execute([$song]);
$_SESSION=['user_id'=>2];Auth::resetDbCache();
profileCheck(method_exists(SetlistService::class,'profileSharingWarning'),'Sharing warning service exists');
if(method_exists(SetlistService::class,'profileSharingWarning')){
 profileCheck(SetlistService::profileSharingWarning($song,'Secret')!==null,'Owner is warned before sharing private profile');
 profileCheck(SetlistService::profileSharingWarning($song,'HD')===null,'Standard HD does not produce a warning');
}
$_SESSION=['user_id'=>3];Auth::resetDbCache();
$package=SetlistOfflineHelper::getOfflinePackage(1,['id'=>1,'title'=>'Fixture','items'=>[['song_id'=>$song,'chord_profile'=>'Secret']]]);
profileCheck(($package['chord_set_status'][$song]['Secret']??null)==='forbidden','Offline package explicitly marks private profile forbidden');
profileCheck(($package['chord_sets'][$song]['Secret']??null)===[],'Forbidden package does not contain private chords');
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
