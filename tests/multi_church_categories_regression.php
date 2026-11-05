<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_categories_regression.php — danh mục bài RIÊNG của một Hội Thánh.
 * Quản trị HT tạo danh mục riêng (ép quyền xem private, không đặt công khai được); chỉ thành viên HT đó (và admin hệ thống)
 * thấy danh mục + bài trong đó (danh sách, SQL quyền xem bài, chốt xem theo mã); HT khác không tạo/sửa/xóa được; cờ tắt = như cũ.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/ChurchAccessGuard.php';
require_once $root . '/api/services/ChurchService.php';
require_once $root . '/api/services/SongService.php';
require_once $root . '/api/services/CategoryService.php';
require_once $root . '/api/controllers/CategoryController.php';
require_once $root . '/tests/lib/mock_php_input.php';

$total = 0; $failed = 0;
function checkCat(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}
function callCat(string $method, array $get = [], ?array $body = null): array {
    $_GET = $get; $_SERVER['REQUEST_METHOD'] = $method; http_response_code(200);
    mockPhpInput($body === null ? '' : json_encode($body));
    ob_start();
    try { (new CategoryController())->handleRequest($method); } catch (HttpException $e) { http_response_code($e->getStatusCode()); echo json_encode(['error' => $e->getMessage()]); }
    catch (Throwable $e) { echo json_encode(['exception' => $e->getMessage()]); }
    $out = (string)ob_get_clean();
    restorePhpInput();
    return [http_response_code(), json_decode($out, true) ?? []];
}
/** Mã các danh mục / bài mà người xem hiện tại thấy. */
function visibleCategoryIds(): array { return array_map('intval', array_column(CategoryService::getAll(), 'id')); }
function visibleSongIds(PDO $pdo): array {
    return array_map('strval', $pdo->query('SELECT s.id FROM songs s WHERE ' . SongService::visibilitySqlClause('s'))->fetchAll(PDO::FETCH_COLUMN));
}

$pdo = createTestDatabase();
DB::setPdo($pdo);
$pwd = password_hash('x', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (4, 'adminHT1', ?, 'banhat', 'active'), (5, 'banhatHT2', ?, 'banhat', 'active'), (6, 'adminHT2', ?, 'banhat', 'active')")->execute([$pwd, $pwd, $pwd]);
$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (2, 'HT Hai', 'ht-hai', 'ABCD1234')");
// 4 = quản trị HT1; 5 = thành viên chỉ HT2; 6 = quản trị HT2 (chỉ HT2); 2 (banhat) = thành viên HT1.
$pdo->exec("DELETE FROM church_members WHERE user_id IN (5, 6)");
$pdo->exec("UPDATE church_members SET role = 'church_admin' WHERE user_id = 4 AND church_id = 1");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (2, 5, 'member'), (2, 6, 'church_admin')");

FeatureFlags::setOverride('MULTI_CHURCH', true);

// ── Tạo danh mục riêng
asUser(4, 'banhat');
$made = callCat('POST', [], ['name' => 'Bài riêng HT1', 'visibility' => 'public', 'church_id' => 1]);
$catId = (int)($made[1]['id'] ?? 0);
checkCat($made[0] === 200 && $catId > 0, 'Quản trị HT1 tạo được danh mục riêng cho HT1');
checkCat((string)$pdo->query("SELECT visibility FROM categories WHERE id = $catId")->fetchColumn() === 'private', 'Danh mục riêng bị ép quyền xem private dù yêu cầu public');
checkCat((int)$pdo->query("SELECT church_id FROM categories WHERE id = $catId")->fetchColumn() === 1, 'Danh mục ghi đúng church_id');
checkCat(callCat('POST', [], ['name' => 'Chung'])[0] === 403, 'Quản trị HT không tạo được danh mục chung (cần admin hệ thống)');
checkCat(callCat('POST', [], ['name' => 'Lấn sân', 'church_id' => 2])[0] === 403, 'Quản trị HT1 không tạo cho HT2');
checkCat(callCat('PUT', ['id' => $catId], ['visibility' => 'public'])[0] === 400, 'Danh mục riêng không đặt công khai được');
checkCat(callCat('PUT', ['id' => $catId], ['name' => 'Bài riêng HT1 (đổi tên)'])[0] === 200, 'Quản trị HT1 đổi tên danh mục riêng');

$pdo->exec("INSERT INTO songs (id, title, xmlPath, category_id, visibility, is_public) VALUES ('s-rieng', 'Bài riêng', 'x.xml', $catId, 'private', 0), ('s-chung', 'Bài chung', 'y.xml', 1, 'public', 1)");

// ── Ai thấy gì
asUser(2, 'banhat');
checkCat(in_array($catId, visibleCategoryIds(), true) && in_array('s-rieng', visibleSongIds($pdo), true), 'Thành viên HT1 thấy danh mục và bài riêng');
checkCat(SongService::viewerMayViewCategory($catId), 'Thành viên HT1 qua chốt xem theo mã');
asUser(5, 'banhat');
checkCat(!in_array($catId, visibleCategoryIds(), true), 'Thành viên chỉ HT2 không thấy danh mục riêng HT1');
checkCat(!in_array('s-rieng', visibleSongIds($pdo), true) && in_array('s-chung', visibleSongIds($pdo), true), 'Thành viên HT2 không thấy bài riêng HT1, vẫn thấy bài chung');
checkCat(!SongService::viewerMayViewCategory($catId), 'Thành viên HT2 bị chốt xem theo mã chặn');
asUser(null);
checkCat(!in_array($catId, visibleCategoryIds(), true) && !in_array('s-rieng', visibleSongIds($pdo), true) && in_array('s-chung', visibleSongIds($pdo), true), 'Khách chỉ thấy danh mục/bài chung công khai');
asUser(1, 'admin');
checkCat(in_array($catId, visibleCategoryIds(), true) && in_array('s-rieng', visibleSongIds($pdo), true), 'Admin hệ thống thấy tất cả');

// ── HT khác không sửa/xóa
asUser(6, 'banhat');
checkCat(callCat('PUT', ['id' => $catId], ['name' => 'Cướp'])[0] === 403, 'Quản trị HT2 không sửa được danh mục HT1');
checkCat(callCat('DELETE', ['id' => $catId])[0] === 403, 'Quản trị HT2 không xóa được danh mục HT1');
checkCat((int)$pdo->query("SELECT COUNT(*) FROM categories WHERE id = $catId")->fetchColumn() === 1, 'Danh mục HT1 còn nguyên');
asUser(2, 'banhat');
checkCat(callCat('DELETE', ['id' => $catId])[0] === 403, 'Thành viên thường không xóa được danh mục');

// ── Quản trị HT1 xóa: bài chuyển về danh mục 1
asUser(4, 'banhat');
checkCat(callCat('DELETE', ['id' => $catId])[0] === 200 && (int)$pdo->query("SELECT category_id FROM songs WHERE id = 's-rieng'")->fetchColumn() === 1, 'Quản trị HT1 xóa danh mục riêng, bài về danh mục mặc định');

// ── Cờ tắt: như cũ (danh mục riêng không lọc)
$pdo->exec("INSERT INTO categories (id, name, slug, visibility, church_id) VALUES (50, 'Riêng cũ', 'rieng-cu', 'private', 1)");
FeatureFlags::setOverride('MULTI_CHURCH', false);
asUser(5, 'banhat');
checkCat(in_array(50, visibleCategoryIds(), true), 'Cờ tắt: danh mục không bị lọc theo HT');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}\n";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
