<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/api/core/RequestSecurity.php';
$total = 0; $failed = 0;
function csrfCheck(bool $ok, string $label): void {
    global $total, $failed; ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function allowedWrite(array $server, string $method, bool $enforce): bool {
    if (method_exists(RequestSecurity::class, 'isAllowedRequest')) return RequestSecurity::isAllowedRequest($server, $method, $enforce);
    return !RequestSecurity::requiresOriginCheck($method) || RequestSecurity::isSameOrigin($server);
}
$_SESSION = ['csrf_token' => 'fixture-token'];
$server = ['HTTP_HOST' => 'localhost:8080', 'HTTPS' => 'off'];
$same = $server + ['HTTP_ORIGIN' => 'http://localhost:8080'];
csrfCheck(!allowedWrite($server, 'POST', false), 'Writes without both Origin and Referer are denied even with enforcement off');
csrfCheck(allowedWrite($same, 'POST', false), 'Same-origin legacy write works with enforcement off');
csrfCheck(!allowedWrite($same, 'POST', true), 'Enforcement rejects a missing CSRF token');
csrfCheck(!allowedWrite($same + ['HTTP_X_CSRF_TOKEN' => 'wrong'], 'PUT', true), 'Enforcement rejects an incorrect token');
csrfCheck(allowedWrite($same + ['HTTP_X_CSRF_TOKEN' => 'fixture-token'], 'PATCH', true), 'Same-origin session token permits a write');
csrfCheck(!allowedWrite($server + ['HTTP_ORIGIN' => 'http://evil.example', 'HTTP_X_CSRF_TOKEN' => 'fixture-token'], 'DELETE', true), 'A valid token does not override foreign Origin');
csrfCheck(allowedWrite($server + ['HTTP_REFERER' => 'http://localhost:8080/app/'], 'POST', false), 'Same-origin Referer works when Origin is absent');
csrfCheck(allowedWrite($server, 'GET', true) && allowedWrite($server, 'HEAD', true), 'Reads remain available without a token');
echo "SUITE_COMPLETE total={$total}\n"; exit($failed ? 1 : 0);
