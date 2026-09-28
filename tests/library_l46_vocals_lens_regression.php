<?php
declare(strict_types=1);

/**
 * tests/library_l46_vocals_lens_regression.php
 *
 * Kiểm thử hồi quy Ticket L4-6 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * - Hát: Chế độ Một khổ, chỉ giai điệu (ẩn khoá Fa, bè), không hợp âm.
 * - Chế độ Một khổ (Single verse mode) qua VerseManager.
 * - Chỉ giai điệu qua OSMDRenderer.setCompactMode(true) (ẩn khuông Fa và bè phụ).
 * - Không hợp âm: ẩn #chord-canvas và lớp ký hiệu hợp âm.
 * - Thanh điều khiển Vocals Lens Bar và các tuỳ chọn linh hoạt.
 * - Tuân thủ Line budget < 600 dòng và tỷ lệ Behavioral checks >= 56%.
 */

$testName = "Ticket L4-6: Vocals Stage Lens (Single Verse, Melody Only & No Chords)";
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

$vocalsLensFile = __DIR__ . '/../assets/js/vocals-lens.js';
$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$cssFile = __DIR__ . '/../assets/css/components.css';

// 1. Kiểm tra tồn tại file và số dòng
assertCondition(file_exists($vocalsLensFile), "File assets/js/vocals-lens.js tồn tại");
$vocalsSrc = file_exists($vocalsLensFile) ? file_get_contents($vocalsLensFile) : '';
$vocalsLines = count(explode("\n", $vocalsSrc));
assertCondition($vocalsLines > 100 && $vocalsLines < 600, "assets/js/vocals-lens.js duy trì {$vocalsLines} dòng (< 600 dòng)");

// 2. Kiểm tra CSS components
$cssSrc = file_exists($cssFile) ? file_get_contents($cssFile) : '';
$cssLines = count(explode("\n", $cssSrc));
assertCondition($cssLines > 100 && $cssLines < 600, "assets/css/components.css duy trì {$cssLines} dòng (< 600 dòng)");
assertCondition(
    str_contains($cssSrc, '.vocals-lens-bar') &&
    str_contains($cssSrc, '.vocals-mode-badge') &&
    str_contains($cssSrc, '.btn-vocals-tool') &&
    str_contains($cssSrc, 'body.vocals-lens-active #chord-canvas'),
    "components.css chứa đầy đủ định dạng cho .vocals-lens-bar, .vocals-mode-badge, .btn-vocals-tool và ẩn hợp âm"
);

// 3. Kiểm tra stage-lens.js tích hợp vai trò vocals
$stageSrc = file_exists($stageLensFile) ? file_get_contents($stageLensFile) : '';
assertCondition(
    str_contains($stageSrc, "roleId === 'vocals'") &&
    str_contains($stageSrc, 'VocalsLens?.activate'),
    "stage-lens.js tích hợp kích hoạt VocalsLens khi chọn vai trò Hát"
);

// ═══ KIỂM THỬ HÀNH VI ĐƠN VỊ VÀ ĐIỀU HƯỚNG QUA NODE.JS ═══
$nodeScript = <<< 'JS'
const fs = require('fs');
const vocalsSrc = fs.readFileSync('assets/js/vocals-lens.js', 'utf8');

let verseMode = 'all';
let compactMode = false;
const bodyClasses = new Set();
const chordCanvasStyle = { display: 'block' };
const vocalsBarClass = new Set(['hidden']);

const mockElements = {};
function getMock(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      style: { setProperty: () => {} },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, v) { if (v) this._set.add(c); else this._set.delete(c); }
      },
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      dataset: {}
    };
  }
  return mockElements[id];
}

const window = {
  VerseManager: {
    setMode: (m) => { verseMode = m; },
    getMode: () => verseMode,
    getCurrentVerse: () => 1,
    getAvailableVerses: () => [1, 2, 3, 4]
  },
  OSMDRenderer: {
    setCompactMode: (c) => { compactMode = c; },
    getCompactMode: () => compactMode
  },
  document: {
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        contains: (c) => bodyClasses.has(c)
      },
      dataset: {}
    },
    getElementById(id) {
      if (id === 'chord-canvas') return { style: chordCanvasStyle };
      if (id === 'vocals-lens-bar') {
        const el = getMock(id);
        el.classList.contains = (c) => vocalsBarClass.has(c);
        el.classList.add = (c) => vocalsBarClass.add(c);
        el.classList.remove = (c) => vocalsBarClass.delete(c);
        el.classList.toggle = (c, v) => { if (v) vocalsBarClass.add(c); else vocalsBarClass.delete(c); };
        return el;
      }
      return getMock(id);
    },
    createElement(tag) {
      return getMock('el_' + Math.random());
    }
  }
};

global.window = window;
global.document = window.document;

eval(vocalsSrc);

// 1. Kiểm tra trạng thái ban đầu
const initialActive = window.VocalsLens.isActive();

// 2. Kích hoạt VocalsLens
window.VocalsLens.activate();
const activated = window.VocalsLens.isActive() === true;
const singleVerseOk = verseMode === 'single';
const compactOk = compactMode === true;
const chordHidden = chordCanvasStyle.display === 'none';
const bodyClassOk = bodyClasses.has('vocals-lens-active');
const barVisible = !vocalsBarClass.has('hidden');

// 3. Test toggle ẩn khoá Fa
window.VocalsLens.toggleHideFaStaff(false);
const faToggledOff = compactMode === false;
window.VocalsLens.toggleHideFaStaff(true);
const faToggledOn = compactMode === true;

// 4. Test toggle ẩn hợp âm
window.VocalsLens.toggleHideChords(false);
const chordsShown = chordCanvasStyle.display === 'block';
window.VocalsLens.toggleHideChords(true);
const chordsHiddenAgain = chordCanvasStyle.display === 'none';

// 5. Deactivate
window.VocalsLens.deactivate();
const deactivated = window.VocalsLens.isActive() === false;
const bodyClassRemoved = !bodyClasses.has('vocals-lens-active');
const verseRestored = verseMode === 'all';
const compactRestored = compactMode === false;
const chordsRestored = chordCanvasStyle.display === 'block';

console.log(JSON.stringify({
  initialActive,
  activated,
  singleVerseOk,
  compactOk,
  chordHidden,
  bodyClassOk,
  barVisible,
  faToggledOff,
  faToggledOn,
  chordsShown,
  chordsHiddenAgain,
  deactivated,
  bodyClassRemoved,
  verseRestored,
  compactRestored,
  chordsRestored
}));
JS;

$tmpScript = sys_get_temp_dir() . '/test_vocals_lens_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);
$output = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$json = json_decode((string)$output, true);

if (is_array($json)) {
    // 4. Behavioral: VocalsLens kích hoạt thành công
    assertCondition(
        $json['initialActive'] === false && !empty($json['activated']),
        "Behavioral: VocalsLens.activate() chuyển trạng thái isActive() thành true",
        true
    );

    // 5. Behavioral: Tự động chuyển sang chế độ Một khổ (Single verse)
    assertCondition(
        !empty($json['singleVerseOk']),
        "Behavioral: VocalsLens.activate() tự động gọi VerseManager.setMode('single') phóng to lời ca",
        true
    );

    // 6. Behavioral: Chỉ giai điệu qua OSMDRenderer.setCompactMode(true)
    assertCondition(
        !empty($json['compactOk']),
        "Behavioral: VocalsLens.activate() tự động kích hoạt compactMode (ẩn khoá Fa và các bè phụ)",
        true
    );

    // 7. Behavioral: Ẩn hoàn toàn hợp âm
    assertCondition(
        !empty($json['chordHidden']),
        "Behavioral: VocalsLens.activate() ẩn #chord-canvas để nhường toàn bộ không gian cho giai điệu",
        true
    );

    // 8. Behavioral: Gán body.vocals-lens-active và hiển thị #vocals-lens-bar
    assertCondition(
        !empty($json['bodyClassOk']) && !empty($json['barVisible']),
        "Behavioral: Gán class vocals-lens-active trên body và hiển thị thanh điều khiển #vocals-lens-bar",
        true
    );

    // 9. Behavioral: Bật/tắt linh hoạt tuỳ chọn ẩn khoá Fa
    assertCondition(
        !empty($json['faToggledOff']) && !empty($json['faToggledOn']),
        "Behavioral: toggleHideFaStaff cho phép ca viên linh hoạt bật/tắt hiển thị khoá Fa",
        true
    );

    // 10. Behavioral: Bật/tắt linh hoạt tuỳ chọn ẩn hợp âm
    assertCondition(
        !empty($json['chordsShown']) && !empty($json['chordsHiddenAgain']),
        "Behavioral: toggleHideChords cho phép ca viên linh hoạt bật/tắt hiển thị hợp âm",
        true
    );

    // 11. Behavioral: Deactivate phục hồi hoàn toàn trạng thái bản nhạc
    assertCondition(
        !empty($json['deactivated']) && !empty($json['bodyClassRemoved']) &&
        !empty($json['verseRestored']) && !empty($json['compactRestored']) && !empty($json['chordsRestored']),
        "Behavioral: VocalsLens.deactivate() phục hồi hoàn toàn chế độ khổ, khoá Fa và hiển thị hợp âm",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử đơn vị VocalsLens qua Node.js: " . $output, true);
}

// ═══ KIỂM THỬ HÀNH VI TÍCH HỢP VỚI STAGE LENS ═══
$roleAdaptScript = <<< 'JS'
const fs = require('fs');
const vocalsSrc = fs.readFileSync('assets/js/vocals-lens.js', 'utf8');
const stageSrc = fs.readFileSync('assets/js/stage-lens.js', 'utf8');

const bodyClasses = new Set();
let verseMode = 'all';
let compactMode = false;

const mockElements = {};
function getMock(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      style: { setProperty: () => {} },
      classList: {
        _set: new Set(['hidden']),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, v) { if (v) this._set.add(c); else this._set.delete(c); }
      },
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      dataset: {}
    };
  }
  return mockElements[id];
}

const window = {
  Store: { _state: {}, get(k) { return this._state[k]; }, set(k, v) { this._state[k] = v; } },
  localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); } },
  document: {
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        contains: (c) => bodyClasses.has(c)
      },
      dataset: {}
    },
    getElementById(id) { return getMock(id); },
    createElement(tag) { return getMock('el_' + Math.random()); }
  },
  VerseManager: {
    setMode: (m) => { verseMode = m; },
    getMode: () => verseMode,
    getCurrentVerse: () => 1,
    getAvailableVerses: () => [1, 2, 3]
  },
  OSMDRenderer: {
    setCompactMode: (c) => { compactMode = c; },
    getCompactMode: () => compactMode
  },
  SafeHtml: { escape: (s) => String(s) },
  URLState: { update() {} }
};

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(vocalsSrc);
eval(stageSrc);

// 1. Chuyển sang vai trò Hát (vocals)
window.StageLens.setRole('vocals', true, false);

const isVocalsRole = window.StageLens.getCurrentRole() === 'vocals';
const bodyVocalsDataset = window.document.body.dataset.stageLens === 'vocals';
const isVocalsActive = window.VocalsLens.isActive();
const isSingleVerseActive = verseMode === 'single';
const isCompactActive = compactMode === true;

// 2. Chuyển sang vai trò Guitar
window.StageLens.setRole('guitar', true, false);
const isGuitarRole = window.StageLens.getCurrentRole() === 'guitar';
const isVocalsDeactivated = !window.VocalsLens.isActive();

console.log(JSON.stringify({
  isVocalsRole,
  bodyVocalsDataset,
  isVocalsActive,
  isSingleVerseActive,
  isCompactActive,
  isGuitarRole,
  isVocalsDeactivated
}));
JS;

$tmpAdapt = sys_get_temp_dir() . '/test_vocals_adapt_' . uniqid() . '.js';
file_put_contents($tmpAdapt, $roleAdaptScript);
$adaptOut = shell_exec("node \"{$tmpAdapt}\" 2>&1");
@unlink($tmpAdapt);

$adaptJson = json_decode((string)$adaptOut, true);

if (is_array($adaptJson)) {
    // 12. Behavioral: StageLens kích hoạt vai trò 'vocals'
    assertCondition(
        !empty($adaptJson['isVocalsRole']) && !empty($adaptJson['bodyVocalsDataset']),
        "Behavioral: StageLens chuyển vai trò thành 'vocals' và gán body[data-stage-lens='vocals']",
        true
    );

    // 13. Behavioral: Kích hoạt VocalsLens đồng bộ Một khổ và Chỉ giai điệu
    assertCondition(
        !empty($adaptJson['isVocalsActive']) && !empty($adaptJson['isSingleVerseActive']) && !empty($adaptJson['isCompactActive']),
        "Behavioral: StageLens kích hoạt VocalsLens với chế độ Một khổ và ẩn khoá Fa",
        true
    );

    // 14. Behavioral: Đổi sang vai trò khác tự động deactivate VocalsLens
    assertCondition(
        !empty($adaptJson['isGuitarRole']) && !empty($adaptJson['isVocalsDeactivated']),
        "Behavioral: Chuyển vai trò sang Guitar tự động hủy kích hoạt VocalsLens",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử chuyển vai trò StageLens Hát: " . $adaptOut, true);
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
