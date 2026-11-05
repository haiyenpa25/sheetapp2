<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_accounts_regression.php — quản lý HT trong tab người dùng:
 * tạo HT kèm 3 tài khoản (banhat/bannhac/admin.<viết tắt>, mật khẩu ngẫu nhiên), gán/gỡ người dùng, xóa HT an toàn
 * (chương trình mất, tài khoản + bài hát + XML còn, danh mục riêng thành admin_only), danh sách người dùng kèm HT, phân quyền.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/ChurchAccessGuard.php';
require_once $root . '/api/services/ChurchService.php';
require_once $root . '/api/services/ManagerUserHelper.php';
require_once $root . '/api/controllers/ChurchController.php';
require_once $root . '/tests/lib/mock_php_input.php';

$total = 0; $failed = 0;
function checkAcc(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}
function callChurch(string $method, array $get = [], ?array $body = null): array {
    $_GET = $get; $_SERVER['REQUEST_METHOD'] = $method; http_response_code(200);
    mockPhpInput($body === null ? '' : json_encode($body));
    ob_start();
    try { (new ChurchController())->handleRequest($method); } catch (HttpException $e) { http_response_code($e->getStatusCode()); echo json_encode(['error' => $e->getMessage()]); }
    catch (Throwable $e) { echo json_encode(['exception' => $e->getMessage()]); }
    $out = (string)ob_get_clean();
    restorePhpInput();
    return [http_response_code(), json_decode($out, true) ?? []];
}

// Chạy trực tiếp file này cũng không được ghi nhật ký kiểm toán giả vào storage/logs/audit.log thật.
require_once $root . '/api/core/AuditLogger.php';
AuditLogger::setLogPath(sys_get_temp_dir() . '/sheetapp_audit_accounts_' . bin2hex(random_bytes(4)) . '.log');

$pdo = createTestDatabase();
DB::setPdo($pdo);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
FeatureFlags::setOverride('MULTI_CHURCH', true);
$default = (int)ChurchService::defaultChurchId();

// ── Quyền: chỉ admin hệ thống tạo/xóa/gán
asUser(2, 'banhat');
checkAcc(callChurch('POST', ['action' => 'create'], ['name' => 'X', 'abbr' => 'xx'])[0] === 403, 'Người thường không tạo được HT');
checkAcc(callChurch('POST', ['action' => 'delete'], ['church_id' => $default, 'confirm' => true])[0] === 403, 'Người thường không xóa được HT');
checkAcc(callChurch('POST', ['action' => 'add_member'], ['church_id' => $default, 'user_id' => 3])[0] === 403, 'Người thường không gán được người vào HT');

// ── Tạo HT kèm 3 tài khoản
asUser(1, 'admin');
$r = callChurch('POST', ['action' => 'create'], ['name' => 'Hội thánh Thạnh Mỹ Lợi', 'abbr' => 'httml']);
$accounts = $r[1]['accounts'] ?? [];
$churchId = (int)($r[1]['church']['id'] ?? 0);
checkAcc($r[0] === 200 && $churchId > 0 && count($accounts) === 3, 'Tạo HT kèm 3 tài khoản');
$names = array_column($accounts, 'username');
sort($names);
checkAcc($names === ['admin.httml', 'banhat.httml', 'bannhac.httml'], 'Tên tài khoản theo quy ước <vai trò>.<viết tắt>');
$byName = array_column($accounts, null, 'username');
checkAcc(preg_match('/^[A-Za-z0-9]{12}$/', (string)$byName['banhat.httml']['password']) === 1, 'Mật khẩu ngẫu nhiên 12 ký tự');
checkAcc(count(array_unique(array_column($accounts, 'password'))) === 3, 'Mỗi tài khoản một mật khẩu khác nhau');
$row = $pdo->query("SELECT id, role, password_hash FROM users WHERE username = 'admin.httml'")->fetch(PDO::FETCH_ASSOC);
checkAcc(password_verify($byName['admin.httml']['password'], (string)$row['password_hash']), 'Mật khẩu trả về đăng nhập được, DB chỉ lưu băm');
checkAcc($row['role'] === 'leader' && ChurchService::memberRole((int)$row['id'], $churchId) === 'church_admin', 'admin.<viết tắt>: vai trò hệ thống leader + quản trị HT');
$sysRoles = $pdo->query("SELECT username, role FROM users WHERE username LIKE '%.httml' ORDER BY username")->fetchAll(PDO::FETCH_KEY_PAIR);
checkAcc($sysRoles['banhat.httml'] === 'banhat' && $sysRoles['bannhac.httml'] === 'bannhac', 'banhat/bannhac giữ đúng vai trò hệ thống');
checkAcc(!in_array('admin', $sysRoles, true), 'Không tài khoản nào của HT là admin hệ thống');

// ── Trùng viết tắt / viết tắt sai: không tạo dở dang
$before = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
$dup = callChurch('POST', ['action' => 'create'], ['name' => 'Khác', 'abbr' => 'HTTML']);
checkAcc($dup[0] === 400, 'Viết tắt trùng bị từ chối (không phân biệt hoa thường)');
checkAcc(callChurch('POST', ['action' => 'create'], ['name' => 'Khác', 'abbr' => 'a b'])[0] === 400, 'Viết tắt có khoảng trắng bị từ chối');
checkAcc(callChurch('POST', ['action' => 'create'], ['name' => 'Khác', 'abbr' => 'x'])[0] === 400, 'Viết tắt quá ngắn bị từ chối');
checkAcc((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === $before && (int)$pdo->query('SELECT COUNT(*) FROM churches')->fetchColumn() === 2, 'Lỗi không để lại HT/tài khoản dở dang');
$pdo->exec("INSERT INTO users (username, password_hash, role, status) VALUES ('banhat.zz', 'x', 'banhat', 'active')");
$before = (int)$pdo->query('SELECT COUNT(*) FROM churches')->fetchColumn();
checkAcc(callChurch('POST', ['action' => 'create'], ['name' => 'ZZ', 'abbr' => 'zz'])[0] === 400 && (int)$pdo->query('SELECT COUNT(*) FROM churches')->fetchColumn() === $before, 'Tài khoản trùng sẵn có → từ chối trước khi tạo');

// ── Gán / gỡ người dùng
$hoaidinh = (int)$pdo->query("SELECT id FROM users WHERE username = 'banhat'")->fetchColumn();
checkAcc(callChurch('POST', ['action' => 'add_member'], ['church_id' => $churchId, 'user_id' => $hoaidinh, 'role' => 'member'])[0] === 200 && ChurchService::memberRole($hoaidinh, $churchId) === 'member', 'Admin hệ thống gán người dùng vào HT');
checkAcc(count(ChurchService::forUser($hoaidinh)) === 2, 'Một người thuộc nhiều HT');
checkAcc(callChurch('POST', ['action' => 'add_member'], ['church_id' => $churchId, 'user_id' => 99999])[0] === 400, 'Gán người không tồn tại bị từ chối');
checkAcc(callChurch('POST', ['action' => 'add_member'], ['church_id' => $churchId, 'user_id' => $hoaidinh, 'role' => 'boss'])[0] === 400, 'Vai trò lạ bị từ chối');
checkAcc(callChurch('POST', ['action' => 'add_member'], ['church_id' => $churchId, 'user_id' => $hoaidinh, 'role' => 'leader'])[0] === 200 && ChurchService::memberRole($hoaidinh, $churchId) === 'leader', 'Gán lại đổi vai trò, không tạo bản ghi đôi');
checkAcc(callChurch('POST', ['action' => 'remove_member'], ['church_id' => $churchId, 'user_id' => $hoaidinh])[0] === 200 && ChurchService::memberRole($hoaidinh, $churchId) === null, 'Gỡ khỏi HT');
checkAcc((int)$pdo->query("SELECT COUNT(*) FROM users WHERE id = $hoaidinh")->fetchColumn() === 1, 'Gỡ khỏi HT không xóa tài khoản');
$adminHt = (int)$pdo->query("SELECT id FROM users WHERE username = 'admin.httml'")->fetchColumn();
checkAcc(callChurch('POST', ['action' => 'remove_member'], ['church_id' => $churchId, 'user_id' => $adminHt])[0] === 409, 'Không gỡ được admin HT cuối cùng');

// ── Danh sách người dùng kèm HT
$list = ManagerUserHelper::getUsersList();
$mine = array_column($list, null, 'username');
checkAcc(isset($mine['admin.httml']['churches'][0]['name']) && $mine['admin.httml']['churches'][0]['role'] === 'church_admin', 'Danh sách người dùng kèm Hội thánh và vai trò');
checkAcc($mine['banhat']['churches'][0]['name'] === 'Hội Thánh mặc định', 'Người dùng cũ hiện HT mặc định');
FeatureFlags::setOverride('MULTI_CHURCH', false);
checkAcc(!array_key_exists('churches', ManagerUserHelper::getUsersList()[0]), 'Cờ tắt: danh sách người dùng như cũ (không có cột HT)');
FeatureFlags::setOverride('MULTI_CHURCH', true);

// ── Xóa HT an toàn
$pdo->exec("INSERT INTO setlists (id, title, created_by, church_id) VALUES (500, 'CN HTTML', $adminHt, $churchId), (501, 'CN mặc định', 1, $default)");
$pdo->exec("INSERT INTO setlist_items (setlist_id, song_id, display_order) VALUES (500, '001-thanh-chua-yeu-thuong', 1)");
$pdo->exec("INSERT INTO categories (id, name, slug, visibility, church_id) VALUES (900, 'Bài riêng HTTML', 'rieng-httml', 'private', $churchId)");
$pdo->exec("INSERT INTO songs (id, title, xmlPath, category_id, visibility, is_public) VALUES ('pv-httml-1', 'Bài riêng', 'storage/private/xml/pv-httml-1.xml', 900, 'private', 0)");
asUser(1, 'admin');
$noConfirm = callChurch('POST', ['action' => 'delete'], ['church_id' => $churchId]);
checkAcc($noConfirm[0] === 400 && (int)$pdo->query("SELECT COUNT(*) FROM churches WHERE id = $churchId")->fetchColumn() === 1, 'Xóa không xác nhận bị từ chối, HT còn nguyên');
$del = callChurch('POST', ['action' => 'delete'], ['church_id' => $churchId, 'confirm' => true]);
checkAcc($del[0] === 200 && (int)($del[1]['deleted']['setlists'] ?? -1) === 1 && (int)($del[1]['deleted']['members'] ?? -1) === 3, 'Xóa HT báo số chương trình/thành viên đã xóa');
checkAcc((int)$pdo->query("SELECT COUNT(*) FROM churches WHERE id = $churchId")->fetchColumn() === 0, 'HT đã bị xóa');
checkAcc((int)$pdo->query('SELECT COUNT(*) FROM setlists WHERE id = 500')->fetchColumn() === 0 && (int)$pdo->query('SELECT COUNT(*) FROM setlist_items WHERE setlist_id = 500')->fetchColumn() === 0, 'Chương trình của HT bị xóa (kể cả các mục)');
checkAcc((int)$pdo->query('SELECT COUNT(*) FROM setlists WHERE id = 501')->fetchColumn() === 1, 'Chương trình HT khác không bị đụng');
checkAcc((int)$pdo->query("SELECT COUNT(*) FROM users WHERE username LIKE '%.httml'")->fetchColumn() === 3, 'Tài khoản của HT vẫn còn (không xóa)');
checkAcc((int)$pdo->query('SELECT COUNT(*) FROM church_members WHERE church_id = ' . $churchId)->fetchColumn() === 0, 'Quan hệ thành viên đã gỡ');
$song = $pdo->query("SELECT category_id FROM songs WHERE id = 'pv-httml-1'")->fetch(PDO::FETCH_ASSOC);
checkAcc($song !== false && (int)$song['category_id'] === 900, 'Bài hát riêng và đường dẫn XML vẫn còn');
$cat = $pdo->query('SELECT church_id, visibility FROM categories WHERE id = 900')->fetch(PDO::FETCH_ASSOC);
checkAcc($cat['church_id'] === null && $cat['visibility'] === 'admin_only', 'Danh mục riêng chuyển admin_only, không lộ cho ai (chờ admin gán lại)');
// Không xóa HT cuối cùng
checkAcc(callChurch('POST', ['action' => 'delete'], ['church_id' => $default, 'confirm' => true])[0] === 409, 'Không xóa được HT duy nhất của hệ thống');

// ── Quyền tải bài: admin HT chỉ vào danh mục riêng của HT mình
require_once $root . '/api/controllers/ImportController.php';
function uploadAllowed(int $categoryId): bool {
    try { ImportController::authorizeUpload($categoryId); return true; }
    catch (HttpException $e) { return false; }
}
$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (20, 'HT A', 'ht-a', 'AAAA1111'), (21, 'HT B', 'ht-b', 'BBBB2222')");
$pdo->exec("INSERT INTO users (id, username, password_hash, role, status) VALUES (70, 'adm.a', 'x', 'leader', 'active'), (71, 'mem.a', 'x', 'bannhac', 'active')");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (20, 70, 'church_admin'), (20, 71, 'member')");
$pdo->exec("INSERT INTO categories (id, name, slug, visibility, church_id) VALUES (910, 'Riêng A', 'rieng-a', 'private', 20), (911, 'Riêng B', 'rieng-b', 'private', 21)");
asUser(1, 'admin');
checkAcc(uploadAllowed(910) && uploadAllowed(1) && uploadAllowed(911), 'Admin hệ thống tải được vào mọi danh mục');
asUser(70, 'leader');
checkAcc(uploadAllowed(910), 'Admin HT A tải được vào danh mục riêng của HT A');
checkAcc(!uploadAllowed(911), 'Admin HT A không tải được vào danh mục riêng của HT B');
checkAcc(!uploadAllowed(1), 'Admin HT A không tải được vào danh mục chung');
asUser(71, 'bannhac');
checkAcc(!uploadAllowed(910), 'Thành viên thường của HT A không tải được bài');
asUser(null);
checkAcc(!uploadAllowed(910), 'Khách không tải được bài');
FeatureFlags::setOverride('MULTI_CHURCH', false);
asUser(70, 'leader');
checkAcc(!uploadAllowed(910), 'Cờ tắt: admin HT không tải được (chỉ admin hệ thống như cũ)');
FeatureFlags::setOverride('MULTI_CHURCH', true);

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}\n";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
