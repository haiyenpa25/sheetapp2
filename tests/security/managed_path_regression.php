<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/api/services/SongService.php';

$allowedDir = $root . '/storage/users/security-test';
$allowedFile = $allowedDir . '/allowed.xml';
$outsideFile = $root . '/tests/security/outside.xml';
if (!is_dir($allowedDir)) {
    mkdir($allowedDir, 0775, true);
}
file_put_contents($allowedFile, '<score-partwise/>');
file_put_contents($outsideFile, '<score-partwise/>');

$method = new ReflectionMethod(SongService::class, 'resolveManagedXmlPath');
$failures = [];

function checkPath(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$condition) {
        $failures[] = $message;
    }
}

try {
    checkPath($method->invoke(null, $allowedFile) === realpath($allowedFile), 'XML below storage/users is accepted');
    checkPath($method->invoke(null, $outsideFile) === null, 'XML outside managed roots is rejected');
    checkPath($method->invoke(null, '../../index.php') === null, 'Traversal outside managed roots is rejected');
    checkPath($method->invoke(null, $root . '/index.php') === null, 'Non-XML files are rejected');
} finally {
    @unlink($allowedFile);
    @rmdir($allowedDir);
    @unlink($outsideFile);
}

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d managed-path regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll managed-path regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
