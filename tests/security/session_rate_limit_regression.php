<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$rateDir = sys_get_temp_dir() . '/sheetapp-rate-test-' . bin2hex(random_bytes(4));
putenv('LOGIN_RATE_LIMIT_DIR=' . $rateDir);

require_once $root . '/api/core/Session.php';
require_once $root . '/api/core/LoginRateLimiter.php';

$failures = [];
function checkSessionSecurity(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) $failures[] = $message;
}

$http = Session::cookieOptions(false);
$https = Session::cookieOptions(true);
checkSessionSecurity($http['httponly'] === true, 'Session cookie is HttpOnly');
checkSessionSecurity($http['samesite'] === 'Lax', 'Session cookie uses SameSite=Lax');
checkSessionSecurity($http['secure'] === false, 'Local HTTP remains usable');
checkSessionSecurity($https['secure'] === true, 'HTTPS session cookie is Secure');

$key = LoginRateLimiter::key('198.51.100.10', 'demo-user');
checkSessionSecurity(LoginRateLimiter::isBlocked($key) === false, 'Fresh login key is not blocked');
for ($i = 0; $i < 10; $i++) LoginRateLimiter::recordFailure($key);
checkSessionSecurity(LoginRateLimiter::isBlocked($key) === true, 'Ten failed attempts block login');
LoginRateLimiter::clear($key);
checkSessionSecurity(LoginRateLimiter::isBlocked($key) === false, 'Successful login clears the limiter');

foreach (glob($rateDir . '/*') ?: [] as $file) @unlink($file);
@rmdir($rateDir);

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d session/rate-limit regression test(s) failed.\n", count($failures)));
    exit(1);
}
echo "\nAll session/rate-limit regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
