<?php
/**
 * api/import_helpers.php
 * Chứa các hàm tiện ích cho việc parse MusicXML, lưu lịch sử bài hát, tạo slug, v.v.
 */

function _isSafeRemoteUrl(string $url): bool {
    $parts = parse_url($url);
    if ($parts === false || !isset($parts['scheme'], $parts['host'])) return false;
    if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) return false;
    if (isset($parts['user']) || isset($parts['pass'])) return false;

    $port = $parts['port'] ?? (strtolower($parts['scheme']) === 'https' ? 443 : 80);
    if (!in_array($port, [80, 443], true)) return false;

    $host = strtolower(rtrim($parts['host'], '.'));
    if ($host === 'localhost' || str_ends_with($host, '.localhost')) return false;

    $ips = filter_var($host, FILTER_VALIDATE_IP)
        ? [$host]
        : (gethostbynamel($host) ?: []);
    if ($ips === []) return false;

    foreach ($ips as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return false;
        }
    }
    return true;
}

function _fetchUrl(string $url, int $timeout = 15, int $maxBytes = 10485760): string|false {
    for ($redirects = 0; $redirects <= 3; $redirects++) {
        if (!_isSafeRemoteUrl($url)) return false;

        $parts = parse_url($url);
        $host = strtolower(rtrim($parts['host'], '.'));
        $port = $parts['port'] ?? (strtolower($parts['scheme']) === 'https' ? 443 : 80);
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : (gethostbynamel($host)[0] ?? null);
        if ($ip === null) return false;

        $body = '';
        $location = null;
        $tooLarge = false;
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => min($timeout, 10),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'SheetApp/1.0 MusicXML Importer',
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/xml,application/zip'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_RESOLVE => [sprintf('%s:%d:%s', $host, $port, $ip)],
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$location): int {
                if (stripos($line, 'Location:') === 0) $location = trim(substr($line, 9));
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, &$tooLarge, $maxBytes): int {
                if (strlen($body) + strlen($chunk) > $maxBytes) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if ($tooLarge || $ok === false) return false;
        if ($status >= 300 && $status < 400 && $location !== null) {
            $url = _resolveUrl($location, $url);
            continue;
        }
        return $status >= 200 && $status < 300 ? $body : false;
    }
    return false;
}

function _isValidMusicXML(string $content, string $ext): bool {
    if (empty($content)) return false;
    if ($ext === 'mxl') return substr($content, 0, 2) === 'PK';

    $previous = libxml_use_internal_errors(true);
    $document = new DOMDocument();
    $loaded = $document->loadXML($content, LIBXML_NONET | LIBXML_NOBLANKS | LIBXML_COMPACT);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$loaded || $document->documentElement === null) return false;

    $root = strtolower($document->documentElement->localName);
    if (!in_array($root, ['score-partwise', 'score-timewise'], true)) return false;

    $blockedElements = ['script', 'iframe', 'object', 'embed', 'foreignobject'];
    foreach ($document->getElementsByTagName('*') as $element) {
        if (in_array(strtolower($element->localName), $blockedElements, true)) return false;
        foreach ($element->attributes ?? [] as $attribute) {
            $name = strtolower($attribute->localName);
            $value = strtolower(trim($attribute->value));
            if (str_starts_with($name, 'on')) return false;
            if (in_array($name, ['href', 'src'], true) && preg_match('#^(?:javascript|data|file):#i', $value)) {
                return false;
            }
        }
    }
    return true;
}

function _detectKey(string $xmlContent): string {
    if (preg_match('/<fifths>(-?\d+)<\/fifths>/', $xmlContent, $m)) {
        $fifths = (int)$m[1];
        $keys   = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
        $idx    = $fifths + 7;
        return $keys[$idx] ?? 'C';
    }
    return '';
}

function _extractTitle(string $html): string {
    if (preg_match('/<title>([^<]+)<\/title>/i', $html, $m)) {
        $t = html_entity_decode(trim($m[1]));
        $t = preg_replace('/\s*[|–-].*$/', '', $t);
        return trim($t);
    }
    if (preg_match('/<h1[^>]*>([^<]+)<\/h1>/i', $html, $m)) {
        return html_entity_decode(trim(strip_tags($m[1])));
    }
    return '';
}

function _resolveUrl(string $url, string $baseUrl): string {
    if (preg_match('#^https?://#i', $url)) return $url;
    $parsed = parse_url($baseUrl);
    $base   = $parsed['scheme'] . '://' . $parsed['host'];
    if (str_starts_with($url, '//')) return $parsed['scheme'] . ':' . $url;
    if (str_starts_with($url, '/')) return $base . $url;
    $basePath = dirname($parsed['path'] ?? '/');
    return $base . $basePath . '/' . $url;
}

function _generateFilename(string $title, string $ext): string {
    $slug = _slugify($title);
    $slug = $slug ?: 'sheet-' . time();
    $filename = $slug . '.' . $ext;
    $i = 1;
    while (file_exists(SHEETS_DIR . $filename)) {
        $filename = $slug . '-' . $i++ . '.' . $ext;
    }
    return $filename;
}

function _saveSong($pdo, string $title, string $xmlPath, string $key, string $source): array {
    $id = _slugify($title) ?: 'song-' . time();
    $baseId  = $id;
    $counter = 1;
    while (true) {
        $check = $pdo->prepare("SELECT COUNT(*) FROM songs WHERE id = ?");
        $check->execute([$id]);
        if ($check->fetchColumn() == 0) break;
        $id = $baseId . '-' . $counter++;
    }

    $httlvnId = null; // import thì mặc định ko có unless logic nâng cao
    $stmt = $pdo->prepare("INSERT INTO songs (id, title, httlvnId, xmlPath, defaultKey) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $title, $httlvnId, $xmlPath, $key]);

    return [
        'id'         => $id,
        'title'      => $title,
        'xmlPath'    => $xmlPath,
        'defaultKey' => $key,
        'source'     => $source,
        'dateAdded'  => date('Y-m-d')
    ];
}

function _slugify(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $from = ['à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ','đ',
             'è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ','ì','í','ỉ','ĩ','ị',
             'ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ','ơ','ớ','ợ','ờ','ở','ỡ',
             'ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ','ỳ','ý','ỷ','ỹ','ỵ'];
    $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','d',
             'e','e','e','e','e','e','e','e','e','e','e','i','i','i','i','i',
             'o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o',
             'u','u','u','u','u','u','u','u','u','u','u','y','y','y','y','y'];
    $text = str_replace($from, $to, $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', trim($text));
    return substr($text, 0, 80);
}

function _error(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
