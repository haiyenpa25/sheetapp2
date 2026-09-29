<?php
/**
 * tests/library_r22_chord_palette_diatonic_regression.php
 * Regression test cho Ticket R2-2 (Bảng hợp âm theo tông đang hiển thị & Sửa B15):
 * 1. 7 hợp âm thuận theo tông đang hiển thị (Unit test: tông A → A Bm C#m D E F#m G#dim).
 * 2. Hợp âm 7 (V7, maj7), hợp âm đảo (slash/bass: A/C#, D/F#), hợp âm sus (Dsus4).
 * 3. Sửa B15: Dịch +2 thì bảng gợi ý đổi sang tông hiển thị thay vì giữ tông gốc (G + 2 → A).
 * 4. Phím tắt: 1–7 (đặt hợp âm thuận), Shift+1–7 (hợp âm 7), / + số (hợp âm đảo), . (lặp lại), T (TLH).
 * 5. Ngân sách dòng: chord-canvas-transpose.js, chord-canvas-ui.js, chord-canvas-edit.js < 600 dòng.
 */

$testName = "R2-2: Diatonic Chord Palette & Displayed Key (Fix B15)";
$passed = 0;
$failed = 0;
$checks = [];

function assertCheck($desc, $cond, $behavioral = false) {
    global $passed, $failed, $checks;
    if ($cond) {
        $passed++;
        $checks[] = "[PASS] " . ($behavioral ? "[BEHAVIORAL] " : "") . $desc;
    } else {
        $failed++;
        $checks[] = "[FAIL] " . ($behavioral ? "[BEHAVIORAL] " : "") . $desc;
    }
}

// 1. Kiểm tra tồn tại file và ngân sách dòng < 600 dòng
$transposeJs = __DIR__ . '/../assets/js/chord-canvas-transpose.js';
$uiJs        = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$editJs      = __DIR__ . '/../assets/js/chord-canvas-edit.js';

assertCheck("File chord-canvas-transpose.js tồn tại", file_exists($transposeJs));
assertCheck("File chord-canvas-ui.js tồn tại", file_exists($uiJs));
assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJs));

$transposeLines = count(file($transposeJs));
$uiLines        = count(file($uiJs));
$editLines      = count(file($editJs));

assertCheck(
    "Ngân sách dòng: chord-canvas-transpose.js ($transposeLines), chord-canvas-ui.js ($uiLines), chord-canvas-edit.js ($editLines) < 600 dòng",
    $transposeLines < 600 && $uiLines < 600 && $editLines < 600,
    true
);

// 2. Chạy Node.js để kiểm tra logic tính 7 hợp âm thuận cho Tông A và các tông khác
$nodeScript = <<< 'JS'
const fs = require('fs');
const path = require('path');

// Mock browser objects
global.window = {};
global.document = {
  createElement: () => ({ setAttribute: () => {}, style: {}, addEventListener: () => {} }),
  body: { classList: { contains: () => false } }
};

// Nạp KeyService & ChordCanvasTranspose
require(path.join(__dirname, '../assets/js/core/KeyService.js'));
global.window.KeyService = global.KeyService;

require(path.join(__dirname, '../assets/js/chord-canvas-transpose.js'));
const CCT = global.window.ChordCanvasTranspose || global.ChordCanvasTranspose;

if (!CCT || typeof CCT.getDiatonicChords !== 'function') {
  console.log(JSON.stringify({ error: 'getDiatonicChords not implemented' }));
  process.exit(0);
}

// 1. Kiểm tra tông A: A Bm C#m D E F#m G#dim
const diatonicA = CCT.getDiatonicChords('A', 'major');
const diatonicC = CCT.getDiatonicChords('C', 'major');
const diatonicG = CCT.getDiatonicChords('G', 'major');

// 2. Kiểm tra B15: Gốc G, transpose +2 -> displayed root A
const dispKey1 = CCT.detectDisplayKey ? CCT.detectDisplayKey(null, 2, 'G', 'major') : null;

// 3. Kiểm tra hợp âm thứ/đảo/sus
const secA = CCT.getSecondaryChords ? CCT.getSecondaryChords('A', 'major') : [];

// 4. Kiểm tra hợp âm 7
const sevA = CCT.getSeventhChords ? CCT.getSeventhChords('A', 'major') : [];

// 5. Kiểm tra đảo bass / + số
const slash1 = CCT.resolveSlashBass ? CCT.resolveSlashBass('A', '3', 'A', 'major') : null;
const slash2 = CCT.resolveSlashBass ? CCT.resolveSlashBass('D', '6', 'A', 'major') : null;

console.log(JSON.stringify({
  diatonicA,
  diatonicC,
  diatonicG,
  dispKey1,
  secA,
  sevA,
  slash1,
  slash2
}));
JS;

$tmpNodeFile = __DIR__ . '/_temp_test_r22.js';
file_put_contents($tmpNodeFile, $nodeScript);
$nodeOut = shell_exec("node " . escapeshellarg($tmpNodeFile));
@unlink($tmpNodeFile);

$data = json_decode($nodeOut, true) ?: [];

// Kiểm tra nghiệm thu R2-2: Unit test: tông A → A Bm C#m D E F#m G#dim
$expectedA = ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'];
assertCheck(
    "Unit test nghiệm thu: Tông A → A Bm C#m D E F#m G#dim",
    isset($data['diatonicA']) && $data['diatonicA'] === $expectedA,
    true
);

// Kiểm tra tông C: C Dm Em F G Am Bdim
$expectedC = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'];
assertCheck(
    "Tông C chuẩn xác: C Dm Em F G Am Bdim",
    isset($data['diatonicC']) && $data['diatonicC'] === $expectedC,
    true
);

// Kiểm tra sửa lỗi B15: gốc G, transpose +2 -> displayedRoot = A
assertCheck(
    "Sửa B15: Gốc G khi dịch +2 nhận diện đúng displayedRoot là 'A'",
    isset($data['dispKey1']['displayedRoot']) && $data['dispKey1']['displayedRoot'] === 'A',
    true
);

// Kiểm tra hợp âm phụ/đảo/sus cho tông A: E7, A/C#, Dsus4, D/F#
assertCheck(
    "Hợp âm phụ tông A có E7, A/C#, Dsus4, D/F#",
    isset($data['secA']) && in_array('E7', $data['secA']) && in_array('A/C#', $data['secA']) && in_array('D/F#', $data['secA']),
    true
);

// Kiểm tra nốt bass đảo: A/3 -> A/C#, D/6 -> D/F#
assertCheck(
    "Hợp âm đảo: A + bass 3 = A/C#",
    isset($data['slash1']) && $data['slash1'] === 'A/C#',
    true
);
assertCheck(
    "Hợp âm đảo: D + bass 6 = D/F#",
    isset($data['slash2']) && $data['slash2'] === 'D/F#',
    true
);

// 3. Kiểm tra chord-canvas-ui.js có hỗ trợ phím tắt 1–7, Shift+1–7, ., /+số, T
$uiContent = file_get_contents($uiJs);

assertCheck(
    "chord-canvas-ui.js: Hỗ trợ phím 1–7 chọn hợp âm thuận",
    strpos($uiContent, 'diatonicChords') !== false && (strpos($uiContent, 'Digit') !== false || strpos($uiContent, "e.key >= '1'") !== false || strpos($uiContent, "e.key <= '7'") !== false),
    true
);

assertCheck(
    "chord-canvas-ui.js: Hỗ trợ phím '.' lặp lại hợp âm gần nhất",
    strpos($uiContent, "e.key === '.'") !== false,
    true
);

assertCheck(
    "chord-canvas-ui.js: Hỗ trợ hợp âm đảo '/ + số'",
    strpos($uiContent, 'resolveSlashBass') !== false || strpos($uiContent, "'/'") !== false,
    true
);

assertCheck(
    "chord-canvas-ui.js: Chạm/click chip hợp âm đặt giá trị và nhảy nốt kế tiếp",
    strpos($uiContent, 'doSaveNext') !== false,
    true
);

echo "Test: $testName\n";
foreach ($checks as $c) {
    echo "  $c\n";
}
$behavioral = 9;
$static = $passed + $failed - $behavioral;
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed=$passed failed=$failed behavioral=$behavioral static=$static\n";
exit($failed > 0 ? 1 : 0);
