<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_api_regression.php — S3 API quản lý Hội Thánh (route churches).
 * Kiểm: danh sách HT của tôi, chọn HT, vào bằng mã mời (chờ duyệt), duyệt/đổi vai trò/khóa, quyền quản trị HT,
 * chặn bỏ admin HT cuối cùng, đổi mã mời, tạo HT (chỉ admin hệ thống), giới hạn nhập sai mã.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/ChurchAccessGuard.php';
require_once $root . '/api/services/ChurchService.php';
require_once $root . '/api/controllers/ChurchController.php';
require_once $root . '/tests/lib/mock_php_input.php';

$total = 0; $failed = 0;
function checkApi(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}
/** Gọi ChurchController như HTTP, trả [status, json]. */
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

$pdo = createTestDatabase();
DB::setPdo($pdo);
$pwd = password_hash('x', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (4, 'leader1', ?, 'leader', 'active'), (5, 'newbie', ?, 'viewer', 'active'), (6, 'other', ?, 'leader', 'active')")->execute([$pwd, $pwd, $pwd]);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
$ht1 = (int)ChurchService::defaultChurchId();
$pdo->exec("DELETE FROM church_members WHERE user_id = 5"); // newbie chưa thuộc HT nào
// HT2 có quản trị riêng là user 6; user 4 làm admin HT1; admin hệ thống chỉ còn là leader HT1.
$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (2, 'HT Hai', 'ht-hai', 'ABCD1234')");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (2, 6, 'church_admin')");
$pdo->exec("UPDATE church_members SET role = 'church_admin' WHERE user_id = 4 AND church_id = $ht1");
$pdo->exec("UPDATE church_members SET role = 'leader' WHERE user_id = 1 AND church_id = $ht1");

FeatureFlags::setOverride('MULTI_CHURCH', true);

// ── Khách bị chặn
asUser(null);
checkApi(callChurch('GET')[0] === 401, 'Khách không gọi được API Hội Thánh');

// ── Danh sách của tôi
asUser(2, 'banhat');
$r = callChurch('GET');
checkApi($r[0] === 200 && count($r[1]['churches'] ?? []) === 1 && (int)$r[1]['active_church_id'] === $ht1, 'Thành viên thấy HT của mình và HT đang làm việc');
checkApi(!isset($r[1]['all_churches']), 'Thành viên thường không thấy danh sách mọi HT');
asUser(1, 'admin');
checkApi(count(callChurch('GET')[1]['all_churches'] ?? []) === 2, 'Admin hệ thống thấy mọi HT');

// ── Vào bằng mã mời → chờ duyệt, chưa vào được
asUser(5, 'viewer');
$bad = callChurch('POST', ['action' => 'join'], ['code' => 'ZZZZZZZZ']);
checkApi($bad[0] === 400, 'Mã mời sai bị từ chối (nhận ' . $bad[0] . ')');
$code2 = (string)$pdo->query("SELECT invite_code FROM churches WHERE id = 2")->fetchColumn();
$join = callChurch('POST', ['action' => 'join'], ['code' => strtolower($code2)]);
checkApi($join[0] === 200 && ($join[1]['membership']['status'] ?? '') === 'pending', 'Nhập mã mời (không phân biệt hoa thường) → chờ duyệt');
checkApi(ChurchService::memberRole(5, 2) === null, 'Đang chờ duyệt chưa là thành viên hoạt động');
checkApi((callChurch('POST', ['action' => 'join'], ['code' => $code2])[1]['membership']['status'] ?? '') === 'pending', 'Nhập lại mã vẫn chờ duyệt');
checkApi((int)$pdo->query("SELECT COUNT(*) FROM church_members WHERE user_id = 5 AND church_id = 2")->fetchColumn() === 1, 'Chỉ một bản ghi thành viên');
$mine = callChurch('GET')[1];
checkApi(count($mine['pending'] ?? []) === 1 && (int)$mine['pending'][0]['id'] === 2, 'Danh sách hiện HT đang chờ duyệt');

// ── Quyền quản trị HT
checkApi(callChurch('GET', ['action' => 'members', 'church_id' => 2])[0] === 403, 'Người thường không xem được thành viên/mã mời');
asUser(4, 'leader');
checkApi(callChurch('GET', ['action' => 'members', 'church_id' => 2])[0] === 403, 'Admin HT1 không quản lý được HT2');
$m1 = callChurch('GET', ['action' => 'members', 'church_id' => $ht1]);
checkApi($m1[0] === 200 && !empty($m1[1]['invite_code']) && count($m1[1]['members']) >= 4, 'Admin HT1 xem được thành viên + mã mời của HT1');
asUser(6, 'leader');
$approve = callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 5, 'status' => 'active', 'role' => 'member']);
checkApi($approve[0] === 200 && ChurchService::memberRole(5, 2) === 'member', 'Admin HT2 duyệt thành viên với vai trò member');
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 5, 'role' => 'superuser'])[0] === 400, 'Vai trò lạ bị từ chối');
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 99, 'role' => 'member'])[0] === 400, 'Người không thuộc HT bị từ chối');
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => $ht1, 'user_id' => 2, 'role' => 'leader'])[0] === 403, 'Admin HT2 không sửa được thành viên HT1');

// ── Chọn HT đang làm việc
asUser(5, 'viewer');
checkApi(callChurch('POST', ['action' => 'switch'], ['church_id' => 2])[0] === 200 && ChurchService::activeChurchId(5) === 2, 'Chọn được HT mình thuộc');
checkApi(callChurch('POST', ['action' => 'switch'], ['church_id' => $ht1])[0] === 403, 'Không chọn được HT chưa thuộc');

// ── Không bỏ được admin HT cuối cùng
asUser(6, 'leader');
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 6, 'role' => 'member'])[0] === 409, 'Không hạ vai trò admin HT cuối cùng');
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 6, 'status' => 'disabled'])[0] === 409, 'Không khóa admin HT cuối cùng');
callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 5, 'role' => 'church_admin']);
checkApi(callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 6, 'role' => 'member'])[0] === 200, 'Còn admin khác thì hạ được');

// ── Khóa thành viên: không tự mở lại bằng mã mời
asUser(5, 'viewer');
callChurch('POST', ['action' => 'update_member'], ['church_id' => 2, 'user_id' => 6, 'status' => 'disabled']);
asUser(6, 'leader');
checkApi(ChurchService::memberRole(6, 2) === null, 'Thành viên bị khóa không còn quyền trong HT');
checkApi(callChurch('POST', ['action' => 'join'], ['code' => $code2])[0] === 400, 'Người bị khóa không tự mở lại bằng mã mời');

// ── Đổi mã mời / tên
asUser(5, 'viewer');
$new = callChurch('POST', ['action' => 'regenerate_code'], ['church_id' => 2]);
$newCode = (string)($new[1]['invite_code'] ?? '');
checkApi($new[0] === 200 && $newCode !== $code2 && preg_match('/^[A-F0-9]{8}$/', $newCode) === 1, 'Đổi mã mời cho mã mới 8 ký tự');
asUser(4, 'leader');
checkApi(callChurch('POST', ['action' => 'join'], ['code' => $code2])[0] === 400, 'Mã mời cũ hết hiệu lực');
checkApi(callChurch('POST', ['action' => 'rename'], ['church_id' => 2, 'name' => 'x'])[0] === 403, 'Admin HT khác không đổi được tên');
asUser(5, 'viewer');
checkApi(callChurch('POST', ['action' => 'rename'], ['church_id' => 2, 'name' => '   '])[0] === 400, 'Tên rỗng bị từ chối');
checkApi(callChurch('POST', ['action' => 'rename'], ['church_id' => 2, 'name' => 'Hội Thánh Bình An'])[0] === 200
    && (string)$pdo->query("SELECT name FROM churches WHERE id = 2")->fetchColumn() === 'Hội Thánh Bình An', 'Đổi tên HT thành công');

// ── Tạo HT: chỉ admin hệ thống
checkApi(callChurch('POST', ['action' => 'create'], ['name' => 'Lậu'])[0] === 403, 'Admin HT không tạo được HT mới');
asUser(1, 'admin');
$c1 = callChurch('POST', ['action' => 'create'], ['name' => 'Hội Thánh Đức Tin']);
checkApi($c1[0] === 200 && ($c1[1]['church']['slug'] ?? '') !== '' && preg_match('/^[a-z0-9-]+$/', (string)$c1[1]['church']['slug']) === 1, 'Admin hệ thống tạo HT, slug chỉ gồm a-z0-9-');
$c2 = callChurch('POST', ['action' => 'create'], ['name' => 'Hội Thánh Đức Tin']);
checkApi($c2[0] === 200 && $c2[1]['church']['slug'] !== $c1[1]['church']['slug'], 'Tên trùng vẫn có slug khác');
checkApi(callChurch('POST', ['action' => 'switch'], ['church_id' => (int)$c1[1]['church']['id']])[0] === 200, 'Admin hệ thống chọn được HT bất kỳ');

// ── Giới hạn nhập sai mã
asUser(4, 'leader');
for ($i = 0; $i < 10; $i++) callChurch('POST', ['action' => 'join'], ['code' => 'BAD' . $i]);
checkApi(callChurch('POST', ['action' => 'join'], ['code' => $newCode])[0] === 429, 'Nhập sai quá 10 lần trong phiên bị chặn 429');

// ── Cờ tắt: router chặn route
$idx = (string)file_get_contents($root . '/api/index.php');
checkApi((bool)preg_match("/case 'churches':\s+if \(!FeatureFlags::isEnabled\('MULTI_CHURCH'\)\)/", $idx), 'Router chặn route churches khi cờ tắt');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}\n";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
