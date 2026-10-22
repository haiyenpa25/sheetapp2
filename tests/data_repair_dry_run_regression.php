<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';
$dir=sys_get_temp_dir().'/sheetapp_repair_plan_'.bin2hex(random_bytes(8));mkdir($dir);$dbFile=$dir.'/fixture.sqlite';
$pdo=createTestDatabase();$song='001-thanh-chua-yeu-thuong';
$pdo->prepare("INSERT INTO user_chord_sets(song_id,user_id,username,set_name) VALUES (?,1,'banhat','Legacy')")->execute([$song]);
$pdo->exec("INSERT INTO domain_events(type,subject_type,subject_id,created_at) VALUES ('fixture','test_fixture','1','2026-09-27 10:00:00')");
$pdo->exec("INSERT INTO notifications(user_id,event_id,title,created_at) VALUES (2,1,'Fixture','2026-09-27 10:00:00')");
$pdo->exec('VACUUM INTO '.$pdo->quote($dbFile));$pdo=null;$before=hash_file('sha256',$dbFile);$total=0;$failed=0;
function repairCheck(bool$ok,string$msg):void{global$total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
try{
 $tool=dirname(__DIR__).'/tools/plan_data_repairs.php';
 $out=[];$status=0;exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg($tool).' --db='.escapeshellarg($dbFile).' 2>&1',$out,$status);
 repairCheck($status===0,'Read-only repair plan succeeds on fixture');$plan=json_decode(implode("\n",$out),true)?:[];
 repairCheck(($plan['ownership'][0]['new_user_id']??0)===2,'Plan identifies owner by matching username');
 repairCheck(count($plan['events']??[])===1&&count($plan['notifications']??[])===1,'Plan lists exact cleanup candidates');
 repairCheck(hash_file('sha256',$dbFile)===$before,'Dry-run leaves database bytes unchanged');
 $planFile=$dir.'/plan.json';file_put_contents($planFile,json_encode($plan));
 $out=[];$status=0;exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg(dirname(__DIR__).'/tools/apply_data_repair_plan.php').' --db='.escapeshellarg($dbFile).' --plan='.escapeshellarg($planFile).' --backup-dir='.escapeshellarg($dir).' --apply-index --apply-cleanup 2>&1',$out,$status);
 repairCheck($status===0,'Approved apply succeeds only on disposable fixture');
 $applied=json_decode(implode("\n",$out),true)?:[];
 repairCheck(is_file($applied['backup']??''),'Apply creates a verified pre-change backup');
 $check=new PDO('sqlite:'.$dbFile);repairCheck((int)$check->query('SELECT COUNT(*) FROM domain_events')->fetchColumn()===0&&(int)$check->query('SELECT COUNT(*) FROM notifications')->fetchColumn()===0,'Apply deletes exactly fixture cleanup candidates');
 $index=$check->query("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='users_chord_code_unique'")->fetchColumn();repairCheck((int)$index===1,'Apply installs the unique chord code index');$check=null;
}finally{foreach(glob($dir.'/*')?:[]as$f)unlink($f);rmdir($dir);}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
