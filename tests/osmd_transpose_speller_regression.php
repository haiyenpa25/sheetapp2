<?php
declare(strict_types=1);

/**
 * tests/osmd_transpose_speller_regression.php
 * Wrapper cho tests/js/osmd_transpose_speller.cjs: dịch giọng (+/−) không sinh thăng/giáng/♮ thừa; kèm kiểm đã đăng ký script.
 */
$out = [];
$code = 0;
exec('node ' . escapeshellarg(__DIR__ . '/js/osmd_transpose_speller.cjs') . ' 2>&1', $out, $code);
$nodeTotal = 0;
foreach ($out as $line) {
    if (preg_match('/^SUITE_COMPLETE total=(\d+)/', $line, $m)) { $nodeTotal = (int)$m[1]; continue; }
    echo $line . "\n";
}
$failed = $code !== 0;
function chk(bool $ok, string $msg): bool { echo ($ok ? '[PASS:S] ' : '[FAIL:S] ') . $msg . "\n"; return $ok; }
$root = dirname(__DIR__);
$index = (string)file_get_contents($root . '/index.php');
$posSpeller = strpos($index, "jsTag('osmd-transpose-speller.js')");
$posRenderer = strpos($index, "jsTag('osmd-renderer.js')");
$failed |= !chk($posSpeller !== false && $posRenderer !== false && $posSpeller < $posRenderer, 'index.php nạp osmd-transpose-speller.js trước osmd-renderer.js');
$renderer = (string)file_get_contents($root . '/assets/js/osmd-renderer.js');
$failed |= !chk(str_contains($renderer, 'OsmdTransposeSpeller?.install?.(osmd.TransposeCalculator)'), 'osmd-renderer.js gắn bộ ghi tên nốt vào TransposeCalculator');
$failed |= !chk(preg_match('/transposeValue === 0 && _appliedTranspose !== 0\)\s*\{\s*await reload\(null, 0\)/', $renderer) === 1, 'Modern: về tông gốc (0) sau khi đã dịch thì dựng lại từ XML gốc, không dùng khoá nhạc đã dịch còn sót (hết ♮/♯ thừa)');
$failed |= !chk(substr_count($renderer, '_appliedTranspose = 0') >= 2, 'Modern: _appliedTranspose được reset sau mỗi osmd.load()');
$oldIndex = (string)file_get_contents($root . '/old/index.php');
$posOS = strpos($oldIndex, "jsTag('osmd-transpose-speller.js')");
$posOR = strpos($oldIndex, "jsTag('osmd-renderer.js')");
$failed |= !chk($posOS !== false && $posOR !== false && $posOS < $posOR, 'old/index.php (Classic) nạp osmd-transpose-speller.js trước osmd-renderer.js');
$oldRenderer = (string)file_get_contents($root . '/old/assets/js/osmd-renderer.js');
$failed |= !chk(substr_count($oldRenderer, 'OsmdTransposeSpeller?.install?.(osmd.TransposeCalculator)') === 2, 'Classic osmd-renderer.js gắn bộ ghi tên nốt ở cả hai chỗ tạo TransposeCalculator (load + reload)');
echo "\nSUITE_COMPLETE total=" . ($nodeTotal + 6) . "\n";
exit($failed ? 1 : 0);
