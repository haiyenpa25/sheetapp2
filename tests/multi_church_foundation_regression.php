<?php
declare(strict_types=1);
ob_start();

/**
 * tests/multi_church_foundation_regression.php — S1 nền đa Hội Thánh (migration 018, ChurchService, ChurchAccessGuard).
 * Kiểm: schema, chuyển dữ liệu cũ vào HT mặc định, chạy lại an toàn, cờ MULTI_CHURCH tắt = hành vi cũ,
 * cờ bật = cô lập theo HT, một người thuộc nhiều HT, thành viên bị khóa/chờ duyệt không vào được.
 */
$root = dirname(__DIR__);
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/FeatureFlags.php';
require_once $root . '/api/core/ChurchAccessGuard.php';
require_once $root . '/api/services/ChurchService.php';

$total = 0; $failed = 0;
function checkMc(bool $ok, string $label): void {
    global $total, $failed;
    ++$total; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function asUser(?int $id, string $role = 'viewer'): void {
    $_SESSION = $id ? ['user_id' => $id, 'username' => 'u' . $id, 'role' => $role] : [];
    Auth::resetDbCache();
}

$pdo = createTestDatabase();
DB::setPdo($pdo);
// Dữ liệu có trước migration: 3 người dùng (admin/banhat/viewer) + thêm 1 leader, 1 bị khóa, 1 chương trình lễ.
$pwd = password_hash('x', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (4, 'leader', ?, 'leader', 'active')")->execute([$pwd]);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, status) VALUES (5, 'locked', ?, 'banhat', 'disabled')")->execute([$pwd]);
$pdo->exec("INSERT INTO setlists (id, title, created_by) VALUES (1, 'Chúa nhật 1', 2)");

$migrate = require $root . '/api/migrations/018_multi_church.php';
$migrate($pdo);
$migrate($pdo); // chạy lại an toàn

checkMc(DB::hasTable('churches') && DB::hasTable('church_members'), 'Có bảng churches và church_members');
checkMc(DB::hasColumn('setlists', 'church_id') && DB::hasColumn('categories', 'church_id'), 'setlists và categories có cột church_id');
checkMc((int)$pdo->query("SELECT COUNT(*) FROM churches")->fetchColumn() === 1, 'Chạy lại migration không tạo thêm HT');
$default = (int)ChurchService::defaultChurchId();
checkMc($default > 0, 'Có HT mặc định (slug mac-dinh)');
checkMc((int)$pdo->query("SELECT COUNT(*) FROM setlists WHERE church_id = $default")->fetchColumn() === 1, 'Chương trình lễ cũ thuộc HT mặc định');
checkMc((int)$pdo->query("SELECT COUNT(*) FROM categories WHERE church_id IS NOT NULL")->fetchColumn() === 0, 'Danh mục cũ giữ dùng chung (church_id trống)');
checkMc((int)$pdo->query("SELECT COUNT(*) FROM church_members")->fetchColumn() === 5, 'Mọi tài khoản cũ thành thành viên HT mặc định, không trùng khi chạy lại');
checkMc(ChurchService::memberRole(1, $default) === 'church_admin', 'admin hệ thống → church_admin');
checkMc(ChurchService::memberRole(4, $default) === 'leader', 'leader → leader');
checkMc(ChurchService::memberRole(2, $default) === 'member', 'banhat → member');
checkMc(ChurchService::memberRole(3, $default) === 'viewer', 'viewer → viewer');
checkMc(ChurchService::memberRole(5, $default) === null, 'Tài khoản bị khóa không là thành viên hoạt động');
checkMc(ChurchService::policyRole(2, $default) === 'banhat' && ChurchService::policyRole(1, $default) === 'leader', 'Vai trò HT ánh xạ đúng vai trò AuthPolicy');
checkMc(ChurchService::policyRole(2, 999) === null, 'Không phải thành viên → không có quyền');

// Cờ TẮT: hành vi một HT như cũ (ai cũng qua chốt)
FeatureFlags::setOverride('MULTI_CHURCH', false);
asUser(null);
checkMc(ChurchAccessGuard::canAccessSetlist(1), 'Cờ tắt: không đổi hành vi (chốt luôn cho qua)');

// Cờ BẬT: thêm HT thứ hai có chương trình lễ riêng
FeatureFlags::setOverride('MULTI_CHURCH', true);
$pdo->exec("INSERT INTO churches (id, name, slug, invite_code) VALUES (2, 'HT Hai', 'ht-hai', 'ABCD1234')");
$pdo->exec("INSERT INTO setlists (id, title, created_by, church_id) VALUES (2, 'HT Hai CN', 2, 2)");
$pdo->exec("INSERT INTO church_members (church_id, user_id, role) VALUES (2, 2, 'member')");   // banhat thuộc cả hai HT
$pdo->exec("INSERT INTO church_members (church_id, user_id, role, status) VALUES (2, 3, 'viewer', 'pending')");

asUser(null);
checkMc(!ChurchAccessGuard::canAccessSetlist(1), 'Cờ bật: khách không vào được chương trình lễ');
asUser(4, 'leader');
checkMc(ChurchAccessGuard::canAccessSetlist(1) && !ChurchAccessGuard::canAccessSetlist(2), 'Cờ bật: leader HT mặc định chỉ thấy HT của mình');
asUser(2, 'banhat');
checkMc(ChurchAccessGuard::canAccessSetlist(1) && ChurchAccessGuard::canAccessSetlist(2), 'Một người thuộc nhiều HT thấy cả hai');
asUser(3, 'viewer');
checkMc(ChurchAccessGuard::canAccessSetlist(1) && !ChurchAccessGuard::canAccessSetlist(2), 'Thành viên đang chờ duyệt chưa vào được HT mới');
asUser(5, 'banhat');
checkMc(!ChurchAccessGuard::canAccessSetlist(1), 'Tài khoản bị khóa không vào được');
asUser(1, 'admin');
checkMc(ChurchAccessGuard::canAccessSetlist(1) && ChurchAccessGuard::canAccessSetlist(2), 'Admin hệ thống vào mọi HT');
checkMc(ChurchAccessGuard::canManageChurch(2), 'Admin hệ thống quản lý được mọi HT');
asUser(4, 'leader');
checkMc(!ChurchAccessGuard::canManageChurch($default), 'Leader không phải admin HT thì không quản lý thành viên');

// HT đang làm việc
asUser(2, 'banhat');
checkMc(ChurchService::activeChurchId(2) === $default, 'HT đang làm việc mặc định là HT đầu tiên của người dùng');
checkMc(ChurchService::setActive(2, 2) && ChurchService::activeChurchId(2) === 2, 'Chọn được HT mình thuộc');
checkMc(!ChurchService::setActive(3, 2), 'Không chọn được HT chưa là thành viên');
checkMc(ChurchService::activeAdminCount($default) === 1, 'Đếm admin HT đúng (chặn xóa admin cuối ở bước sau)');
checkMc(preg_match('/^[A-F0-9]{8}$/', ChurchService::generateInviteCode()) === 1, 'Mã mời 8 ký tự hex');

FeatureFlags::reset();
echo "\nTổng: $total, lỗi: $failed\n";
echo "SUITE_COMPLETE total={$total}
";
ob_end_flush();
exit($failed > 0 ? 1 : 0);
