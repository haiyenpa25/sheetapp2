<?php
declare(strict_types=1);
ob_start(); // Giữ đầu ra CLI khỏi việc commit header HTTP mô phỏng.

/**
 * tests/private_catalog_regression.php — danh mục riêng + tải bài (XML) riêng tư (2026-10-29).
 * Bài có bản quyền không được lọt ra khách: kiểm danh sách, xem bài, phát XML, mọi route theo mã bài,
 * chương trình, chuyển công khai/riêng, chống lấy file ngoài thư mục, chịu được thiếu migration 017, quy tắc Git.
 */
$root = dirname(__DIR__);
$privateDir = sys_get_temp_dir() . '/sheetapp-private-' . bin2hex(random_bytes(4)) . '/xml';
putenv('SHEETAPP_PRIVATE_XML_DIR=' . $privateDir);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/services/ImportService.php';
require_once $root . '/api/services/CategoryService.php';
require_once $root . '/api/services/SetlistPublicReadService.php';
require_once $root . '/api/core/SongAccessGuard.php';
require_once $root . '/api/controllers/SongController.php';

$total = 0; $failed = 0;
function checkPc(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $name = ''): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => $name] : [];
    Auth::resetDbCache();
}
function fetchXml(string $songId): array {
    $_GET = ['action' => 'xml', 'id' => $songId]; $_SERVER['REQUEST_METHOD'] = 'GET'; http_response_code(200);
    ob_start(); (new SongController())->handleRequest('GET');
    return ['body' => (string)ob_get_clean(), 'status' => http_response_code()];
}
function guardAllows(string $route, string $songId): bool {
    $_GET = ['songId' => $songId]; $_SERVER['REQUEST_METHOD'] = 'GET';
    return SongAccessGuard::isAllowed($route);
}
function throwsInvalid(callable $fn): bool {
    try { $fn(); } catch (InvalidArgumentException $e) { return true; } catch (Throwable $e) { return false; }
    return false;
}
function throwsAny(callable $fn): bool {
    try { $fn(); } catch (Throwable $e) { return true; }
    return false;
}
function uploadXml(string $content, string $title, int $categoryId, string $name = 'bai.xml'): array {
    $tmp = tempnam(sys_get_temp_dir(), 'pcx');
    file_put_contents($tmp, $content);
    try {
        return ImportService::upload(['name' => $name, 'tmp_name' => $tmp, 'size' => strlen($content), 'error' => UPLOAD_ERR_OK],
            ['title' => $title, 'category_id' => $categoryId, 'visibility' => 'public']);
    } finally { @unlink($tmp); }
}
function rrmdir(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $f) { if ($f === '.' || $f === '..') continue; $p = $dir . '/' . $f; is_dir($p) ? rrmdir($p) : @unlink($p); }
    @rmdir($dir);
}

$samples = glob($root . '/storage/Thanh ca/*.xml') ?: [];
$sampleXml = $samples ? (string)file_get_contents($samples[0]) : '';
checkPc($sampleXml !== '', 'Có file MusicXML mẫu để thử tải lên');

$pdo = createTestDatabase();
DB::setPdo($pdo);
SongService::invalidateCache();
$usersBefore = count(glob($root . '/storage/users/*/imported/*') ?: []);

// ── 1. Danh mục và quyền xem ────────────────────────────────────────────────
asUser(1, 'admin');
$privCat = CategoryService::create('Bản quyền riêng', 'private');
$adminCat = CategoryService::create('Chỉ admin', 'admin_only');
$pubCat = CategoryService::create('Công khai mới', 'public');
checkPc($privCat['visibility'] === 'private' && $adminCat['visibility'] === 'admin_only' && $pubCat['visibility'] === 'public', 'Tạo danh mục với ba mức quyền xem');
checkPc(throwsInvalid(fn() => CategoryService::create('bản QUYỀN riêng', 'public')), 'Tên danh mục trùng (không phân biệt hoa thường) bị từ chối');
checkPc(throwsInvalid(fn() => CategoryService::create('Xấu', 'secret')), 'Quyền xem không hợp lệ bị từ chối');
checkPc(throwsInvalid(fn() => CategoryService::create(str_repeat('a', 101), 'public')), 'Tên danh mục quá dài bị từ chối');
$names = fn() => array_column(CategoryService::getAll(), 'name');
asUser(null);        checkPc(!in_array('Bản quyền riêng', $names(), true) && !in_array('Chỉ admin', $names(), true) && in_array('Công khai mới', $names(), true), 'Khách chỉ thấy danh mục công khai');
asUser(3, 'viewer'); checkPc(!in_array('Bản quyền riêng', $names(), true), 'Viewer đã đăng nhập không thấy danh mục riêng');
asUser(2, 'banhat'); checkPc(in_array('Bản quyền riêng', $names(), true) && !in_array('Chỉ admin', $names(), true), 'Ban nhạc thấy danh mục riêng nhưng không thấy danh mục chỉ-admin');
asUser(1, 'admin');  checkPc(in_array('Chỉ admin', $names(), true), 'Admin thấy mọi danh mục');

// ── 2. Tải bài vào danh mục riêng ───────────────────────────────────────────
$up = uploadXml($sampleXml, 'Bài Có Bản Quyền', $privCat['id']);
$song = $up['song']; $pid = (string)$song['id'];
checkPc($song['visibility'] === 'private' && (int)$song['is_public'] === 0, 'Bài tải vào danh mục riêng bị ép thành riêng tư dù người tải chọn công khai');
checkPc(str_starts_with($pid, PrivateSongXmlService::ID_PREFIX), 'Mã bài riêng tư mang tiền tố pv- (để Git bỏ qua hợp âm/ghi chú)');
checkPc($song['xmlPath'] === PrivateSongXmlService::apiPath($pid), 'xmlPath lưu URL API có kiểm quyền, không phải đường dẫn tải trực tiếp');
$stored = PrivateSongXmlService::filePath($pid);
checkPc($stored !== null && str_starts_with($stored, (string)realpath($privateDir) . DIRECTORY_SEPARATOR) && is_file($stored), 'File XML nằm trong vùng riêng tư');
checkPc(SongService::resolveManagedXmlPath($song['xmlPath']) === $stored, 'resolveManagedXmlPath ánh xạ URL API về file riêng tư (xuất ChordPro, tìm lời dùng được)');
checkPc(count(glob($root . '/storage/users/*/imported/*') ?: []) === $usersBefore, 'Không ghi file nào vào vùng tải trực tiếp storage/users');
checkPc(throwsAny(fn() => uploadXml($sampleXml, 'Bài mxl', $privCat['id'], 'bai.mxl')), 'Bài riêng tư từ chối file .mxl');
$adminSong = uploadXml($sampleXml, 'Bài Chỉ Admin', $adminCat['id'])['song'];
checkPc($adminSong['visibility'] === 'admin_only', 'Danh mục chỉ-admin ép bài thành admin_only');

// ── 3. Ma trận truy cập ─────────────────────────────────────────────────────
foreach ([[null, 'khách'], [3, 'viewer']] as [$uid, $label]) {
    asUser($uid, $uid ? 'viewer' : '');
    $inList = in_array($pid, array_column(SongService::getAll(), 'id'), true);
    checkPc(SongService::getById($pid) === null && !$inList, "$label: không thấy bài riêng tư trong danh sách và khi xem theo mã");
    checkPc(fetchXml($pid)['status'] === 404, "$label: API phát XML trả 404 cho bài riêng tư");
    checkPc(!guardAllows('chord_sets', $pid) && !guardAllows('annotations', $pid) && !guardAllows('export', $pid) && !guardAllows('arrangements', $pid) && !guardAllows('sessions', $pid), "$label: chốt chặn theo mã bài chặn hợp âm, ghi chú, xuất ChordPro, bản phối, phiên");
}
asUser(2, 'banhat');
$x = fetchXml($pid);
checkPc(SongService::getById($pid) !== null && $x['status'] === 200 && $x['body'] === $sampleXml, 'Ban nhạc xem được bài riêng tư và nhận đúng nội dung XML');
checkPc(guardAllows('chord_sets', $pid), 'Ban nhạc qua được chốt chặn theo mã bài');
checkPc(SongService::getById((string)$adminSong['id']) === null && fetchXml((string)$adminSong['id'])['status'] === 404, 'Ban nhạc không thấy bài chỉ-admin');
asUser(1, 'admin');
checkPc(fetchXml((string)$adminSong['id'])['status'] === 200, 'Admin xem được bài chỉ-admin');

// ── 4. Chống lấy file ngoài thư mục ─────────────────────────────────────────
checkPc(fetchXml('../../.env')['status'] === 404 && fetchXml('..%2F..%2Fapp')['status'] === 404, 'API phát XML từ chối mã chứa đường dẫn lên thư mục cha');
checkPc(PrivateSongXmlService::filePath('../x') === null && PrivateSongXmlService::songIdFromApiPath('api/index.php?route=songs&action=xml&id=' . rawurlencode('../x')) === null, 'Dịch vụ XML riêng tư từ chối id không hợp lệ');

// ── 5. Công khai / chuyển riêng cả danh mục ─────────────────────────────────
$pub = CategoryService::update($privCat['id'], null, 'public');
checkPc($pub['songs_changed'] === 1 && $pub['visibility'] === 'public', 'Công khai danh mục áp dụng đồng loạt cho các bài trong đó');
asUser(null);
checkPc(SongService::getById($pid) !== null && fetchXml($pid)['status'] === 200 && guardAllows('chord_sets', $pid), 'Sau khi công khai, khách xem được bài, XML và hợp âm');
asUser(1, 'admin'); CategoryService::update($privCat['id'], null, 'private'); asUser(null);
checkPc(SongService::getById($pid) === null && fetchXml($pid)['status'] === 404, 'Chuyển lại riêng tư thì khách mất quyền xem ngay (bộ nhớ đệm công khai được làm mới)');
asUser(1, 'admin'); CategoryService::update($privCat['id'], null, 'admin_only'); asUser(2, 'banhat');
checkPc(SongService::getById($pid) === null, 'Chuyển danh mục sang chỉ-admin thì ban nhạc cũng mất quyền xem');
asUser(1, 'admin'); CategoryService::update($privCat['id'], null, 'private');

// ── 6. Chuyển bài có sẵn vào/ra danh mục riêng ──────────────────────────────
$existing = '001-thanh-chua-yeu-thuong';
SongService::update($existing, ['category_id' => $privCat['id']]);
$row = $pdo->query("SELECT visibility FROM songs WHERE id='$existing'")->fetch();
checkPc($row['visibility'] === 'private', 'Chuyển bài công khai vào danh mục riêng thì bài thành riêng tư');
SongService::update($existing, ['category_id' => $pubCat['id']]);
$row = $pdo->query("SELECT visibility FROM songs WHERE id='$existing'")->fetch();
checkPc($row['visibility'] === 'private', 'Chuyển ra danh mục công khai KHÔNG tự công khai bài (phải công khai chủ động)');

// ── 7. Chương trình (bản rút gọn cho viewer) ────────────────────────────────
$pdo->exec("INSERT INTO setlists (title, status, created_by, scheduled_date) VALUES ('CT thử', 'published', 1, '2026-11-01')");
$sid = (int)$pdo->lastInsertId();
$pdo->exec("UPDATE songs SET visibility='public', is_public=1, category_id=1 WHERE id='002-ngoi-khen-chua'");
$pdo->prepare("INSERT INTO setlist_items (setlist_id, song_id, display_order) VALUES (?, ?, 1), (?, ?, 2)")->execute([$sid, '002-ngoi-khen-chua', $sid, $pid]);
$items = array_column(SetlistPublicReadService::getById($sid)['items'], 'song_id');
checkPc(in_array('002-ngoi-khen-chua', $items, true) && !in_array($pid, $items, true), 'Chương trình cho viewer không liệt kê bài riêng tư');

// ── 8. Chịu được web chưa chạy migration 017 ───────────────────────────────
$old = createTestDatabase();
$old->exec('ALTER TABLE categories DROP COLUMN visibility');
DB::setPdo($old); asUser(null);
$cats = CategoryService::getAll();
checkPc(count($cats) > 0 && ($cats[0]['visibility'] ?? null) === 'public', 'Chưa có cột visibility: danh sách danh mục vẫn chạy (coi như công khai)');
checkPc(is_array(SongService::getAll()) && SongService::categoryVisibility(1) === 'public', 'Chưa có cột visibility: danh sách bài và quyền danh mục vẫn chạy');
asUser(1, 'admin');
checkPc(throwsInvalid(fn() => CategoryService::create('Riêng', 'private')), 'Chưa có cột visibility: tạo danh mục riêng bị từ chối kèm hướng dẫn chạy migration');
DB::setPdo($pdo);

// ── 9. Quy tắc Git và web ───────────────────────────────────────────────────
$ignore = (string)file_get_contents($root . '/.gitignore');
checkPc(str_contains($ignore, 'storage/private/') && str_contains($ignore, 'storage/data/chord_sets/pv-*/') && str_contains($ignore, 'storage/data/annotations/pv-*'), '.gitignore loại XML riêng tư và hợp âm/ghi chú của bài pv-');
$guard = dirname($privateDir) . '/.htaccess';
checkPc(is_file($guard) && str_contains((string)file_get_contents($guard), 'Require all denied'), 'Thư mục XML riêng tư tự có .htaccess chặn truy cập trực tiếp');

rrmdir(dirname($privateDir));
echo "SUITE_COMPLETE total={$total}\n";
exit($failed ? 1 : 0);
