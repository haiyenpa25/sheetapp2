<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$options=getopt('', ['db:','apply']);
if(isset($options['apply'])) { fwrite(STDERR,"This tool is read-only. Data changes require a separately approved migration.\n");exit(1); }
$file=realpath($options['db']??__DIR__.'/../storage/data/app.sqlite');
if($file===false) { fwrite(STDERR,"Database not found\n");exit(1); }
$pdo=new PDO('sqlite:file:'.str_replace('\\','/',$file).'?mode=ro',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('PRAGMA query_only=ON');
$plan=[
 'mode'=>'read-only', 'database_sha256'=>hash_file('sha256',$file),
 'ownership'=>$pdo->query("SELECT cs.id,cs.song_id,cs.set_name,cs.user_id AS old_user_id,cs.username,u.id AS new_user_id FROM user_chord_sets cs JOIN users u ON u.username=cs.username COLLATE NOCASE WHERE cs.user_id=1 AND cs.user_id<>u.id ORDER BY cs.id")->fetchAll(),
 'legacy_owner_review'=>$pdo->query("SELECT cs.id,cs.user_id,cs.username AS set_username,u.username AS actual_owner_username,cs.set_name FROM user_chord_sets cs LEFT JOIN users u ON u.id=cs.user_id WHERE cs.id IN (5,6,8) ORDER BY cs.id")->fetchAll(),
 'duplicate_chord_codes'=>$pdo->query("SELECT UPPER(TRIM(chord_code)) AS code,GROUP_CONCAT(id) AS user_ids,COUNT(*) AS count FROM users WHERE TRIM(COALESCE(chord_code,''))<>'' GROUP BY UPPER(TRIM(chord_code)) HAVING COUNT(*)>1")->fetchAll(),
 'proposed_unique_index'=>"CREATE UNIQUE INDEX users_chord_code_unique ON users(UPPER(TRIM(chord_code))) WHERE TRIM(COALESCE(chord_code,'')) <> ''",
 'candidate_window'=>['from'=>'2026-09-26','before'=>'2026-10-01'],
 'events'=>$pdo->query("SELECT id,type,subject_type,subject_id,created_at FROM domain_events WHERE created_at>='2026-09-26' AND created_at<'2026-10-01' ORDER BY id")->fetchAll(),
 'notifications'=>$pdo->query("SELECT id,event_id,user_id,created_at FROM notifications WHERE (created_at>='2026-09-26' AND created_at<'2026-10-01') OR event_id IN (SELECT id FROM domain_events WHERE created_at>='2026-09-26' AND created_at<'2026-10-01') ORDER BY id")->fetchAll(),
];
$notificationIds=array_column($plan['notifications'],'id');
$plan['deliveries']=[];
if($notificationIds){
 $stmt=$pdo->prepare('SELECT id,notification_id FROM notification_deliveries WHERE notification_id IN ('.implode(',',array_fill(0,count($notificationIds),'?')).') ORDER BY id');
 $stmt->execute($notificationIds);$plan['deliveries']=$stmt->fetchAll();
}
$plan['dependent_rows']=[];
foreach($pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN) as $table){
 $quoted='"'.str_replace('"','""',$table).'"';
 foreach($pdo->query('PRAGMA foreign_key_list('.$quoted.')')->fetchAll() as $fk){
  $parent=$fk['table'];if(!in_array($parent,['domain_events','notifications'],true))continue;
  $ids=array_column($plan[$parent==='domain_events'?'events':'notifications'],'id');if(!$ids)continue;
  $column='"'.str_replace('"','""',$fk['from']).'"';
  $stmt=$pdo->prepare('SELECT COUNT(*) FROM '.$quoted.' WHERE '.$column.' IN ('.implode(',',array_fill(0,count($ids),'?')).')');$stmt->execute($ids);
  $plan['dependent_rows'][]=['table'=>$table,'column'=>$fk['from'],'parent'=>$parent,'count'=>(int)$stmt->fetchColumn(),'on_delete'=>$fk['on_delete']];
 }
}
$plan['plan_sha256']=hash('sha256',json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
echo json_encode($plan,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),"\n";
