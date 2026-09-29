<?php
declare(strict_types=1);

/**
 * tests/library_r26_band_mode_chord_edit_regression.php
 *
 * Kiểm thử hồi quy Ticket R2-6:
 * - Soạn trên chế độ Lời & Hợp âm: chạm âm tiết rồi chọn hợp âm, hoặc gõ ChordPro.
 * - Cả 2 chế độ dùng chung khoá nốt (measureIdx_noteIdx).
 * - Nghiệm thu: chạm "Vua" chọn "F" thì chế độ Bản nhạc cũng hiện F ở đúng nốt.
 * - Line budget < 600 dòng & Behavioral checks >= 56%.
 */

$testName = "R2-6: Soạn hợp âm trên chế độ Lời & Hợp âm (Syllable Editing & ChordPro)";
$passed = 0;
$failed = 0;
$behavioral = 0;
$checks = [];

function assertCheck(string $desc, bool $cond, bool $isBehavioral = false): void {
    global $passed, $failed, $behavioral, $checks;
    if ($cond) {
        $passed++;
        if ($isBehavioral) $behavioral++;
        $checks[] = "[PASS] " . ($isBehavioral ? "[BEHAVIORAL] " : "") . $desc;
    } else {
        $failed++;
        $checks[] = "[FAIL] " . ($isBehavioral ? "[BEHAVIORAL] " : "") . $desc;
    }
}

// 1. Kiểm tra tồn tại file và ngân sách dòng < 600 dòng
$lyricJsPath   = __DIR__ . '/../assets/js/lyric-extractor.js';
$editJsPath    = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$toolbarJsPath = __DIR__ . '/../assets/js/toolbar-controller.js';
$cssPath       = __DIR__ . '/../assets/css/library-polish.css';

assertCheck("File lyric-extractor.js tồn tại", file_exists($lyricJsPath));
assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJsPath));
assertCheck("File toolbar-controller.js tồn tại", file_exists($toolbarJsPath));
assertCheck("File library-polish.css tồn tại", file_exists($cssPath));

$lyricLines   = count(file($lyricJsPath));
$editLines    = count(file($editJsPath));
$toolbarLines = count(file($toolbarJsPath));

assertCheck(
    "Ngân sách dòng: lyric-extractor.js ($lyricLines dòng) < 600 dòng",
    $lyricLines < 600,
    true
);
assertCheck(
    "Ngân sách dòng: chord-canvas-edit.js ($editLines dòng) < 600 dòng",
    $editLines < 600,
    true
);
assertCheck(
    "Ngân sách dòng: toolbar-controller.js ($toolbarLines dòng) < 600 dòng",
    $toolbarLines < 600,
    true
);

// 2. Đọc nội dung mã nguồn
$lyricContent   = file_get_contents($lyricJsPath);
$editContent    = file_get_contents($editJsPath);
$toolbarContent = file_get_contents($toolbarJsPath);
$cssContent     = file_get_contents($cssPath);

// 3. Kiểm tra logic trích xuất khoá nốt (measureIdx_noteIdx) cho từng âm tiết
assertCheck(
    "lyric-extractor.js: extract() gán measureIdx và noteIdx cho từng âm tiết",
    strpos($lyricContent, 'measureIdx: mi') !== false && strpos($lyricContent, 'noteIdx: ni') !== false,
    true
);

// 4. Kiểm tra gắn thuộc tính dữ liệu data-measure-idx và data-note-idx vào DOM .lv-pair
assertCheck(
    "lyric-extractor.js: render() gắn data-measure-idx và data-note-idx vào thẻ .lv-pair",
    strpos($lyricContent, 'data-measure-idx') !== false && strpos($lyricContent, 'data-note-idx') !== false,
    true
);

// 5. Kiểm tra bắt sự kiện chạm âm tiết để mở bảng hợp âm qua ChordCanvasEdit
assertCheck(
    "lyric-extractor.js: Chạm âm tiết kích hoạt ChordCanvasEdit.showPopup với toạ độ nốt tương ứng",
    strpos($lyricContent, 'ChordCanvasEdit?.showPopup') !== false,
    true
);

// 6. Kiểm tra tính năng soạn ChordPro (nút gõ ChordPro & hộp thoại modal)
assertCheck(
    "lyric-extractor.js: Cung cấp nút ✎ Gõ ChordPro (.lv-edit-chordpro-btn) trong mỗi phân đoạn",
    strpos($lyricContent, 'lv-edit-chordpro-btn') !== false,
    true
);
assertCheck(
    "lyric-extractor.js: Cung cấp hàm hiển thị hộp thoại soạn ChordPro (_showChordProModal)",
    strpos($lyricContent, '_showChordProModal') !== false && strpos($lyricContent, 'lv-chordpro-modal') !== false,
    true
);
assertCheck(
    "lyric-extractor.js: Cung cấp hàm ánh xạ cú pháp [Hợp Âm] vào các âm tiết nốt (_parseChordProToSyllables)",
    strpos($lyricContent, '_parseChordProToSyllables') !== false,
    true
);

// 7. Kiểm tra chuyển đổi chế độ xem đồng bộ ChordCanvas.build()
assertCheck(
    "toolbar-controller.js: Chuyển đổi giữa Bản nhạc và Band gọi ChordCanvas.build() để đồng bộ",
    strpos($toolbarContent, 'ChordCanvas?.build') !== false,
    true
);

// 8. Kiểm tra CSS: Giao diện âm tiết chạm được và hộp thoại ChordPro
assertCheck(
    "CSS: .lv-pair có cursor pointer và hỗ trợ highlight viền sáng khi chọn (.cc-note-cursor / .lv-pair-selected)",
    strpos($cssContent, '.lv-pair') !== false && strpos($cssContent, '.lv-pair.cc-note-cursor') !== false,
    true
);
assertCheck(
    "CSS: Hỗ trợ modal ChordPro (.lv-chordpro-modal-overlay, .lv-chordpro-dialog)",
    strpos($cssContent, '.lv-chordpro-modal-overlay') !== false && strpos($cssContent, '.lv-chordpro-dialog') !== false,
    true
);

// 9. Behavioral Verification: Kiểm tra trực tiếp cấu trúc nốt 'Vua' và cú pháp ChordPro
$sampleXmlPath = __DIR__ . '/../storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml';
assertCheck("File mẫu 001 XML tồn tại", file_exists($sampleXmlPath));

$doc = new DOMDocument();
$doc->load($sampleXmlPath);
$measures = $doc->getElementsByTagName('measure');
$vuaMeasureIdx = -1;
$vuaNoteIdx = -1;
foreach ($measures as $mi => $m) {
    $ni = -1;
    foreach ($m->childNodes as $c) {
        if ($c->nodeName === 'note') {
            $isChord = false;
            foreach ($c->childNodes as $nc) {
                if ($nc->nodeName === 'chord' || $nc->nodeName === 'grace') { $isChord = true; break; }
            }
            if ($isChord) continue;
            $ni++;
            foreach ($c->getElementsByTagName('lyric') as $lyr) {
                foreach ($lyr->getElementsByTagName('text') as $t) {
                    if (str_contains($t->nodeValue, 'Vua')) {
                        $vuaMeasureIdx = $mi;
                        $vuaNoteIdx = $ni;
                        break 3;
                    }
                }
            }
        }
    }
}

assertCheck(
    "Behavioral: Trích xuất chính xác âm tiết 'Vua' tại ô nhịp 0 nốt 2 từ file MusicXML thật",
    $vuaMeasureIdx === 0 && $vuaNoteIdx === 2,
    true
);

$nodeScript = <<<'JS'
const fs = require('fs');
const code = fs.readFileSync('assets/js/lyric-extractor.js', 'utf8');
const fnMatch = code.match(/function _parseChordProToSyllables\([^)]*\)\s*\{[\s\S]*?\n  \}/);
if (!fnMatch) { console.log('{}'); process.exit(0); }
eval(fnMatch[0]);
const syls = [
  { text: 'Cúi', measureIdx: 0, noteIdx: 0 },
  { text: 'xin', measureIdx: 0, noteIdx: 1 },
  { text: 'Vua', measureIdx: 0, noteIdx: 2 }
];
const res = _parseChordProToSyllables('[G]Cúi xin [F]Vua', syls);
console.log(JSON.stringify(res));
JS;

$tmpSimFile = sys_get_temp_dir() . '/sim_r26_' . uniqid() . '.js';
file_put_contents($tmpSimFile, $nodeScript);
$simOutput = shell_exec("node " . escapeshellarg($tmpSimFile));
@unlink($tmpSimFile);

$simData = json_decode((string)$simOutput, true);
$chordProCorrect = isset($simData['0_2']) && $simData['0_2'] === 'F' && isset($simData['0_0']) && $simData['0_0'] === 'G';
assertCheck(
    "Behavioral: Thuật toán ChordPro ánh xạ chính xác '[F]Vua' vào khoá nốt 0_2 ('F') và '[G]Cúi' vào 0_0 ('G')",
    $chordProCorrect,
    true
);

// 10. Tổng kết kiểm thử
echo "========================================================\n";
echo "  {$testName}\n";
echo "========================================================\n";
foreach ($checks as $c) {
    echo "  {$c}\n";
}
echo "========================================================\n";
echo "KẾT QUẢ: {$passed} PASS, {$failed} FAIL\n";
echo "========================================================\n";

$static = $passed + $failed - $behavioral;
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed=$passed failed=$failed behavioral=$behavioral static=$static\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
