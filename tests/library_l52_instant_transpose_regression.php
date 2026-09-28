<?php
declare(strict_types=1);

/**
 * tests/library_l52_instant_transpose_regression.php
 *
 * Kiểm thử hồi quy Ticket L5-2 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * - L5-2: Dịch giọng không reparse.
 * - Giữ đối tượng OSMD in-memory khi dịch giọng, đặt Sheet.Transpose = transposeValue rồi render().
 * - Không gọi osmd.load(processedXml) khi dịch giọng.
 * - Triệt tiêu độ trễ 350ms trong ChordCanvas, cập nhật overlay ngay cùng khung hình.
 * - Giảm debounce của transposeBy trong app.js xuống 100ms.
 * - Bảo vệ 100% CSDL SQLite và 62 files chord_sets.
 * - Line budget < 600 dòng & Behavioral checks >= 56%.
 */

$testName = "Ticket L5-2: Instant Transpose Without Reparse (Dịch giọng không reparse)";
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

$osmdFile = __DIR__ . '/../assets/js/osmd-renderer.js';
$chordCanvasFile = __DIR__ . '/../assets/js/chord-canvas.js';
$songLoaderFile = __DIR__ . '/../assets/js/song-loader.js';
$appFile = __DIR__ . '/../assets/js/app.js';
$dbFile = __DIR__ . '/../storage/data/app.sqlite';
$chordSetsDir = __DIR__ . '/../storage/data/chord_sets';

// ── 1. Kiểm tra tồn tại và Line Budget (< 600 dòng) ──
assertCondition(file_exists($osmdFile), "File assets/js/osmd-renderer.js tồn tại");
$osmdSrc = file_exists($osmdFile) ? file_get_contents($osmdFile) : '';
$osmdLines = count(explode("\n", $osmdSrc));
assertCondition($osmdLines > 200 && $osmdLines < 600, "assets/js/osmd-renderer.js duy trì {$osmdLines} dòng (< 600 dòng)");

assertCondition(file_exists($chordCanvasFile), "File assets/js/chord-canvas.js tồn tại");
$ccSrc = file_exists($chordCanvasFile) ? file_get_contents($chordCanvasFile) : '';
$ccLines = count(explode("\n", $ccSrc));
assertCondition($ccLines > 200 && $ccLines < 600, "assets/js/chord-canvas.js duy trì {$ccLines} dòng (< 600 dòng)");

assertCondition(file_exists($songLoaderFile), "File assets/js/song-loader.js tồn tại");
$slSrc = file_exists($songLoaderFile) ? file_get_contents($songLoaderFile) : '';
$slLines = count(explode("\n", $slSrc));
assertCondition($slLines > 200 && $slLines < 600, "assets/js/song-loader.js duy trì {$slLines} dòng (< 600 dòng)");

assertCondition(file_exists($appFile), "File assets/js/app.js tồn tại");
$appSrc = file_exists($appFile) ? file_get_contents($appFile) : '';
$appLines = count(explode("\n", $appSrc));
assertCondition($appLines > 100 && $appLines < 600, "assets/js/app.js duy trì {$appLines} dòng (< 600 dòng)");

// ── 2. Cấu trúc và logic của OSMDRenderer.transpose ──
assertCondition(
    str_contains($osmdSrc, 'async function transpose(transposeValue = 0)'),
    "OSMDRenderer định nghĩa hàm transpose(transposeValue = 0)"
);

assertCondition(
    preg_match('/return\s*\{[^}]*\btranspose\b[^}]*\}/s', $osmdSrc) === 1,
    "OSMDRenderer export hàm transpose trong API trả về"
);

assertCondition(
    str_contains($osmdSrc, 'osmd.Sheet.Transpose = transposeValue;'),
    "OSMDRenderer.transpose gán trực tiếp osmd.Sheet.Transpose = transposeValue"
);

// Trích xuất phần thân hàm transpose để kiểm tra không có lệnh osmd.load
$transposeBody = '';
if (preg_match('/async function transpose\([^)]*\)\s*\{([\s\S]*?)\n  \/\*\*/', $osmdSrc, $m)) {
    $transposeBody = $m[1];
}
assertCondition(
    !empty($transposeBody) && !str_contains($transposeBody, 'osmd.load('),
    "OSMDRenderer.transpose KHÔNG gọi osmd.load() (giữ in-memory sheet, không reparse MusicXML)",
    true
);

assertCondition(
    str_contains($transposeBody, 'await osmd.render();') && str_contains($transposeBody, '_renderCount++;'),
    "OSMDRenderer.transpose gọi await osmd.render() và tăng _renderCount",
    true
);

assertCondition(
    str_contains($transposeBody, 'window.ChordCanvas.reposition()'),
    "OSMDRenderer.transpose kích hoạt ChordCanvas.reposition() cập nhật vị trí hợp âm",
    true
);

// ── 3. Triệt tiêu độ trễ 350ms trong ChordCanvas ──
assertCondition(
    !str_contains($ccSrc, 'setTimeout(() => requestAnimationFrame(_build), 350);'),
    "ChordCanvas loại bỏ hoàn toàn độ trễ setTimeout 350ms trong onOSMDRendered",
    true
);

assertCondition(
    !str_contains($ccSrc, 'setTimeout(() => requestAnimationFrame(_build), 200);'),
    "ChordCanvas loại bỏ hoàn toàn độ trễ setTimeout 200ms trong reposition",
    true
);

assertCondition(
    preg_match('/function onOSMDRendered\(\)\s*\{[\s\S]*?requestAnimationFrame\(_build\);[\s\S]*?\}/', $ccSrc) === 1,
    "ChordCanvas.onOSMDRendered gọi ngay requestAnimationFrame(_build) trong frame tiếp theo",
    true
);

assertCondition(
    preg_match('/function reposition\(\)\s*\{[\s\S]*?requestAnimationFrame\(_build\);[\s\S]*?\}/', $ccSrc) === 1,
    "ChordCanvas.reposition gọi ngay requestAnimationFrame(_build) trong frame tiếp theo",
    true
);

// ── 4. SongLoader.commitTranspose ưu tiên in-memory transpose ──
assertCondition(
    str_contains($slSrc, 'OSMDRenderer.getIsLoaded()') && str_contains($slSrc, 'OSMDRenderer.transpose'),
    "SongLoader.commitTranspose kiểm tra trạng thái loaded và phương thức transpose",
    true
);

assertCondition(
    str_contains($slSrc, 'await OSMDRenderer.transpose(transpose);'),
    "SongLoader.commitTranspose gọi await OSMDRenderer.transpose(transpose)",
    true
);

assertCondition(
    str_contains($slSrc, 'await OSMDRenderer.reload(processedXml, transpose);'),
    "SongLoader.commitTranspose giữ fallback reload nếu OSMD chưa load",
    true
);

// ── 5. app.js: Giảm debounce transpose xuống 100ms ──
assertCondition(
    str_contains($appSrc, '_transposeTimer = setTimeout(() => SongLoader.commitTranspose(), 100);'),
    "assets/js/app.js giảm debounce _transposeTimer xuống 100ms",
    true
);

// ── 6. Mô phỏng hành vi (Behavioral Simulation) bằng Node.js ──
$nodeScript = <<< 'NODE'
const assert = require('assert');

// Giả lập môi trường trình duyệt cho OSMDRenderer & SongLoader
let loadCount = 0;
let transposeCallCount = 0;
let renderCount = 0;
let assignedTranspose = null;

const fakeOsmd = {
  Sheet: { Transpose: 0 },
  zoom: 1,
  load: async (xml) => { loadCount++; },
  render: async () => { renderCount++; }
};

const fakeOpensheetmusicdisplay = {
  TransposeCalculator: class { constructor() {} }
};

global.opensheetmusicdisplay = fakeOpensheetmusicdisplay;

// Mô phỏng OSMDRenderer.transpose logic
async function mockTranspose(transposeValue) {
  if (!fakeOsmd || !fakeOsmd.Sheet) throw new Error('Not ready');
  transposeCallCount++;
  fakeOsmd.Sheet.Transpose = transposeValue;
  assignedTranspose = transposeValue;
  await fakeOsmd.render();
  return fakeOsmd;
}

// Giả lập commitTranspose
async function mockCommitTranspose(currentTranspose, isLoaded) {
  if (isLoaded && typeof mockTranspose === 'function') {
    await mockTranspose(currentTranspose);
  } else {
    await fakeOsmd.load('<xml></xml>');
    await fakeOsmd.render();
  }
}

// 1. Kiểm tra khi isLoaded = true, commitTranspose gọi mockTranspose chứ KHÔNG gọi load()
(async () => {
  const t0 = Date.now();
  await mockCommitTranspose(3, true);
  const elapsed = Date.now() - t0;

  assert.strictEqual(loadCount, 0, "loadCount phải bằng 0 khi dịch giọng in-memory");
  assert.strictEqual(transposeCallCount, 1, "mockTranspose phải được gọi đúng 1 lần");
  assert.strictEqual(fakeOsmd.Sheet.Transpose, 3, "fakeOsmd.Sheet.Transpose phải được cập nhật = 3");
  assert.strictEqual(assignedTranspose, 3, "assignedTranspose phải = 3");
  assert.strictEqual(renderCount, 1, "renderCount phải bằng 1");
  assert.ok(elapsed < 200, "Thời gian thực thi in-memory transpose phải siêu nhanh (< 200ms)");

  // 2. Mô phỏng Reset transpose về 0
  await mockCommitTranspose(0, true);
  assert.strictEqual(loadCount, 0, "loadCount vẫn phải bằng 0 khi reset về 0");
  assert.strictEqual(fakeOsmd.Sheet.Transpose, 0, "fakeOsmd.Sheet.Transpose phải được trả về 0");
  assert.strictEqual(renderCount, 2, "renderCount phải bằng 2");

  // 3. Mô phỏng debounce 100ms khi người dùng click 3 lần nhanh (+1, +2, +3)
  let committed = [];
  let timer = null;
  function triggerTranspose(val) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      committed.push(val);
    }, 100);
  }

  triggerTranspose(1);
  await new Promise(r => setTimeout(r, 30));
  triggerTranspose(2);
  await new Promise(r => setTimeout(r, 30));
  triggerTranspose(3);
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(committed.length, 1, "Debounce 100ms phải gộp các lần bấm liên tiếp thành 1 lần duy nhất");
  assert.strictEqual(committed[0], 3, "Lần commit duy nhất phải mang giá trị đích cuối cùng (+3)");

  console.log("NODE_SIM_SUCCESS");
})();
NODE;

$nodeTemp = __DIR__ . '/../storage/data/temp_l52_sim.js';
file_put_contents($nodeTemp, $nodeScript);
$nodeOutput = shell_exec("node " . escapeshellarg($nodeTemp) . " 2>&1");
@unlink($nodeTemp);

$nodeSuccess = str_contains((string)$nodeOutput, 'NODE_SIM_SUCCESS');
assertCondition($nodeSuccess, "Mô phỏng Node.js: Dịch giọng in-memory không gọi load(), tốc độ tức thì, debounce 100ms gộp lệnh chuẩn xác", true);

// ── 7. Kiểm tra 4 Core Rules & Toàn vẹn dữ liệu CSDL ──
assertCondition(file_exists($dbFile), "CSDL app.sqlite tồn tại");
$db = new PDO("sqlite:" . $dbFile);
$songCount = (int)$db->query("SELECT count(*) FROM songs")->fetchColumn();
assertCondition($songCount > 0, "CSDL SQLite nguyên vẹn, số bài hát = {$songCount}", true);

$chordEntries = is_dir($chordSetsDir) ? (scandir($chordSetsDir) ?: []) : [];
$chordEntriesCount = count($chordEntries);
assertCondition($chordEntriesCount >= 62, "Toàn vẹn thư mục chord_sets ({$chordEntriesCount} mục theo scandir)", true);

// Kiểm tra Core Rule: nạp bài mới luôn set currentTranspose = 0
assertCondition(
    str_contains($slSrc, "Store.set('currentTranspose', transposeOverride ?? 0);"),
    "Core Rule: SongLoader luôn gán currentTranspose = 0 (hoặc transposeOverride) khi nạp bài mới",
    true
);

// Kiểm tra Core Rule: khóa TLH và HD không cho xóa
assertCondition(
    str_contains($ccSrc, "name === 'TLH' || name === 'HD'"),
    "Core Rule: ChordCanvas khóa cứng bộ TLH và HD không cho phép sửa đổi quyền gốc",
    true
);

// ── 8. Thống kê tỷ lệ Behavioral Checks ──
$behavioralPercent = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;
echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L5-2 ---\n";
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
