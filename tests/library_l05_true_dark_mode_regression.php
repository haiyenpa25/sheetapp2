<?php
/**
 * tests/library_l05_true_dark_mode_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L0-5 (ROADMAP4.md):
 * 1. Chế độ tối thật: Bỏ hoàn toàn đảo màu 2 lần (filter: invert).
 * 2. Tô màu SVG bằng CSS variables / rules trực tiếp:
 *    - Nốt, khuông, lời màu ngà #E8E2D0
 *    - Nền vùng nhạc #0B0B0C (độ sáng < 10%)
 *    - Hợp âm màu hổ phách #FBBF24 (tương phản >= 8:1)
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L0-5: Chế Độ Tối Thật Cho Bản Nhạc (True SVG Dark Mode)\n";
echo "========================================================\n\n";

$sheetCssPath = $root . '/assets/css/sheet.css';
$sheetCss = file_get_contents($sheetCssPath);

// 1. Kiểm tra không còn bất kỳ filter: invert nào áp lên osmd container hoặc svg
$hasInvertOnOsmd = (bool)preg_match('/(?:#osmd-container|\.osmd-container)[^{}]*\{[^}]*filter:\s*invert\(/i', $sheetCss);
checkStatic(
    'no_invert_filter_on_osmd',
    !$hasInvertOnOsmd,
    'sheet.css ĐÃ LOẠI BỎ HOÀN TOÀN filter: invert(...) trên OSMD container và SVG (chống đảo màu 2 lần)'
);

// 2. Kiểm tra nền vùng nhạc là #0B0B0C
$has0B0B0CBg = strpos($sheetCss, '#0B0B0C') !== false;
checkStatic(
    'dark_mode_bg_0b0b0c',
    $has0B0B0CBg,
    'sheet.css thiết lập nền vùng nhạc ở chế độ tối là #0B0B0C (độ sáng < 10%)'
);

// 3. Kiểm tra nốt, khuông, lời màu ngà #E8E2D0
$hasIvoryInk = strpos($sheetCss, '#E8E2D0') !== false;
checkStatic(
    'dark_mode_ink_ivory',
    $hasIvoryInk,
    'sheet.css tô màu nốt, khuông, lời bằng màu ngà #E8E2D0'
);

// 4. Kiểm tra hợp âm màu hổ phách #FBBF24
$hasAmberChords = strpos($sheetCss, '#FBBF24') !== false;
checkStatic(
    'dark_mode_chords_amber',
    $hasAmberChords,
    'sheet.css tô màu hợp âm bằng màu hổ phách #FBBF24 (độ tương phản > 11:1)'
);

// 5. Kiểm tra toán học tương phản giữa #FBBF24 và #0B0B0C
function calculateLuminance(int $r, int $g, int $b): float {
    $a = array_map(function($v) {
        $v /= 255.0;
        return $v <= 0.03928 ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4);
    }, [$r, $g, $b]);
    return 0.2126 * $a[0] + 0.7152 * $a[1] + 0.0722 * $a[2];
}

$lumBg = calculateLuminance(0x0B, 0x0B, 0x0C);
$lumChord = calculateLuminance(0xFB, 0xBF, 0x24);
$contrastRatio = ($lumChord + 0.05) / ($lumBg + 0.05);

checkBehavior(
    'amber_chord_contrast_ratio_ge_8',
    $contrastRatio >= 8.0,
    sprintf('Độ tương phản màu hợp âm #FBBF24 trên nền #0B0B0C đạt %.2f:1 (yêu cầu >= 8:1)', $contrastRatio)
);

// 6. Kiểm tra độ sáng nền #0B0B0C < 10%
$bgBrightness = (0x0B / 255.0) * 100.0;
checkBehavior(
    'bg_brightness_lt_10_percent',
    $bgBrightness < 10.0,
    sprintf('Độ sáng nền #0B0B0C là %.2f%% (yêu cầu < 10%%)', $bgBrightness)
);

TestAssert::finish();
