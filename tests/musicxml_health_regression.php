<?php
declare(strict_types=1);

/**
 * tests/musicxml_health_regression.php
 * MusicXmlHealthService: cảnh báo lỗi XML khi nhập + phát hiện bài trùng (tên chuẩn hoá, nội dung y hệt),
 * không lộ bài riêng tư; ImportService gắn warnings/duplicates vào phản hồi mà không làm hỏng việc nhập.
 */
$root = dirname(__DIR__);
require_once $root . '/api/services/MusicXmlHealthService.php';

$total = 0;
$failed = 0;
function check(bool $ok, string $label, string $kind = 'B'): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? "[PASS:$kind] " : "[FAIL:$kind] ") . $label . "\n";
}

function score(string $harmonies, string $lyric = '<lyric><text>La</text></lyric>', string $note = '<pitch><step>C</step><octave>4</octave></pitch>'): string {
    return '<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">'
        . '<measure number="3">' . $harmonies . '<note>' . $note . '<duration>4</duration>' . $lyric . '</note></measure></part></score-partwise>';
}
$harmony = '<harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>';
$other = '<harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>';

// 1) analyze
$clean = MusicXmlHealthService::analyze(score($harmony . '<note><rest/><duration>1</duration></note>' . $other));
check($clean === [], 'XML sạch → không cảnh báo');
$dup = MusicXmlHealthService::analyze(score($harmony . $harmony));
check(count($dup) === 1 && str_contains($dup[0], 'ô nhịp 3'), 'Hợp âm trùng cùng vị trí → báo đúng ô nhịp 3');
check(MusicXmlHealthService::analyze(score($harmony . '<note><rest/></note>' . $harmony)) === [], 'Cùng hợp âm nhưng khác vị trí (có nốt xen giữa) → không báo trùng');
check(in_array('Có lời (lyric) rỗng', MusicXmlHealthService::analyze(score('', '<lyric><text> </text></lyric>')), true), 'Lời rỗng → cảnh báo');
check(in_array('Bản nhạc không có lời', MusicXmlHealthService::analyze(score('', '')), true), 'Không có lời → cảnh báo');
check(in_array('Không có nốt nhạc nào (chỉ toàn dấu lặng)', MusicXmlHealthService::analyze(score('', '<lyric><text>a</text></lyric>', '<rest/>')), true), 'Toàn dấu lặng → cảnh báo');
check(MusicXmlHealthService::analyze('<score-partwise><oops>') === ['Không đọc được cấu trúc XML'], 'XML hỏng → cảnh báo, không ném lỗi');

// 2) normalizeTitle
check(MusicXmlHealthService::normalizeTitle('001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI') === MusicXmlHealthService::normalizeTitle('Hỡi Thánh Vương kíp ngự lai!'), 'Chuẩn hoá tên: bỏ số đầu, dấu câu, hoa/thường, giữ dấu tiếng Việt');
check(MusicXmlHealthService::normalizeTitle('Hô-sa-na') !== MusicXmlHealthService::normalizeTitle('Hô-sa-nô'), 'Chuẩn hoá tên: không gộp nhầm bài khác');

// 3) findDuplicates với DB trong bộ nhớ + thư mục tạm
$dir = sys_get_temp_dir() . '/sheetapp_health_' . bin2hex(random_bytes(4));
mkdir($dir . '/storage', 0777, true);
$existingXml = score($harmony . $other);
file_put_contents($dir . '/storage/a.xml', $existingXml);
file_put_contents($dir . '/storage/b.xml', score($other));
$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE songs (id TEXT, title TEXT, xmlPath TEXT, is_public INTEGER)');
$ins = $pdo->prepare('INSERT INTO songs VALUES (?,?,?,?)');
$ins->execute(['pub-a', '012 Tôn Vinh Cha', 'storage/a.xml', 1]);
$ins->execute(['pub-b', 'Bài khác', 'storage/b.xml', 1]);
$ins->execute(['pv-secret', 'Tôn Vinh Cha', 'storage/none.xml', 0]);

$byTitle = MusicXmlHealthService::findDuplicates($pdo, 'tôn vinh cha', score('<x/>'), $dir);
check(count($byTitle) === 1 && $byTitle[0]['id'] === 'pub-a' && $byTitle[0]['reason'] === 'trùng tên', 'Trùng tên chuẩn hoá → khớp bài công khai');
check(!in_array('pv-secret', array_column($byTitle, 'id'), true), 'Không lộ bài riêng tư (is_public=0) trong kết quả trùng');
$byHash = MusicXmlHealthService::findDuplicates($pdo, 'Tên hoàn toàn mới', $existingXml, $dir);
check(count($byHash) === 1 && $byHash[0]['id'] === 'pub-a' && $byHash[0]['reason'] === 'nội dung XML y hệt', 'Nội dung XML y hệt (khác tên) → phát hiện');
check(MusicXmlHealthService::findDuplicates($pdo, 'Tên mới', score('<y/>'), $dir) === [], 'Bài mới thật sự → không trùng');
check(MusicXmlHealthService::findDuplicates($pdo, '', score('<y/>'), $dir) === [], 'Tên rỗng → không khớp bừa');

// 4) ImportService gắn báo cáo (kiểm cấu trúc mã, vì lưu thật cần DB/storage đầy đủ)
$svc = (string)file_get_contents($root . '/api/services/ImportService.php');
check(str_contains($svc, 'MusicXmlHealthService.php') && substr_count($svc, '$health') >= 3, 'ImportService nạp dịch vụ và nối $health vào cả đường công khai lẫn riêng tư', 'S');
check(preg_match('/function healthReport\(.*?try \{.*?catch \(Throwable/s', $svc) === 1, 'healthReport bắt Throwable → lỗi phân tích không làm hỏng việc nhập', 'S');
check(strpos($svc, 'self::healthReport(') < strpos($svc, 'self::resolveImportDir($categoryId)'), 'Báo cáo tính TRƯỚC khi lưu (bài vừa nhập không tự khớp chính nó)', 'S');

array_map('unlink', glob($dir . '/storage/*'));
rmdir($dir . '/storage');
rmdir($dir);

echo "SUITE_COMPLETE total={$total}\n";
exit($failed === 0 ? 0 : 1);
