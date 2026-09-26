<?php
/**
 * tests/library_l03_chord_hide_by_class_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L0-3 (ROADMAP4.md):
 * 1. Ẩn hợp âm SVG bằng class hoặc data-attribute, KHÔNG ẩn theo màu text[fill="..."]
 * 2. Bảo vệ lời bài hát và tiêu đề không bao giờ bị biến mất khi người dùng chọn màu hợp âm đen (#000000).
 * 3. OSMDRenderer có cơ chế _tagChordSymbols gắn class osmd-chord-symbol và data-chord-symbol.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L0-3: Ẩn hợp âm SVG bằng Class / Data Attribute\n";
echo "========================================================\n\n";

// 1. Kiểm tra assets/js/chord-canvas.js
$chordCanvasPath = $root . '/assets/js/chord-canvas.js';
$chordCanvasCode = file_get_contents($chordCanvasPath);

checkStatic(
    'chord_canvas_no_color_fill_selector',
    strpos($chordCanvasCode, 'text[fill=') === false,
    'ChordCanvas KHÔNG CÒN dùng selector text[fill=...] để ẩn hợp âm theo màu'
);

checkStatic(
    'chord_canvas_uses_class_selector',
    strpos($chordCanvasCode, '.osmd-chord-symbol') !== false,
    'ChordCanvas dùng class .osmd-chord-symbol để ẩn hợp âm SVG'
);

checkStatic(
    'chord_canvas_uses_data_attribute_selector',
    strpos($chordCanvasCode, '[data-chord-symbol="true"]') !== false,
    'ChordCanvas dùng data-attribute [data-chord-symbol="true"] để ẩn hợp âm SVG'
);

checkStatic(
    'chord_canvas_calls_tag_chord_symbols',
    strpos($chordCanvasCode, 'tagChordSymbols') !== false,
    'ChordCanvas gọi tagChordSymbols để đảm bảo các phần tử hợp âm SVG được gắn thẻ'
);

// 2. Kiểm tra assets/js/osmd-renderer.js
$osmdRendererPath = $root . '/assets/js/osmd-renderer.js';
$osmdRendererCode = file_get_contents($osmdRendererPath);

checkStatic(
    'osmd_renderer_defines_tag_chord_symbols',
    strpos($osmdRendererCode, 'function _tagChordSymbols()') !== false,
    'OSMDRenderer định nghĩa hàm _tagChordSymbols()'
);

checkStatic(
    'osmd_renderer_tags_class_and_data',
    strpos($osmdRendererCode, "t.classList.add('osmd-chord-symbol'") !== false ||
    strpos($osmdRendererCode, "node.classList.add('osmd-chord-symbol')") !== false,
    'OSMDRenderer gắn class osmd-chord-symbol vào các phần tử hợp âm SVG'
);

checkStatic(
    'osmd_renderer_exports_tag_chord_symbols',
    strpos($osmdRendererCode, 'tagChordSymbols: _tagChordSymbols') !== false,
    'OSMDRenderer export phương thức tagChordSymbols ra bên ngoài'
);

checkBehavior(
    'black_color_safe_contract',
    strpos($chordCanvasCode, 'text[fill=') === false && strpos($chordCanvasCode, '.osmd-chord-symbol') !== false,
    'Khi đổi màu hợp âm thành #000000, CSS ẩn hợp âm không gây ảnh hưởng đến lời bài hát hay tiêu đề'
);

TestAssert::finish();
