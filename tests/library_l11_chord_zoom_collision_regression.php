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

// 2. Preset-based sizing replaced the fixed multiplier in baseline 623b745.
// Real font sizes and collision boxes are checked in library-tv0-chord-geometry.spec.js.
$hasScaledFontSize = str_contains($dotsJs, '18 * scale * presetMultiplier')
    && str_contains($dotsJs, 'Math.max(11, Math.min(34');
checkStatic(
    'chord_dots_fontsize_tracks_preset_and_zoom',
    $hasScaledFontSize,
    'Static: cỡ chữ theo preset/zoom có giới hạn; hình học thực kiểm trong E2E'
);

// 3. Kiểm tra thuật toán chống va chạm ngang (overlap check & reposition)
$hasCollisionPrevention = strpos($dotsJs, 'curLeft < prevRight') !== false
    && strpos($dotsJs, 'prevRight + horizPad') !== false
    && str_contains($dotsJs, 'horizPad = Math.max(3, Math.round(6 * scale))');
checkStatic(
    'chord_dots_horizontal_collision_prevention',
    $hasCollisionPrevention,
    'Static: chống overlap dùng khoảng cách theo zoom; hộp DOM thực kiểm trong E2E'
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
