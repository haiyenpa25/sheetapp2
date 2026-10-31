<?php
declare(strict_types=1);

/**
 * Hồi quy: nút −/+ Tông không bị toast che, Toàn màn hình ẩn thanh dưới,
 * panel ghi chú mở ngay lần bấm đầu và lưu ghi chú theo từng nhạc cụ (Modern + Classic).
 */
$root = dirname(__DIR__);
$failed = 0;
function check(string $label, bool $ok): void {
    global $failed, $total;
    $total = ($total ?? 0) + 1;
    echo ($ok ? 'PASS' : 'FAIL') . ": $label\n";
    if (!$ok) $failed++;
}
function read(string $path): string { global $root; return (string)file_get_contents("$root/$path"); }

$polish = read('assets/css/library-polish.css');
check('Toast điện thoại hiện ở đầu màn hình, không phủ thanh đáy',
    (bool)preg_match('/@media \(max-width: 680px\) \{\s*\.toast-container \{[^}]*top: calc\(52px[^}]*bottom: auto !important/s', $polish));
check('Toast điện thoại không nuốt cú chạm (chỉ nút × nhận chạm)',
    str_contains($polish, '.toast-container .toast { pointer-events: none; }') && str_contains($polish, '.toast-dismiss { pointer-events: auto;'));
check('Biểu Diễn ẩn thanh dưới với độ ưu tiên thắng luật grid',
    str_contains(read('assets/css/control-deck.css'), 'body.sheet-only-mode #mobile-thumb-bar.mobile-thumb-bar { display: none !important; }'));

foreach (['assets/js/performance-notes.js', 'old/assets/js/performance-notes.js'] as $file) {
    $js = read($file);
    check("$file: panel tạo ở trạng thái ẩn (mở ngay lần bấm đầu)", str_contains($js, "_panel.className = 'hidden';"));
    check("$file: ghi chú cá nhân vẫn giữ perfNotes.instruments cũ khi lưu", str_contains($js, 'instruments,'));
    check("$file: Ban Hát được ghi chú (không khoá admin)", str_contains($js, 'isBanhat'));
}
check('Classic dùng cùng bản performance-notes.js với Modern', read('assets/js/performance-notes.js') === read('old/assets/js/performance-notes.js'));
check('Modern: nút Ghi chú của panel ban nhạc/nhạc cụ nằm trên header', str_contains(read('assets/js/annotation-panel.js'), "button('Ghi chú'"));
check('Classic có nút Ghi chú mở panel ban nhạc/nhạc cụ', str_contains(read('old/includes/toolbar.php'), 'id="btn-toolbar-notes"') && str_contains(read('old/includes/toolbar.php'), 'AnnotationCanvas?.open'));

// Toàn màn hình: iPhone không có Fullscreen API → vẫn vào chế độ bằng CSS (trước đây resetToView ngay)
$mm = read('assets/js/core/ModeManager.js');
$fsFn = substr($mm, (int)strpos($mm, 'async function _requestFullscreen'), 900);
check('ModeManager: thiếu/bị từ chối Fullscreen API không thoát chế độ Biểu Diễn', !str_contains($fsFn, 'resetToView'));
check('ModeManager: hỗ trợ webkitRequestFullscreen (iPad cũ)', str_contains($mm, 'webkitRequestFullscreen') && str_contains($mm, 'webkitfullscreenchange'));
check('ModeManager: chỉ thoát khi rời toàn màn hình thật đã vào', str_contains($mm, '_nativeFullscreen && _currentMode === MODES.PERFORMANCE'));
$oldUi = read('old/assets/js/app-ui.js');
check('Classic: nút toàn màn hình xin toàn màn hình thật, có dự phòng', str_contains($oldUi, '_enterNativeFullscreen') && str_contains($oldUi, 'webkitRequestFullscreen'));
check('Classic: header điện thoại và dải thông tin ẩn khi toàn màn hình', str_contains(read('old/assets/css/control-deck.css'), 'body.sheet-only-mode #toolbar#toolbar'));

require_once "$root/api/services/SessionService.php";
$m = new ReflectionMethod(SessionService::class, 'sanitizeInstrumentNotes');
$m->setAccessible(true);
$out = $m->invoke(null, ['Guitar' => ' Quạt ', 'bad id!' => 'x', 'drums' => '', 'bass' => str_repeat('a', 900), 'vocals' => ['x']]);
check('Giữ id hợp lệ (hạ chữ thường, cắt khoảng trắng)', ($out['guitar'] ?? '') === 'Quạt');
check('Bỏ id sai, ghi chú rỗng và giá trị không phải chuỗi', !isset($out['bad id!']) && !isset($out['drums']) && !isset($out['vocals']));
check('Giới hạn độ dài mỗi ghi chú', mb_strlen($out['bass'] ?? '') === 600);
check('Đầu vào không phải mảng → rỗng', $m->invoke(null, 'abc') === []);

echo $failed ? "\n$failed FAILED\n" : "\nALL PASS\n";
if (!$failed) echo "SUITE_COMPLETE total={$total}\n";
exit($failed ? 1 : 0);
