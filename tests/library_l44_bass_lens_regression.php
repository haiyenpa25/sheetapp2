<?php
declare(strict_types=1);

/**
 * tests/library_l44_bass_lens_regression.php
 *
 * Kiểm thử hồi quy Ticket L4-4 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * - Bass: Nốt gốc chữ to, hợp âm đảo lấy nốt bass (C/E → E, G/B → B, D/F# → F#).
 * - Trích xuất chính xác nốt Bass từ hợp âm đảo (Slash chord) và nốt gốc (Root note).
 * - Hiển thị nốt Bass nổi bật trên giao diện Band / Lời bài hát.
 * - Thanh công cụ Bass Lens Bar và tùy chọn bật/tắt nốt Bass lớn.
 * - Tuân thủ Line budget < 600 dòng và tỷ lệ Behavioral checks >= 56%.
 */

$testName = "Ticket L4-4: Bass Stage Lens (Big Bass Root & Slash Chords)";
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

$bassLensFile = __DIR__ . '/../assets/js/bass-lens.js';
$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$lyricExtractorFile = __DIR__ . '/../assets/js/lyric-extractor.js';
$cssFile = __DIR__ . '/../assets/css/components.css';

// 1. Kiểm tra file và kích thước
assertCondition(file_exists($bassLensFile), "File assets/js/bass-lens.js tồn tại");
$bassSrc = file_exists($bassLensFile) ? file_get_contents($bassLensFile) : '';
$lineCount = count(explode("\n", $bassSrc));
assertCondition($lineCount > 50 && $lineCount < 600, "assets/js/bass-lens.js duy trì {$lineCount} dòng (< 600 dòng)");

// 2. Kiểm tra CSS nốt Bass to và thanh công cụ
$cssSrc = file_exists($cssFile) ? file_get_contents($cssFile) : '';
assertCondition(
    str_contains($cssSrc, '.lv-bass-root') &&
    str_contains($cssSrc, '.lv-bass-sub') &&
    str_contains($cssSrc, '.bass-lens-bar'),
    "components.css chứa quy tắc định dạng cho .lv-bass-root, .lv-bass-sub và .bass-lens-bar"
);

// 3. Kiểm tra tích hợp trong lyric-extractor.js
$lyricSrc = file_exists($lyricExtractorFile) ? file_get_contents($lyricExtractorFile) : '';
assertCondition(
    str_contains($lyricSrc, 'BassLens') &&
    str_contains($lyricSrc, 'lv-bass-root'),
    "lyric-extractor.js tích hợp BassLens và render class .lv-bass-root cho nốt bass"
);

// ═══ KIỂM THỬ HÀNH VI ĐƠN VỊ VÀ ĐỒNG BỘ QUA NODE.JS ═══
$nodeScript = <<< 'JS'
const fs = require('fs');
const bassSrc = fs.readFileSync('assets/js/bass-lens.js', 'utf8');

const localStorageData = {};
const window = {
  localStorage: {
    getItem: (k) => localStorageData[k] || null,
    setItem: (k, v) => { localStorageData[k] = String(v); }
  },
  SafeHtml: {
    escape: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  },
  StageLens: {
    getCurrentRole: () => 'bass'
  }
};
global.window = window;
global.localStorage = window.localStorage;

eval(bassSrc);

// A. Test extractBassNote
const slashTests = [
  { in: 'C/E', exp: 'E' },
  { in: 'G/B', exp: 'B' },
  { in: 'D/F#', exp: 'F#' },
  { in: 'Am/C', exp: 'C' },
  { in: 'Em9/G', exp: 'G' },
  { in: 'A7/C#', exp: 'C#' },
  { in: 'Bb/D', exp: 'D' },
  { in: 'F/A', exp: 'A' },
  { in: 'Eb/Bb', exp: 'Bb' }
];

const slashPass = slashTests.every(t => window.BassLens.extractBassNote(t.in) === t.exp);

const rootTests = [
  { in: 'C', exp: 'C' },
  { in: 'Am7', exp: 'A' },
  { in: 'F#m', exp: 'F#' },
  { in: 'Bbmaj7', exp: 'Bb' },
  { in: 'Eb', exp: 'Eb' },
  { in: 'G#dim', exp: 'G#' },
  { in: 'Dm', exp: 'D' }
];

const rootPass = rootTests.every(t => window.BassLens.extractBassNote(t.in) === t.exp);

// B. Test parseBassInfo
const infoSlash = window.BassLens.parseBassInfo('C/E');
const infoSlashOk = infoSlash &&
  infoSlash.bassNote === 'E' &&
  infoSlash.rootNote === 'C' &&
  infoSlash.isSlash === true &&
  infoSlash.fullChord === 'C/E';

const infoRoot = window.BassLens.parseBassInfo('Am7');
const infoRootOk = infoRoot &&
  infoRoot.bassNote === 'A' &&
  infoRoot.rootNote === 'A' &&
  infoRoot.isSlash === false &&
  infoRoot.fullChord === 'Am7';

// C. Test formatBassDisplay
const dispSlash = window.BassLens.formatBassDisplay('C/E');
const dispSlashOk = dispSlash.includes('class="bass-root-highlight">E<') &&
                    dispSlash.includes('class="bass-slash-hint">(C/E)<');

const dispRoot = window.BassLens.formatBassDisplay('C');
const dispRootOk = dispRoot.includes('class="bass-root-highlight">C<') &&
                   !dispRoot.includes('bass-slash-hint');

// D. Test toggleBigBass
const defaultBig = window.BassLens.isBigBassActive();
window.BassLens.toggleBigBass(false);
const toggledOff = window.BassLens.isBigBassActive() === false && localStorageData['sheetapp_bass_big_notes'] === '0';
window.BassLens.toggleBigBass(true);
const toggledOn = window.BassLens.isBigBassActive() === true && localStorageData['sheetapp_bass_big_notes'] === '1';

console.log(JSON.stringify({
  slashPass,
  rootPass,
  infoSlashOk,
  infoRootOk,
  dispSlashOk,
  dispRootOk,
  defaultBig,
  toggledOff,
  toggledOn
}));
JS;

$tmpScript = sys_get_temp_dir() . '/test_bass_lens_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);
$output = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$json = json_decode((string)$output, true);

if (is_array($json)) {
    // 4. Behavioral: Trích xuất nốt bass từ hợp âm đảo (Slash Chords)
    assertCondition(
        !empty($json['slashPass']),
        "Behavioral: extractBassNote trích xuất chính xác nốt bass từ hợp âm đảo (C/E→E, G/B→B, D/F#→F#, Em9/G→G)",
        true
    );

    // 5. Behavioral: Trích xuất nốt gốc từ hợp âm thường (Root Notes)
    assertCondition(
        !empty($json['rootPass']),
        "Behavioral: extractBassNote trích xuất nốt gốc từ hợp âm thường (C→C, Am7→A, F#m→F#, Bbmaj7→Bb)",
        true
    );

    // 6. Behavioral: Phân tích chi tiết parseBassInfo cho hợp âm đảo
    assertCondition(
        !empty($json['infoSlashOk']),
        "Behavioral: parseBassInfo('C/E') nhận diện đúng { bassNote:'E', rootNote:'C', isSlash:true }",
        true
    );

    // 7. Behavioral: Phân tích chi tiết parseBassInfo cho hợp âm thường
    assertCondition(
        !empty($json['infoRootOk']),
        "Behavioral: parseBassInfo('Am7') nhận diện đúng { bassNote:'A', rootNote:'A', isSlash:false }",
        true
    );

    // 8. Behavioral: Định dạng formatBassDisplay cho hợp âm đảo
    assertCondition(
        !empty($json['dispSlashOk']),
        "Behavioral: formatBassDisplay('C/E') tạo HTML nổi bật nốt bass E và kèm gợi ý (C/E)",
        true
    );

    // 9. Behavioral: Định dạng formatBassDisplay cho hợp âm thường
    assertCondition(
        !empty($json['dispRootOk']),
        "Behavioral: formatBassDisplay('C') tạo HTML nổi bật nốt C gọn gàng",
        true
    );

    // 10. Behavioral: Bật/tắt chế độ Big Bass đồng bộ LocalStorage
    assertCondition(
        !empty($json['defaultBig']) && !empty($json['toggledOff']) && !empty($json['toggledOn']),
        "Behavioral: toggleBigBass lưu trạng thái chính xác vào localStorage ('sheetapp_bass_big_notes')",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử đơn vị BassLens qua Node.js: " . $output, true);
}

// ═══ KIỂM THỬ HÀNH VI TƯƠNG TÁC GIAO DIỆN & STAGE LENS ADAPTATION ═══
$roleAdaptScript = <<< 'JS'
const fs = require('fs');
const stageSrc = fs.readFileSync('assets/js/stage-lens.js', 'utf8');

const bassBarClass = new Set(['hidden']);
const guitarBarClass = new Set();
let lyricRenderCalled = false;

const window = {
  Store: { _state: {}, get(k) { return this._state[k]; }, set(k, v) { this._state[k] = v; } },
  localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); } },
  document: {
    body: { dataset: {} },
    getElementById(id) {
      if (id === 'bass-lens-bar') {
        return {
          classList: {
            contains: (c) => bassBarClass.has(c),
            add: (c) => bassBarClass.add(c),
            remove: (c) => bassBarClass.delete(c)
          }
        };
      }
      if (id === 'guitar-lens-bar') {
        return {
          classList: {
            contains: (c) => guitarBarClass.has(c),
            add: (c) => guitarBarClass.add(c),
            remove: (c) => guitarBarClass.delete(c)
          }
        };
      }
      return null;
    }
  },
  DisplaySettings: {
    renderLyricViewIfActive() {
      lyricRenderCalled = true;
    }
  },
  URLState: { update() {} }
};

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(stageSrc);

// Chuyển sang vai trò Bass
window.StageLens.setRole('bass', true, false);

const isBassRole = window.StageLens.getCurrentRole() === 'bass';
const bassBarVisible = !bassBarClass.has('hidden');
const guitarBarHidden = guitarBarClass.has('hidden');
const bodyStageLensAttr = window.document.body.dataset.stageLens === 'bass';

console.log(JSON.stringify({
  isBassRole,
  bassBarVisible,
  guitarBarHidden,
  bodyStageLensAttr,
  lyricRenderCalled
}));
JS;

$tmpAdapt = sys_get_temp_dir() . '/test_bass_adapt_' . uniqid() . '.js';
file_put_contents($tmpAdapt, $roleAdaptScript);
$adaptOut = shell_exec("node \"{$tmpAdapt}\" 2>&1");
@unlink($tmpAdapt);

$adaptJson = json_decode((string)$adaptOut, true);

if (is_array($adaptJson)) {
    // 11. Behavioral: StageLens chuyển vai trò thành 'bass'
    assertCondition(
        !empty($adaptJson['isBassRole']),
        "Behavioral: StageLens.getCurrentRole() trả về 'bass' khi kích hoạt",
        true
    );

    // 12. Behavioral: Hiển thị thanh bass-lens-bar và ẩn guitar-lens-bar
    assertCondition(
        !empty($adaptJson['bassBarVisible']) && !empty($adaptJson['guitarBarHidden']),
        "Behavioral: Chuyển sang Bass Lens tự động hiển thị #bass-lens-bar và ẩn #guitar-lens-bar",
        true
    );

    // 13. Behavioral: Cập nhật body[data-stage-lens="bass"]
    assertCondition(
        !empty($adaptJson['bodyStageLensAttr']),
        "Behavioral: document.body.dataset.stageLens được cập nhật thành 'bass'",
        true
    );

    // 14. Behavioral: Yêu cầu re-render lại lời bài hát với nốt Bass to
    assertCondition(
        !empty($adaptJson['lyricRenderCalled']),
        "Behavioral: Tự động kích hoạt DisplaySettings.renderLyricViewIfActive() để cập nhật nốt Bass",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử chuyển vai trò StageLens: " . $adaptOut, true);
}

// ═══ KIỂM THỬ HÀNH VI RENDER TRONG LYRIC EXTRACTOR ═══
$lyricRenderScript = <<< 'JS'
const fs = require('fs');

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
                    if (q.includes('bass-step')) return { textContent: 'E' };
                    if (q === 'kind') return { textContent: 'major', getAttribute: () => null };
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
            },
            {
              children: [
                {
                  tagName: 'harmony',
                  hasAttribute: () => false,
                  querySelector: (q) => {
                    if (q === 'root-step') return { textContent: 'G' };
                    if (q === 'bass-step') return null;
                    if (q === 'kind') return { textContent: 'major', getAttribute: () => null };
                    return null;
                  }
                },
                {
                  tagName: 'note',
                  querySelector: () => null,
                  querySelectorAll: (q) => [
                    {
                      getAttribute: () => '1',
                      querySelector: (sq) => sq === 'text' ? { textContent: 'yêu' } : { textContent: 'single' }
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

const lyricSrc = fs.readFileSync('assets/js/lyric-extractor.js', 'utf8');
const bassSrc = fs.readFileSync('assets/js/bass-lens.js', 'utf8');


const window = {
  SafeHtml: {
    escape: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  },
  StageLens: {
    getCurrentRole: () => 'bass'
  },
  document: {
    body: { dataset: { stageLens: 'bass' } }
  },
  localStorage: { getItem: () => '1', setItem: () => {} }
};
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(bassSrc);
eval(lyricSrc);

// Tạo đoạn text có hợp âm đảo C/E và hợp âm thường G
const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <direction>
        <direction-type>
          <harmony>
            <root><root-step>C</root-step></root>
            <kind>major</kind>
            <bass><bass-step>E</bass-step></bass>
          </harmony>
        </direction-type>
      </direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <lyric><text>Chúa</text></lyric>
      </note>
    </measure>
    <measure number="2">
      <direction>
        <direction-type>
          <harmony>
            <root><root-step>G</root-step></root>
            <kind>major</kind>
          </harmony>
        </direction-type>
      </direction>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration>
        <lyric><text>yêu</text></lyric>
      </note>
    </measure>
  </part>
</score-partwise>`;

let renderedHtml = '';
const container = {
  style: { setProperty: () => {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
  set innerHTML(html) { renderedHtml = html; },
  get innerHTML() { return renderedHtml; }
};
window.document.getElementById = (id) => container;


window.LyricExtractor.render('lyric-view-container', mockXml, 0);

const hasBassRootE = renderedHtml.includes('<span class="lv-bass-root">E</span>');
const hasBassSubCE = renderedHtml.includes('<span class="lv-bass-sub">(C/E)</span>');
const hasBassRootG = renderedHtml.includes('<span class="lv-bass-root">G</span>');
const hasChordBassClass = renderedHtml.includes('lv-chord-bass');

console.log(JSON.stringify({
  renderedHtml,
  hasBassRootE,
  hasBassSubCE,
  hasBassRootG,
  hasChordBassClass
}));

JS;

$tmpLyric = sys_get_temp_dir() . '/test_bass_lyric_' . uniqid() . '.js';
file_put_contents($tmpLyric, $lyricRenderScript);
$lyricOut = shell_exec("node \"{$tmpLyric}\" 2>&1");
@unlink($tmpLyric);

$lyricJson = json_decode((string)$lyricOut, true);

if (is_array($lyricJson)) {
    // 15. Behavioral: LyricExtractor render nốt bass to 'E' cho C/E
    assertCondition(
        !empty($lyricJson['hasBassRootE']),
        "Behavioral: LyricExtractor render nốt Bass lớn 'E' cho hợp âm đảo C/E",
        true
    );

    // 16. Behavioral: LyricExtractor render ghi chú '(C/E)' cho C/E
    assertCondition(
        !empty($lyricJson['hasBassSubCE']),
        "Behavioral: LyricExtractor render ghi chú phụ '(C/E)' cho nhạc công Bass tham chiếu",
        true
    );

    // 17. Behavioral: LyricExtractor render nốt bass to 'G' cho hợp âm G
    assertCondition(
        !empty($lyricJson['hasBassRootG']),
        "Behavioral: LyricExtractor render nốt gốc lớn 'G' cho hợp âm chuẩn G",
        true
    );

    // 18. Behavioral: Gán class lv-chord-bass cho phần tử hợp âm
    assertCondition(
        !empty($lyricJson['hasChordBassClass']),
        "Behavioral: Phần tử hiển thị hợp âm có class .lv-chord-bass để kích hoạt CSS chuyên biệt",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử LyricExtractor với BassLens: " . $lyricOut, true);
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
