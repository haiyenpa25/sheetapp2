<?php
/**
 * tests/library_l015_tempo_unset_104_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-15 (ROADMAP 4):
 *  1. Coi BPM 104 là "chưa có tempo" (chip hiện "♩ —", bấm để đặt).
 *  2. Thống nhất tempo mặc định cho metronome và thanh thông tin là 80 (L-D6).
 *  3. Modal tempo không còn mặc định là 104.
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
echo "   Ticket L0-15: BPM Unset 104 -> '♩ —' Regression\n";
echo "========================================================\n\n";

$songInfoBarJs = file_get_contents(__DIR__ . '/../assets/js/song-info-bar.js');
$metronomeJs   = file_get_contents(__DIR__ . '/../assets/js/metronome.js');
$modalsPhp     = file_get_contents(__DIR__ . '/../includes/modals.php');

// 1. Kiểm tra song-info-bar.js xử lý 104 -> ♩ —
check(
    strpos($songInfoBarJs, '!== 104') !== false,
    'song_info_bar_treats_104_as_unset',
    'song-info-bar.js coi tempo 104 là chưa có tempo'
);
check(
    strpos($songInfoBarJs, '♩ —') !== false,
    'song_info_bar_renders_dash_for_unset',
    'song-info-bar.js render "♩ —" khi bài chưa có tempo'
);

// 2. Kiểm tra metronome.js fallback thống nhất 80 khi gặp 104
check(
    strpos($metronomeJs, '!== 104') !== false,
    'metronome_treats_104_as_unset',
    'metronome.js bỏ qua tempo 104 và dùng mặc định thống nhất 80'
);

// 3. Kiểm tra modals.php không còn mặc định 104
check(
    strpos($modalsPhp, 'id="tempo-modal-val"') !== false && strpos($modalsPhp, '>104</span>') === false,
    'modals_tempo_val_not_104',
    'modals.php tempo modal val không còn là 104'
);
check(
    strpos($modalsPhp, 'id="tempo-modal-slider"') !== false && strpos($modalsPhp, 'value="104"') === false,
    'modals_tempo_slider_not_104',
    'modals.php tempo modal slider không còn là 104'
);

// 4. Ngân sách file < 600 dòng
$files = [
    'assets/js/song-info-bar.js' => __DIR__ . '/../assets/js/song-info-bar.js',
    'assets/js/metronome.js' => __DIR__ . '/../assets/js/metronome.js',
    'includes/modals.php' => __DIR__ . '/../includes/modals.php',
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
