<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/LiveSyncService.php';
require_once __DIR__.'/../api/controllers/AuthController.php';require_once __DIR__.'/../api/controllers/ExportController.php';require_once __DIR__.'/../api/core/FeatureFlags.php';
DB::setPdo(createTestDatabase());$dir=sys_get_temp_dir().'/sheetapp_aux_'.bin2hex(random_bytes(8));mkdir($dir);LiveSyncService::setRoomDir($dir);
$total=0;$failed=0;function auxiliaryCheck(bool $ok,string $msg):void{global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
try{
 $first=LiveSyncService::createRoom('AUX');$file=glob($dir.'/*.json')[0];$state=json_decode(file_get_contents($file),true);$state['createdAt']=time()-10800;$state['expiresAt']=time()+3600;file_put_contents($file,json_encode($state));
 $next=LiveSyncService::createRoom('AUX');auxiliaryCheck(!($next['success']??true),'Active unexpired room older than two hours cannot be taken over');
 auxiliaryCheck(json_decode(file_get_contents($file),true)['hostToken']===$first['hostToken'],'Existing host token is preserved');
 $_SESSION=['user_id'=>2];$_GET=['action'=>'logout'];ob_start();(new AuthController())->handleRequest('GET');ob_end_clean();
 auxiliaryCheck(isset($_SESSION['user_id'])&&http_response_code()===405,'GET logout is rejected without changing session');
 FeatureFlags::setOverride('EXPORT_CHORDPRO',false);$_GET=['format'=>'text','song_id'=>'missing'];ob_start();(new ExportController())->handleRequest('GET');$response=json_decode(ob_get_clean(),true);
 auxiliaryCheck(http_response_code()===404&&str_contains($response['error']??'','hiện đang tắt'),'Text export honors the same feature gate');
}finally{foreach(glob($dir.'/*')?:[]as$f)unlink($f);rmdir($dir);LiveSyncService::setRoomDir(null);}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
