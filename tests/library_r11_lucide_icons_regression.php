<?php
// tests/library_r11_lucide_icons_regression.php — Ticket R1-1: Lucide SVG Icons Regression

require_once __DIR__ . '/lib/assert.php';

echo "========================================================\n";
echo "   Ticket R1-1: Bộ Icon Lucide SVG & Chuẩn Hóa Khung   \n";
echo "========================================================\n\n";

$baseDir = dirname(__DIR__);

// 1. Kiểm tra tồn tại Sprite SVG
$spritePath = $baseDir . '/assets/icons/lucide.svg';
checkStatic(
    'sprite_svg_exists',
    file_exists($spritePath) && filesize($spritePath) > 500,
    'Sprite SVG assets/icons/lucide.svg tồn tại và có dung lượng hợp lệ'
);

$spriteContent = file_exists($spritePath) ? file_get_contents($spritePath) : '';
checkStatic(
    'sprite_svg_symbols',
    strpos($spriteContent, 'id="icon-menu"') !== false &&
    strpos($spriteContent, 'id="icon-info"') !== false &&
    strpos($spriteContent, 'id="icon-music"') !== false &&
    strpos($spriteContent, 'id="icon-zap"') !== false &&
    strpos($spriteContent, 'id="icon-settings"') !== false,
    'Sprite SVG chứa các symbol Lucide cốt lõi (menu, info, music, zap, settings)'
);

// 2. Kiểm tra helper icon()
require_once $baseDir . '/includes/icons.php';
checkBehavior(
    'icon_helper_function_exists',
    function_exists('icon'),
    'Hàm helper PHP icon() tồn tại trong includes/icons.php'
);

$iconOutput = icon('settings', 'icon-md', ['data-testid' => 'test-icon']);
checkBehavior(
    'icon_helper_output_format',
    strpos($iconOutput, '<svg class="icon icon-settings icon-md"') !== false &&
    strpos($iconOutput, '<use href="#icon-settings"/>') !== false &&
    strpos($iconOutput, 'data-testid="test-icon"') !== false,
    'Hàm icon() sinh ra thẻ <svg> với <use href="#icon-name"/> và class đầy đủ'
);

// 3. Quét không còn emoji trần trong 4 file includes chính của trang Thư viện
$filesToScan = [
    'includes/toolbar.php',
    'includes/sidebar.php',
    'includes/sheet_viewer.php',
    'includes/modals.php'
];

// Regex bắt emojis phổ biến (Miscellaneous Symbols, Dingbats, Emoticons, Pictographs, Transport, Alchemical, etc.)
// Ngoại lệ duy nhất cho phép: nốt nhạc '♩' trong nội dung nhạc
$emojiPattern = '/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{2B55}\x{2700}-\x{27BF}\x{2300}-\x{23FF}]/u';

foreach ($filesToScan as $relPath) {
    $fullPath = $baseDir . '/' . $relPath;
    $content = file_exists($fullPath) ? file_get_contents($fullPath) : '';
    preg_match_all($emojiPattern, $content, $matches);
    
    // Loại bỏ nốt nhạc ♩ nếu có
    $found = array_filter($matches[0], function($sym) {
        return $sym !== '♩';
    });
    
    $uniqueFound = array_unique($found);
    $key = 'zero_emojis_' . str_replace(['/', '.'], '_', $relPath);
    
    checkBehavior(
        $key,
        count($uniqueFound) === 0,
        "File {$relPath} không còn emoji trần (" . (count($uniqueFound) === 0 ? "0 emoji" : implode(', ', $uniqueFound)) . ")"
    );
}

// 4. Kiểm tra CSS định dạng icon trong library-polish.css
$cssPath = $baseDir . '/assets/css/library-polish.css';
$cssContent = file_exists($cssPath) ? file_get_contents($cssPath) : '';
checkStatic(
    'css_icon_styling',
    strpos($cssContent, '.icon') !== false &&
    strpos($cssContent, 'stroke: currentColor') !== false,
    'assets/css/library-polish.css có quy tắc CSS cho class .icon'
);

// 5. Kiểm tra index.php đã nhúng sprite và require includes/icons.php
$indexPath = $baseDir . '/index.php';
$indexContent = file_exists($indexPath) ? file_get_contents($indexPath) : '';
checkStatic(
    'index_loads_icons_helper_and_sprite',
    strpos($indexContent, "icons.php") !== false &&
    strpos($indexContent, "lucide-sprite-container") !== false,
    'index.php đã require icons.php và inlined Lucide sprite'
);

echo "\n";
echo "SUITE_COMPLETE total=10\n";
