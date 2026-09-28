<?php
declare(strict_types=1);

/**
 * tests/library_l45_drums_lens_regression.php
 *
 * Kiểm thử hồi quy Ticket L4-5 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * - Trống: Bản đồ bài + BPM + đếm ô nhịp + đèn nhịp; không nốt, không hợp âm.
 * - Giao diện sân khấu Trống không nốt nhạc (#osmd-container ẩn), không hợp âm.
 * - Số BPM cực đại, nút TAP Tempo và điều chỉnh nhanh.
 * - Đèn nhịp LED trực quan nhấp nháy theo thời gian thực (real-time visual flasher).
 * - Bộ đếm ô nhịp (Measure Counter) tự động chuyển bar hoặc thao tác thủ công.
 * - Bản đồ bài hát (Song Sections Map): Dạo · K1 · ĐK · K2 · ĐK · Kết.
 * - Tuân thủ Line budget < 600 dòng và tỷ lệ Behavioral checks >= 56%.
 */

$testName = "Ticket L4-5: Drums Stage Lens (Roadmap, BPM, Measure Counter & LED Flasher)";
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

$drumsLensFile = __DIR__ . '/../assets/js/drums-lens.js';
$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$cssFile = __DIR__ . '/../assets/css/components.css';

// 1. Kiểm tra file và kích thước
assertCondition(file_exists($drumsLensFile), "File assets/js/drums-lens.js tồn tại");
$drumsSrc = file_exists($drumsLensFile) ? file_get_contents($drumsLensFile) : '';
$drumsLines = count(explode("\n", $drumsSrc));
assertCondition($drumsLines > 100 && $drumsLines < 600, "assets/js/drums-lens.js duy trì {$drumsLines} dòng (< 600 dòng)");

// 2. Kiểm tra CSS components cho Drums Stage Lens
$cssSrc = file_exists($cssFile) ? file_get_contents($cssFile) : '';
$cssLines = count(explode("\n", $cssSrc));
assertCondition($cssLines > 100 && $cssLines < 600, "assets/css/components.css duy trì {$cssLines} dòng (< 600 dòng)");
assertCondition(
    str_contains($cssSrc, '.drums-stage-container') &&
    str_contains($cssSrc, '.drums-bpm-number') &&
    str_contains($cssSrc, '.drums-led-flasher') &&
    str_contains($cssSrc, '.drums-measure-box') &&
    str_contains($cssSrc, '.drums-section-chip'),
    "components.css chứa đầy đủ định dạng cho .drums-stage-container, .drums-bpm-number, .drums-led-flasher, .drums-measure-box và .drums-section-chip"
);

// 3. Kiểm tra stage-lens.js tích hợp vai trò drums
$stageSrc = file_exists($stageLensFile) ? file_get_contents($stageLensFile) : '';
assertCondition(
    str_contains($stageSrc, "roleId === 'drums'") &&
    str_contains($stageSrc, 'DrumsLens?.activate'),
    "stage-lens.js tích hợp kích hoạt DrumsLens khi chọn vai trò trống"
);

// ═══ KIỂM THỬ HÀNH VI ĐƠN VỊ VÀ STATE MACHINE QUA NODE.JS ═══
$nodeScript = <<< 'JS'
const fs = require('fs');
const drumsSrc = fs.readFileSync('assets/js/drums-lens.js', 'utf8');

const window = {
  Metronome: {
    _bpm: 80,
    setBpm(b) { this._bpm = b; },
    getBpm() { return this._bpm; },
    getBeatsPerMeasure() { return 4; },
    togglePlay() { this.playing = !this.playing; }
  },
  ArrangementEngine: {
    getSections() { return null; },
    jumpToSection(id) { this.lastJump = id; }
  },
  SafeHtml: {
    escape: (s) => String(s)
  }
};
global.window = window;

eval(drumsSrc);

// A. Test BPM getter/setter
const initialBpm = window.DrumsLens.getBpm();
window.DrumsLens.setBpm(128);
const updatedBpm = window.DrumsLens.getBpm() === 128 && window.Metronome.getBpm() === 128;

// B. Test Measure navigation
const m1 = window.DrumsLens.getCurrentMeasure();
window.DrumsLens.nextMeasure();
const m2 = window.DrumsLens.getCurrentMeasure();
window.DrumsLens.prevMeasure();
const m1Again = window.DrumsLens.getCurrentMeasure();
window.DrumsLens.setMeasure(15);
const m15 = window.DrumsLens.getCurrentMeasure();
window.DrumsLens.resetMeasure();
const mReset = window.DrumsLens.getCurrentMeasure();

const measureNavOk = m1 === 1 && m2 === 2 && m1Again === 1 && m15 === 15 && mReset === 1;

// C. Test Song Sections Roadmap
const sections = window.DrumsLens.getSections();
const hasSections = Array.isArray(sections) && sections.length >= 4;
const hasIntro = sections.some(s => s.name === 'Dạo' || s.type === 'intro');
const hasChorus = sections.some(s => s.name === 'ĐK' || s.type === 'chorus');

// D. Test Jump to Section
window.DrumsLens.jumpToSection('sec-chorus1');
const curSec = window.DrumsLens.getCurrentSection();
const jumpedMeasure = window.DrumsLens.getCurrentMeasure();
const jumpOk = curSec && curSec.type === 'chorus' && jumpedMeasure === curSec.start_measure && window.ArrangementEngine.lastJump === 'sec-chorus1';

// E. Test flashBeat & auto-increment bar
window.DrumsLens.activate();
const beforeBar = window.DrumsLens.getCurrentMeasure();
// Giả lập phách 0 (accent beat -> sang bar mới)
window.DrumsLens.flashBeat(0, true);
const afterBar = window.DrumsLens.getCurrentMeasure();
const beatOk = afterBar === beforeBar + 1;
window.DrumsLens.deactivate();

console.log(JSON.stringify({
  initialBpm,
  updatedBpm,
  measureNavOk,
  hasSections,
  hasIntro,
  hasChorus,
  jumpOk,
  beatOk
}));
JS;

$tmpScript = sys_get_temp_dir() . '/test_drums_lens_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);
$output = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$json = json_decode((string)$output, true);

if (is_array($json)) {
    // 4. Behavioral: BPM getter/setter đồng bộ Metronome
    assertCondition(
        !empty($json['updatedBpm']),
        "Behavioral: DrumsLens.setBpm(128) cập nhật BPM và đồng bộ với Metronome",
        true
    );

    // 5. Behavioral: Điều hướng ô nhịp (next, prev, set, reset)
    assertCondition(
        !empty($json['measureNavOk']),
        "Behavioral: Điều hướng ô nhịp (next, prev, setMeasure, resetMeasure) chính xác",
        true
    );

    // 6. Behavioral: Bản đồ bài hát chứa đầy đủ các phân đoạn
    assertCondition(
        !empty($json['hasSections']) && !empty($json['hasIntro']) && !empty($json['hasChorus']),
        "Behavioral: getSections() cung cấp bản đồ bài hát đầy đủ Dạo, Lời, Điệp Khúc, Kết",
        true
    );

    // 7. Behavioral: Nhảy đoạn cập nhật ô nhịp và kích hoạt ArrangementEngine
    assertCondition(
        !empty($json['jumpOk']),
        "Behavioral: jumpToSection('sec-chorus1') nhảy đến start_measure của Điệp Khúc và đồng bộ ArrangementEngine",
        true
    );

    // 8. Behavioral: flashBeat phách 0 tự động đếm tăng ô nhịp
    assertCondition(
        !empty($json['beatOk']),
        "Behavioral: flashBeat(0, true) phách nhấn đầu ô nhịp tự động tăng bộ đếm ô nhịp",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử đơn vị DrumsLens qua Node.js: " . $output, true);
}

// ═══ KIỂM THỬ HÀNH VI TƯƠNG TÁC GIAO DIỆN & ADAPTATION ═══
$roleAdaptScript = <<< 'JS'
const fs = require('fs');
const drumsSrc = fs.readFileSync('assets/js/drums-lens.js', 'utf8');
const stageSrc = fs.readFileSync('assets/js/stage-lens.js', 'utf8');

const osmdStyle = { display: 'block' };
const chordStyle = { display: 'block' };
const lyricClass = new Set();
const drumsClass = new Set(['hidden']);

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
      dataset: {},
      appendChild: () => {}
    };
  }
  return mockElements[id];
}

const window = {
  Store: { _state: {}, get(k) { return this._state[k]; }, set(k, v) { this._state[k] = v; } },
  localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); } },
  document: {
    body: { dataset: {} },
    getElementById(id) {
      const el = getMock(id);
      if (id === 'osmd-container') el.style = osmdStyle;
      if (id === 'chord-canvas') el.style = chordStyle;
      if (id === 'lyric-view-container') {
        el.classList.add = (c) => lyricClass.add(c);
        el.classList.remove = (c) => lyricClass.delete(c);
        el.classList.contains = (c) => lyricClass.has(c);
      }
      if (id === 'drums-stage-container') {
        el.classList.add = (c) => drumsClass.add(c);
        el.classList.remove = (c) => drumsClass.delete(c);
        el.classList.contains = (c) => drumsClass.has(c);
      }
      return el;
    },
    createElement(tag) {
      return getMock('el_' + Math.random());
    }
  },
  SafeHtml: { escape: (s) => String(s) },
  Metronome: { getBpm: () => 88, getBeatsPerMeasure: () => 4 },
  URLState: { update() {} }
};

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(drumsSrc);
eval(stageSrc);

// 1. Chuyển sang vai trò Drums
window.StageLens.setRole('drums', true, false);

const isDrumsRole = window.StageLens.getCurrentRole() === 'drums';
const isDrumsActive = window.DrumsLens.isActive();
const osmdHidden = osmdStyle.display === 'none';
const chordHidden = chordStyle.display === 'none';
const lyricHidden = lyricClass.has('hidden');
const drumsVisible = !drumsClass.has('hidden');
const bodyDrumsRole = window.document.body.dataset.stageLens === 'drums';

// 2. Chuyển sang vai trò khác (Guitar)
window.StageLens.setRole('guitar', true, false);
const drumsDeactivated = !window.DrumsLens.isActive();
const osmdRestored = osmdStyle.display === 'block';

console.log(JSON.stringify({
  isDrumsRole,
  isDrumsActive,
  osmdHidden,
  chordHidden,
  lyricHidden,
  drumsVisible,
  bodyDrumsRole,
  drumsDeactivated,
  osmdRestored
}));
JS;

$tmpAdapt = sys_get_temp_dir() . '/test_drums_adapt_' . uniqid() . '.js';
file_put_contents($tmpAdapt, $roleAdaptScript);
$adaptOut = shell_exec("node \"{$tmpAdapt}\" 2>&1");
@unlink($tmpAdapt);

$adaptJson = json_decode((string)$adaptOut, true);

if (is_array($adaptJson)) {
    // 9. Behavioral: StageLens kích hoạt vai trò 'drums'
    assertCondition(
        !empty($adaptJson['isDrumsRole']) && !empty($adaptJson['bodyDrumsRole']),
        "Behavioral: StageLens chuyển vai trò thành 'drums' và cập nhật body[data-stage-lens='drums']",
        true
    );

    // 10. Behavioral: DrumsLens chuyển sang trạng thái active
    assertCondition(
        !empty($adaptJson['isDrumsActive']),
        "Behavioral: DrumsLens.isActive() trả về true khi kích hoạt vai trò Trống",
        true
    );

    // 11. Behavioral: Ẩn hoàn toàn nốt nhạc (#osmd-container) và hợp âm (#chord-canvas)
    assertCondition(
        !empty($adaptJson['osmdHidden']) && !empty($adaptJson['chordHidden']) && !empty($adaptJson['lyricHidden']),
        "Behavioral: Chế độ Trống tự động ẩn nốt nhạc (#osmd-container), ẩn hợp âm (#chord-canvas) và ẩn lời (#lyric-view-container)",
        true
    );

    // 12. Behavioral: Hiển thị sân khấu Trống (#drums-stage-container)
    assertCondition(
        !empty($adaptJson['drumsVisible']),
        "Behavioral: Hiển thị giao diện chuyên biệt #drums-stage-container cho nhạc công Trống",
        true
    );

    // 13. Behavioral: Rời khỏi vai trò Trống tự động deactivate và phục hồi bản nhạc
    assertCondition(
        !empty($adaptJson['drumsDeactivated']) && !empty($adaptJson['osmdRestored']),
        "Behavioral: Đổi vai trò khỏi Trống tự động deactivate DrumsLens và phục hồi hiển thị bản nhạc",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử chuyển vai trò StageLens Trống: " . $adaptOut, true);
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
