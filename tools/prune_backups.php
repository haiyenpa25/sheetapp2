<?php
/**
 * tools/prune_backups.php — Dọn bản sao lưu tự động cũ trong storage/backups (OPT-02).
 *
 * Chỉ xét file tự động có dạng <tiền tố>_YYYYmmdd_HHMMSS.sqlite; mỗi tiền tố giữ N bản mới nhất.
 * Bản chụp đặt tên thủ công (trước migration, restore drill, manifest…) không bao giờ bị đụng tới.
 * Mặc định chỉ in danh sách (dry-run). Chỉ xoá khi có --apply.
 *
 *   php tools/prune_backups.php                 # dry-run, giữ 3 bản mỗi tiền tố
 *   php tools/prune_backups.php --keep=5
 *   php tools/prune_backups.php --apply
 *   php tools/prune_backups.php --dir=<path>    # thư mục khác (dùng cho test)
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

const AUTO_BACKUP_PATTERN = '/^(?<prefix>[A-Za-z0-9_-]+?)_(?<stamp>\d{8}_\d{6})\.sqlite$/';
const DEFAULT_KEEP = 3;

/**
 * @return array<string, list<string>> tiền tố => tên file, mới nhất trước
 */
function groupAutoBackups(string $dir): array {
    $groups = [];
    foreach (scandir($dir) ?: [] as $name) {
        if (!preg_match(AUTO_BACKUP_PATTERN, $name, $m)) continue;
        $groups[$m['prefix']][$m['stamp'] . "\0" . $name] = $name;
    }
    foreach ($groups as $prefix => $files) {
        krsort($files, SORT_STRING);
        $groups[$prefix] = array_values($files);
    }
    ksort($groups);
    return $groups;
}

/**
 * @return list<string> các file vượt quá số bản cần giữ
 */
function selectPrunable(array $groups, int $keep): array {
    $prunable = [];
    foreach ($groups as $files) {
        foreach (array_slice($files, $keep) as $name) $prunable[] = $name;
    }
    return $prunable;
}

$options = getopt('', ['apply', 'keep:', 'dir:']);
$dir = $options['dir'] ?? __DIR__ . '/../storage/backups';
$keep = isset($options['keep']) ? (int)$options['keep'] : DEFAULT_KEEP;
$apply = isset($options['apply']);

if (!is_dir($dir)) {
    fwrite(STDERR, "Không tìm thấy thư mục: {$dir}\n");
    exit(1);
}
if ($keep < 1) {
    fwrite(STDERR, "--keep phải >= 1\n");
    exit(1);
}

$groups = groupAutoBackups($dir);
$prunable = selectPrunable($groups, $keep);
$bytes = 0;
foreach ($prunable as $name) $bytes += (int)filesize($dir . '/' . $name);

echo ($apply ? "XOÁ" : "DRY-RUN") . " — giữ {$keep} bản mới nhất mỗi tiền tố trong {$dir}\n";
foreach ($groups as $prefix => $files) {
    echo sprintf("  %-28s %3d file, giữ %d, dọn %d\n", $prefix, count($files), min($keep, count($files)), max(0, count($files) - $keep));
}
foreach ($prunable as $name) echo "  - {$name}\n";
echo sprintf("Tổng: %d file, %.1f MB\n", count($prunable), $bytes / 1048576);

if (!$apply) {
    echo "Chưa xoá gì. Chạy lại với --apply sau khi đã duyệt danh sách.\n";
    exit(0);
}

$failed = 0;
foreach ($prunable as $name) {
    if (!@unlink($dir . '/' . $name)) {
        $failed++;
        fwrite(STDERR, "Không xoá được: {$name}\n");
    }
}
echo "Đã xoá " . (count($prunable) - $failed) . " file.\n";
exit($failed > 0 ? 1 : 0);
