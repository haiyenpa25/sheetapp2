<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$controller = file_get_contents($root . '/api/controllers/PracticeController.php');
$service = file_get_contents($root . '/api/services/PracticeService.php');
$failures = [];

function check(bool $condition, string $message): void {
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . "\n";
    if (!$condition) $failures[] = $message;
}

check(str_contains($service, 'public static function isOwner'), 'Practice service exposes an ownership check');
check(str_contains($service, 'SELECT user_id FROM practice_sessions WHERE id = ?'), 'Practice ownership is read from the stored session');
check(substr_count($controller, 'PracticeService::isOwner($sessionId, $userId)') === 2, 'Checkpoint and finish both enforce ownership');
check(substr_count($controller, '!Auth::isAdmin()') >= 2, 'Admin override is explicit for practice writes');
check(str_contains($controller, 'Auth::requireLogin();'), 'Practice endpoints require login');

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d practice ownership regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll practice ownership regression tests passed.\n";
