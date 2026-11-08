<?php
declare(strict_types=1);

/**
 * tests/toolbar_customizer_regression.php
 * Ẩn/hiện nút toolbar (Modern + Classic): hành vi module qua Node (tests/js/toolbar_customizer.cjs),
 * cộng kiểm cấu trúc: cả hai index.php nạp module, selector khớp nút thật, nút cổng vào không cho ẩn.
 */
$root = dirname(__DIR__);
$total = 0;
$failed = 0;
function check(bool $ok, string $label, string $kind = 'B'): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? "[PASS:$kind] " : "[FAIL:$kind] ") . $label . "\n";
}

// 1) Hành vi thật qua Node
$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$output = [];
$code = 0;
exec(escapeshellarg($node) . ' ' . escapeshellarg($root . '/tests/js/toolbar_customizer.cjs') . ' 2>&1', $output, $code);
$ran = 0;
foreach ($output as $line) {
    if (str_starts_with($line, 'OK ')) { $ran++; check(true, substr($line, 3)); }
    elseif (str_starts_with($line, 'FAIL ')) { $ran++; check(false, substr($line, 5)); }
}
check($ran > 0 && $code === 0, "Script Node chạy trọn vẹn ({$ran} kiểm tra, exit {$code})");

// 2) Cấu trúc (đọc mã, nhãn S)
$js = (string)file_get_contents($root . '/assets/js/toolbar-customizer.js');
foreach (['index.php' => 'Modern', 'old/index.php' => 'Classic'] as $file => $name) {
    check(str_contains((string)file_get_contents($root . '/' . $file), "jsTag('toolbar-customizer.js')"), "{$name}: index.php nạp toolbar-customizer.js", 'S');
}
check(str_contains($js, ':not(#tc-x4)'), 'Luật ẩn có tăng độ ưu tiên để thắng control-deck.css của Classic', 'S');

// Mỗi selector dạng #id phải tồn tại trong ít nhất một giao diện (tránh trỏ nhầm id đã đổi tên)
$markup = '';
foreach (['includes/toolbar.php', 'old/includes/toolbar.php', 'includes/sheet_viewer.php', 'old/index.php', 'index.php'] as $f) {
    if (is_file($root . '/' . $f)) $markup .= file_get_contents($root . '/' . $f);
}
preg_match_all("/selectors: \[(.*?)\]/", $js, $groups);
$missing = [];
foreach ($groups[1] as $group) {
    preg_match_all("/'([^']+)'/", $group, $sels);
    foreach ($sels[1] as $sel) {
        if (preg_match('/#([A-Za-z0-9_-]+)\s*$/', $sel, $m) && !str_contains($markup, 'id="' . $m[1] . '"')) $missing[] = $sel;
        if (preg_match('/^\.([A-Za-z0-9_-]+)$/', $sel, $m) && !str_contains($markup, $m[1])) $missing[] = $sel;
    }
}
check($missing === [], 'Mọi selector trỏ tới nút có thật trong toolbar' . ($missing ? ' — thiếu: ' . implode(', ', $missing) : ''), 'S');

$protected = ['#btn-more-options', '#btn-open-sidebar', '#btn-toolbar-customize'];
$hit = array_filter($protected, static fn(string $id): bool => str_contains($js, "'" . $id . "'"));
check($hit === [], 'Nút cổng vào (⋮ Tuỳ Chọn, mở danh sách bài, mục Tùy chỉnh) không nằm trong danh sách ẩn được', 'S');

echo "SUITE_COMPLETE total={$total}\n";
exit($failed === 0 ? 0 : 1);
