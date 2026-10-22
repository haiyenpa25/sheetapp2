<?php
declare(strict_types=1);
function requireIsolatedE2eRoot(): void {
    if (PHP_SAPI !== 'cli' || getenv('SHEETAPP_E2E') !== '1') {
        http_response_code(403); exit("Only isolated CLI E2E is allowed.\n");
    }
    $root=realpath(dirname(__DIR__));
    $marker=json_decode((string)@file_get_contents($root.'/.sheetapp-e2e-isolated.json'),true);
    $source=is_array($marker)?realpath((string)($marker['sourceRoot']??'')):false;
    if(!$source||strcasecmp($root,$source)===0
        ||str_starts_with(strtolower($root).DIRECTORY_SEPARATOR,strtolower(rtrim($source,'/\\')).DIRECTORY_SEPARATOR)
        ||empty($marker['baseURL'])||getenv('SHEETAPP_E2E_BASE_URL')!==$marker['baseURL']){
        fwrite(STDERR,"E2E requires a verified isolated copy and matching server URL.\n");exit(1);
    }
}
