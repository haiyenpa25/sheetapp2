<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/api/services/LiveSyncService.php';

$tmpDir = sys_get_temp_dir() . '/sheetapp_ls_sec_' . bin2hex(random_bytes(4));
LiveSyncService::setRoomDir($tmpDir);

$room = 'SEC-' . strtoupper(bin2hex(random_bytes(6)));
$roomFile = $tmpDir . '/' . strtolower($room) . '.json';
$failures = [];

function checkLive(bool $condition, string $message): void {
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) {
        $failures[] = $message;
    }
}

try {
    $created = LiveSyncService::createRoom($room, ['leader' => 'Security test']);
    checkLive(!empty($created['success']) && !empty($created['hostToken']), 'Host can create a new room');

    $duplicate = LiveSyncService::createRoom($room, ['leader' => 'Attacker']);
    checkLive(empty($duplicate['success']), 'An active room cannot be overwritten');

    $withoutToken = LiveSyncService::updateRoom($room, '', ['bpm' => 200]);
    checkLive(empty($withoutToken['success']), 'Room update without host token is rejected');

    $wrongToken = LiveSyncService::updateRoom($room, 'wrong-token', ['bpm' => 200]);
    checkLive(empty($wrongToken['success']), 'Room update with wrong host token is rejected');

    $valid = LiveSyncService::updateRoom($room, $created['hostToken'], ['bpm' => 90]);
    checkLive(!empty($valid['success']), 'Room update with the host token succeeds');

    $controller = file_get_contents($root . '/api/controllers/LiveSyncController.php') ?: '';
    checkLive(str_contains($controller, 'Auth::requireLogin();'), 'Live Sync room creation requires login');
} finally {
    if (is_file($roomFile)) {
        @unlink($roomFile);
    }
    if (is_dir($tmpDir)) {
        @rmdir($tmpDir);
    }
    LiveSyncService::setRoomDir(null);
}

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d Live Sync regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll Live Sync regression tests passed.\n";
