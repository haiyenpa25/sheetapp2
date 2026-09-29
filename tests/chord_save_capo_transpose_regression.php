<?php
declare(strict_types=1);

/**
 * tests/chord_save_capo_transpose_regression.php
 *
 * Kiểm thử hồi quy Ticket R0-5 (ROADMAP5, lỗi B7):
 * Khi lưu hợp âm đang gõ (đang xem ở tông đã dịch + có Capo), server phải
 * nhận đúng hợp âm ở TÔNG GỐC. ChordCanvasTranspose.applyTranspose() (đường
 * HIỂN THỊ) tính effectiveShift = semitones - capo rồi transpose hợp âm gốc
 * theo effectiveShift đó để ra hợp âm hiển thị. Trước đây, đường LƯU
 * (ChordCanvasEdit.saveChord) chỉ đảo ngược `semitones` và bỏ quên `capo`
 * hoàn toàn — có Capo thì hợp âm lưu sai tông gốc.
 *
 * Test dùng chính assets/js/transpose-engine.js thật (nạp qua Node vm, không
 * viết lại logic transpose) để không tự mock sai công thức âm nhạc.
 */

$testName = "Ticket R0-5: Lưu hợp âm phải đảo ngược cả Semitones lẫn Capo (lỗi B7)";
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

$editFile = __DIR__ . '/../assets/js/chord-canvas-edit.js';
assertCondition(file_exists($editFile), "File assets/js/chord-canvas-edit.js tồn tại");
$editSrc = file_exists($editFile) ? file_get_contents($editFile) : '';

// ── 1. Static: saveChord() phải đọc capoLevel và tính effectiveShift = semitones - capo ──
assertCondition(
    str_contains($editSrc, "const capo = window.Store?.get?.('capoLevel') ?? 0;"),
    "saveChord() đọc capoLevel từ Store (không còn bỏ quên Capo)"
);
assertCondition(
    str_contains($editSrc, 'const effectiveShift = semitones - capo;') &&
    str_contains($editSrc, 'TransposeEngine.transposeChord(chordInput, -effectiveShift, useFlatsOriginal)'),
    "saveChord() đảo ngược ĐÚNG effectiveShift (semitones - capo), khớp công thức HIỂN THỊ trong ChordCanvasTranspose.applyTranspose()"
);

// ── 2. Behavioral: nạp TransposeEngine.js THẬT qua Node vm, kiểm chứng công thức đảo ngược ──
$transposeEngineFile = __DIR__ . '/../assets/js/transpose-engine.js';
assertCondition(file_exists($transposeEngineFile), "File assets/js/transpose-engine.js tồn tại");
$teSrc = file_exists($transposeEngineFile) ? file_get_contents($transposeEngineFile) : '';
// Escape dấu backtick/$ khi nhúng nguyên văn source thật vào template literal của Node script
$teSrcEscaped = str_replace(['\\', '`', '$'], ['\\\\', '\\`', '\\$'], $teSrc);

$nodeScript = <<<NODE
const assert = require('assert');
const vm = require('vm');

// Nạp NGUYÊN VĂN transpose-engine.js thật (không viết lại công thức) — không cung cấp
// global.Tonal nên TransposeEngine tự rơi về _manualTranspose (thuần chromatic, không
// phụ thuộc npm package nào), đủ để kiểm chứng phép cộng/trừ semitone chính xác.
const sandbox = { console };
vm.createContext(sandbox);
// vm.runInContext không tự gắn khai báo top-level "const" vào đối tượng sandbox,
// nên phải tự gán "this.TransposeEngine = TransposeEngine;" ngay trong CÙNG script
// (cùng scope) để lấy ra được sau khi chạy xong.
vm.runInContext(`{$teSrcEscaped}\nthis.TransposeEngine = TransposeEngine;`, sandbox);
const TransposeEngine = sandbox.TransposeEngine;
assert.ok(TransposeEngine && typeof TransposeEngine.transposeChord === 'function', 'TransposeEngine.transposeChord phải nạp được từ file thật');

// Tái hiện ĐÚNG công thức đã sửa trong saveChord() (chord-canvas-edit.js):
//   effectiveShift = semitones - capo
//   chordOriginalKey = effectiveShift===0 ? chordInput : transposeChord(chordInput, -effectiveShift, useFlats)
function saveReverse(displayedInput, semitones, capo, useFlats) {
  const effectiveShift = semitones - capo;
  if (effectiveShift === 0) return displayedInput;
  return TransposeEngine.transposeChord(displayedInput, -effectiveShift, useFlats);
}

// Công thức HIỂN THỊ thật trong ChordCanvasTranspose.applyTranspose() (chiều ngược lại):
function displayForward(originalChord, semitones, capo, useFlats) {
  const effectiveShift = semitones - capo;
  if (effectiveShift === 0) return originalChord;
  return TransposeEngine.transposeChord(originalChord, effectiveShift, useFlats);
}

// 1. Kịch bản đúng như đề bài ticket: tông +2, capo 3, gõ "C" khi đang xem ->
//    effectiveShift = 2-3 = -1 -> đảo ngược = transposeChord('C', +1) = 'C#'
const r1 = saveReverse('C', 2, 3, false);
assert.strictEqual(r1, 'C#', 'tông +2, capo 3, gõ "C": phải lưu đúng "C#" ở tông gốc (nhận được "' + r1 + '")');

// 2. Chỉ có Capo, KHÔNG dịch tông (semitones=0): trước đây bị BỎ QUA hoàn toàn vì code cũ
//    chỉ kiểm tra "semitones !== 0". Capo 3 một mình vẫn phải đảo ngược +3 semitone.
const r2 = saveReverse('C', 0, 3, false);
assert.strictEqual(r2, 'D#', 'chỉ có capo=3 (semitones=0), gõ "C": phải lưu "D#" ở tông gốc, không được giữ nguyên "C" (nhận được "' + r2 + '")');
assert.notStrictEqual(r2, 'C', 'lỗi B7 tái diễn nếu capo một mình không làm hợp âm lưu thay đổi gì');

// 3. Round-trip: hiển thị thuận rồi lưu ngược phải cho lại đúng hợp âm gốc ban đầu,
//    với nhiều tổ hợp (semitones, capo) khác nhau -- không chỉ đúng 1 trường hợp may rủi.
const cases = [
  { orig: 'G',  semitones: -2, capo: 1 },
  { orig: 'Am', semitones: 5,  capo: 2 },
  { orig: 'D7', semitones: 0,  capo: 5 },
  { orig: 'F#m', semitones: -7, capo: 0 },
];
for (const c of cases) {
  const displayed = displayForward(c.orig, c.semitones, c.capo, false);
  const restored = saveReverse(displayed, c.semitones, c.capo, false);
  assert.strictEqual(restored, c.orig,
    'Round-trip thất bại cho orig=' + c.orig + ' semitones=' + c.semitones + ' capo=' + c.capo +
    ': hiển thị="' + displayed + '", lưu lại="' + restored + '" (kỳ vọng "' + c.orig + '")');
}

console.log('NODE_SIM_SUCCESS');
NODE;

$nodeTemp = __DIR__ . '/../storage/data/temp_r05_capo_sim.js';
file_put_contents($nodeTemp, $nodeScript);
$nodeOutput = shell_exec("node " . escapeshellarg($nodeTemp) . " 2>&1");
@unlink($nodeTemp);

$nodeSuccess = str_contains((string)$nodeOutput, 'NODE_SIM_SUCCESS');
assertCondition(
    $nodeSuccess,
    "Mô phỏng Node.js (TransposeEngine thật): đảo ngược đúng cả semitones lẫn capo, round-trip ổn định qua nhiều tổ hợp",
    true
);
if (!$nodeSuccess) {
    echo "[OUTPUT]: " . trim((string)$nodeOutput) . "\n";
}

// ── 3. Line budget ──
$editLines = count(file($editFile));
assertCondition($editLines < 600, "assets/js/chord-canvas-edit.js duy trì {$editLines} dòng (< 600)");

// ── Tổng kết ──
$behavioralPercent = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;
echo "\n--- KẾT QUẢ KIỂM THỬ TICKET R0-5 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra hành vi (Behavioral): {$behavioralChecks} / {$totalChecks} ({$behavioralPercent}%)\n";

$failed = array_filter($checks, fn($c) => !$c['pass']);
if (empty($failed)) {
    echo "=> TẤT CẢ CHECKS ĐỀU PASS!\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "=> CÓ " . count($failed) . " KIỂM TRA THẤT BẠI:\n";
    foreach ($failed as $f) {
        echo "  - {$f['desc']}\n";
    }
    exit(1);
}
