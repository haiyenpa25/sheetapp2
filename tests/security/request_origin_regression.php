<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/api/core/RequestSecurity.php';

$failures = [];
function checkOrigin(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) $failures[] = $message;
}

$server = ['HTTP_HOST' => 'localhost:8080', 'HTTPS' => 'off'];
checkOrigin(RequestSecurity::isSameOrigin($server + ['HTTP_ORIGIN' => 'http://localhost:8080']), 'Same-origin request is accepted');
checkOrigin(!RequestSecurity::isSameOrigin($server + ['HTTP_ORIGIN' => 'https://evil.example']), 'Foreign Origin is rejected');
checkOrigin(!RequestSecurity::isSameOrigin($server + ['HTTP_SEC_FETCH_SITE' => 'cross-site']), 'Cross-site Fetch Metadata is rejected');
checkOrigin(RequestSecurity::isSameOrigin($server), 'Non-browser request without origin metadata remains usable');

$apiIndex = file_get_contents($root . '/api/index.php') ?: '';
$htaccess = file_get_contents($root . '/.htaccess') ?: '';
checkOrigin(!str_contains($apiIndex, 'Access-Control-Allow-Origin: *'), 'API does not emit wildcard CORS');
checkOrigin(!str_contains($htaccess, 'Access-Control-Allow-Origin "*"'), '.htaccess does not emit wildcard CORS');

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d request-origin regression test(s) failed.\n", count($failures)));
    exit(1);
}
echo "\nAll request-origin regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
