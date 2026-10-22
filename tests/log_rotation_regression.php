<?php
declare(strict_types=1);

// SUITE_TYPE: behavioral
require_once __DIR__ . '/../api/core/AuditLogger.php';
$dir = sys_get_temp_dir() . '/sheetapp_log_rotation_' . bin2hex(random_bytes(8));
mkdir($dir);
$total = 0;
$failed = 0;
function logCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
register_shutdown_function(static function () use ($dir): void {
    AuditLogger::setLogPath(null);
    foreach (glob($dir . '/*') ?: [] as $file) unlink($file);
    rmdir($dir);
});

$path = $dir . '/audit.log';
AuditLogger::setLogPath($path);
$old = str_repeat('x', 5 * 1024 * 1024);
file_put_contents($path, $old);
logCheck(AuditLogger::log('rotation-test', 1, null), 'Audit append succeeds');
logCheck(is_file($path . '.1'), 'Audit log rotates at size limit');
logCheck(file_get_contents($path . '.1') === $old, 'Rotation preserves previous audit content');
$entry = json_decode(trim((string)file_get_contents($path)), true);
logCheck(($entry['action'] ?? '') === 'rotation-test', 'New audit file contains the new JSON entry');

if (class_exists('RotatingLog')) {
    $client = $dir . '/client_errors.log';
    foreach (['first', 'second', 'third', 'fourth', 'fifth'] as $message) {
        logCheck(RotatingLog::append($client, $message, 6, 2), 'Append client record ' . $message);
    }
    logCheck(file_get_contents($client) === 'fifth', 'Latest client record is active');
    logCheck(file_get_contents($client . '.1') === 'fourth', 'Newest archive contains previous record');
    logCheck(file_get_contents($client . '.2') === 'third', 'Second archive contains preceding record');
    logCheck(!is_file($client . '.3'), 'Archive count stays bounded');
    logCheck(!RotatingLog::append($dir . '/absent/log', 'record'), 'Unwritable destination reports failure');
}
mkdir($dir . '/blocked.log.lock');
logCheck(RotatingLog::append($dir . '/blocked.log', "fallback\n", 10, 2), 'Unavailable sidecar lock falls back to locked append');
logCheck(@file_get_contents($dir . '/blocked.log') === "fallback\n", 'Fallback retains the audit entry');
file_put_contents($dir . '/rename.log', "original\n");
mkdir($dir . '/rename.log.1');
logCheck(RotatingLog::append($dir . '/rename.log', "next\n", 10, 2), 'Failed rotation continues appending to current log');
logCheck(file_get_contents($dir . '/rename.log') === "original\nnext\n", 'Failed rotation does not drop new log entry');
rmdir($dir . '/blocked.log.lock'); rmdir($dir . '/rename.log.1');
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
