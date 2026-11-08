<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

/**
 * tools/scan_library_health.php
 * Quét CHỈ ĐỌC toàn bộ kho bài: cảnh báo cấu trúc MusicXML + các nhóm bài trùng (tên chuẩn hoá, nội dung y hệt).
 * Không sửa file, không ghi DB. Chạy: php tools/scan_library_health.php
 */
require_once __DIR__ . '/../api/services/MusicXmlHealthService.php';

$root = dirname(__DIR__);
$pdo = new PDO('sqlite:' . $root . '/storage/data/app.sqlite');
$rows = $pdo->query('SELECT id, title, xmlPath FROM songs WHERE COALESCE(is_public, 1) = 1')->fetchAll(PDO::FETCH_ASSOC);

$byTitle = [];
$byHash = [];
$issues = [];
foreach ($rows as $row) {
    $byTitle[MusicXmlHealthService::normalizeTitle((string)$row['title'])][] = $row['id'];
    $path = $root . '/' . $row['xmlPath'];
    if (!is_file($path)) { $issues[$row['id']] = ['Thiếu file XML']; continue; }
    $xml = (string)file_get_contents($path);
    $byHash[md5($xml)][] = $row['id'];
    $warnings = array_values(array_filter(
        MusicXmlHealthService::analyze($xml),
        static fn(string $w): bool => $w !== 'Bản nhạc không có lời'
    ));
    if ($warnings) $issues[$row['id']] = $warnings;
}

echo 'Đã quét ' . count($rows) . " bài công khai\n\n";
echo 'Bài có cảnh báo cấu trúc: ' . count($issues) . "\n";
foreach ($issues as $id => $warnings) echo "  $id: " . implode('; ', $warnings) . "\n";

$sameTitle = array_filter($byTitle, static fn(array $ids): bool => count($ids) > 1);
$sameXml = array_filter($byHash, static fn(array $ids): bool => count($ids) > 1);
echo "\nNhóm trùng tên chuẩn hoá: " . count($sameTitle) . " (có thể là cùng bài ở các tuyển tập khác nhau)\n";
foreach ($sameTitle as $ids) echo '  ' . implode(', ', $ids) . "\n";
echo "\nNhóm trùng nội dung XML y hệt: " . count($sameXml) . "\n";
foreach ($sameXml as $ids) echo '  ' . implode(', ', $ids) . "\n";
