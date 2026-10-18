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
        $content = _fetchUrl($url, 10);
        $extension = str_ends_with(strtolower($url), '.mxl') ? 'mxl' : 'xml';
        if (is_string($content) && _isValidMusicXML($content, $extension)) return $url;
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
            return $decoded;
        }
    }

    if (preg_match('/["\'](<\?xml[^"\']{50,})["\']/', $html, $m)) {
        $xml = html_entity_decode($m[1]);
        if (_isValidMusicXML($xml, 'xml')) {
            return $xml;
        }
    }

    return null;
}
