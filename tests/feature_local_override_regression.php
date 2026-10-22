<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
$dir=sys_get_temp_dir().'/sheetapp_flags_'.bin2hex(random_bytes(8));
mkdir($dir.'/api/core',0775,true); mkdir($dir.'/storage/config',0775,true);
copy(__DIR__.'/../api/core/FeatureFlags.php',$dir.'/api/core/FeatureFlags.php');
require_once $dir.'/api/core/FeatureFlags.php';
$total=0;$failed=0;
function flagCheck(bool $ok,string $msg):void { global $total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n"; }
try {
 file_put_contents($dir.'/storage/config/features.json',json_encode(['EXPORT_CHORDPRO'=>true,'PRACTICE_ASSIGNMENTS'=>true]));
 file_put_contents($dir.'/storage/config/features.local.json',json_encode(['EXPORT_CHORDPRO'=>false,'csrf_enforce'=>true]));
 flagCheck(!FeatureFlags::isEnabled('EXPORT_CHORDPRO'),'Local override can disable a tracked default');
 flagCheck(FeatureFlags::isEnabled('csrf_enforce'),'Local override can enable a known flag');
 flagCheck(FeatureFlags::isEnabled('PRACTICE_ASSIGNMENTS'),'Missing local key retains tracked value');
 file_put_contents($dir.'/storage/config/features.local.json','bad json'); FeatureFlags::reset();
 flagCheck(FeatureFlags::isEnabled('EXPORT_CHORDPRO'),'Malformed local config retains tracked defaults');
 unlink($dir.'/storage/config/features.json');unlink($dir.'/storage/config/features.local.json');FeatureFlags::reset();
 flagCheck(!FeatureFlags::isEnabled('EXPORT_CHORDPRO'),'Fresh checkout without config uses safe built-in defaults');
} finally {
 foreach(glob($dir.'/storage/config/*')?:[] as $f)unlink($f);
 unlink($dir.'/api/core/FeatureFlags.php');rmdir($dir.'/api/core');rmdir($dir.'/api');rmdir($dir.'/storage/config');rmdir($dir.'/storage');rmdir($dir);
}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
