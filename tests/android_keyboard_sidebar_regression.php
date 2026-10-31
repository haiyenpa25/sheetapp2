<?php
declare(strict_types=1);

/**
 * tests/android_keyboard_sidebar_regression.php
 * Wrapper cho tests/js/android_keyboard_sidebar.cjs: menu bài hát không biến mất khi bàn phím ảo Android hiện
 * (Modern + Classic), kèm kiểm khoá chống bản cũ: mọi script nạp lười/asset trang Quản lý/in đều có ?v= theo mốc sửa file.
 */
$root = dirname(__DIR__);
$out = [];
$code = 0;
exec('node ' . escapeshellarg(__DIR__ . '/js/android_keyboard_sidebar.cjs') . ' 2>&1', $out, $code);
$nodeTotal = 0;
foreach ($out as $line) {
    if (preg_match('/^SUITE_COMPLETE total=(\d+)/', $line, $m)) { $nodeTotal = (int)$m[1]; continue; } // chỉ in 1 dòng tổng ở cuối
    echo $line . "\n";
}
$failed = $code !== 0;

// Chống phiên bản cũ (tĩnh): ScriptLoader gắn ?v= vào URL nạp lười; các trang dùng chung một hàm tính phiên bản.
function chk(bool $ok, string $msg): bool { echo ($ok ? '[PASS:S] ' : '[FAIL:S] ') . $msg . "\n"; return $ok; }
$loader = (string)file_get_contents($root . '/assets/js/core/ScriptLoader.js');
$failed |= !chk(str_contains($loader, '__ASSET_V__') && str_contains($loader, 'v=${encodeURIComponent'), 'ScriptLoader gắn ?v=<__ASSET_V__> vào URL module nạp lười (không còn URL trần bị CDN giữ cả năm)');
$helper = (string)file_get_contents($root . '/includes/asset_version.php');
$failed |= !chk(str_contains($helper, 'function sheetapp_asset_version') && str_contains($helper, "'assets/js/modals'") && str_contains($helper, 'max($latest'), 'includes/asset_version.php lấy mốc sửa MỚI NHẤT của JS dùng chung (đổi file nào cũng đổi phiên bản)');
foreach (['index.php', 'old/index.php'] as $page) {
    $src = (string)file_get_contents($root . '/' . $page);
    $failed |= !chk(str_contains($src, 'sheetapp_asset_version(') && str_contains($src, '__ASSET_V__'), "$page tính sheetapp_asset_version() và đặt window.__ASSET_V__ trước ScriptLoader");
}
$mgr = (string)file_get_contents($root . '/manager/index.php');
$bare = preg_match_all('#<(?:script|link rel="stylesheet")\s+(?:src|href)="(?:\.\./assets/|js/|manager)[^"?]+\.(?:js|css)"#', $mgr);
$failed |= !chk($bare === 0, 'manager/index.php: không còn script/CSS nội bộ thiếu ?v= (tìm thấy ' . $bare . ')');
$staticVer = preg_match('#(?:src|href)="[^"]+\.(?:js|css)\?v=\d+\.\d+(?:\.\d+)?"#', $mgr . (string)file_get_contents($root . '/print/chord-sheet.php') . (string)file_get_contents($root . '/print/service-booklet.php'));
$failed |= !chk($staticVer === 0, 'Quản lý & trang in không dùng ?v=2.x cứng (JS/CSS sửa là URL đổi theo filemtime)');
echo "\nSUITE_COMPLETE total=" . ($nodeTotal + 6) . "\n";
exit($failed ? 1 : 0);
