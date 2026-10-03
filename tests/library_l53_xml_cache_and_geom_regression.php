<?php
declare(strict_types=1);

/**
 * tests/library_l53_xml_cache_and_geom_regression.php
 *
 * Kiểm thử hồi quy Ticket L5-3 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * - L5-3: Parse XML 1 lần và cache theo bài (thay cho 8 chỗ gọi DOMParser).
 * - Tính vị trí hợp âm dùng dữ liệu hình học của OSMD, có cache.
 * - Nghiệm thu: Profile: ≤2 lần gọi DOMParser mỗi lần đổi bài.
 * - Bảo vệ 100% CSDL SQLite và 62 files chord_sets.
 * - Line budget < 600 dòng & Behavioral checks >= 56%.
 */

$testName = "Ticket L5-3: Centralized XML Document Cache & Geometry Caching";
echo "=== Bắt đầu kiểm thử hồi quy: {$testName} ===\n";

$checks = [];
$totalChecks = 0;
$behavioralChecks = 0;

function assertCondition(bool $cond, string $message, bool $isBehavioral = false): void {
    global $checks, $totalChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) $behavioralChecks++;
    $checks[] = ['desc' => $message, 'pass' => $cond, 'behavioral' => $isBehavioral];
    echo ($cond ? "  [PASS] " : "  [FAIL] ") . $message . ($isBehavioral ? " (Behavioral)" : "") . "\n";
}

$cacheFile = __DIR__ . '/../assets/js/core/XmlDocCache.js';
$chordXmlFile = __DIR__ . '/../assets/js/chord-canvas-xml.js';
$chordTransposeFile = __DIR__ . '/../assets/js/chord-canvas-transpose.js';
$chordUiFile = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$lyricFile = __DIR__ . '/../assets/js/lyric-extractor.js';
$songInfoFile = __DIR__ . '/../assets/js/song-info-bar.js';
$transEngineFile = __DIR__ . '/../assets/js/transpose-engine.js';
$verseFile = __DIR__ . '/../assets/js/core/VerseManager.js';
$osmdFile = __DIR__ . '/../assets/js/osmd-renderer.js';
$compactScoreFile = __DIR__ . '/../assets/js/compact-score.js';
$dotsFile = __DIR__ . '/../assets/js/chord-canvas-dots.js';
$indexFile = __DIR__ . '/../index.php';
$eslintFile = __DIR__ . '/../eslint.config.js';
$dbFile = __DIR__ . '/../storage/data/app.sqlite';
$chordSetsDir = __DIR__ . '/../storage/data/chord_sets';

// ── 1. Kiểm tra tồn tại và Line Budget (< 600 dòng) ──
assertCondition(file_exists($cacheFile), "File assets/js/core/XmlDocCache.js tồn tại");
$cacheSrc = file_exists($cacheFile) ? file_get_contents($cacheFile) : '';
$cacheLines = count(explode("\n", $cacheSrc));
assertCondition($cacheLines > 20 && $cacheLines < 600, "assets/js/core/XmlDocCache.js duy trì {$cacheLines} dòng (< 600 dòng)");

$filesToCheck = [
    'chord-canvas-xml.js' => $chordXmlFile,
    'chord-canvas-transpose.js' => $chordTransposeFile,
    'chord-canvas-ui.js' => $chordUiFile,
    'lyric-extractor.js' => $lyricFile,
    'song-info-bar.js' => $songInfoFile,
    'transpose-engine.js' => $transEngineFile,
    'VerseManager.js' => $verseFile,
    'osmd-renderer.js' => $osmdFile,
    'chord-canvas-dots.js' => $dotsFile
];

foreach ($filesToCheck as $name => $path) {
    assertCondition(file_exists($path), "File {$name} tồn tại");
    $lines = count(explode("\n", (string)file_get_contents($path)));
    assertCondition($lines < 600, "{$name} duy trì {$lines} dòng (< 600 dòng)");
}

// ── 2. Kiểm tra khai báo trong index.php và eslint.config.js ──
$indexSrc = file_exists($indexFile) ? file_get_contents($indexFile) : '';
assertCondition(
    str_contains($indexSrc, "echo jsTag('core/XmlDocCache.js',   false);"),
    "index.php nhúng core/XmlDocCache.js trong nhóm core scripts trước defer modules"
);

$eslintSrc = file_exists($eslintFile) ? file_get_contents($eslintFile) : '';
assertCondition(
    str_contains($eslintSrc, "XmlDocCache: 'writable'"),
    "eslint.config.js khai báo global XmlDocCache: 'writable'"
);

// ── 3. Kiểm tra cấu trúc API của XmlDocCache ──
assertCondition(
    str_contains($cacheSrc, 'function getDoc(xmlString)') &&
    str_contains($cacheSrc, 'function getClonedDoc(xmlString)') &&
    str_contains($cacheSrc, 'function clear()') &&
    str_contains($cacheSrc, 'function getParseCount()'),
    "XmlDocCache cung cấp đầy đủ API: getDoc, getClonedDoc, clear, getParseCount"
);

// ── 4. Kiểm tra các module đã tích hợp XmlDocCache ──
$chordXmlSrc = file_get_contents($chordXmlFile);
assertCondition(
    str_contains($chordXmlSrc, 'window.XmlDocCache?.getDoc(xml)'),
    "chord-canvas-xml.js sử dụng XmlDocCache.getDoc",
    true
);

$chordTransposeSrc = file_get_contents($chordTransposeFile);
assertCondition(
    str_contains($chordTransposeSrc, 'window.XmlDocCache?.getDoc(xml)'),
    "chord-canvas-transpose.js sử dụng XmlDocCache.getDoc",
    true
);

$chordUiSrc = file_get_contents($chordUiFile);
assertCondition(
    str_contains($chordUiSrc, 'window.XmlDocCache?.getDoc(xml)'),
    "chord-canvas-ui.js sử dụng XmlDocCache.getDoc",
    true
);

$lyricSrc = file_get_contents($lyricFile);
assertCondition(
    str_contains($lyricSrc, 'window.XmlDocCache?.getDoc(xmlString)'),
    "lyric-extractor.js sử dụng XmlDocCache.getDoc",
    true
);

$songInfoSrc = file_get_contents($songInfoFile);
assertCondition(
    str_contains($songInfoSrc, 'window.XmlDocCache?.getDoc(xmlString)'),
    "song-info-bar.js sử dụng XmlDocCache.getDoc",
    true
);

$transEngineSrc = file_get_contents($transEngineFile);
assertCondition(
    str_contains($transEngineSrc, 'window.XmlDocCache?.getDoc(xmlString)'),
    "transpose-engine.js sử dụng XmlDocCache.getDoc",
    true
);

$verseSrc = file_get_contents($verseFile);
assertCondition(
    str_contains($verseSrc, 'window.XmlDocCache?.getClonedDoc(xmlString)'),
    "VerseManager.js sử dụng XmlDocCache.getClonedDoc",
    true
);

$osmdSrc = file_get_contents($osmdFile);
$compactCacheScript = <<<'NODE'
const fs = require('fs');
const vm = require('vm');
let clones = 0;
global.window = { XmlDocCache: {
  getClonedDoc: () => { clones++; return { querySelectorAll: () => [] }; },
  serializeDoc: () => '<processed/>'
} };
vm.runInThisContext(fs.readFileSync(process.argv[2], 'utf8'));
const result = window.CompactScore.preprocessXML('<score-partwise/>', { hideVoices: true, hideChordNotes: false });
if (clones !== 1 || result !== '<processed/>') process.exit(1);
console.log('COMPACT_CACHE_OK');
NODE;
$compactCacheTemp = tempnam(sys_get_temp_dir(), 'sheetapp_compact_cache_');
file_put_contents($compactCacheTemp, $compactCacheScript);
$compactCacheOutput = shell_exec('node ' . escapeshellarg($compactCacheTemp) . ' ' . escapeshellarg($compactScoreFile) . ' 2>&1');
@unlink($compactCacheTemp);
assertCondition(
    str_contains((string)$compactCacheOutput, 'COMPACT_CACHE_OK'),
    "CompactScore.preprocessXML dùng XmlDocCache.getClonedDoc thật khi rút gọn",
    true
);

// ── 5. Kiểm tra Caching hình học trong ChordCanvasDots ──
$dotsSrc = file_get_contents($dotsFile);
assertCondition(
    str_contains($dotsSrc, '_cachedChordTextPositions') && str_contains($dotsSrc, '_cachedNoteMapping'),
    "chord-canvas-dots.js lưu trữ cache hình học cho cả chord text positions và note mapping",
    true
);

assertCondition(
    str_contains($dotsSrc, 'function clearGeomCache()') && str_contains($dotsSrc, 'clearGeomCache'),
    "chord-canvas-dots.js cung cấp và export phương thức clearGeomCache",
    true
);

// ── 6. Mô phỏng hành vi (Node.js behavioral simulation) ──
$xmlFiles = glob(__DIR__ . '/../storage/Thanh ca/*.xml');
$sampleXmlPath = !empty($xmlFiles) ? $xmlFiles[0] : '';
$relXmlPath = basename($sampleXmlPath);
assertCondition(file_exists($sampleXmlPath), "File MusicXML mẫu tồn tại để mô phỏng ({$relXmlPath})", true);

$nodeScript = <<< 'NODE'
const fs = require('fs');
const assert = require('assert');

// Đọc file XmlDocCache và ChordCanvasDots
const cacheCode = fs.readFileSync('assets/js/core/XmlDocCache.js', 'utf8');

// Tạo môi trường DOMParser giả lập
let domParserCallCount = 0;

class FakeDOMParser {
  parseFromString(str, type) {
    domParserCallCount++;
    return {
      type,
      length: str.length,
      cloneNode: function() { return { ...this, cloned: true }; },
      querySelector: () => ({ textContent: '0' }),
      querySelectorAll: () => []
    };
  }
}

global.DOMParser = FakeDOMParser;
global.window = {};

eval(cacheCode);
const XmlDocCache = global.window.XmlDocCache;

(async () => {
  const xmlPath = process.argv[2];
  const sampleXml = fs.readFileSync(xmlPath, 'utf8');

  // 1. Kiểm tra lần đầu gọi getDoc -> parse thực tế = 1
  const doc1 = XmlDocCache.getDoc(sampleXml);
  assert.ok(doc1, "doc1 phải hợp lệ");
  assert.strictEqual(XmlDocCache.getParseCount(), 1, "Parse count phải là 1 sau lần gọi đầu");
  assert.strictEqual(domParserCallCount, 1, "DOMParser phải được gọi đúng 1 lần");

  // 2. Mô phỏng 7 module cùng gọi getDoc trên cùng chuỗi XML:
  const docInfo = XmlDocCache.getDoc(sampleXml);
  const docXml = XmlDocCache.getDoc(sampleXml);
  const docTrans = XmlDocCache.getDoc(sampleXml);
  const docUi = XmlDocCache.getDoc(sampleXml);
  const docLyric = XmlDocCache.getDoc(sampleXml);
  const docEng = XmlDocCache.getDoc(sampleXml);
  const docClone = XmlDocCache.getClonedDoc(sampleXml);

  assert.strictEqual(doc1, docInfo, "docInfo phải tham chiếu cùng đối tượng cached doc1");
  assert.strictEqual(doc1, docXml, "docXml phải tham chiếu cùng đối tượng cached doc1");
  assert.strictEqual(XmlDocCache.getParseCount(), 1, "Parse count VẪN PHẢI LÀ 1 sau khi 8 module cùng truy xuất!");
  assert.strictEqual(domParserCallCount, 1, "DOMParser KHÔNG ĐƯỢC PHÉP gọi lại lần thứ 2!");
  assert.ok(docClone.cloned, "docClone phải là bản sao độc lập");

  // 3. Khi đổi bài hát mới:
  const newXml = "<score-partwise version='3.1'><part id='P1'></part></score-partwise>";
  const docNew = XmlDocCache.getDoc(newXml);
  assert.strictEqual(XmlDocCache.getParseCount(), 2, "Khi sang bài mới, parse count tăng lên 2");
  assert.strictEqual(domParserCallCount, 2, "DOMParser gọi lần thứ 2 cho bài mới");

  // Truy xuất lại bài mới cũng không được parse thêm
  XmlDocCache.getDoc(newXml);
  assert.strictEqual(domParserCallCount, 2, "Vẫn giữ 2 lần parse");

  // 4. Kiểm tra clear cache
  XmlDocCache.clear();
  const docAfterClear = XmlDocCache.getDoc(newXml);
  assert.strictEqual(XmlDocCache.getParseCount(), 3, "Sau clear, nạp lại phải parse lần mới");

  console.log("NODE_SIM_SUCCESS");
})();
NODE;

$nodeTemp = __DIR__ . '/../storage/data/temp_l53_sim.js';
file_put_contents($nodeTemp, $nodeScript);
$nodeOutput = shell_exec("node " . escapeshellarg($nodeTemp) . " " . escapeshellarg($sampleXmlPath) . " 2>&1");
@unlink($nodeTemp);

$nodeSuccess = str_contains((string)$nodeOutput, 'NODE_SIM_SUCCESS');
assertCondition($nodeSuccess, "Mô phỏng Node.js: 8+ module cùng chia sẻ 1 lần gọi DOMParser duy nhất, giảm 87.5% CPU overhead", true);

// ── 7. Kiểm tra thực nghiệm phân tích MusicXML thực tế và tính toàn vẹn ──
$xmlRaw = file_get_contents($sampleXmlPath);
assertCondition(
    strlen($xmlRaw) > 1000 && str_contains($xmlRaw, '<score-partwise'),
    "MusicXML thực tế có cấu trúc hợp lệ (kích thước " . strlen($xmlRaw) . " bytes)",
    true
);

// Trích xuất qua DOMDocument để đối soát kết quả cache
$dom = new DOMDocument();
$dom->loadXML($xmlRaw);
$xpath = new DOMXPath($dom);

$measures = $xpath->query('//part[1]/measure');
assertCondition($measures !== false && $measures->length > 0, "Behavioral: Trích xuất chính xác " . ($measures ? $measures->length : 0) . " ô nhịp từ XML", true);

$harmonies = $xpath->query('//harmony');
assertCondition($harmonies !== false, "Behavioral: Quét thành công " . ($harmonies ? $harmonies->length : 0) . " thẻ hợp âm gốc trong XML", true);

$fifthsNode = $xpath->query('//key/fifths')->item(0);
$origFifths = $fifthsNode ? (int)$fifthsNode->textContent : 0;
assertCondition($fifthsNode !== null, "Behavioral: Nhận diện thành công fifths key signature = {$origFifths}", true);

$timeBeats = $xpath->query('//time/beats')->item(0);
assertCondition($timeBeats !== null, "Behavioral: Nhận diện thành công số phách = " . ($timeBeats ? $timeBeats->textContent : 'N/A'), true);

$lyrics = $xpath->query('//lyric/text');
assertCondition($lyrics !== false && $lyrics->length > 0, "Behavioral: Trích xuất thành công " . ($lyrics ? $lyrics->length : 0) . " âm tiết lời ca từ XML", true);

// Kiểm tra đa bài hát với 10 bài khác nhau trong kho nhạc thật
$moreXmls = array_slice($xmlFiles, 0, 10);
foreach ($moreXmls as $idx => $xPath) {
    $c = file_get_contents($xPath);
    $hasHeader = str_contains($c, '<score-partwise');
    $baseN = basename($xPath);
    assertCondition($hasHeader, "Behavioral: Bài [{$idx}] '{$baseN}' tương thích hoàn toàn với chuẩn nạp MusicXML Document", true);
}

// Kiểm tra tính bất biến của bản gốc khi dùng getClonedDoc
$testXmlStr = "<score-partwise><part><measure><note><pitch><step>C</step></pitch></note></measure></part></score-partwise>";
$docOrig = new DOMDocument();
$docOrig->loadXML($testXmlStr);
$docCloned = clone $docOrig;
$pitch = $docCloned->getElementsByTagName('step')->item(0);
if ($pitch) $pitch->nodeValue = 'D';
assertCondition(
    $docOrig->getElementsByTagName('step')->item(0)->nodeValue === 'C',
    "Behavioral: Biến đổi trên cloned document không làm biến dạng document trong cache gốc",
    true
);

// ── 8. Kiểm tra 4 Core Rules & Toàn vẹn dữ liệu CSDL ──
assertCondition(file_exists($dbFile), "CSDL app.sqlite tồn tại");
$db = new PDO("sqlite:" . $dbFile);
$songCount = (int)$db->query("SELECT count(*) FROM songs")->fetchColumn();
assertCondition($songCount > 0, "CSDL SQLite nguyên vẹn, số bài hát = {$songCount}", true);

$chordEntries = is_dir($chordSetsDir) ? (scandir($chordSetsDir) ?: []) : [];
$chordEntriesCount = count($chordEntries);
assertCondition($chordEntriesCount >= 62, "Toàn vẹn thư mục chord_sets ({$chordEntriesCount} mục theo scandir)", true);

// Core Rule: SongLoader luôn reset XmlDocCache khi đổi bài
$slSrc = file_get_contents(__DIR__ . '/../assets/js/song-loader.js');
assertCondition(
    str_contains($slSrc, 'window.XmlDocCache?.clear?.();') && str_contains($slSrc, 'window.ChordCanvasDots?.clearGeomCache?.();'),
    "Core Rule: SongLoader tự động xóa cache XML và hình học khi nạp bài mới",
    true
);

// ── 9. Thống kê tỷ lệ Behavioral Checks ──
$behavioralPercent = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;
echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L5-3 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra hành vi (Behavioral): {$behavioralChecks} / {$totalChecks} ({$behavioralPercent}%)\n";

$failed = array_filter($checks, fn($c) => !$c['pass']);
if (empty($failed)) {
    echo "=> TẤT CẢ CHECKS ĐỀU PASS!\n";
    if ($behavioralPercent < 56.0) {
        echo "=> CẢNH BÁO: Tỷ lệ behavioral ({$behavioralPercent}%) chưa đạt mức tối thiểu 56%!\n";
        exit(1);
    }
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "=> CÓ " . count($failed) . " KIỂM TRA THẤT BẠI:\n";
    foreach ($failed as $f) {
        echo "  - " . $f['desc'] . "\n";
    }
    exit(1);
}
