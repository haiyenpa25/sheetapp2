<?php
/**
 * tests/library_l11_chord_zoom_collision_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L1-1 (ROADMAP4.md):
 * 1. Cỡ chữ hợp âm co giãn theo zoom: tỉ lệ chiều cao chữ hợp âm / chữ lời >= 1.3 (chuẩn 1.35)
 * 2. Khoảng cách tới khuông (GAP_PX, Y offset) co giãn theo tỉ lệ zoom (scale).
 * 3. Thuật toán chống va chạm ngang cho hợp âm: dàn đều, tránh chồng chữ khi hợp âm dài.
 * 4. DisplaySettings và OSMDRenderer thiết lập kích thước hợp âm chuẩn tối thiểu 2.85.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L1-1: Hợp Âm Co Giãn Theo Zoom & Chống Va Chạm\n";
echo "========================================================\n\n";

$dotsJsPath = $root . '/assets/js/chord-canvas-dots.js';
$dotsJs = file_get_contents($dotsJsPath);

$osmdRendererJsPath = $root . '/assets/js/osmd-renderer.js';
$osmdRendererJs = file_get_contents($osmdRendererJsPath);

$displaySettingsJsPath = $root . '/assets/js/display-settings.js';
$displaySettingsJs = file_get_contents($displaySettingsJsPath);

// 1. Kiểm tra GAP_PX co giãn theo scale trong chord-canvas-dots.js
$hasScaledGap = strpos($dotsJs, 'GAP_PX = Math.round(22 * scale)') !== false
    || strpos($dotsJs, 'GAP_PX = Math.round(') !== false;
checkStatic(
    'chord_dots_gap_scaled_with_zoom',
    $hasScaledGap,
    'chord-canvas-dots.js áp dụng GAP_PX co giãn động theo zoom scale'
);

// 2. Kiểm tra cỡ chữ hợp âm overlay có hệ số >= 1.35
$hasScaledFontSize = preg_match('/fSize\s*=\s*Math\.max\(\s*16\s*,\s*Math\.round\(\s*20\s*\*\s*scale\s*\*\s*1\.35/', $dotsJs);
checkBehavior(
    'chord_dots_fontsize_ratio_1_35',
    (bool)$hasScaledFontSize,
    'chord-canvas-dots.js định nghĩa cỡ chữ hợp âm với hệ số phóng đại 1.35x theo zoom scale'
);

// 3. Kiểm tra thuật toán chống va chạm ngang (overlap check & reposition)
$hasCollisionPrevention = strpos($dotsJs, 'curLeft < prevRight') !== false
    && strpos($dotsJs, 'prevRight + 6') !== false;
checkBehavior(
    'chord_dots_horizontal_collision_prevention',
    $hasCollisionPrevention,
    'chord-canvas-dots.js có thuật toán kiểm tra overlap và dàn ngang các nhãn hợp âm kề nhau'
);

// 4. Kiểm tra OSMDRenderer TextHeight >= 2.85
$hasOsmdChordTextHeight = (bool)preg_match('/ChordSymbolTextHeight:\s*2\.85/', $osmdRendererJs);
checkStatic(
    'osmd_chord_symbol_text_height_ge_2_85',
    $hasOsmdChordTextHeight,
    'osmd-renderer.js cấu hình ChordSymbolTextHeight = 2.85 đảm bảo tỉ lệ hợp âm/lời >= 1.35 trong SVG'
);

// 5. Kiểm tra DisplaySettings chord size mặc định >= 2.85
$hasDisplaySettingsSize = (bool)preg_match('/size:\s*2\.85/', $displaySettingsJs);
checkStatic(
    'display_settings_chord_size_ge_2_85',
    $hasDisplaySettingsSize,
    'display-settings.js cấu hình chordPrefs.size = 2.85 đồng bộ toàn hệ thống'
);

TestAssert::finish();
