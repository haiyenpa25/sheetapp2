<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__.'/fixtures/isolated_storage.php';require_once __DIR__.'/fixtures/test_db_fixture.php';require_once __DIR__.'/../api/services/UserService.php';
DB::setPdo(createTestDatabase());$_SESSION=[];Auth::resetDbCache();$total=0;$failed=0;
function codeCheck(bool$ok,string$msg):void{global$total,$failed;$total++;if(!$ok)$failed++;echo($ok?'[PASS:B] ':'[FAIL:B] ').$msg."\n";}
$first=UserService::createWithProfile('collide-one','Fixture-strong-2026!','viewer','Fixture','Guitar','COLL');
$denied=false;try{UserService::createWithProfile('collide-two','Fixture-strong-2026!','viewer','Fixture','Guitar','coll');}catch(InvalidArgumentException $e){$denied=true;}
codeCheck($denied,'Explicit duplicate chord code is rejected case-insensitively');
if(!method_exists(UserService::class,'generateChordCode'))codeCheck(false,'Unique registration code generator exists');
else{
 $code=UserService::generateChordCode('collide-three');codeCheck($code!=='COLL','Same username prefix generates an available code');
 codeCheck(!in_array(UserService::generateChordCode('HD'),['HD','TLH','DEFAULT'],true),'Registration never grants a reserved standard code');
 UserService::assertChordCodeAvailable('COLL',$first);codeCheck(true,'Existing owner may retain own code');
}
echo "SUITE_COMPLETE total={$total}\n";exit($failed?1:0);
