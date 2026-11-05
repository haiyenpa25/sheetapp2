<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_roles_regression.php — vai trò trong Hội Thánh là TRẦN quyền ghi chương trình lễ.
 * Một người có vai trò hệ thống "leader" nhưng chỉ là Chỉ xem / Thành viên trong HT thì không tạo/sửa/phát hành/xóa/phân công;
 * Thành viên thêm/sửa/xóa bài trong chương trình của mình; Ca trưởng HT làm đủ; cờ tắt = như cũ; admin hệ thống luôn được.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/ChurchAccessGuard.php';
require_once $root . '/api/services/ChurchService.php';
require_once $root . '/api/services/SetlistService.php';
require_once $root . '/api/controllers/SetlistController.php';
require_once $root . '/tests/lib/mock_php_input.php';

$total = 0; $failed = 0;
function checkRole(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}
function callSetlist(string $method, array $get = [], ?array $body = null): array {
    $_GET = $get; $_SERVER['REQUEST_METHOD'] = $method; http_response_code(200);
    mockPhpInput($body === null ? '' : json_encode($body));
    ob_start();
    try { (new SetlistController())->handleRequest($method); } catch (HttpException $e) { http_response_code($e->getStatusCode()); echo json_encode(['error' => $e->getMessage()]); }
    catch (Throwable $e) { echo json_encode(['exception' => $e->getMessage()]); }
    $out = (string)ob_get_clean();
    restorePhpInput();
    return [http_response_code(), json_decode($out, true) ?? []];
}
function setChurchRole(PDO $pdo, int $user, string $role): void {
    $pdo->prepare("UPDATE church_members SET role = ? WHERE user_id = ? AND church_id = 1")->execute([$role, $user]);
}

$pdo = createTestDatabase();
DB::setPdo($pdo);
$pwd = password_hash('x', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (4, 'leaderA', ?, 'leader', 'active')")->execute([$pwd]);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
$pdo->exec("INSERT INTO setlists (id, title, created_by, church_id, status) VALUES (10, 'CN HT1', 4, 1, 'draft')");
$pdo->exec("INSERT INTO setlist_items (id, setlist_id, song_id, display_order) VALUES (110, 10, '001-thanh-chua-yeu-thuong', 1)");

FeatureFlags::setOverride('MULTI_CHURCH', true);
$add = ['setlist_id' => 10, 'song_id' => '002-ngoi-khen-chua'];

// ── Vai trò hệ thống leader nhưng "Chỉ xem" trong HT
setChurchRole($pdo, 4, 'viewer');
asUser(4, 'leader');
checkRole(callSetlist('POST', [], ['title' => 'Mới'])[0] === 403, 'Chỉ xem trong HT: không tạo được chương trình');
checkRole(callSetlist('POST', ['action' => 'update', 'id' => 10], ['title' => 'Sửa'])[0] === 403, 'Chỉ xem trong HT: không sửa được chương trình');
checkRole(callSetlist('POST', ['action' => 'publish', 'id' => 10], [])[0] === 403, 'Chỉ xem trong HT: không phát hành được');
checkRole(callSetlist('POST', ['action' => 'add_item'], $add)[0] === 403, 'Chỉ xem trong HT: không thêm bài được');
checkRole(callSetlist('POST', ['action' => 'update_item', 'id' => 110], ['bpm' => 90])[0] === 403, 'Chỉ xem trong HT: không sửa bài trong chương trình');
checkRole(callSetlist('DELETE', ['action' => 'remove_item', 'id' => 110])[0] === 403, 'Chỉ xem trong HT: không xóa bài khỏi chương trình');
checkRole(callSetlist('POST', ['action' => 'assign'], ['setlist_id' => 10, 'user_id' => 1, 'role' => 'vocal'])[0] === 403, 'Chỉ xem trong HT: không phân công được');
checkRole(callSetlist('DELETE', ['id' => 10])[0] === 403, 'Chỉ xem trong HT: không xóa được chương trình');
checkRole(callSetlist('GET', ['id' => 10])[0] === 200, 'Chỉ xem trong HT: vẫn xem được chương trình');
checkRole((int)$pdo->query("SELECT COUNT(*) FROM setlists")->fetchColumn() === 1 && (string)$pdo->query("SELECT title FROM setlists WHERE id = 10")->fetchColumn() === 'CN HT1', 'Dữ liệu không đổi sau các lần bị chặn');

// ── Thành viên trong HT: chỉ ghi bài trong chương trình, không tạo/phát hành/phân công
setChurchRole($pdo, 4, 'member');
checkRole(callSetlist('POST', [], ['title' => 'Mới'])[0] === 403, 'Thành viên: không tạo được chương trình');
checkRole(callSetlist('POST', ['action' => 'publish', 'id' => 10], [])[0] === 403, 'Thành viên: không phát hành được');
checkRole(callSetlist('POST', ['action' => 'assign'], ['setlist_id' => 10, 'user_id' => 1, 'role' => 'vocal'])[0] === 403, 'Thành viên: không phân công được');
checkRole(callSetlist('POST', ['action' => 'add_item'], $add)[0] === 200, 'Thành viên: thêm bài vào chương trình của mình');
checkRole(callSetlist('POST', ['action' => 'update_item', 'id' => 110], ['bpm' => 90])[0] === 200, 'Thành viên: sửa bài trong chương trình');

// ── Ca trưởng HT: đủ quyền
setChurchRole($pdo, 4, 'leader');
$mk = callSetlist('POST', [], ['title' => 'Mới', 'scheduled_date' => '2026-11-15']);
checkRole($mk[0] === 200 && (int)($mk[1]['id'] ?? 0) > 0, 'Ca trưởng HT: tạo được chương trình');
checkRole(callSetlist('POST', ['action' => 'update', 'id' => 10], ['title' => 'Sửa'])[0] === 200, 'Ca trưởng HT: sửa được');
checkRole(callSetlist('POST', ['action' => 'publish', 'id' => 10], [])[0] === 200, 'Ca trưởng HT: phát hành được');

// ── Quản trị HT cũng đủ quyền
setChurchRole($pdo, 4, 'church_admin');
checkRole(callSetlist('POST', ['action' => 'assign'], ['setlist_id' => 10, 'user_id' => 1, 'role' => 'vocal'])[0] === 200, 'Quản trị HT: phân công được');

// ── Admin hệ thống luôn được, kể cả chưa là thành viên
$pdo->exec("DELETE FROM church_members WHERE user_id = 1");
asUser(1, 'admin');
checkRole(callSetlist('POST', ['action' => 'update', 'id' => 10], ['title' => 'Admin sửa'])[0] === 200, 'Admin hệ thống không bị trần vai trò HT');

// ── Cờ tắt: như cũ (vai trò HT không ảnh hưởng)
FeatureFlags::setOverride('MULTI_CHURCH', false);
setChurchRole($pdo, 4, 'viewer');
asUser(4, 'leader');
checkRole(callSetlist('POST', ['action' => 'update', 'id' => 10], ['title' => 'Cờ tắt'])[0] === 200, 'Cờ tắt: vai trò HT không chặn (hành vi cũ)');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}\n";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
