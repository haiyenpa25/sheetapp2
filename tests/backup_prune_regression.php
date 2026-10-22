<?php
/**
 * tests/backup_prune_regression.php — OPT-02: tools/prune_backups.php
 * Chạy hoàn toàn trên thư mục tạm; không đụng storage/backups thật.
 */

declare(strict_types=1);
// SUITE_TYPE: behavioral

$total = 0;
$passed = 0;
function check(bool $ok, string $desc): void {
    global $total, $passed;
    $total++;
    if ($ok) $passed++;
    echo ($ok ? "  [PASS] " : "  [FAIL] ") . $desc . "\n";
}

echo "=== OPT-02: Backup Prune Regression ===\n";

$root = dirname(__DIR__);
$tool = escapeshellarg($root . '/tools/prune_backups.php');
$dir = sys_get_temp_dir() . '/sheetapp_prune_' . getmypid();
@mkdir($dir, 0775, true);

$auto = [];
for ($i = 1; $i <= 6; $i++) {
    $auto[] = sprintf('app_before_r34_202610%02d_120000.sqlite', $i);
}
$manual = [
    'app-before-learning-owner-20260925.sqlite',
    'snapshot_before_k3_cleanup.sqlite',
    'manifest_20260925_013707.json',
    'other_tool_20261001_080000.sqlite',
];
foreach (array_merge($auto, $manual) as $name) file_put_contents("{$dir}/{$name}", 'x');

$dry = (string)shell_exec("php {$tool} --dir=" . escapeshellarg($dir));
check(str_contains($dry, 'DRY-RUN'), 'Mặc định là dry-run');
check(count(glob("{$dir}/*")) === 10, 'Dry-run không xoá file nào');
check(str_contains($dry, 'app_before_r34_20261001_120000.sqlite'), 'Dry-run liệt kê bản cũ nhất');
check(!str_contains($dry, 'app_before_r34_20261006_120000.sqlite'), 'Dry-run không liệt kê bản mới nhất');

shell_exec("php {$tool} --apply --dir=" . escapeshellarg($dir));
$left = array_map('basename', glob("{$dir}/*") ?: []);
check(count(array_filter($left, fn($n) => str_starts_with($n, 'app_before_r34_'))) === 3, '--apply giữ đúng 3 bản r34 mới nhất');
check(in_array('app_before_r34_20261006_120000.sqlite', $left, true), 'Bản mới nhất còn nguyên');
check(!in_array('app_before_r34_20261001_120000.sqlite', $left, true), 'Bản cũ nhất đã bị xoá');
foreach ($manual as $name) {
    check(in_array($name, $left, true), "Không đụng bản thủ công / tiền tố khác: {$name}");
}

shell_exec("php {$tool} --apply --keep=1 --dir=" . escapeshellarg($dir));
$left = array_map('basename', glob("{$dir}/*") ?: []);
check(in_array('other_tool_20261001_080000.sqlite', $left, true), '--keep=1 vẫn giữ bản duy nhất của tiền tố khác');

foreach (glob("{$dir}/*") ?: [] as $f) @unlink($f);
@rmdir($dir);

echo "Tổng số kiểm tra: {$total} (Behavioral: {$total}, Static: 0)\n";
echo "Số kiểm tra đạt: {$passed}\n";
echo "Số kiểm tra lỗi: " . ($total - $passed) . "\n";
echo "SUITE_COMPLETE total={$total}\n";
exit($passed === $total ? 0 : 1);
