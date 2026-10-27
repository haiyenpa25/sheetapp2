<?php
declare(strict_types=1);
$checks = 0;
function gzipCheck(bool $ok, string $label, bool $behavioral = true): void {
    global $checks;
    ++$checks;
    $kind = $behavioral ? 'B' : 'S';
    echo ($ok ? "[PASS:{$kind}] " : "[FAIL:{$kind}] ") . $label . "\n";
    if (!$ok) exit(1);
}
function gzipHeader(array $headers, string $name): string {
    foreach ($headers as $header) {
        if (stripos($header, $name . ':') === 0) return trim(substr($header, strlen($name) + 1));
    }
    return '';
}
function gzipRead(string $url, string $accept, string $extra = ''): array {
    $context = stream_context_create(['http' => ['header' => "Accept-Encoding: {$accept}\r\n{$extra}", 'ignore_errors' => true, 'timeout' => 10]]);
    $body = file_get_contents($url, false, $context);
    return [$body, $http_response_header ?? []];
}
$root = dirname(__DIR__);
$files = ['assets/js/vendor/opensheetmusicdisplay.min.js', 'assets/css/sheet.css', 'assets/css/layout.css', 'assets/css/library-polish.css'];
foreach ($files as $file) {
    gzipCheck(is_file($root . '/' . $file . '.gz'), "sidecar exists: {$file}", false);
    $source = file_get_contents($root . '/' . $file);
    $compressed = file_get_contents($root . '/' . $file . '.gz');
    gzipCheck(gzdecode($compressed) === $source, "gunzip is byte-identical: {$file}");
    gzipCheck(strlen($compressed) < strlen($source) / 2, "sidecar cuts transport by more than half: {$file}");
}
$base = getenv('SHEETAPP_TEST_URL');
if (!$base) { echo "[SKIP] HTTP requires explicit isolated SHEETAPP_TEST_URL\nSUITE_COMPLETE total={$checks}\n"; exit; }
foreach ($files as $file) {
    $source = file_get_contents($root . '/' . $file);
    $url = rtrim($base, '/') . '/' . $file . '?v=tv24';
    [$gzip, $gzipHeaders] = gzipRead($url, 'gzip');
    gzipCheck(str_contains($gzipHeaders[0] ?? '', '200') && gzipHeader($gzipHeaders, 'Content-Encoding') === 'gzip', "HTTP serves gzip: {$file}");
    gzipCheck(gzdecode($gzip) === $source && strlen($gzip) < strlen($source) / 2, "HTTP gzip decodes exactly: {$file}");
    $mime = str_ends_with($file, '.js') ? 'text/javascript' : 'text/css';
    gzipCheck(str_starts_with(gzipHeader($gzipHeaders, 'Content-Type'), $mime), "HTTP preserves MIME: {$file}");
    gzipCheck(stripos(gzipHeader($gzipHeaders, 'Vary'), 'Accept-Encoding') !== false, "HTTP declares encoding variance: {$file}");
    [$identity, $identityHeaders] = gzipRead($url, 'identity');
    gzipCheck($identity === $source && gzipHeader($identityHeaders, 'Content-Encoding') === '', "identity stays uncompressed: {$file}");
    [$disabled, $disabledHeaders] = gzipRead($url, 'br, gzip;q=0, identity');
    gzipCheck($disabled === $source && gzipHeader($disabledHeaders, 'Content-Encoding') === '', "gzip q=0 is respected: {$file}");
    gzipCheck(stripos(gzipHeader($identityHeaders, 'Vary'), 'Accept-Encoding') !== false, "identity also declares variance: {$file}");
    $gzipEtag = gzipHeader($gzipHeaders, 'ETag');
    $identityEtag = gzipHeader($identityHeaders, 'ETag');
    gzipCheck($gzipEtag !== '' && $identityEtag !== '' && $gzipEtag !== $identityEtag, "representations have distinct ETags: {$file}");
    [$notModified, $conditional] = gzipRead($url, 'gzip', "If-None-Match: {$gzipEtag}\r\n");
    gzipCheck(str_contains($conditional[0] ?? '', '304') && ($notModified === '' || $notModified === false), "gzip conditional request returns 304 without an entity body: {$file}");
    [$different, $crossVariant] = gzipRead($url, 'identity', "If-None-Match: {$gzipEtag}\r\n");
    gzipCheck(str_contains($crossVariant[0] ?? '', '200') && $different === $source, "gzip ETag does not suppress identity: {$file}");
    [$range, $rangeHeaders] = gzipRead($url, 'gzip', "Range: bytes=0-19\r\n");
    gzipCheck(str_contains($rangeHeaders[0] ?? '', '206') && $range === substr($source, 0, 20), "range stays a valid identity range: {$file}");
}
echo "SUITE_COMPLETE total={$checks}\n";
