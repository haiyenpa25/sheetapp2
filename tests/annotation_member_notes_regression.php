<?php
declare(strict_types=1);
/**
 * Ghi chú theo nhạc cụ do thành viên tự ghi (mỗi người chỉ sửa/xóa ghi chú của mình, Admin sửa tất cả)
 * và ghi chú chung của bài cho ban nhạc (điệu, tempo, lời dặn).
 */
require_once dirname(__DIR__) . '/api/core/HttpException.php';
require_once dirname(__DIR__) . '/api/services/AnnotationService.php';
$root = dirname(__DIR__);
$failed = 0;
function check(bool $ok, string $label): void {
    global $failed, $total;
    $total = ($total ?? 0) + 1;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
    if (!$ok) $failed++;
}
function rejects(callable $call, int $status, string $label): void {
    try { $call(); check(false, $label); }
    catch (HttpException $error) { check($error->getStatusCode() === $status, $label . " ({$error->getStatusCode()})"); }
}
$dir = sys_get_temp_dir() . '/sheetapp-member-notes-' . bin2hex(random_bytes(6));
mkdir($dir);
$an = ['id' => 7, 'name' => 'an', 'admin' => false];
$binh = ['id' => 8, 'name' => 'binh', 'admin' => false];
$admin = ['id' => 1, 'name' => 'admin', 'admin' => true];
$note = fn(string $id, string $instrument, string $text) => ['id' => $id, 'instrumentId' => $instrument, 'measureIdx' => 2, 'noteIdx' => 0, 'staffIdx' => 0, 'text' => $text];
try {
    $doc = AnnotationService::document('song-m', $dir);
    $doc = AnnotationService::saveDocument('song-m', [$note('n-an', 'drums', 'Fill')], $doc['revision'], $dir, $an);
    check($doc['annotations'][0]['author'] === 'an' && $doc['annotations'][0]['createdBy'] === 7, 'thành viên thêm ghi chú: máy chủ gắn tác giả');
    $spoof = $note('n-b', 'guitar', 'Quạt') + ['author' => 'an', 'createdBy' => 7];
    $doc = AnnotationService::saveDocument('song-m', [$doc['annotations'][0], $spoof], $doc['revision'], $dir, $binh);
    check($doc['annotations'][1]['author'] === 'binh', 'không giả mạo được tác giả từ client');
    $edit = $doc['annotations']; $edit[0]['text'] = 'Sửa trộm';
    rejects(fn() => AnnotationService::saveDocument('song-m', $edit, $doc['revision'], $dir, $binh), 403, 'không sửa được ghi chú người khác');
    rejects(fn() => AnnotationService::saveDocument('song-m', [$doc['annotations'][1]], $doc['revision'], $dir, $binh), 403, 'không xóa được ghi chú người khác');
    $own = $doc['annotations']; $own[1]['text'] = 'Rải';
    $doc = AnnotationService::saveDocument('song-m', $own, $doc['revision'], $dir, $binh);
    check($doc['annotations'][1]['text'] === 'Rải' && $doc['annotations'][0]['text'] === 'Fill', 'sửa ghi chú của mình, ghi chú người khác giữ nguyên');
    $doc = AnnotationService::saveDocument('song-m', [$doc['annotations'][1]], $doc['revision'], $dir, $an);
    check(count($doc['annotations']) === 1 && $doc['annotations'][0]['author'] === 'binh', 'tự xóa ghi chú của mình');
    $doc = AnnotationService::saveDocument('song-m', [], $doc['revision'], $dir, $admin);
    check($doc['annotations'] === [], 'Admin xóa được ghi chú của mọi người');

    $doc = AnnotationService::saveBandNote('song-m', ['style' => ' Ballad ', 'tempo' => 60, 'text' => 'Intro piano 4 ô'], $doc['revision'], $dir, $an);
    check($doc['bandNote']['style'] === 'Ballad' && $doc['bandNote']['tempo'] === 60 && $doc['bandNote']['updatedBy'] === 'an', 'lưu ghi chú chung cho ban nhạc');
    $doc = AnnotationService::saveDocument('song-m', [$note('n-c', 'bass', 'Nốt gốc')], $doc['revision'], $dir, $binh);
    check(($doc['bandNote']['text'] ?? '') === 'Intro piano 4 ô', 'lưu ghi chú nhạc cụ không làm mất ghi chú chung');
    $doc = AnnotationService::saveBandNote('song-m', ['style' => 'Slow', 'tempo' => null, 'text' => ''], $doc['revision'], $dir, $binh);
    check(count($doc['annotations']) === 1 && $doc['bandNote']['tempo'] === null, 'lưu ghi chú chung không làm mất ghi chú nhạc cụ; tempo bỏ trống được');
    rejects(fn() => AnnotationService::saveBandNote('song-m', ['tempo' => 999], $doc['revision'], $dir, $an), 422, 'tempo ngoài 20–300 bị chặn');
    rejects(fn() => AnnotationService::saveBandNote('song-m', ['tempo' => '60'], $doc['revision'], $dir, $an), 422, 'tempo phải là số nguyên');
    rejects(fn() => AnnotationService::saveBandNote('song-m', ['text' => str_repeat('x', 1001)], $doc['revision'], $dir, $an), 422, 'lời dặn quá dài bị chặn');
    rejects(fn() => AnnotationService::saveBandNote('song-m', ['style' => 'x'], 'stale', $dir, $an), 409, 'ghi chú chung có chống ghi đè phiên cũ');
    $doc = AnnotationService::saveBandNote('song-m', ['style' => '', 'text' => ''], $doc['revision'], $dir, $an);
    check($doc['bandNote'] === null, 'xóa trống toàn bộ = gỡ ghi chú chung');
    check(AnnotationService::document('song-m', $dir)['bandNote'] === null, 'đọc lại khớp');

    $legacy = AnnotationService::document('song-legacy', $dir);
    $legacy = AnnotationService::saveDocument('song-legacy', [$note('old', 'general', 'Cũ')], $legacy['revision'], $dir);
    $edit = $legacy['annotations']; $edit[0]['text'] = 'Sửa';
    rejects(fn() => AnnotationService::saveDocument('song-legacy', $edit, $legacy['revision'], $dir, $an), 403, 'ghi chú cũ (không tác giả) chỉ Admin sửa');

    $ctl = file_get_contents("$root/api/controllers/AnnotationController.php");
    check(str_contains($ctl, 'Auth::requireBanhat();') && preg_match("/instrument_save'\\) \\{\\s*Auth::requireAdmin\\(\\);/", $ctl) === 1, 'controller: thành viên ghi chú, danh mục nhạc cụ vẫn chỉ Admin');
    check(str_contains($ctl, "'band_note_save'"), 'controller: có action band_note_save');
} finally {
    array_map('unlink', glob("$dir/{,.}*.{json,lock}", GLOB_BRACE) ?: []);
    @rmdir($dir);
}
echo $failed ? "\n$failed FAILED\n" : "\nALL PASS\n";
if (!$failed) echo "SUITE_COMPLETE total={$total}\n";
exit($failed ? 1 : 0);
