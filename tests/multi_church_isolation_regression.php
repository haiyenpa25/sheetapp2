<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_isolation_regression.php — S2 cô lập dữ liệu theo Hội Thánh (cờ MULTI_CHURCH bật).
 * Người HT1 không đọc/sửa/xóa/phân công/thêm mục/xem báo cáo của HT2 qua TỪNG điểm vào của SetlistController,
 * danh sách và báo cáo chỉ gồm HT đang làm việc, chương trình mới gắn đúng HT, cờ tắt = hành vi cũ.
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
function checkIso(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer', ?int $church = null): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    if ($church) $_SESSION['church_id'] = $church;
    Auth::resetDbCache();
}
/** Gọi SetlistController như HTTP, trả [status, json]. */
function callSetlist(string $method, array $get = [], ?array $body = null): array {
    $_GET = $get; $_SERVER['REQUEST_METHOD'] = $method; http_response_code(200);
    mockPhpInput($body === null ? '' : json_encode($body));
    ob_start();
    try { (new SetlistController())->handleRequest($method); } catch (Throwable $e) { echo json_encode(['exception' => $e->getMessage()]); }
    $out = (string)ob_get_clean();
    restorePhpInput();
    return [http_response_code(), json_decode($out, true) ?? []];
}

$pdo = createTestDatabase();
DB::setPdo($pdo);
$pwd = password_hash('x', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (4, 'leader1', ?, 'leader', 'active'), (5, 'leader2', ?, 'leader', 'active')")->execute([$pwd, $pwd]);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
$ht1 = (int)ChurchService::defaultChurchId();
$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (2, 'HT Hai', 'ht-hai', 'ABCD1234')");
// leader1 chỉ thuộc HT1; leader2 chỉ thuộc HT2.
$pdo->exec("DELETE FROM church_members WHERE user_id = 5");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (2, 5, 'leader')");

FeatureFlags::setOverride('MULTI_CHURCH', true);

// ── Tạo chương trình: gắn đúng HT đang làm việc
asUser(4, 'leader');
$r1 = callSetlist('POST', [], ['title' => 'CN HT1', 'scheduled_date' => '2026-11-08']);
$sl1 = (int)($r1[1]['id'] ?? 0);
checkIso($sl1 > 0 && (int)$pdo->query("SELECT church_id FROM setlists WHERE id = $sl1")->fetchColumn() === $ht1, 'Chương trình mới của leader HT1 thuộc HT1');
asUser(5, 'leader');
$r2 = callSetlist('POST', [], ['title' => 'CN HT2', 'scheduled_date' => '2026-11-08']);
$sl2 = (int)($r2[1]['id'] ?? 0);
checkIso($sl2 > 0 && (int)$pdo->query("SELECT church_id FROM setlists WHERE id = $sl2")->fetchColumn() === 2, 'Chương trình mới của leader HT2 thuộc HT2');
$pdo->exec("UPDATE setlists SET status = 'published' WHERE id IN ($sl1, $sl2)");
$pdo->exec("INSERT INTO setlist_items (id, setlist_id, song_id, display_order) VALUES (101, $sl1, '001-thanh-chua-yeu-thuong', 1), (102, $sl2, '002-ngoi-khen-chua', 1)");
$pdo->exec("INSERT INTO service_plan_assignments (id, setlist_id, user_id, role) VALUES (201, $sl2, 5, 'leader')");

// ── Danh sách chỉ gồm HT đang làm việc
asUser(4, 'leader');
$list = callSetlist('GET')[1]['data'] ?? [];
checkIso(array_map('intval', array_column($list, 'id')) === [$sl1], 'leader HT1 chỉ thấy chương trình HT1 trong danh sách');
asUser(2, 'banhat');
$pub = callSetlist('GET')[1]['data'] ?? [];
checkIso(!in_array($sl2, array_map('intval', array_column($pub, 'id')), true), 'Thành viên HT1 không thấy chương trình HT2');
asUser(null);
checkIso(callSetlist('GET')[0] === 401, 'Khách vẫn bị chặn 401');

// ── HT1 truy cập HT2 qua từng điểm vào → 404
asUser(4, 'leader');
$cases = [
    'xem chi tiết'       => ['GET', ['id' => $sl2], null],
    'gói offline'        => ['GET', ['action' => 'offline_package', 'id' => $sl2], null],
    'cập nhật'           => ['POST', ['action' => 'update', 'id' => $sl2], ['title' => 'hack']],
    'phát hành'          => ['POST', ['action' => 'publish', 'id' => $sl2], []],
    'thêm mục'           => ['POST', ['action' => 'add_item'], ['setlist_id' => $sl2, 'song_id' => '001-thanh-chua-yeu-thuong']],
    'sửa mục'            => ['POST', ['action' => 'update_item', 'id' => 102], ['bpm' => 99]],
    'xóa mục'            => ['DELETE', ['action' => 'remove_item', 'id' => 102], null],
    'phân công'          => ['POST', ['action' => 'assign'], ['setlist_id' => $sl2, 'user_id' => 4, 'role' => 'vocal']],
    'gỡ phân công'       => ['DELETE', ['action' => 'remove_assignment', 'id' => 201], null],
    'phản hồi phân công' => ['POST', ['action' => 'respond_assignment', 'id' => 201], ['status' => 'confirmed']],
    'xóa chương trình'   => ['DELETE', ['id' => $sl2], null],
];
foreach ($cases as $label => [$m, $g, $b]) {
    $res = callSetlist($m, $g, $b);
    checkIso($res[0] === 404, "HT1 → HT2 ($label) bị chặn 404 (nhận {$res[0]})");
}
checkIso((string)$pdo->query("SELECT title FROM setlists WHERE id = $sl2")->fetchColumn() === 'CN HT2', 'Dữ liệu HT2 nguyên vẹn sau các lần thử');
checkIso((int)$pdo->query("SELECT COUNT(*) FROM setlist_items WHERE setlist_id = $sl2")->fetchColumn() === 1, 'Mục của HT2 không bị thêm/xóa');

// ── Phân công người ngoài HT bị từ chối; người trong HT thì được
asUser(4, 'leader');
$bad = callSetlist('POST', ['action' => 'assign'], ['setlist_id' => $sl1, 'user_id' => 5, 'role' => 'vocal']);
checkIso($bad[0] === 400, 'Không phân công được người thuộc HT khác (nhận ' . $bad[0] . ')');
$ok = callSetlist('POST', ['action' => 'assign'], ['setlist_id' => $sl1, 'user_id' => 2, 'role' => 'vocal']);
checkIso($ok[0] === 200, 'Phân công được thành viên cùng HT (nhận ' . $ok[0] . ')');

// ── Báo cáo / lịch sử dùng bài chỉ tính HT đang làm việc
$pdo->exec("INSERT INTO song_usage_history (song_id, setlist_id, service_date) VALUES ('001-thanh-chua-yeu-thuong', $sl1, '2026-11-01'), ('001-thanh-chua-yeu-thuong', $sl2, '2026-11-02'), ('002-ngoi-khen-chua', $sl2, '2026-11-02')");
asUser(4, 'leader');
$hist = SetlistService::getSongUsageHistory('001-thanh-chua-yeu-thuong');
checkIso((int)$hist['total_used'] === 1 && count($hist['history']) === 1, 'Lịch sử dùng bài chỉ tính HT1');
$report = SetlistService::getUsageReport(null, null, 20);
checkIso((int)$report['summary']['total_song_plays'] === 1 && count($report['recent_history']) === 1, 'Báo cáo sử dụng chỉ tính HT1');
checkIso(!in_array('002-ngoi-khen-chua', array_column($report['most_used'], 'song_id'), true), 'Bài chỉ dùng ở HT2 không lọt vào "dùng nhiều" của HT1');
checkIso(in_array('002-ngoi-khen-chua', array_column($report['dormant_songs'], 'song_id'), true), 'Bài chỉ dùng ở HT2 vẫn là "chưa dùng" với HT1');
$recent = SetlistService::checkRecentUsage('002-ngoi-khen-chua', 4);
checkIso(empty($recent['is_recent']) && $recent['last_used_date'] === null, 'Cảnh báo dùng gần đây không tính lần dùng ở HT khác');

// ── Admin hệ thống chuyển HT tùy ý
asUser(1, 'admin', 2);
$adminList = callSetlist('GET')[1]['data'] ?? [];
checkIso(array_map('intval', array_column($adminList, 'id')) === [$sl2], 'Admin đang ở HT2 thấy chương trình HT2');
asUser(1, 'admin', $ht1);
checkIso(callSetlist('GET', ['id' => $sl2])[0] === 200, 'Admin hệ thống mở được chương trình HT2 theo mã');

// ── Người chưa thuộc HT nào không tạo được chương trình
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (6, 'lone', ?, 'leader', 'active')")->execute([$pwd]);
asUser(6, 'leader');
checkIso(callSetlist('POST', [], ['title' => 'x'])[0] === 403, 'Người chưa thuộc HT nào không tạo được chương trình');

// ── Cờ TẮT: hành vi cũ, ai đã đăng nhập thấy tất cả
FeatureFlags::setOverride('MULTI_CHURCH', false);
asUser(4, 'leader');
$all = callSetlist('GET')[1]['data'] ?? [];
checkIso(count($all) === 2, 'Cờ tắt: thấy mọi chương trình như trước');
checkIso(callSetlist('GET', ['id' => $sl2])[0] === 200, 'Cờ tắt: mở được chương trình HT2 như trước');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}
";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
