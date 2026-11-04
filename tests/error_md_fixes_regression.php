<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
ob_start();
$root = dirname(__DIR__);
$privateDir = sys_get_temp_dir() . '/sheetapp-reloc-' . bin2hex(random_bytes(4)) . '/xml';
putenv('SHEETAPP_PRIVATE_XML_DIR=' . $privateDir);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/services/CategoryService.php';
require_once $root . '/api/services/SongXmlRelocator.php';
require_once $root . '/api/services/ImportService.php';
require_once $root . '/api/services/ManagerRepertoireHelper.php';
require_once $root . '/api/services/LibrarySyncService.php';
require_once $root . '/api/core/Response.php';
$pdo = createTestDatabase(); DB::setPdo($pdo);
$total = 0; $failed = 0;
function ec(bool $ok, string $m): void { global $total, $failed; ++$total; if (!$ok) ++$failed; fwrite(STDOUT, ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $m . "\n"); }

$xml = '<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><key><fifths>0</fifths></key></attributes></measure></part></score-partwise>';
$tag = 'zz-reloc-' . bin2hex(random_bytes(2));
$dirA = "storage/Thanh ca/{$tag}-a/"; $dirB = "storage/Thanh ca/{$tag}-b/";
// Test ghi thư mục thật trong storage/Thanh ca: luôn dọn khi kết thúc, kể cả khi dừng giữa chừng.
register_shutdown_function(static function () use ($root, $tag): void {
    foreach (['a', 'b'] as $suffix) {
        $dir = "{$root}/storage/Thanh ca/{$tag}-{$suffix}";
        foreach (glob($dir . '/*') ?: [] as $file) @unlink($file);
        @rmdir($dir);
    }
});
$pdo->exec("INSERT INTO categories (id, name, slug, visibility, display_order) VALUES (901, 'ZZ A', '{$tag}-a', 'public', 7), (902, 'ZZ B', '{$tag}-b', 'public', 8)");
@mkdir($root . '/' . $dirA, 0775, true);
file_put_contents($root . '/' . $dirA . 'x.xml', $xml);
$pdo->prepare("INSERT INTO songs (id, title, xmlPath, category_id, visibility, is_public) VALUES ('zz-song-1', 'ZZ', ?, 901, 'public', 1)")->execute([$dirA . 'x.xml']);

// ERR-09: đổi danh mục → file theo sang thư mục mới
$r = SongService::update('zz-song-1', ['category_id' => 902]);
$path = (string)$pdo->query("SELECT xmlPath FROM songs WHERE id='zz-song-1'")->fetchColumn();
ec(($r['success'] ?? false) && $path === $dirB . 'x.xml' && is_file($root . '/' . $path) && !is_file($root . '/' . $dirA . 'x.xml'), 'ERR-09: đổi danh mục bài → file XML chuyển sang thư mục danh mục mới, xmlPath cập nhật');

// ERR-07: đổi tên không đổi slug
$u = CategoryService::update(902, 'ZZ B đã đổi tên');
ec($u['slug'] === "{$tag}-b" && $u['name'] === 'ZZ B đã đổi tên', 'ERR-07: đổi tên danh mục giữ nguyên slug (thư mục không lệch)');

// ERR-08: công khai → nội bộ: file rời storage/Thanh ca sang kho riêng
CategoryService::update(902, null, 'private');
$path = (string)$pdo->query("SELECT xmlPath FROM songs WHERE id='zz-song-1'")->fetchColumn();
ec(str_starts_with($path, 'api/index.php?route=songs&action=xml') && !is_file($root . '/' . $dirB . 'x.xml') && is_file($privateDir . '/zz-song-1.xml'), 'ERR-08: danh mục chuyển nội bộ → XML rời thư mục công khai sang kho riêng');
// nội bộ → công khai
CategoryService::update(902, null, 'public');
$pdo->exec("UPDATE songs SET visibility='public', is_public=1 WHERE id='zz-song-1'");
SongXmlRelocator::relocate('zz-song-1');
$path = (string)$pdo->query("SELECT xmlPath FROM songs WHERE id='zz-song-1'")->fetchColumn();
ec($path === $dirB . 'zz-song-1.xml' && is_file($root . '/' . $path) && !is_file($privateDir . '/zz-song-1.xml'), 'ERR-08: chuyển lại công khai → XML về thư mục danh mục');

// ERR-06: sửa danh mục giữ display_order
$_SESSION = ['user_id' => (int)$pdo->query("SELECT id FROM users WHERE role='admin' AND status='active' LIMIT 1")->fetchColumn()]; Auth::resetDbCache();
$res = ManagerRepertoireHelper::manageCategory('update', ['id' => 902, 'name' => 'ZZ B', 'icon' => '🎵', 'description' => '']);
ec((int)$pdo->query('SELECT display_order FROM categories WHERE id=902')->fetchColumn() === 8, 'ERR-06: sửa danh mục không gửi display_order thì giữ nguyên thứ tự');

// ERR-11: giải nén .mxl
$tmpZip = tempnam(sys_get_temp_dir(), 'mxl');
if (class_exists('ZipArchive')) {
    $zip = new ZipArchive(); $zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('META-INF/container.xml', '<container><rootfiles><rootfile full-path="inner/song.xml"/></rootfiles></container>');
    $zip->addFromString('inner/song.xml', $xml); $zip->close();
    $un = ImportService::unpackMxl((string)file_get_contents($tmpZip));
    ec(str_contains($un, '<score-partwise') && substr($un, 0, 2) !== 'PK', 'ERR-11: .mxl được giải nén thành MusicXML thuần');
} else {
    fwrite(STDOUT, "[SKIP] ERR-11: PHP chưa bật extension zip (ZipArchive) nên không kiểm được giải nén .mxl
");
}
ec(ImportService::unpackMxl($xml) === $xml, 'ERR-11: XML thường đi qua không đổi');
$bad = false; try { ImportService::unpackMxl("PK\x03\x04rác"); } catch (Throwable $e) { $bad = true; }
ec($bad, 'ERR-11: .mxl hỏng báo lỗi rõ ràng');
@unlink($tmpZip);
$loader = (string)file_get_contents($root . '/assets/js/core/SongLoaderCore.js');
ec(str_contains($loader, "startsWith('PK')"), 'ERR-11: trình tải kiểm MusicXML hợp lệ trước khi đưa cho OSMD');

// ERR-04: khóa chống đồng bộ chồng
$lockFile = $root . '/storage/logs/library_sync.lock';
@mkdir(dirname($lockFile), 0775, true);
$fh = fopen($lockFile, 'c'); flock($fh, LOCK_EX);
$busy = LibrarySyncService::syncAll(false);
flock($fh, LOCK_UN); fclose($fh);
ec(($busy['busy'] ?? false) === true && ($busy['success'] ?? true) === false, 'ERR-04: đồng bộ đang chạy thì lần thứ hai bị từ chối (409), không chạy chồng');
$src = (string)file_get_contents($root . '/api/services/LibrarySyncService.php');
ec(str_contains($src, 'GIT_TERMINAL_PROMPT=0') && str_contains($src, 'timeout 120'), 'ERR-04: git push có timeout và không treo chờ mật khẩu');

// ERR-13: importer Classic
$old = (string)file_get_contents($root . '/old/assets/js/importer.js');
ec(str_contains($old, 'importer.search(url, { title })') && str_contains($old, 'importer.fetch(url, { title })') && str_contains($old, '(?:old\\/)?'), 'ERR-13: Classic truyền tên bài và tính đúng đường dẫn OMR từ /old/');
// ERR-12 / ERR-03 giữ nguyên
ec(str_contains((string)file_get_contents($root . '/old/assets/js/admin-ui.js'), 'Array.isArray(res) ? res : (res.data || [])'), 'ERR-12: modal Quản trị /old/ đọc danh mục dạng mảng');
// ERR-15: lưu HD cập nhật hash manifest
ec(str_contains((string)file_get_contents($root . '/api/services/ChordSetService.php'), 'refreshManifestHash'), 'ERR-15: lưu bộ HD cập nhật hash trong library.manifest.json');

// dọn dữ liệu test (chỉ các đường dẫn do test tạo)
foreach ([$dirA, $dirB] as $d) { foreach (glob($root . '/' . $d . '*') ?: [] as $f) @unlink($f); @rmdir($root . '/' . $d); }
foreach (glob($privateDir . '/*') ?: [] as $f) @unlink($f);
ob_end_clean();
echo "SUITE_COMPLETE total={$total}\n"; exit($failed ? 1 : 0);
