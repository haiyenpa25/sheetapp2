<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';
require_once __DIR__.'/../api/services/ManagerService.php';
$pdo=createTestDatabase(); DB::setPdo($pdo);
$dir=sys_get_temp_dir().'/sheetapp_reserved_'.bin2hex(random_bytes(8)); putenv('CHORD_SETS_DIR='.$dir);
$song='001-thanh-chua-yeu-thuong'; $total=0; $failed=0;
function reservedCheck(bool $ok,string $msg):void { global $total,$failed; $total++; if(!$ok)$failed++; echo ($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n"; }
$_SESSION=['user_id'=>2,'username'=>'banhat']; Auth::resetDbCache();
try {
    $pdo->prepare("INSERT INTO user_chord_sets(song_id,user_id,username,set_name,chords_json) VALUES (?,2,'banhat','Personal','[]')")->execute([$song]);
    $id=(int)$pdo->lastInsertId();
    foreach(['HD','hd','HĐ',' hd ','TLH','tlh','default','DEFAULT','__action'] as $name) {
        $r=ManagerService::forkSong(['song_id'=>$song,'set_name'=>$name]);
        reservedCheck(!($r['success']??false),'Manager rejects reserved fork '.$name);
        $r=ManagerService::saveUserChordSet($id,['set_name'=>$name]);
        reservedCheck(!($r['success']??false),'Manager rejects reserved rename '.$name);
        $r=ChordSetService::forkSet($song,'HD',$name,2,'banhat');
        reservedCheck(!($r['success']??false),'Service rejects reserved fork '.$name);
        reservedCheck(!ChordSetService::cloneSet($song,'HD',$name,2,'banhat'),'Clone rejects reserved target '.$name);
    }
    reservedCheck(!ChordSetService::saveSet($song,'tlh',[],2,'banhat'),'Save rejects lower-case TLH');
    reservedCheck(!ChordSetService::saveSet($song,'HĐ',[],2,'banhat'),'Save rejects normalized HD alias');
    $pdo->prepare("INSERT INTO user_chord_sets(song_id,user_id,username,set_name,chords_json) VALUES (?,1,'official','HD','[{\"chord\":\"C\"}]'), (?,2,'fake','HD','[{\"chord\":\"BAD\"}]')")->execute([$song,$song]);
    reservedCheck(ChordSetService::loadSet($song,'HD')===[['chord'=>'C']],'Earliest official HD survives later counterfeit row');
} finally {
    foreach(glob($dir.'/*/*.json')?:[] as $f)unlink($f);
    foreach(glob($dir.'/*',GLOB_ONLYDIR)?:[] as $d)rmdir($d);
    if(is_dir($dir))rmdir($dir); putenv('CHORD_SETS_DIR');
}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
