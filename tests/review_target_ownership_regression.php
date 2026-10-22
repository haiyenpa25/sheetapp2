<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
$pdo = createTestDatabase(); DB::setPdo($pdo);
$dir = sys_get_temp_dir() . '/sheetapp_review_owner_' . bin2hex(random_bytes(8));
putenv('CHORD_SETS_DIR=' . $dir);
$song = '001-thanh-chua-yeu-thuong';
$_SESSION = ['user_id' => 3, 'username' => 'viewer']; Auth::resetDbCache();
$json = '[{"chord":"SECRET"}]';
$pdo->prepare("INSERT INTO user_chord_sets (song_id,user_id,username,set_name,is_public,chords_json) VALUES (?,2,'banhat','NAM',0,?)")->execute([$song,$json]);
$total = 0; $failed = 0;
function ownerCheck(bool $ok, string $message): void { global $total,$failed; $total++; if (!$ok) $failed++; echo ($ok?'[PASS:B] ':'[FAIL:B] ').$message."\n"; }
try {
    ownerCheck(ReviewService::resolveChordSetTarget($song,'NAM',3) === 0,'Review name resolution rejects another owner private set');
    ownerCheck($pdo->query("SELECT chords_json FROM user_chord_sets WHERE set_name='NAM'")->fetchColumn() === $json,'Victim chords are unchanged');
    ownerCheck(!is_dir($dir),'Resolving a review does not write any disk export');
    ownerCheck(ReviewService::resolveChordSetTarget($song,'Missing',3) === 0,'Unknown set is not created during review');
    $_SESSION = ['user_id'=>2,'username'=>'banhat']; Auth::resetDbCache();
    $id = (int)$pdo->query("SELECT id FROM user_chord_sets WHERE set_name='NAM'")->fetchColumn();
    ownerCheck(ReviewService::resolveChordSetTarget($song,'NAM',2) === $id,'Owner resolves own set');
    ownerCheck(ReviewService::resolveChordSetTarget($song,'banhat__NAM',2) === $id,'Owner resolves qualified alias');
} finally {
    foreach (glob($dir.'/*/*.json')?:[] as $file) unlink($file);
    foreach (glob($dir.'/*',GLOB_ONLYDIR)?:[] as $path) rmdir($path);
    if (is_dir($dir)) rmdir($dir);
    putenv('CHORD_SETS_DIR');
}
echo "SUITE_COMPLETE total={$total}\n"; exit($failed?1:0);
