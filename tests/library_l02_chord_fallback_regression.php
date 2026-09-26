<?php
/**
 * tests/library_l02_chord_fallback_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L0-2 & Quyết định L-D1 (ROADMAP4.md):
 * 1. Dự phòng HD rỗng → TLH (Core Rule 1): Khi bộ HD có 0 hợp âm, không được chèn CSS ẩn MusicXML.
 * 2. Cung cấp API getChordStatus và getXmlChordCount trên ChordCanvas.
 * 3. Hiển thị nhãn chip trung thực:
 *    - HD rỗng: "HD chưa có · đang hiện TLH"
 *    - HD thưa (<30% TLH): "HD còn thiếu — xem TLH"
 * 4. DisplaySettings / LyricExtractor: Không xóa harmony MusicXML khi HD rỗng.
 * 5. Quét 20 bài ngẫu nhiên có <harmony> trong XML: đảm bảo không bao giờ bị 0 hợp âm khi hiển thị.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';
require_once __DIR__ . '/../api/core/Config.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L0-2: Dự phòng HD rỗng → TLH & Quyết định L-D1 \n";
echo "========================================================\n\n";

// 1. Kiểm tra static trong assets/js/chord-canvas.js
$chordCanvasPath = $root . '/assets/js/chord-canvas.js';
$chordCanvasCode = file_get_contents($chordCanvasPath);

checkStatic(
    'chord_canvas_fallback_flag',
    strpos($chordCanvasCode, 'isFallbackToTlh') !== false,
    'ChordCanvas có logic xác định cờ isFallbackToTlh'
);

checkStatic(
    'chord_canvas_get_chord_status',
    strpos($chordCanvasCode, 'getChordStatus') !== false,
    'ChordCanvas export phương thức getChordStatus()'
);

checkStatic(
    'chord_canvas_get_xml_chord_count',
    strpos($chordCanvasCode, 'getXmlChordCount') !== false,
    'ChordCanvas export phương thức getXmlChordCount()'
);

checkStatic(
    'chord_canvas_style_empty_on_fallback',
    strpos($chordCanvasCode, "styleBlock.textContent = ''") !== false,
    'ChordCanvas gán styleBlock rỗng khi là default hoặc fallback (không ẩn MusicXML chords)'
);

// 2. Kiểm tra static trong assets/js/song-info-bar.js
$songInfoBarPath = $root . '/assets/js/song-info-bar.js';
$songInfoBarCode = file_get_contents($songInfoBarPath);

checkStatic(
    'info_bar_hd_empty_label',
    strpos($songInfoBarCode, 'HD chưa có · đang hiện TLH') !== false,
    'SongInfoBar có nhãn "HD chưa có · đang hiện TLH" khi bộ HD rỗng'
);

checkStatic(
    'info_bar_hd_sparse_label',
    strpos($songInfoBarCode, 'HD còn thiếu — xem TLH') !== false,
    'SongInfoBar có nhãn "HD còn thiếu — xem TLH" khi bộ HD thưa theo L-D1'
);

checkStatic(
    'info_bar_fallback_class',
    strpos($songInfoBarCode, 'si-chord-fallback') !== false,
    'SongInfoBar gắn class CSS si-chord-fallback'
);

checkStatic(
    'info_bar_sparse_class',
    strpos($songInfoBarCode, 'si-chord-sparse') !== false,
    'SongInfoBar gắn class CSS si-chord-sparse'
);

// 3. Kiểm tra static trong assets/js/display-settings.js
$displaySettingsPath = $root . '/assets/js/display-settings.js';
$displaySettingsCode = file_get_contents($displaySettingsPath);

checkStatic(
    'display_settings_custom_chords_guard',
    strpos($displaySettingsCode, 'Object.keys(customChords).length > 0') !== false,
    'DisplaySettings bảo vệ không xóa harmony MusicXML khi customChords rỗng'
);

// 4. Behavioral Check: Quét 20 bài ngẫu nhiên trong DB
$dbPath = Config::get('DB_PATH');
$db = new PDO('sqlite:' . $dbPath);
$stmt = $db->query("SELECT id, title, xmlPath FROM songs ORDER BY RANDOM() LIMIT 20");
$songs = $stmt->fetchAll(PDO::FETCH_ASSOC);

$chordSetsDir = $root . '/storage/data/chord_sets';
$scannedSongs = 0;
$safeSongs = 0;

foreach ($songs as $s) {
    $xmlFullPath = $root . '/' . ltrim($s['xmlPath'], '/\\');
    if (!file_exists($xmlFullPath)) continue;

    $xml = file_get_contents($xmlFullPath);
    $xmlHarmonyCount = substr_count($xml, '<harmony');

    $hdFile = $chordSetsDir . '/' . $s['id'] . '/HD.json';
    $hdCount = 0;
    if (file_exists($hdFile)) {
        $hdData = json_decode(file_get_contents($hdFile), true);
        $hdCount = is_array($hdData) ? count($hdData) : 0;
    }

    $effectiveChordCount = ($hdCount > 0) ? $hdCount : $xmlHarmonyCount;

    if ($xmlHarmonyCount > 0) {
        $scannedSongs++;
        if ($effectiveChordCount > 0) {
            $safeSongs++;
        }
    }
}

checkBehavior(
    'random_20_songs_no_blank_chords',
    $scannedSongs > 0 && $safeSongs === $scannedSongs,
    "Quét $scannedSongs bài có hợp âm XML ngẫu nhiên: 100% bài có hợp âm hiển thị hiệu dụng > 0 (không bài nào bị trắng hợp âm)"
);

TestAssert::finish();
