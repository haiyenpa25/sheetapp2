<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$response = file_get_contents($root . '/api/core/Response.php') ?: '';
$api = file_get_contents($root . '/api/index.php') ?: '';
$controllers = glob($root . '/api/controllers/*Controller.php') ?: [];
$failures = [];

function checkErrorSecurity(bool $condition, string $message): void {
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) $failures[] = $message;
}

checkErrorSecurity(str_contains($response, 'function unauthorized'), 'Response provides a 401 helper');
checkErrorSecurity(
    !preg_match('/Response::error\([^;]*\$e->getMessage\(\)/s', $api),
    'Global API handler does not expose exception details'
);
checkErrorSecurity(str_contains($api, 'error_log('), 'Global API handler logs exception details server-side');
checkErrorSecurity(
    str_contains($response, 'public static function serverError(Throwable $error'),
    'Response provides a centralized safe server-error helper'
);

$unsafeControllers = [];
foreach ($controllers as $controller) {
    $contents = file_get_contents($controller) ?: '';
    if (preg_match('/Response::error\([^;]*\$e->getMessage\(\)[^;]*,\s*500\s*\)/s', $contents)) {
        $unsafeControllers[] = basename($controller);
    }
}
checkErrorSecurity($unsafeControllers === [], 'Controllers do not expose exception details in HTTP 500 responses');

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d error-disclosure regression test(s) failed.\n", count($failures)));
    exit(1);
}
echo "\nAll error-disclosure regression tests passed.\n";
