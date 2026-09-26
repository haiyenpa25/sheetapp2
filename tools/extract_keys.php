<?php
/**
 * extract_keys.php
 * Đọc tất cả file XML trong storage/Thanh ca/
 * Trích xuất key signature → cập nhật songs.json
 * Chạy: php tools/extract_keys.php
 *       hoặc truy cập http://localhost/SheetApp/tools/extract_keys.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Map từ fifths + mode → tên key
// fifths: -7..+7, mode: major/minor
$keyMap = [
    // major
    '-7-major' => 'Cb', '-6-major' => 'Gb', '-5-major' => 'Db',
    '-4-major' => 'Ab', '-3-major' => 'Eb', '-2-major' => 'Bb',
    '-1-major' => 'F',   '0-major'  => 'C',  '1-major'  => 'G',
     '2-major' => 'D',   '3-major'  => 'A',  '4-major'  => 'E',
     '5-major' => 'B',   '6-major'  => 'F#', '7-major'  => 'C#',
    // minor
    '-7-minor' => 'Abm', '-6-minor' => 'Ebm', '-5-minor' => 'Bbm',
    '-4-minor' => 'Fm',  '-3-minor' => 'Cm',  '-2-minor' => 'Gm',
    '-1-minor' => 'Dm',   '0-minor'  => 'Am',  '1-minor'  => 'Em',
     '2-minor' => 'Bm',   '3-minor'  => 'F#m', '4-minor'  => 'C#m',
     '5-minor' => 'G#m',  '6-minor'  => 'D#m', '7-minor'  => 'A#m',
];

$projectRoot = dirname(__DIR__);
$sheetsDir   = $projectRoot . '/storage/Thanh ca/';
$songsFile   = $projectRoot . '/storage/data/songs.json';

if (!file_exists($songsFile)) {
    die("Không tìm thấy songs.json\n");
}

$songs = json_decode(file_get_contents($songsFile), true);
if (!is_array($songs)) die("songs.json không hợp lệ\n");

$updated = 0;
$errors  = 0;
$skipped = 0;

$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    echo "=== Extract Keys từ MusicXML ===\n\n";
}

foreach ($songs as &$song) {
    $xmlPath = $projectRoot . '/' . $song['xmlPath'];

    // Thử đọc đường dẫn từ xmlPath
    if (!file_exists($xmlPath)) {
        // Thử tìm theo httlvnId
        if (!empty($song['httlvnId'])) {
            $pattern = $sheetsDir . $song['httlvnId'] . ' *.xml';
            $found   = glob($pattern);
            if ($found) $xmlPath = $found[0];
            else { $errors++; continue; }
        } else {
            $errors++;
            continue;
        }
    }

    // Parse XML
    libxml_use_internal_errors(true);
    $xml = simplexml_load_file($xmlPath);
    if (!$xml) {
        $errors++;
        continue;
    }

    // Tìm <key> đầu tiên
    $keyNodes = $xml->xpath('//key');
    if (empty($keyNodes)) {
        $skipped++;
        continue;
    }

    $fifths = (int) $keyNodes[0]->fifths;
    $mode   = strtolower(trim((string) ($keyNodes[0]->mode ?? 'major')));
    if (!$mode) $mode = 'major';

    $mapKey = "$fifths-$mode";
    $keyName = $keyMap[$mapKey] ?? null;

    if ($keyName === null) {
        $skipped++;
        continue;
    }

    if ($song['defaultKey'] !== $keyName) {
        $song['defaultKey'] = $keyName;
        $updated++;
        if ($isCli) echo "[OK] #{$song['httlvnId']} {$song['title']} → {$keyName}\n";
    } else {
        $skipped++;
    }
}
unset($song);

// Ghi lại songs.json
file_put_contents($songsFile, json_encode(array_values($songs), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

$total = count($songs);
echo "\n=== XONG ===\n";
echo "Tổng bài : $total\n";
echo "Đã cập nhật: $updated\n";
echo "Đã có rồi  : $skipped\n";
echo "Lỗi đọc   : $errors\n";
