<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/api/core/Response.php';
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . "\n";
    if (!$condition) $failures[] = $message;
}

ob_start();
Response::ok(['id' => 7], 'Đã lưu');
$payload = json_decode((string)ob_get_clean(), true);
check(($payload['success'] ?? false) === true, 'Successful response retains the success flag');
check(($payload['id'] ?? null) === 7, 'Successful response retains payload data');
check(($payload['message'] ?? '') === 'Đã lưu', 'Legacy second-argument message is preserved');

ob_start();
Response::ok(['id' => 7], true);
$prettyJson = (string)ob_get_clean();
check(str_contains($prettyJson, "\n"), 'Boolean pretty-print argument remains compatible');

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d response contract regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll response contract regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
