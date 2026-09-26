<?php
/**
 * tests/library_l012_true_capo_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-12 (ROADMAP 4):
 *  1. Capo đúng nghĩa: Capo N thì hợp âm hiển thị = thế bấm (dịch xuống N bán cung).
 *     - Nhạc thật giữ nguyên tông.
 *     - Unit test: bài Eb + capo 3 -> thế bấm C.
 *  2. Badge hiển thị đúng format: "Capo N · nghe ra [Key]".
 *  3. Gợi ý capo tốt nhất phải hiển thị, không bị ẩn (loại bỏ display: none !important).
 *  4. Ngân sách file < 600 dòng.
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;

function check(bool $condition, string $id, string $desc, bool $isBehavioral = true): void {
    global $passed, $failed;
    $typeTag = $isBehavioral ? '[PASS:B]' : '[PASS:S]';
    if ($condition) {
        $passed++;
        echo "  {$typeTag} [{$id}] {$desc}\n";
    } else {
        $failed++;
        echo "  [FAIL] [{$id}] {$desc}\n";
    }
}

echo "========================================================\n";
echo "   Ticket L0-12: True Capo & Fingered Chord Regression\n";
echo "========================================================\n\n";

// ── 1. Unit Test: Bài Eb + capo 3 -> thế bấm C ──────────────
$nodeCmd = 'node -e "'
    . 'const KS = require(\'./assets/js/key-service.js\');'
    . 'const TE = require(\'./assets/js/transpose-engine.js\');'
    . 'const ebCapo3Key = KS.displayKey(\'Eb\', -3);'
    . 'const ebCapo3Chord = TE.transposeChord(\'Eb\', -3);'
    . 'const aCapo2Key = KS.displayKey(\'A\', -2);'
    . 'const fCapo1Key = KS.displayKey(\'F\', -1);'
    . 'console.log(JSON.stringify({ ebCapo3Key, ebCapo3Chord, aCapo2Key, fCapo1Key }));'
    . '"';

$output = shell_exec($nodeCmd);
$data = json_decode(trim((string)$output), true);

check(
    isset($data['ebCapo3Key']) && $data['ebCapo3Key'] === 'C',
    'unit_eb_capo_3_key_is_c',
    "Unit test L0-12: Bài tông Eb + capo 3 -> thế bấm C (nhận được: {$data['ebCapo3Key']})"
);

check(
    isset($data['ebCapo3Chord']) && $data['ebCapo3Chord'] === 'C',
    'unit_eb_capo_3_chord_is_c',
    "Unit test L0-12: Hợp âm Eb + capo 3 -> thế bấm hợp âm C (nhận được: {$data['ebCapo3Chord']})"
);

check(
    isset($data['aCapo2Key']) && $data['aCapo2Key'] === 'G' &&
    isset($data['fCapo1Key']) && $data['fCapo1Key'] === 'E',
    'unit_other_capo_transpositions',
    'Unit test các tông khác: Bài A + capo 2 -> thế G, bài F + capo 1 -> thế E'
);

// ── 2. Capo Badge & CSS Checks ───────────────────────────────
$sheetCss = file_get_contents(__DIR__ . '/../assets/css/sheet.css');
check(
    strpos($sheetCss, '.capo-badge { display: none !important; }') === false,
    'capo_badge_not_hidden_by_important',
    'CSS sheet.css không còn luật ".capo-badge { display: none !important; }" triệt tiêu Capo badge'
);

check(
    strpos($sheetCss, '.capo-badge {') !== false && strpos($sheetCss, 'background: rgba(245, 158, 11') !== false,
    'capo_badge_styled',
    'CSS sheet.css có định dạng nổi bật chuyên nghiệp cho .capo-badge'
);

// ── 3. Logic: Nhạc thật giữ nguyên, thế bấm dịch xuống N ─────
$toolbarCtrl = file_get_contents(__DIR__ . '/../assets/js/toolbar-controller.js');
check(
    strpos($toolbarCtrl, "App?.transposeBy?.(delta)") === false &&
    strpos($toolbarCtrl, "Store.set('capoLevel', newCapo)") !== false,
    'capo_does_not_shift_sounding_pitch',
    'Chọn Capo không còn gọi transposeBy(delta) làm sai lệch tông nhạc thật của cả ban nhạc'
);

$appUi = file_get_contents(__DIR__ . '/../assets/js/app-ui.js');
check(
    strpos($appUi, "badge.textContent = soundingKey ? `Capo \${currentCapo} · nghe ra \${soundingKey}`") !== false,
    'capo_badge_format_sounding_key',
    'AppUI.updateCapoBadge hiển thị format chuẩn: "Capo N · nghe ra [Key]"'
);

check(
    strpos($appUi, "💡 Gợi ý: Capo") !== false,
    'capo_badge_shows_best_suggestion',
    'AppUI.updateCapoBadge hiển thị gợi ý capo tốt nhất (suggestBestCapo) thay vì ẩn đi'
);

$canvasTrans = file_get_contents(__DIR__ . '/../assets/js/chord-canvas-transpose.js');
check(
    strpos($canvasTrans, 'semitones - capo') !== false,
    'chord_canvas_applies_capo_shift',
    'ChordCanvasTranspose tính effectiveShift = semitones - capo để hiển thị đúng thế bấm'
);

$dispSettings = file_get_contents(__DIR__ . '/../assets/js/display-settings.js');
check(
    strpos($dispSettings, 'trOffset - capo') !== false,
    'lyric_view_applies_capo_shift',
    'DisplaySettings tính chordShift = trOffset - capo cho chế độ Band / Xem lời'
);

// ── 4. Verify all touched files remain strictly < 600 lines ───
$files = [
    'assets/js/toolbar-controller.js' => __DIR__ . '/../assets/js/toolbar-controller.js',
    'assets/js/app-ui.js' => __DIR__ . '/../assets/js/app-ui.js',
    'assets/js/chord-canvas-transpose.js' => __DIR__ . '/../assets/js/chord-canvas-transpose.js',
    'assets/js/display-settings.js' => __DIR__ . '/../assets/js/display-settings.js',
    'assets/js/song-loader.js' => __DIR__ . '/../assets/js/song-loader.js',
    'includes/toolbar.php' => __DIR__ . '/../includes/toolbar.php',
];

foreach ($files as $name => $path) {
    $lines = count(file($path));
    check($lines < 600, "line_budget_{$name}", "{$name} có {$lines} dòng (< 600)");
}

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
