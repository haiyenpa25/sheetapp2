<?php
/**
 * api/import_scrapers.php
 * Chứa logic trích xuất URL hoặc nội dung XML từ các trang web (e.g. thanhca.httlvn.org)
 */

function _guessHttlvnXmlUrl(string $pageUrl, string $html): ?string {
    $parsed = parse_url($pageUrl);
    $base   = $parsed['scheme'] . '://' . $parsed['host'];
    $path   = $parsed['path'] ?? '/';
    $slug   = basename($path);

    $candidates = [];
    if (preg_match('/thanh-ca-(\d+)/i', $path, $numMatch)) {
        $songNum = intval($numMatch[1]);
        $candidates[] = $base . '/Download/SheetMusic/' . $songNum;
    }

    $candidates = array_merge($candidates, [
        $base . $path . '.xml',
        $base . $path . '/sheet.xml',
        $base . '/files/sheets/' . $slug . '.xml',
        $base . '/sites/default/files/' . $slug . '.xml',
        $base . '/storage/sheets/' . $slug . '.xml',
        $base . '/xml/' . $slug . '.xml',
        $base . '/musicxml/' . $slug . '.xml',
        $base . $path . '.mxl',
        str_replace('/thanh-ca-', '/xml/thanh-ca-', $base . $path) . '.xml',
    ]);

    foreach ($candidates as $url) {
        $headers = @get_headers($url, 1);
        if ($headers) {
            $status = $headers[0] ?? '';
            $ct     = strtolower($headers['Content-Type'] ?? $headers['content-type'] ?? '');
            if (strpos($status, '200') !== false &&
                (strpos($ct, 'xml') !== false || strpos($ct, 'octet') !== false || strpos($ct, 'zip') !== false)) {
                return $url;
            }
        }
    }
    return null;
}

function _extractXmlUrl(string $html, string $pageUrl): ?string {
    $patterns = [
        '/osmd\.load\(["\']([^"\']+\.(?:xml|mxl|musicxml)[^"\']*)["\']/',
        '/OpenSheetMusicDisplay[^;]+load\(["\']([^"\']+\.(?:xml|mxl|musicxml)[^"\']*)["\']/',
        '/data-src=["\']([^"\']+\.(?:xml|mxl|musicxml)[^"\']*)["\']/',
        '/data-xml=["\']([^"\']+\.(?:xml|mxl|musicxml)[^"\']*)["\']/',
        '/<script[^>]+src=["\']([^"\']+\.xml)["\']/',
        '/href=["\']([^"\']+\.(?:xml|mxl|musicxml))["\']/',
        '/src=["\']([^"\']+\.(?:xml|mxl|musicxml))["\']/',
        '/"file":\s*"([^"]+\.(?:xml|mxl|musicxml))"/',
        '/"xmlPath":\s*"([^"]+\.(?:xml|mxl|musicxml))"/',
        '/"url":\s*"([^"]+\.(?:xml|mxl|musicxml))"/',
        '/musicxml[_-]?url["\']?\s*[:=]\s*["\']([^"\']+\.(?:xml|mxl|musicxml))["\']/',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $m)) {
            return _resolveUrl($m[1], $pageUrl);
        }
    }
    return null;
}

function _extractXmlFromScript(string $html, string $pageUrl): ?string {
    if (preg_match('/atob\(["\']([A-Za-z0-9+\/=]{100,})["\']/', $html, $m)) {
        $decoded = base64_decode($m[1]);
        if ($decoded && _isValidMusicXML($decoded, 'xml')) {
            $title    = _extractTitle($html) ?: 'import-' . time();
            $filename = _generateFilename($title, 'xml');
            file_put_contents(SHEETS_DIR . $filename, $decoded);
            return 'storage/sheets/' . $filename;
        }
    }

    if (preg_match('/["\'](<\?xml[^"\']{50,})["\']/', $html, $m)) {
        $xml = html_entity_decode($m[1]);
        if (_isValidMusicXML($xml, 'xml')) {
            $title    = _extractTitle($html) ?: 'import-' . time();
            $filename = _generateFilename($title, 'xml');
            file_put_contents(SHEETS_DIR . $filename, $xml);
            return 'storage/sheets/' . $filename;
        }
    }

    return null;
}
