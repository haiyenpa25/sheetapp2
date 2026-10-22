<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$base = getenv('SHEETAPP_OPT_TEST_URL') ?: '';
if (!preg_match('~^http://(?:127\.0\.0\.1|localhost):\d+/sheetapp2/?$~D', $base)) {
    throw new RuntimeException('An explicit isolated local installation is required');
}
$url = rtrim($base, '/') . '/api/index.php?route=songs';
function catalogRequest(string $method, ?string $etag = null): array {
    global $url;
    $curl = curl_init($url);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_TIMEOUT => 10, CURLOPT_NOBODY => $method === 'HEAD']);
    if ($etag !== null) curl_setopt($curl, CURLOPT_HTTPHEADER, ['If-None-Match: ' . $etag]);
    $response = curl_exec($curl);
    if (!is_string($response)) throw new RuntimeException(curl_error($curl));
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $size = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    curl_close($curl);
    $headers = substr($response, 0, $size);
    preg_match('/^ETag:\s*(.+)\r?$/mi', $headers, $matches);
    return [$status, trim($matches[1] ?? ''), substr($response, $size)];
}
[$status, $etag, $body] = catalogRequest('GET');
$prefix = '{"success":true,"data":';
if ($status !== 200 || !str_starts_with($body, $prefix)) throw new RuntimeException('GET catalog failed');
echo "PASS HTTP catalog GET 200, bytes=" . strlen($body) . "\n";
$json = substr($body, strlen($prefix), -1);
if ($etag !== '"' . hash('sha256', $json) . '"') throw new RuntimeException('ETag does not match exact response snapshot');
echo "PASS ETag matches exact JSON snapshot\n";
foreach ([$etag, 'W/' . $etag, '*'] as $condition) {
    [$status, $current, $body] = catalogRequest('GET', $condition);
    if ($status !== 304 || $current !== $etag || $body !== '') throw new RuntimeException('Conditional catalog GET failed');
    echo "PASS HTTP conditional GET 304 with empty body: {$condition}\n";
}
[$status, $current, $body] = catalogRequest('HEAD');
if ($status !== 200 || $current !== $etag || $body !== '') throw new RuntimeException('HEAD catalog failed');
echo "PASS HTTP HEAD 200 with same ETag and empty body\n";
echo "CATALOG_HTTP_COMPLETE total=6\n";
