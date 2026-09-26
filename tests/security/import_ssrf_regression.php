<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/import_helpers.php';

$cases = [
    'file:///etc/passwd' => false,
    'gopher://127.0.0.1/' => false,
    'http://localhost/admin' => false,
    'http://127.0.0.1/' => false,
    'http://10.0.0.1/' => false,
    'http://172.16.0.1/' => false,
    'http://192.168.1.1/' => false,
    'http://169.254.169.254/latest/meta-data/' => false,
    'http://[::1]/' => false,
    'http://example.com:8080/file.xml' => false,
    'https://8.8.8.8/file.xml' => true,
];

$failed = 0;
foreach ($cases as $url => $expected) {
    $actual = _isSafeRemoteUrl($url);
    if ($actual !== $expected) {
        echo "FAIL: {$url}\n";
        $failed++;
    } else {
        echo "PASS: {$url}\n";
    }
}

$source = file_get_contents(dirname(__DIR__, 2) . '/api/import_helpers.php');
$checks = [
    'redirects are handled manually' => str_contains($source, 'CURLOPT_FOLLOWLOCATION => false'),
    'TLS certificates are verified' => str_contains($source, 'CURLOPT_SSL_VERIFYPEER => true'),
    'response size is bounded' => str_contains($source, '$maxBytes = 10485760'),
    'DNS target is pinned for the request' => str_contains($source, 'CURLOPT_RESOLVE'),
];
foreach ($checks as $label => $passed) {
    echo ($passed ? 'PASS: ' : 'FAIL: ') . $label . "\n";
    if (!$passed) $failed++;
}

if ($failed > 0) {
    fwrite(STDERR, "\n{$failed} import SSRF regression test(s) failed.\n");
    exit(1);
}

echo "\nAll import SSRF regression tests passed.\n";
echo "\nSUITE_COMPLETE total=15\n";
