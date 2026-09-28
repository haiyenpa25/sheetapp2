<?php
declare(strict_types=1);

/**
 * tests/library_l47_harmonic_numeral_regression.php
 *
 * Kiểm thử hồi quy Ticket L4-7 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * - Tuỳ chọn hiển thị hợp âm dạng số La Mã / Nashville (I–IV–V / 1–4–5).
 * - Nghiệm thu: Unit test theo các tông (Key C, Key G, Key D, Key F, Key Bb, Key A, Key Am).
 * - Hỗ trợ hợp âm mở rộng (7, maj7, sus4, dim, aug, add9), hợp âm đảo (C/E, G/B, D/F#).
 * - Chuyển đổi nhanh qua nút toolbar #btn-chord-notation và phím tắt 'N'.
 * - Tích hợp chặt chẽ vào LyricExtractor và ChordCanvas.
 * - Tuân thủ Line budget < 600 dòng và tỷ lệ Behavioral checks >= 56%.
 */

$testName = "Ticket L4-7: Harmonic Numeral (Roman & Nashville Chords)";
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

$hnFile = __DIR__ . '/../assets/js/harmonic-numeral.js';
$lyricFile = __DIR__ . '/../assets/js/lyric-extractor.js';
$chordDotsFile = __DIR__ . '/../assets/js/chord-canvas-dots.js';
$keyboardFile = __DIR__ . '/../assets/js/keyboard-handler.js';
$indexFile = __DIR__ . '/../index.php';
$toolbarFile = __DIR__ . '/../includes/toolbar.php';

// 1. Kiểm tra tồn tại file và line count
assertCondition(file_exists($hnFile), "File assets/js/harmonic-numeral.js tồn tại");
$hnSrc = file_exists($hnFile) ? file_get_contents($hnFile) : '';
$lineCount = count(explode("\n", $hnSrc));
assertCondition($lineCount > 100 && $lineCount < 600, "assets/js/harmonic-numeral.js duy trì {$lineCount} dòng (< 600 dòng)");

// 2. Kiểm tra nạp trong index.php
$indexSrc = file_exists($indexFile) ? file_get_contents($indexFile) : '';
assertCondition(str_contains($indexSrc, "jsTag('harmonic-numeral.js')"), "index.php nạp harmonic-numeral.js");

// 3. Kiểm tra nút bấm trên toolbar
$tbSrc = file_exists($toolbarFile) ? file_get_contents($toolbarFile) : '';
assertCondition(str_contains($tbSrc, 'id="btn-chord-notation"'), "includes/toolbar.php chứa nút #btn-chord-notation");

// 4. Kiểm tra phím tắt N trong keyboard-handler.js
$kbSrc = file_exists($keyboardFile) ? file_get_contents($keyboardFile) : '';
assertCondition(
    str_contains($kbSrc, "'n'") && str_contains($kbSrc, "HarmonicNumeral"),
    "keyboard-handler.js gắn phím tắt N để chuyển đổi chế độ hợp âm"
);

// 5. Kiểm tra tích hợp trong lyric-extractor.js và chord-canvas-dots.js
$lyricSrc = file_exists($lyricFile) ? file_get_contents($lyricFile) : '';
$dotsSrc = file_exists($chordDotsFile) ? file_get_contents($chordDotsFile) : '';
assertCondition(
    str_contains($lyricSrc, 'HarmonicNumeral') && str_contains($dotsSrc, 'HarmonicNumeral'),
    "lyric-extractor.js và chord-canvas-dots.js đều tích hợp HarmonicNumeral"
);

// ═══ KIỂM THỬ HÀNH VI ĐƠN VỊ VÀ THEO TÔNG BẰNG NODE.JS ═══
$nodeScript = <<< 'JS'
global.window = global;
const fs = require('fs');

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

// Mock DOM
global.document = {
  getElementById: id => null,
  body: { dataset: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} } }
};

const src = fs.readFileSync('assets/js/harmonic-numeral.js', 'utf8');
const fn = new Function(src + '; return HarmonicNumeral;');
const HN = fn();

const results = {};

// 1. Kiểm tra Key C (Major)
results.keyC = {
  C: HN.chordToRoman('C', 'C') === 'I' && HN.chordToNashville('C', 'C') === '1',
  Dm: HN.chordToRoman('Dm', 'C') === 'ii' && HN.chordToNashville('Dm', 'C') === '2m',
  Em: HN.chordToRoman('Em', 'C') === 'iii' && HN.chordToNashville('Em', 'C') === '3m',
  F: HN.chordToRoman('F', 'C') === 'IV' && HN.chordToNashville('F', 'C') === '4',
  G: HN.chordToRoman('G', 'C') === 'V' && HN.chordToNashville('G', 'C') === '5',
  G7: HN.chordToRoman('G7', 'C') === 'V7' && HN.chordToNashville('G7', 'C') === '57',
  Am: HN.chordToRoman('Am', 'C') === 'vi' && HN.chordToNashville('Am', 'C') === '6m',
  Bdim: HN.chordToRoman('Bdim', 'C') === 'vii°' && HN.chordToNashville('Bdim', 'C') === '7dim',
  Bb: HN.chordToRoman('Bb', 'C') === 'bVII' && HN.chordToNashville('Bb', 'C') === 'b7',
  CE: HN.chordToRoman('C/E', 'C') === 'I/3' && HN.chordToNashville('C/E', 'C') === '1/3',
  GB: HN.chordToRoman('G/B', 'C') === 'V/7' && HN.chordToNashville('G/B', 'C') === '5/7'
};

// 2. Kiểm tra Key G (Major)
results.keyG = {
  G: HN.chordToRoman('G', 'G') === 'I' && HN.chordToNashville('G', 'G') === '1',
  Am: HN.chordToRoman('Am', 'G') === 'ii' && HN.chordToNashville('Am', 'G') === '2m',
  Bm: HN.chordToRoman('Bm', 'G') === 'iii' && HN.chordToNashville('Bm', 'G') === '3m',
  C: HN.chordToRoman('C', 'G') === 'IV' && HN.chordToNashville('C', 'G') === '4',
  D: HN.chordToRoman('D', 'G') === 'V' && HN.chordToNashville('D', 'G') === '5',
  D7: HN.chordToRoman('D7', 'G') === 'V7' && HN.chordToNashville('D7', 'G') === '57',
  Em: HN.chordToRoman('Em', 'G') === 'vi' && HN.chordToNashville('Em', 'G') === '6m',
  FsharpDim: HN.chordToRoman('F#dim', 'G') === 'vii°' && HN.chordToNashville('F#dim', 'G') === '7dim',
  DFsharp: HN.chordToRoman('D/F#', 'G') === 'V/7' && HN.chordToNashville('D/F#', 'G') === '5/7'
};

// 3. Kiểm tra Key D (Major)
results.keyD = {
  D: HN.chordToRoman('D', 'D') === 'I' && HN.chordToNashville('D', 'D') === '1',
  Em: HN.chordToRoman('Em', 'D') === 'ii' && HN.chordToNashville('Em', 'D') === '2m',
  FsharpM: HN.chordToRoman('F#m', 'D') === 'iii' && HN.chordToNashville('F#m', 'D') === '3m',
  G: HN.chordToRoman('G', 'D') === 'IV' && HN.chordToNashville('G', 'D') === '4',
  A: HN.chordToRoman('A', 'D') === 'V' && HN.chordToNashville('A', 'D') === '5',
  Bm: HN.chordToRoman('Bm', 'D') === 'vi' && HN.chordToNashville('Bm', 'D') === '6m',
  ACsharp: HN.chordToRoman('A/C#', 'D') === 'V/7' && HN.chordToNashville('A/C#', 'D') === '5/7'
};

// 4. Kiểm tra Key F (Major)
results.keyF = {
  F: HN.chordToRoman('F', 'F') === 'I' && HN.chordToNashville('F', 'F') === '1',
  Gm: HN.chordToRoman('Gm', 'F') === 'ii' && HN.chordToNashville('Gm', 'F') === '2m',
  Am: HN.chordToRoman('Am', 'F') === 'iii' && HN.chordToNashville('Am', 'F') === '3m',
  Bb: HN.chordToRoman('Bb', 'F') === 'IV' && HN.chordToNashville('Bb', 'F') === '4',
  C: HN.chordToRoman('C', 'F') === 'V' && HN.chordToNashville('C', 'F') === '5',
  Dm: HN.chordToRoman('Dm', 'F') === 'vi' && HN.chordToNashville('Dm', 'F') === '6m',
  CE: HN.chordToRoman('C/E', 'F') === 'V/7' && HN.chordToNashville('C/E', 'F') === '5/7'
};

// 5. Kiểm tra Key Bb (Major)
results.keyBb = {
  Bb: HN.chordToRoman('Bb', 'Bb') === 'I' && HN.chordToNashville('Bb', 'Bb') === '1',
  Cm: HN.chordToRoman('Cm', 'Bb') === 'ii' && HN.chordToNashville('Cm', 'Bb') === '2m',
  Dm: HN.chordToRoman('Dm', 'Bb') === 'iii' && HN.chordToNashville('Dm', 'Bb') === '3m',
  Eb: HN.chordToRoman('Eb', 'Bb') === 'IV' && HN.chordToNashville('Eb', 'Bb') === '4',
  F: HN.chordToRoman('F', 'Bb') === 'V' && HN.chordToNashville('F', 'Bb') === '5',
  Gm: HN.chordToRoman('Gm', 'Bb') === 'vi' && HN.chordToNashville('Gm', 'Bb') === '6m'
};

// 6. Kiểm tra Key A (Major)
results.keyA = {
  A: HN.chordToRoman('A', 'A') === 'I' && HN.chordToNashville('A', 'A') === '1',
  Bm: HN.chordToRoman('Bm', 'A') === 'ii' && HN.chordToNashville('Bm', 'A') === '2m',
  CsharpM: HN.chordToRoman('C#m', 'A') === 'iii' && HN.chordToNashville('C#m', 'A') === '3m',
  D: HN.chordToRoman('D', 'A') === 'IV' && HN.chordToNashville('D', 'A') === '4',
  E: HN.chordToRoman('E', 'A') === 'V' && HN.chordToNashville('E', 'A') === '5',
  FsharpM: HN.chordToRoman('F#m', 'A') === 'vi' && HN.chordToNashville('F#m', 'A') === '6m',
  EGsharp: HN.chordToRoman('E/G#', 'A') === 'V/7' && HN.chordToNashville('E/G#', 'A') === '5/7'
};

// 7. Kiểm tra Key Am (Minor)
results.keyAm = {
  Am: HN.chordToRoman('Am', 'Am') === 'i' && HN.chordToNashville('Am', 'Am') === '1m',
  C: HN.chordToRoman('C', 'Am') === 'bIII' && HN.chordToNashville('C', 'Am') === 'b3',
  Dm: HN.chordToRoman('Dm', 'Am') === 'iv' && HN.chordToNashville('Dm', 'Am') === '4m',
  Em: HN.chordToRoman('Em', 'Am') === 'v' && HN.chordToNashville('Em', 'Am') === '5m',
  E7: HN.chordToRoman('E7', 'Am') === 'V7' && HN.chordToNashville('E7', 'Am') === '57',
  F: HN.chordToRoman('F', 'Am') === 'bVI' && HN.chordToNashville('F', 'Am') === 'b6',
  G: HN.chordToRoman('G', 'Am') === 'bVII' && HN.chordToNashville('G', 'Am') === 'b7'
};

// 8. Hợp âm mở rộng
results.extensions = {
  maj7: HN.chordToRoman('Cmaj7', 'C') === 'Imaj7' && HN.chordToNashville('Cmaj7', 'C') === '1maj7',
  sus4: HN.chordToRoman('Csus4', 'C') === 'Isus4' && HN.chordToNashville('Csus4', 'C') === '1sus4',
  aug: HN.chordToRoman('Caug', 'C') === 'I+' && HN.chordToNashville('Caug', 'C') === '1+',
  add9: HN.chordToRoman('Cadd9', 'C') === 'Iadd9' && HN.chordToNashville('Cadd9', 'C') === '1add9'
};

// 9. Vòng chuyển đổi phong cách ký hiệu (Style Cycling & Persistence)
results.state = {
  initial: HN.getNotationStyle() === 'standard',
  firstCycle: HN.cycleNotationStyle() === 'roman' && HN.getNotationStyle() === 'roman',
  secondCycle: HN.cycleNotationStyle() === 'nashville' && HN.getNotationStyle() === 'nashville',
  thirdCycle: HN.cycleNotationStyle() === 'standard' && HN.getNotationStyle() === 'standard',
  setExplicit: HN.setNotationStyle('roman') === 'roman' && global.localStorage.getItem('sheetapp_chord_notation') === 'roman'
};

console.log(JSON.stringify(results));
JS;

$tmpScript = sys_get_temp_dir() . '/test_hn_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);
$nodeOut = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$json = json_decode((string)$nodeOut, true);

if ($json && is_array($json)) {
    // 6. Behavioral: Key C unit tests
    $kc = $json['keyC'] ?? [];
    $allC = !in_array(false, $kc, true) && count($kc) === 11;
    assertCondition(
        $allC,
        "Behavioral: Key C quy đổi chuẩn xác (C→I/1, Dm→ii/2m, Em→iii/3m, F→IV/4, G→V/5, G7→V7/57, Am→vi/6m, Bdim→vii°/7dim, Bb→bVII/b7, C/E→I/3, G/B→V/7)",
        true
    );

    // 7. Behavioral: Key G unit tests
    $kg = $json['keyG'] ?? [];
    $allG = !in_array(false, $kg, true) && count($kg) === 9;
    assertCondition(
        $allG,
        "Behavioral: Key G quy đổi chuẩn xác (G→I/1, Am→ii/2m, Bm→iii/3m, C→IV/4, D→V/5, D7→V7/57, Em→vi/6m, F#dim→vii°/7dim, D/F#→V/7)",
        true
    );

    // 8. Behavioral: Key D unit tests
    $kd = $json['keyD'] ?? [];
    $allD = !in_array(false, $kd, true) && count($kd) === 7;
    assertCondition(
        $allD,
        "Behavioral: Key D quy đổi chuẩn xác (D→I/1, Em→ii/2m, F#m→iii/3m, G→IV/4, A→V/5, Bm→vi/6m, A/C#→V/7)",
        true
    );

    // 9. Behavioral: Key F unit tests
    $kf = $json['keyF'] ?? [];
    $allF = !in_array(false, $kf, true) && count($kf) === 7;
    assertCondition(
        $allF,
        "Behavioral: Key F quy đổi chuẩn xác (F→I/1, Gm→ii/2m, Am→iii/3m, Bb→IV/4, C→V/5, Dm→vi/6m, C/E→V/7)",
        true
    );

    // 10. Behavioral: Key Bb unit tests
    $kbb = $json['keyBb'] ?? [];
    $allBb = !in_array(false, $kbb, true) && count($kbb) === 6;
    assertCondition(
        $allBb,
        "Behavioral: Key Bb quy đổi chuẩn xác (Bb→I/1, Cm→ii/2m, Dm→iii/3m, Eb→IV/4, F→V/5, Gm→vi/6m)",
        true
    );

    // 11. Behavioral: Key A unit tests
    $ka = $json['keyA'] ?? [];
    $allA = !in_array(false, $ka, true) && count($ka) === 7;
    assertCondition(
        $allA,
        "Behavioral: Key A quy đổi chuẩn xác (A→I/1, Bm→ii/2m, C#m→iii/3m, D→IV/4, E→V/5, F#m→vi/6m, E/G#→V/7)",
        true
    );

    // 12. Behavioral: Key Am (Minor) unit tests
    $kam = $json['keyAm'] ?? [];
    $allAm = !in_array(false, $kam, true) && count($kam) === 7;
    assertCondition(
        $allAm,
        "Behavioral: Key Am giọng thứ quy đổi chuẩn xác (Am→i/1m, C→bIII/b3, Dm→iv/4m, Em→v/5m, E7→V7/57, F→bVI/b6, G→bVII/b7)",
        true
    );

    // 13. Behavioral: Hợp âm mở rộng
    $ext = $json['extensions'] ?? [];
    $allExt = !in_array(false, $ext, true) && count($ext) === 4;
    assertCondition(
        $allExt,
        "Behavioral: Xử lý chuẩn xác hợp âm mở rộng (maj7, sus4, aug, add9)",
        true
    );

    // 14. Behavioral: Chuyển đổi và lưu trữ localStorage
    $st = $json['state'] ?? [];
    $allSt = !in_array(false, $st, true) && count($st) === 5;
    assertCondition(
        $allSt,
        "Behavioral: Chu trình đổi phong cách (standard ↔ roman ↔ nashville) và lưu trữ localStorage",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử đơn vị Node.js: " . $nodeOut, true);
}

// ═══ KIỂM THỬ HÀNH VI TÍCH HỢP TRÊN LYRICEXTRACTOR ═══
$lyricTestScript = <<< 'JS'
global.window = global;
const fs = require('fs');

global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = {
  getElementById: id => {
    if (id === 'song-title') return { textContent: 'Bài Ca Cảm Tạ' };
    if (id === 'song-key') return { textContent: 'C' };
    return null;
  }
};

global.DOMParser = class {
  parseFromString(xml) {
    return {
      querySelector: (sel) => {
        if (sel === 'part') return {
          querySelectorAll: (s) => [
            {
              children: [
                {
                  tagName: 'harmony',
                  hasAttribute: () => false,
                  querySelector: (q) => {
                    if (q === 'root-step') return { textContent: 'C' };
                    if (q === 'kind') return { textContent: 'major', getAttribute: () => '' };
                    return null;
                  }
                },
                {
                  tagName: 'note',
                  querySelector: () => null,
                  querySelectorAll: (q) => [
                    {
                      getAttribute: () => '1',
                      querySelector: (sq) => sq === 'text' ? { textContent: 'Cúi' } : { textContent: 'single' }
                    }
                  ]
                }
              ]
            },
            {
              children: [
                {
                  tagName: 'harmony',
                  hasAttribute: () => false,
                  querySelector: (q) => {
                    if (q === 'root-step') return { textContent: 'D' };
                    if (q === 'kind') return { textContent: 'minor', getAttribute: () => 'm' };
                    return null;
                  }
                },
                {
                  tagName: 'note',
                  querySelector: () => null,
                  querySelectorAll: (q) => [
                    {
                      getAttribute: () => '1',
                      querySelector: (sq) => sq === 'text' ? { textContent: 'xin' } : { textContent: 'single' }
                    }
                  ]
                }
              ]
            },
            {
              children: [
                {
                  tagName: 'harmony',
                  hasAttribute: () => false,
                  querySelector: (q) => {
                    if (q === 'root-step') return { textContent: 'G' };
                    if (q === 'kind') return { textContent: 'dominant', getAttribute: () => '7' };
                    return null;
                  }
                },
                {
                  tagName: 'note',
                  querySelector: () => null,
                  querySelectorAll: (q) => [
                    {
                      getAttribute: () => '1',
                      querySelector: (sq) => sq === 'text' ? { textContent: 'Chúa' } : { textContent: 'single' }
                    }
                  ]
                }
              ]
            }
          ]
        };
        return null;
      }
    };
  }
};

const hnSrc = fs.readFileSync('assets/js/harmonic-numeral.js', 'utf8');
const fnHN = new Function(hnSrc + '; return HarmonicNumeral;');
global.HarmonicNumeral = fnHN();

const lyricSrc = fs.readFileSync('assets/js/lyric-extractor.js', 'utf8');
const fnLyric = new Function(lyricSrc + '; return LyricExtractor;');
global.LyricExtractor = fnLyric();

// Giả lập DOM element chứa kết quả
let renderedHtml = '';
const mockContainer = {
  set innerHTML(val) { renderedHtml = val; },
  get innerHTML() { return renderedHtml; },
  style: { setProperty: () => {} },
  querySelectorAll: () => []
};

global.document.getElementById = id => {
  if (id === 'lyric-view-container') return mockContainer;
  if (id === 'song-title') return { textContent: 'Bài Ca Cảm Tạ' };
  if (id === 'song-key') return { textContent: 'C' };
  return null;
};

// Chuỗi MusicXML tối giản chứa hợp âm C, Dm, G7
const xmlSample = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><lyric number="1"><text>Cúi</text></lyric></note>
      <harmony><root><root-step>D</root-step></root><kind>minor</kind></harmony>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><lyric number="1"><text>xin</text></lyric></note>
      <harmony><root><root-step>G</root-step></root><kind>dominant</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><lyric number="1"><text>Chúa</text></lyric></note>
    </measure>
  </part>
</score-partwise>`;

// 1. Render ở chế độ chuẩn (standard)
global.HarmonicNumeral.setNotationStyle('standard', false);
global.LyricExtractor.render('lyric-view-container', xmlSample, 0);
const standardHasC = renderedHtml.includes('data-chord="C"');
const standardHasDm = renderedHtml.includes('data-chord="Dm"');
const standardHasG7 = renderedHtml.includes('data-chord="G7"');

// 2. Chuyển sang số La Mã (roman)
global.HarmonicNumeral.setNotationStyle('roman', false);
global.LyricExtractor.render('lyric-view-container', xmlSample, 0);
const romanHasI = renderedHtml.includes('data-chord="I"');
const romanHasii = renderedHtml.includes('data-chord="ii"');
const romanHasV7 = renderedHtml.includes('data-chord="V7"');

// 3. Chuyển sang Nashville (nashville)
global.HarmonicNumeral.setNotationStyle('nashville', false);
global.LyricExtractor.render('lyric-view-container', xmlSample, 0);
const nashvilleHas1 = renderedHtml.includes('data-chord="1"');
const nashvilleHas2m = renderedHtml.includes('data-chord="2m"');
const nashvilleHas57 = renderedHtml.includes('data-chord="57"');

console.log(JSON.stringify({
  standard: standardHasC && standardHasDm && standardHasG7,
  roman: romanHasI && romanHasii && romanHasV7,
  nashville: nashvilleHas1 && nashvilleHas2m && nashvilleHas57
}));
JS;

$tmpScript2 = sys_get_temp_dir() . '/test_hn_lyric_' . uniqid() . '.js';
file_put_contents($tmpScript2, $lyricTestScript);
$lyricOut = shell_exec("node \"{$tmpScript2}\" 2>&1");
@unlink($tmpScript2);

$lyricJson = json_decode((string)$lyricOut, true);

if ($lyricJson && is_array($lyricJson)) {
    // 15. Behavioral: LyricExtractor render chuẩn
    assertCondition(
        !empty($lyricJson['standard']),
        "Behavioral: LyricExtractor render hợp âm chuẩn (C, Dm, G7) khi notationStyle = 'standard'",
        true
    );

    // 16. Behavioral: LyricExtractor render La Mã
    assertCondition(
        !empty($lyricJson['roman']),
        "Behavioral: LyricExtractor render số La Mã (I, ii, V7) khi notationStyle = 'roman'",
        true
    );

    // 17. Behavioral: LyricExtractor render Nashville
    assertCondition(
        !empty($lyricJson['nashville']),
        "Behavioral: LyricExtractor render số Nashville (1, 2m, 57) khi notationStyle = 'nashville'",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử tích hợp LyricExtractor: " . $lyricOut, true);
}

// Tổng kết
$passCount = count(array_filter($checks, fn($c) => $c['pass']));
$failCount = $totalChecks - $passCount;
$behavioralPercent = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n=========================================================================\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passCount} failed={$failCount} behavioral_ratio={$behavioralPercent}%\n";
echo "=========================================================================\n";

if ($failCount > 0) {
    echo "❌ Có {$failCount} kiểm tra thất bại!\n";
    exit(1);
} else {
    echo "✅ TẤT CẢ KIỂM TRA ĐỀU ĐẠT CHUẨN!\n";
    exit(0);
}
