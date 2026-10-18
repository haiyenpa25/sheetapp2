<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/import_helpers.php';
$passed = 0;
$failed = 0;
function verifyImport(bool $ok, string $label): void {
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
$temp = sys_get_temp_dir() . '/sheetapp-import-names-' . bin2hex(random_bytes(6));
mkdir($temp);
file_put_contents($temp . '/nhap-thu.xml', 'existing');
try {
    verifyImport(_generateFilename('Nhập thử', 'xml', $temp) === 'nhap-thu-1.xml', 'Filename checks the actual target directory');
} catch (Throwable $error) { verifyImport(false, 'Filename: ' . $error->getMessage()); }
unlink($temp . '/nhap-thu.xml');
rmdir($temp);
try {
    _generateFilename('Nhập thử', 'xml', $temp);
    verifyImport(false, 'Missing realpath must reject filename generation');
} catch (RuntimeException $error) { verifyImport(true, 'Missing realpath is rejected'); }

// Evaluate our source under a test namespace: no real network can be called.
$scraper = substr((string)file_get_contents(__DIR__ . '/../api/import_scrapers.php'), 5);
eval('namespace ImportTvProbe; ' . $scraper);
eval(<<<'PHP'
namespace ImportTvProbe;
function get_headers(...$args) { throw new \RuntimeException('Unguarded get_headers reached'); }
function _fetchUrl(string $url, int $timeout = 10) {
    $GLOBALS['importProbeCalls'][] = $url;
    return parse_url($url, PHP_URL_HOST) === 'example.test' ? $GLOBALS['importProbeXml'] : false;
}
function _isValidMusicXML(string $xml, string $ext): bool { return \_isValidMusicXML($xml, $ext); }
function _extractTitle(string $html): string { return \_extractTitle($html); }
PHP);
$xml = '<?xml version="1.0"?><score-partwise version="4.0"><part-list/><credit><credit-words>Import fixture music</credit-words></credit></score-partwise>';
$GLOBALS['importProbeXml'] = $xml;
$GLOBALS['importProbeCalls'] = [];
try {
    $url = ImportTvProbe\_guessHttlvnXmlUrl('https://example.test/thanh-ca-1', '');
    verifyImport($url === 'https://example.test/Download/SheetMusic/1', 'Candidate probe uses the guarded fetch path');
    verifyImport(count($GLOBALS['importProbeCalls']) === 1, 'First valid candidate stops probing');
    verifyImport(ImportTvProbe\_guessHttlvnXmlUrl('http://127.0.0.1/song', '') === null, 'Rejected private candidates cannot become an import URL');
} catch (Throwable $error) { verifyImport(false, 'Probe: ' . $error->getMessage()); }
try {
    $html = '<script>var score=atob("' . base64_encode($xml) . '")</script>';
    verifyImport(ImportTvProbe\_extractXmlFromScript($html, 'https://example.test/song') === $xml, 'Embedded extraction returns XML without writing storage');
} catch (Throwable $error) { verifyImport(false, 'Embedded extraction: ' . $error->getMessage()); }
verifyImport(ImportTvProbe\_extractXmlFromScript('<script>var x="bad";</script>', 'https://example.test') === null, 'Invalid embedded input returns null');
echo "SUITE_COMPLETE total=" . ($passed + $failed) . "\n";
exit($failed ? 1 : 0);
