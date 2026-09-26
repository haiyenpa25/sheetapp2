<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    if (!$condition) {
        $failures[] = $message;
        echo "FAIL: {$message}\n";
        return;
    }
    echo "PASS: {$message}\n";
}

function source(string $path): string {
    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException("Cannot read {$path}");
    }
    return $contents;
}

$userController = source($root . '/api/controllers/UserController.php');
$authController = source($root . '/api/controllers/AuthController.php');
$authUi = source($root . '/assets/js/auth.js');
$modals = source($root . '/includes/modals.php');

check(
    preg_match_all('/Auth::requireAdmin\(\);/', $userController) >= 3,
    'User create, update and delete operations require admin authorization'
);
check(
    str_contains($userController, '$resolvedRole = $role ?? $existing[\'role\'];'),
    'User updates do not silently default the role to banhat'
);
check(
    str_contains($authController, "createWithProfile(\$username, \$password, 'viewer'"),
    'Self-registration creates a viewer account'
);
check(
    str_contains($authController, "\$user['status']") && str_contains($authController, "'active'"),
    'Login checks that the account is active'
);
check(
    substr_count($authController, 'session_regenerate_id(true)') >= 2,
    'Login and registration rotate the session identifier'
);
check(
    !str_contains($authUi, 'auth-quick-chip') && !str_contains($authUi, "'123456'"),
    'Auth JavaScript contains no quick-login fallback or default password'
);
check(
    !str_contains($modals, 'Pass: 123456') && !str_contains($modals, 'auth-quick-chip'),
    'Login modal does not expose quick-login accounts or passwords'
);

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d security regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll authentication regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
