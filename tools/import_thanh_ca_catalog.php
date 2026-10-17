<?php
/**
 * tools/import_thanh_ca_catalog.php
 *
 * Công cụ nhập danh mục và bài hát từ docs/Thanh-ca/catalog.json vào thư viện SheetApp2:
 * - Đồng bộ 7 danh mục (Thánh ca, Tôn Vinh Chúa Hằng Hữu, Biệt Thánh Ca, Ca Khúc Chúc Tôn,
 *   Kinh Thánh Đối Đáp, NS Trương Văn Xê, Hillsongs - Worship).
 * - Giữ nguyên 100% 903 bài Thánh ca (category_id = 1) hiện có.
 * - Sao chép 595 file MusicXML bản gốc của các thể loại mới vào storage/Thanh ca/<categorySlug>/.
 * - Tự động sinh file MusicXML chuẩn (chứa <harmony> hợp âm và <lyric> lời) cho 233 bài chỉ có
 *   lời/hợp âm trong docs/Thanh-ca/songs_xml/ để hiển thị mượt trên cả Bản nhạc & Lời+Hợp âm.
 * - Đồng bộ bảng songs, user_chord_sets (bộ HD) và chỉ mục tìm kiếm FTS5 (songs_fts).
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Forbidden: CLI only\n");
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';

$root = dirname(__DIR__);
$catalogFile = $root . '/docs/Thanh-ca/catalog.json';
if (!file_exists($catalogFile)) {
    fwrite(STDERR, "Không tìm thấy file catalog: {$catalogFile}\n");
    exit(1);
}

$catalog = json_decode((string)file_get_contents($catalogFile), true);
if (!is_array($catalog) || empty($catalog['songs'])) {
    fwrite(STDERR, "Nội dung catalog.json không hợp lệ\n");
    exit(1);
}

$pdo = DB::pdo();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// 1. Định nghĩa 7 danh mục chuẩn
$categoryDefs = [
    'thanh-ca-tin-lanh' => [
        'id'            => 1,
        'name'          => 'Thánh ca',
        'slug'          => 'thanh-ca',
        'icon'          => '🎵',
        'description'   => 'Thánh Ca Hội Thánh Tin Lành Việt Nam (903 bài)',
        'display_order' => 1,
    ],
    'ton-vinh-chua-hang-huu' => [
        'id'            => 2,
        'name'          => 'Tôn Vinh Chúa Hằng Hữu',
        'slug'          => 'ton-vinh-chua-hang-huu',
        'icon'          => '🙌',
        'description'   => 'Tuyển tập Tôn Vinh Chúa Hằng Hữu (387 bài)',
        'display_order' => 2,
    ],
    'biet-thanh-ca' => [
        'id'            => 3,
        'name'          => 'Biệt Thánh Ca',
        'slug'          => 'biet-thanh-ca',
        'icon'          => '🎼',
        'description'   => 'Biệt Thánh Ca & Hợp Xướng (206 bài)',
        'display_order' => 3,
    ],
    'ca-khuc-chuc-ton' => [
        'id'            => 4,
        'name'          => 'Ca Khúc Chúc Tôn',
        'slug'          => 'ca-khuc-chuc-ton',
        'icon'          => '✨',
        'description'   => 'Tuyển tập Ca Khúc Chúc Tôn (105 bài)',
        'display_order' => 4,
    ],
    'kinh-thanh-doi-dap' => [
        'id'            => 5,
        'name'          => 'Kinh Thánh Đối Đáp',
        'slug'          => 'kinh-thanh-doi-dap',
        'icon'          => '📖',
        'description'   => 'Kinh Thánh Đối Đáp Phụng Vụ (100 bài)',
        'display_order' => 5,
    ],
    'ns-truong-van-xe' => [
        'id'            => 6,
        'name'          => 'NS Trương Văn Xê',
        'slug'          => 'ns-truong-van-xe',
        'icon'          => '🎹',
        'description'   => 'Sáng tác của Nhạc sĩ Trương Văn Xê (28 bài)',
        'display_order' => 6,
    ],
    'hillsongs-worship' => [
        'id'            => 7,
        'name'          => 'Hillsongs - Worship',
        'slug'          => 'hillsongs-worship',
        'icon'          => '🎸',
        'description'   => 'Ca khúc thờ phượng Hillsongs (2 bài)',
        'display_order' => 7,
    ],
];

$keyMap = [
    '-7-major' => 'Cb', '-6-major' => 'Gb', '-5-major' => 'Db',
    '-4-major' => 'Ab', '-3-major' => 'Eb', '-2-major' => 'Bb',
    '-1-major' => 'F',   '0-major' => 'C',   '1-major' => 'G',
     '2-major' => 'D',   '3-major' => 'A',   '4-major' => 'E',
     '5-major' => 'B',   '6-major' => 'F#',  '7-major' => 'C#',
    '-7-minor' => 'Abm','-6-minor' => 'Ebm','-5-minor' => 'Bbm',
    '-4-minor' => 'Fm', '-3-minor' => 'Cm', '-2-minor' => 'Gm',
    '-1-minor' => 'Dm',  '0-minor' => 'Am',  '1-minor' => 'Em',
     '2-minor' => 'Bm',  '3-minor' => 'F#m', '4-minor' => 'C#m',
     '5-minor' => 'G#m', '6-minor' => 'D#m', '7-minor' => 'A#m',
];

$reverseKeyMap = [
    'C' => [0, 'major'], 'G' => [1, 'major'], 'D' => [2, 'major'], 'A' => [3, 'major'],
    'E' => [4, 'major'], 'B' => [5, 'major'], 'F#' => [6, 'major'], 'C#' => [7, 'major'],
    'F' => [-1, 'major'], 'Bb' => [-2, 'major'], 'Eb' => [-3, 'major'], 'Ab' => [-4, 'major'],
    'Db' => [-5, 'major'], 'Gb' => [-6, 'major'], 'Cb' => [-7, 'major'],
    'Am' => [0, 'minor'], 'Em' => [1, 'minor'], 'Bm' => [2, 'minor'], 'F#m' => [3, 'minor'],
    'C#m' => [4, 'minor'], 'G#m' => [5, 'minor'], 'D#m' => [6, 'minor'], 'A#m' => [7, 'minor'],
    'Dm' => [-1, 'minor'], 'Gm' => [-2, 'minor'], 'Cm' => [-3, 'minor'], 'Fm' => [-4, 'minor'],
    'Bbm' => [-5, 'minor'], 'Ebm' => [-6, 'minor'], 'Abm' => [-7, 'minor'],
];

function cleanSongTitle(string $rawTitle, ?int &$extractedNum = null): string {
    $t = trim($rawTitle);
    $extractedNum = null;
    if (preg_match('/^0*(\d{1,3})\s+(.+)$/u', $t, $m)) {
        $extractedNum = (int)$m[1];
        $t = trim($m[2]);
    }
    // Chuẩn hóa chính tả & khoảng trắng trước dấu câu (tuân thủ L6-5)
    $t = str_replace(['NGUYỀN', 'Nguyền', 'nguyền'], ['NGUYỆN', 'Nguyện', 'nguyện'], $t);
    $t = (string)preg_replace('/\s+([!?])/u', '$1', $t);
    return trim($t);
}

/**
 * Chuyển hợp âm dạng chuỗi (VD: Am7, D7/F#, G) thành thẻ <harmony> MusicXML
 */
function buildHarmonyXml(string $chordStr): string {
    $chordStr = trim($chordStr);
    if (!preg_match('/^([A-G])([#b]?)([^\/]*)(?:\/([A-G])([#b]?))?$/', $chordStr, $m)) {
        return '';
    }
    $rootStep = $m[1];
    $rootAlter = $m[2] === '#' ? 1 : ($m[2] === 'b' ? -1 : 0);
    $suffix = trim($m[3]);
    $bassStep = $m[4] ?? '';
    $bassAlter = ($m[5] ?? '') === '#' ? 1 : (($m[5] ?? '') === 'b' ? -1 : 0);

    $kindVal = 'major';
    if ($suffix === 'm' || str_starts_with($suffix, 'm')) $kindVal = 'minor';
    if (str_contains($suffix, 'maj7') || str_contains($suffix, 'M7')) $kindVal = 'major-seventh';
    elseif (str_contains($suffix, 'm7')) $kindVal = 'minor-seventh';
    elseif (str_contains($suffix, '7')) $kindVal = 'dominant';
    elseif (str_contains($suffix, 'dim')) $kindVal = 'diminished';
    elseif (str_contains($suffix, 'aug')) $kindVal = 'augmented';
    elseif (str_contains($suffix, 'sus4') || $suffix === 'sus') $kindVal = 'suspended-fourth';
    elseif (str_contains($suffix, 'sus2')) $kindVal = 'suspended-second';

    $xml = "      <harmony>\n        <root>\n          <root-step>{$rootStep}</root-step>\n";
    if ($rootAlter !== 0) {
        $xml .= "          <root-alter>{$rootAlter}</root-alter>\n";
    }
    $xml .= "        </root>\n";
    $safeSuffix = htmlspecialchars($suffix, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $xml .= "        <kind text=\"{$safeSuffix}\">{$kindVal}</kind>\n";
    if ($bassStep !== '') {
        $xml .= "        <bass>\n          <bass-step>{$bassStep}</bass-step>\n";
        if ($bassAlter !== 0) {
            $xml .= "          <bass-alter>{$bassAlter}</bass-alter>\n";
        }
        $xml .= "        </bass>\n";
    }
    $xml .= "      </harmony>\n";
    return $xml;
}

/**
 * Sinh file MusicXML hợp lệ từ lời & hợp âm ChordPro (cho các bài chỉ có lời/hợp âm)
 * @return array{xml: string, chords: list<array{measureIdx: int, noteIdx: int, chord: string}>}
 */
function generateMusicXmlFromChordPro(string $title, string $keyStr, string $chordProText, string $plainLyrics, array $reverseKeyMap): array {
    $fifths = 0;
    $mode = 'major';
    if ($keyStr !== '' && isset($reverseKeyMap[$keyStr])) {
        [$fifths, $mode] = $reverseKeyMap[$keyStr];
    }

    $sourceText = trim($chordProText) !== '' ? $chordProText : $plainLyrics;
    $rawLines = preg_split('/\r?\n/', $sourceText) ?: [];

    // Bỏ dòng đầu nếu trùng tiêu đề in hoa
    if (!empty($rawLines)) {
        $firstClean = trim((string)preg_replace('/\[[^\]]+\]/', '', $rawLines[0]));
        if (mb_strtolower($firstClean, 'UTF-8') === mb_strtolower($title, 'UTF-8')) {
            array_shift($rawLines);
        }
    }

    $measuresXml = '';
    $chordsList = [];
    $measureIdx = 0;

    foreach ($rawLines as $line) {
        $line = trim($line);
        if ($line === '') continue;

        // Tách thành cặp [Chord] + các từ
        $pattern = '/(?:\[([^\]]+)\])?([^\[]+)/u';
        if (!preg_match_all($pattern, $line, $matches, PREG_SET_ORDER)) {
            continue;
        }

        $tokensInLine = [];
        foreach ($matches as $match) {
            $chord = trim($match[1] ?? '');
            $words = preg_split('/\s+/u', trim($match[2] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if (empty($words) && $chord !== '') {
                $tokensInLine[] = ['chord' => $chord, 'word' => ''];
            } else {
                foreach ($words as $wIdx => $w) {
                    $tokensInLine[] = [
                        'chord' => $wIdx === 0 ? $chord : '',
                        'word'  => $w,
                    ];
                }
            }
        }

        if (empty($tokensInLine)) continue;

        // Chia mỗi 4 từ thành 1 ô nhịp (measure) để bản nhạc thoáng và dễ đọc
        $chunks = array_chunk($tokensInLine, 4);
        foreach ($chunks as $chunk) {
            $mNum = $measureIdx + 1;
            $measuresXml .= "    <measure number=\"{$mNum}\">\n";
            if ($measureIdx === 0) {
                $measuresXml .= "      <attributes>\n";
                $measuresXml .= "        <divisions>1</divisions>\n";
                $measuresXml .= "        <key><fifths>{$fifths}</fifths><mode>{$mode}</mode></key>\n";
                $measuresXml .= "        <time><beats>4</beats><beat-type>4</beat-type></time>\n";
                $measuresXml .= "        <clef><sign>G</sign><line>2</line></clef>\n";
                $measuresXml .= "      </attributes>\n";
            }

            $noteIdx = 0;
            foreach ($chunk as $tok) {
                if ($tok['chord'] !== '') {
                    $hXml = buildHarmonyXml($tok['chord']);
                    if ($hXml !== '') {
                        $measuresXml .= $hXml;
                        $chordsList[] = [
                            'measureIdx' => $measureIdx,
                            'noteIdx'    => $noteIdx,
                            'chord'      => $tok['chord'],
                        ];
                    }
                }
                $safeWord = htmlspecialchars($tok['word'] !== '' ? $tok['word'] : ' ', ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $measuresXml .= "      <note>\n";
                $measuresXml .= "        <pitch><step>G</step><octave>4</octave></pitch>\n";
                $measuresXml .= "        <duration>1</duration>\n";
                $measuresXml .= "        <type>quarter</type>\n";
                if ($tok['word'] !== '') {
                    $measuresXml .= "        <lyric number=\"1\"><syllabic>single</syllabic><text>{$safeWord}</text></lyric>\n";
                }
                $measuresXml .= "      </note>\n";
                $noteIdx++;
            }
            $measuresXml .= "    </measure>\n";
            $measureIdx++;
        }
    }

    if ($measureIdx === 0) {
        $measuresXml = "    <measure number=\"1\">\n      <attributes><divisions>1</divisions><key><fifths>{$fifths}</fifths><mode>{$mode}</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n      <note><rest/><duration>4</duration><type>whole</type></note>\n    </measure>\n";
    }

    $safeTitle = htmlspecialchars($title, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
  <movement-title>{$safeTitle}</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
{$measuresXml}  </part>
</score-partwise>
XML;

    return ['xml' => $xml, 'chords' => $chordsList];
}

echo "=== NHẬP KHO BÀI HÁT & THỂ LOẠI TỪ docs/Thanh-ca/catalog.json ===\n\n";

$pdo->beginTransaction();

// Cập nhật bảng categories
$upsertCatStmt = $pdo->prepare("
    INSERT INTO categories (id, name, slug, icon, description, display_order)
    VALUES (:id, :name, :slug, :icon, :desc, :ord)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        icon = excluded.icon,
        description = excluded.description,
        display_order = excluded.display_order
");

foreach ($categoryDefs as $cat) {
    $upsertCatStmt->execute([
        ':id'   => $cat['id'],
        ':name' => $cat['name'],
        ':slug' => $cat['slug'],
        ':icon' => $cat['icon'],
        ':desc' => $cat['description'],
        ':ord'  => $cat['display_order'],
    ]);
}
echo "✅ Đã đồng bộ 7 danh mục trong bảng categories.\n";

$insertSongStmt = $pdo->prepare("
    INSERT INTO songs (id, title, httlvnId, xmlPath, defaultKey, category_id, lyrics_text, composer)
    VALUES (:id, :title, :num, :xmlPath, :key, :catId, :lyrics, :composer)
    ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        httlvnId = excluded.httlvnId,
        xmlPath = excluded.xmlPath,
        defaultKey = excluded.defaultKey,
        category_id = excluded.category_id,
        lyrics_text = excluded.lyrics_text,
        composer = COALESCE(excluded.composer, songs.composer)
");

$checkHdStmt = $pdo->prepare("SELECT id FROM user_chord_sets WHERE song_id = ? AND set_name = 'HD'");
$insertHdStmt = $pdo->prepare("
    INSERT INTO user_chord_sets (song_id, user_id, username, set_name, instrument_type, capo_fret, custom_tempo, chord_count, notes_guide, chords_json, is_public, is_recommended, attribution, checksum)
    VALUES (?, 4, 'hoaidinh', 'HD', 'guitar', 0, 80, ?, 'Bộ hợp âm chuẩn của Hoài Dinh (mặc định)', ?, 1, 1, 'Bản phối chuẩn HD của Hoài Dinh', ?)
");

$statsByCat = [];
$copiedXml = 0;
$generatedXml = 0;

foreach ($catalog['songs'] as $item) {
    $catSlug = (string)($item['categorySlug'] ?? '');
    if ($catSlug === 'thanh-ca-tin-lanh' || !isset($categoryDefs[$catSlug])) {
        // Giữ nguyên 903 bài Thánh Ca Tin Lành hiện có
        continue;
    }

    $catId = $categoryDefs[$catSlug]['id'];
    $slug = (string)$item['slug'];
    $songId = $catSlug . '--' . $slug;

    $extractedNum = null;
    $cleanTitle = cleanSongTitle((string)$item['title'], $extractedNum);

    // Đọc thông tin bổ sung từ songs_xml (key, lyricsWithChords, plainLyrics)
    $songXmlRel = (string)($item['songXmlFile'] ?? "songs_xml/{$catSlug}/{$slug}.xml");
    $songXmlAbs = $root . '/docs/Thanh-ca/' . $songXmlRel;
    $metaKey = '';
    $chordProText = '';
    $plainLyrics = '';
    if (file_exists($songXmlAbs)) {
        $sXml = @simplexml_load_file($songXmlAbs);
        if ($sXml) {
            $metaKey = trim((string)($sXml->key ?? ''));
            $chordProText = trim((string)($sXml->lyricsWithChords ?? ''));
            $plainLyrics = trim((string)($sXml->plainLyrics ?? ''));
        }
    }

    // Xác định thư mục đích trong storage/Thanh ca/<catSlug>
    $targetDir = $root . '/storage/Thanh ca/' . $catSlug;
    if (!is_dir($targetDir)) {
        @mkdir($targetDir, 0755, true);
    }
    $targetRelPath = "storage/Thanh ca/{$catSlug}/{$slug}.xml";
    $targetAbsPath = $targetDir . '/' . $slug . '.xml';

    // Chọn file MusicXML gốc hợp lệ (nếu có)
    $sourceMusicXml = null;
    $files = $item['files'] ?? [];
    if (!empty($item['hasSheet']) && is_array($files) && count($files) > 0) {
        if ($slug === '001-xin-than-linh-den' && isset($files[1]['file'])) {
            $sourceMusicXml = $root . '/docs/Thanh-ca/' . $files[1]['file'];
        } else {
            foreach ($files as $f) {
                $cand = $root . '/docs/Thanh-ca/' . ($f['file'] ?? '');
                if (file_exists($cand) && filesize($cand) >= 1000) {
                    $sourceMusicXml = $cand;
                    break;
                }
            }
        }
    }

    $composer = null;
    $defaultKey = $metaKey !== '' ? $metaKey : 'C';
    $seedChords = [];

    if ($sourceMusicXml && file_exists($sourceMusicXml)) {
        if (!file_exists($targetAbsPath) || filesize($targetAbsPath) !== filesize($sourceMusicXml)) {
            copy($sourceMusicXml, $targetAbsPath);
        }
        $copiedXml++;

        // Đọc key và composer từ MusicXML nếu có
        $mXml = @simplexml_load_file($targetAbsPath);
        if ($mXml) {
            $keyNodes = $mXml->xpath('//key');
            if (!empty($keyNodes)) {
                $fifths = (int)$keyNodes[0]->fifths;
                $mode = strtolower(trim((string)($keyNodes[0]->mode ?? 'major'))) ?: 'major';
                $mapped = $keyMap["{$fifths}-{$mode}"] ?? null;
                if ($mapped && $metaKey === '') {
                    $defaultKey = $mapped;
                }
            }
            foreach ($mXml->xpath('//identification/creator') as $cr) {
                if ((string)($cr['type'] ?? '') === 'composer') {
                    $composer = trim((string)$cr);
                    break;
                }
            }
            if ($plainLyrics === '') {
                $plainLyrics = SongSearchHelper::extractLyricsByVerse((string)file_get_contents($targetAbsPath));
            }
        }
    } else {
        // Bài chưa có bản nhạc MusicXML -> Sinh file MusicXML từ lời & hợp âm
        $gen = generateMusicXmlFromChordPro($cleanTitle, $defaultKey, $chordProText, $plainLyrics, $reverseKeyMap);
        file_put_contents($targetAbsPath, $gen['xml']);
        $seedChords = $gen['chords'];
        $generatedXml++;
    }

    $insertSongStmt->execute([
        ':id'       => $songId,
        ':title'    => $cleanTitle,
        ':num'      => $extractedNum,
        ':xmlPath'  => $targetRelPath,
        ':key'      => $defaultKey,
        ':catId'    => $catId,
        ':lyrics'   => $plainLyrics,
        ':composer' => $composer,
    ]);

    // Đảm bảo có bộ hợp âm HD trong user_chord_sets
    $checkHdStmt->execute([$songId]);
    if (!$checkHdStmt->fetchColumn()) {
        $chordsJson = json_encode($seedChords, JSON_UNESCAPED_UNICODE);
        $insertHdStmt->execute([$songId, count($seedChords), $chordsJson, md5($chordsJson)]);
    }

    $statsByCat[$catSlug] = ($statsByCat[$catSlug] ?? 0) + 1;
}

$pdo->commit();

echo "✅ Đã sao chép {$copiedXml} file MusicXML gốc và khởi tạo {$generatedXml} file MusicXML từ lời/hợp âm.\n";
echo "🔄 Đang đồng bộ lại chỉ mục tìm kiếm FTS5 (songs_fts)...\n";
$ftsCount = SongSearchHelper::rebuildFtsIndex();
SongService::invalidateCache();

echo "✅ Đã cập nhật FTS5 cho {$ftsCount} bài hát và xóa cache cũ.\n\n";
echo "Thống kê số bài hát theo danh mục hiện có trong thư viện:\n";
$rows = $pdo->query("SELECT c.id, c.name, c.slug, COUNT(s.id) as total FROM categories c LEFT JOIN songs s ON s.category_id = c.id GROUP BY c.id ORDER BY c.display_order ASC")->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    printf("  [%d] %-26s (%-24s): %4d bài\n", $r['id'], $r['name'], $r['slug'], $r['total']);
}
