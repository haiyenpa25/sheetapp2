<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$options=getopt('',['db:','plan:','backup-dir:','apply-index','apply-cleanup']);
if(empty($options['plan'])||empty($options['backup-dir'])||(!isset($options['apply-index'])&&!isset($options['apply-cleanup']))){
 fwrite(STDERR,"Requires reviewed --plan, explicit --backup-dir and --apply-index and/or --apply-cleanup. Run plan_data_repairs.php first.\n");exit(1);
}
$db=realpath($options['db']??__DIR__.'/../storage/data/app.sqlite');
$plan=json_decode((string)file_get_contents($options['plan']),true);
if(!$db||!is_array($plan))throw new RuntimeException('Invalid database or reviewed plan');
$out=[];$code=0;
exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg(__DIR__.'/plan_data_repairs.php').' --db='.escapeshellarg($db).' 2>&1',$out,$code);
$current=json_decode(implode("\n",$out),true);
if($code!==0||!is_array($current)||!hash_equals((string)($plan['plan_sha256']??''),(string)$current['plan_sha256']))throw new RuntimeException('Database or candidates changed; regenerate and review the plan');
if(isset($options['apply-index'])&&!empty($current['duplicate_chord_codes']))throw new RuntimeException('Resolve duplicate chord codes before creating the unique index');
foreach($current['dependent_rows']as$dependency){
 if($dependency['count']>0&&!in_array($dependency['table'],['notifications','notification_deliveries'],true))throw new RuntimeException('Additional dependent rows require review');
}
$backupDir=realpath($options['backup-dir']);if(!$backupDir||!is_dir($backupDir))throw new RuntimeException('Backup directory must already exist');
$backup=$backupDir.'/app_before_phuong_an_2_'.date('Ymd_His').'_'.bin2hex(random_bytes(6)).'.sqlite';
$pdo=new PDO('sqlite:'.$db,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('PRAGMA foreign_keys=ON');$pdo->exec('PRAGMA busy_timeout=5000');
$pdo->exec('VACUUM INTO '.$pdo->quote($backup));
$verify=new PDO('sqlite:file:'.str_replace('\\','/',$backup).'?mode=ro');
if($verify->query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('Backup integrity failed');
$verify=null;$result=['backup'=>$backup,'backup_sha256'=>hash_file('sha256',$backup),'deleted'=>[]];
$pdo->beginTransaction();
try{
 if(isset($options['apply-index'])){
  $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS users_chord_code_unique ON users(UPPER(TRIM(chord_code))) WHERE TRIM(COALESCE(chord_code,'')) <> ''");
  $result['unique_chord_code_index']=true;
 }
 if(isset($options['apply-cleanup']))foreach(['notification_deliveries'=>'deliveries','notifications'=>'notifications','domain_events'=>'events']as$table=>$key){
  $ids=array_column($current[$key],'id');$affected=0;
  if($ids){$stmt=$pdo->prepare('DELETE FROM '.$table.' WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$stmt->execute($ids);$affected=$stmt->rowCount();}
  if($affected!==count($ids))throw new RuntimeException('Candidate row count changed during apply');
  $result['deleted'][$table]=$affected;
 }
 $pdo->commit();
}catch(Throwable$e){if($pdo->inTransaction())$pdo->rollBack();throw$e;}
echo json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),"\n";
