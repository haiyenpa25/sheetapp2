<?php
declare(strict_types=1);
ob_start();

/**
 * tests/church_songs_regression.php — kho bài riêng của Hội Thánh: admin HT liệt kê / sửa / xóa / chuyển công khai
 * bài trong danh mục riêng CỦA HT MÌNH; HT khác, thành viên thường và khách bị chặn; chuyển công khai chỉ vào
 * danh mục công khai chung; chiều ngược lại không có đường nào cho admin HT.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/AuditLogger.php';
require_once $root . '/api/controllers/ChurchController.php';
require_once $root . '/tests/lib/mock_php_input.php';

$total = 0; $failed = 0;
function checkCs(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUserCs(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}
function callCs(string $method, array $get = [], ?array $body = null): array {
    $_GET = $get; $_SERVER['REQUEST_METHOD'] = $method; http_response_code(200);
    mockPhpInput($body === null ? '' : json_encode($body));
    ob_start();
    try { (new ChurchController())->handleRequest($method); } catch (HttpException $e) { http_response_code($e->getStatusCode()); echo json_encode(['error' => $e->getMessage()]); }
    catch (Throwable $e) { echo json_encode(['exception' => $e->getMessage()]); }
    $out = (string)ob_get_clean();
    restorePhpInput();
    return [http_response_code(), json_decode($out, true) ?? []];
}

AuditLogger::setLogPath(sys_get_temp_dir() . '/sheetapp_audit_church_songs_' . bin2hex(random_bytes(4)) . '.log');
$pdo = createTestDatabase();
DB::setPdo($pdo);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
FeatureFlags::setOverride('MULTI_CHURCH', true);

$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (30, 'HT A', 'ht-a', 'AAAA3333'), (31, 'HT B', 'ht-b', 'BBBB4444')");
$pdo->exec("INSERT INTO users (id, username, password_hash, role, status) VALUES (80, 'adm.a', 'x', 'leader', 'active'), (81, 'mem.a', 'x', 'bannhac', 'active'), (82, 'adm.b', 'x', 'leader', 'active')");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (30, 80, 'church_admin'), (30, 81, 'member'), (31, 82, 'church_admin')");
$pdo->exec("INSERT INTO categories (id, name, slug, visibility, church_id) VALUES (930, 'Riêng A', 'rieng-a', 'private', 30), (931, 'Riêng B', 'rieng-b', 'private', 31), (932, 'Công khai chung', 'cong-khai-chung', 'public', NULL)");
$pdo->exec("INSERT INTO songs (id, title, xmlPath, category_id, visibility, is_public) VALUES
  ('pv-a-1', 'Bài A1', 'storage/private/xml/pv-a-1.xml', 930, 'private', 0),
  ('pv-a-2', 'Bài A2', 'storage/private/xml/pv-a-2.xml', 930, 'private', 0),
  ('pv-a-3', 'Bài A3', 'storage/private/xml/pv-a-3.xml', 930, 'private', 0),
  ('pv-b-1', 'Bài B1', 'storage/private/xml/pv-b-1.xml', 931, 'private', 0)");

// ── Liệt kê
asUserCs(80, 'leader');
$list = callCs('GET', ['action' => 'songs', 'church_id' => 30]);
$ids = array_column($list[1]['songs'] ?? [], 'id');
checkCs($list[0] === 200 && count($ids) === 3 && !in_array('pv-b-1', $ids, true), 'Admin HT A thấy 3 bài riêng của HT A, không thấy bài HT B');
checkCs(callCs('GET', ['action' => 'songs', 'church_id' => 31])[0] === 403, 'Admin HT A không xem được kho của HT B');
asUserCs(81, 'bannhac');
checkCs(callCs('GET', ['action' => 'songs', 'church_id' => 30])[0] === 403, 'Thành viên thường không xem được danh sách quản lý kho');
asUserCs(null);
checkCs(in_array(callCs('GET', ['action' => 'songs', 'church_id' => 30])[0], [401, 403], true), 'Khách bị từ chối');

// ── Sửa
asUserCs(80, 'leader');
$up = callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-a-1', 'title' => 'Bài A1 (sửa)', 'composer' => 'Nhạc sĩ X', 'tempo' => 90]);
$row = $pdo->query("SELECT title, composer, tempo, category_id, visibility FROM songs WHERE id = 'pv-a-1'")->fetch(PDO::FETCH_ASSOC);
checkCs($up[0] === 200 && $row['title'] === 'Bài A1 (sửa)' && $row['composer'] === 'Nhạc sĩ X' && (int)$row['tempo'] === 90, 'Admin HT sửa được tên, tác giả, tempo');
callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-a-1', 'title' => 'Vẫn riêng', 'category_id' => 932, 'visibility' => 'public', 'xmlPath' => 'x']);
$row = $pdo->query("SELECT category_id, visibility FROM songs WHERE id = 'pv-a-1'")->fetch(PDO::FETCH_ASSOC);
checkCs((int)$row['category_id'] === 930 && $row['visibility'] === 'private', 'Sửa không lách được để đổi danh mục/quyền/đường dẫn');
checkCs(callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-a-1', 'title' => '  '])[0] === 400, 'Tên bài trống bị từ chối');
checkCs(callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-a-1', 'tempo' => 999])[0] === 400, 'Tempo ngoài 20–300 bị từ chối');

// ── Cô lập giữa các HT
checkCs(callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-b-1', 'title' => 'Chiếm bài'])[0] === 404, 'Admin HT A không sửa được bài của HT B (dù khai church_id của mình)');
checkCs(callCs('POST', ['action' => 'song_delete'], ['church_id' => 30, 'song_id' => 'pv-b-1'])[0] === 404, 'Admin HT A không xóa được bài của HT B');
checkCs(callCs('POST', ['action' => 'song_publish'], ['church_id' => 30, 'song_id' => 'pv-b-1', 'target_category_id' => 932])[0] === 404, 'Admin HT A không công khai được bài của HT B');
checkCs(callCs('POST', ['action' => 'song_update'], ['church_id' => 31, 'song_id' => 'pv-b-1', 'title' => 'X'])[0] === 403, 'Admin HT A không thao tác với tư cách HT B');
asUserCs(81, 'bannhac');
checkCs(callCs('POST', ['action' => 'song_delete'], ['church_id' => 30, 'song_id' => 'pv-a-2'])[0] === 403, 'Thành viên thường không xóa được bài');
checkCs((int)$pdo->query("SELECT COUNT(*) FROM songs WHERE id = 'pv-a-2'")->fetchColumn() === 1, 'Bài vẫn còn sau lần xóa bị chặn');

// ── Chuyển công khai
asUserCs(80, 'leader');
checkCs(callCs('POST', ['action' => 'song_publish'], ['church_id' => 30, 'song_id' => 'pv-a-2', 'target_category_id' => 931])[0] === 400, 'Không chuyển được vào danh mục riêng của HT khác');
checkCs(callCs('POST', ['action' => 'song_publish'], ['church_id' => 30, 'song_id' => 'pv-a-2', 'target_category_id' => 930])[0] === 400, 'Không "công khai" vào chính danh mục riêng');
checkCs(callCs('POST', ['action' => 'song_publish'], ['church_id' => 30, 'song_id' => 'pv-a-2', 'target_category_id' => 9999])[0] === 400, 'Danh mục đích không tồn tại bị từ chối');
$pub = callCs('POST', ['action' => 'song_publish'], ['church_id' => 30, 'song_id' => 'pv-a-2', 'target_category_id' => 932]);
$row = $pdo->query("SELECT category_id, visibility, is_public FROM songs WHERE id = 'pv-a-2'")->fetch(PDO::FETCH_ASSOC);
checkCs($pub[0] === 200 && (int)$row['category_id'] === 932 && $row['visibility'] === 'public' && (int)$row['is_public'] === 1, 'Công khai: bài sang danh mục chung, quyền public');
$listAfter = array_column(callCs('GET', ['action' => 'songs', 'church_id' => 30])[1]['songs'] ?? [], 'id');
checkCs(!in_array('pv-a-2', $listAfter, true), 'Bài đã công khai rời kho riêng');
checkCs(callCs('POST', ['action' => 'song_update'], ['church_id' => 30, 'song_id' => 'pv-a-2', 'title' => 'Sửa sau khi công khai'])[0] === 404, 'Sau khi công khai, admin HT không còn sửa/rút lại được (phải nhờ admin hệ thống)');

// ── Xóa
$del = callCs('POST', ['action' => 'song_delete'], ['church_id' => 30, 'song_id' => 'pv-a-3']);
checkCs($del[0] === 200 && (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE id = 'pv-a-3'")->fetchColumn() === 0, 'Admin HT xóa được bài riêng của HT mình');
checkCs((int)$pdo->query("SELECT COUNT(*) FROM songs WHERE id = 'pv-b-1'")->fetchColumn() === 1, 'Bài HT khác không bị đụng');

// ── Admin hệ thống
asUserCs(1, 'admin');
checkCs(callCs('GET', ['action' => 'songs', 'church_id' => 31])[0] === 200, 'Admin hệ thống xem được kho mọi HT');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}\n";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
