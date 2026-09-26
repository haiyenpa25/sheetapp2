<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$controller = file_get_contents($root . '/api/controllers/SessionController.php');
$service = file_get_contents($root . '/api/services/SessionService.php');
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . "\n";
    if (!$condition) $failures[] = $message;
}

check(str_contains($controller, 'SessionService::load($songId, Auth::userId() ?? 0)'), 'Session reads use the authenticated user ID');
check(substr_count($controller, '$songId, $userId,') === 2, 'Both session write paths pass the authenticated user ID');
check(str_contains($service, "'u' . \$userId . '_'"), 'Session files are namespaced by user ID');
check(str_contains($service, 'if ($userId <= 0) return self::defaults($songId);'), 'Anonymous reads cannot access persisted session data');
check(str_contains($service, 'LOCK_EX'), 'Session writes use an exclusive file lock');

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d session ownership regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll session ownership regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
