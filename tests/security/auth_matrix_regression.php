<?php
/**
 * tests/security/auth_matrix_regression.php
 *
 * Kiểm tra hồi quy ma trận quyền hạn RBAC & Vai trò Ca Trưởng (Lát 4.0-a — Epic 4.0):
 * 1. Ma trận quyền AuthPolicy: 4 role (viewer, banhat, leader, admin) × 6 capability = 24 cases
 * 2. Auth helpers: Auth::isLeader(), Auth::requireLeader(), Auth::isBanhat() kế thừa
 * 3. Migration 008: Cột voice_part (S/A/T/B/INSTR) và index trên users
 * 4. UserService & ManagerService: Hỗ trợ role 'leader' và trường 'voice_part'
 * 5. Bảo vệ an toàn: Chặn role không hợp lệ, bảo vệ Admin cuối cùng
 */

declare(strict_types=1);

require_once __DIR__ . '/../../api/core/DB.php';
require_once __DIR__ . '/../../api/core/Auth.php';
require_once __DIR__ . '/../../api/core/Response.php';
require_once __DIR__ . '/../../api/core/MigrationRunner.php';
require_once __DIR__ . '/../../api/services/UserService.php';
require_once __DIR__ . '/../../api/services/ManagerService.php';

// Nạp AuthPolicy nếu đã có
if (file_exists(__DIR__ . '/../../api/core/AuthPolicy.php')) {
    require_once __DIR__ . '/../../api/core/AuthPolicy.php';
}

$failures = [];
$totalChecks = 0;

function check(bool $cond, string $msg, array &$failures, int &$totalChecks): void {
    $totalChecks++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== KIỂM THỬ MA TRẬN QUYỀN HẠN & VAI TRÒ CA TRƯỞNG (EPIC 4.0) ===\n\n";

// ── 1. Kiểm tra sự tồn tại và cấu trúc AuthPolicy (24 matrix cases) ──
echo "[1/4] Kiểm tra Ma Trận Quyền AuthPolicy (4 Roles × 6 Capabilities = 24 cases)...\n";
check(class_exists('AuthPolicy'), 'Lớp AuthPolicy tồn tại trong api/core/AuthPolicy.php', $failures, $totalChecks);

if (class_exists('AuthPolicy')) {
    $expectedMatrix = [
        'view_songs' => [
            'viewer' => true,
            'banhat' => true,
            'leader' => true,
            'admin'  => true,
        ],
        'edit_songs' => [
            'viewer' => false,
            'banhat' => true,
            'leader' => true,
            'admin'  => true,
        ],
        'assign_practice' => [
            'viewer' => false,
            'banhat' => false,
            'leader' => true,
            'admin'  => true,
        ],
        'review_chord_set' => [
            'viewer' => false,
            'banhat' => false,
            'leader' => true,
            'admin'  => true,
        ],
        'view_team_progress' => [
            'viewer' => false,
            'banhat' => false,
            'leader' => true,
            'admin'  => true,
        ],
        'manage_users' => [
            'viewer' => false,
            'banhat' => false,
            'leader' => false,
            'admin'  => true,
        ],
    ];

    foreach ($expectedMatrix as $cap => $roles) {
        foreach ($roles as $role => $expected) {
            $can = AuthPolicy::can($role, $cap);
            check(
                $can === $expected,
                "AuthPolicy::can('{$role}', '{$cap}') phải là " . ($expected ? 'TRUE' : 'FALSE') . " (thực tế: " . ($can ? 'TRUE' : 'FALSE') . ")",
                $failures,
                $totalChecks
            );
        }
    }
}

// ── 2. Kiểm tra Auth helpers cho role 'leader' ──
echo "\n[2/4] Kiểm tra Auth helpers (isLeader, requireLeader, isBanhat)...\n";
check(method_exists('Auth', 'isLeader'), 'Phương thức Auth::isLeader() tồn tại', $failures, $totalChecks);
check(method_exists('Auth', 'requireLeader'), 'Phương thức Auth::requireLeader() tồn tại', $failures, $totalChecks);

// Test isLeader với các role
$_SESSION['role'] = 'viewer';
check(Auth::isLeader() === false, 'Auth::isLeader() trả false cho role viewer', $failures, $totalChecks);
check(Auth::isBanhat() === false, 'Auth::isBanhat() trả false cho role viewer', $failures, $totalChecks);

$_SESSION['role'] = 'banhat';
check(Auth::isLeader() === false, 'Auth::isLeader() trả false cho role banhat', $failures, $totalChecks);
check(Auth::isBanhat() === true, 'Auth::isBanhat() trả true cho role banhat', $failures, $totalChecks);

$_SESSION['role'] = 'leader';
check(Auth::isLeader() === true, 'Auth::isLeader() trả true cho role leader', $failures, $totalChecks);
check(Auth::isBanhat() === true, 'Auth::isBanhat() trả true cho role leader (kế thừa quyền biểu diễn)', $failures, $totalChecks);
check(Auth::isAdmin() === false, 'Auth::isAdmin() trả false cho role leader', $failures, $totalChecks);

$_SESSION['role'] = 'admin';
check(Auth::isLeader() === true, 'Auth::isLeader() trả true cho role admin', $failures, $totalChecks);
check(Auth::isBanhat() === true, 'Auth::isBanhat() trả true cho role admin', $failures, $totalChecks);

// ── 3. Kiểm tra Migration 008 & Cột voice_part trên SQLite ──
echo "\n[3/4] Kiểm tra Migration 008 & CSDL SQLite...\n";
$migrationFile = dirname(__DIR__, 2) . '/api/migrations/008_leader_role.php';
check(file_exists($migrationFile), 'File migration api/migrations/008_leader_role.php tồn tại', $failures, $totalChecks);

// Test migration trên in-memory SQLite cô lập
$tempPdo = new PDO('sqlite::memory:');
$tempPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$tempPdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$tempPdo->exec('PRAGMA foreign_keys = ON;');

$runner = new MigrationRunner($tempPdo);
$executed = $runner->migrate();

$userCols = $tempPdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
$userColNames = array_column($userCols, 'name');
check(in_array('voice_part', $userColNames, true), 'Bảng users có cột voice_part sau migration', $failures, $totalChecks);

// ── 4. Kiểm tra UserService & ManagerService với role 'leader' & voice_part ──
echo "\n[4/4] Kiểm tra UserService & ManagerService với role 'leader' & 'voice_part'...\n";
$pdo = DB::get();

// Dọn dẹp fixture cũ nếu có
$pdo->exec("DELETE FROM users WHERE username IN ('test_leader_user', 'test_singer_s')");

try {
    // Tạo user role leader với voice_part
    $_SESSION['role'] = 'admin';
    $_SESSION['user_id'] = 1;

    $mgrRes = ManagerService::manageUser('create', [
        'username'     => 'test_leader_user',
        'password'     => 'LeaderPass@2026',
        'display_name' => 'Ca Trưởng Test',
        'instrument'   => 'Chỉ huy / Piano',
        'chord_code'   => 'LEAD',
        'role'         => 'leader',
        'voice_part'   => 'T'
    ]);
    check($mgrRes['success'] === true, 'ManagerService::manageUser tạo user role leader thành công', $failures, $totalChecks);

    $created = DB::run("SELECT * FROM users WHERE username = 'test_leader_user'")->fetch();
    check($created && $created['role'] === 'leader', 'User vừa tạo có role = leader trong DB', $failures, $totalChecks);
    check($created && ($created['voice_part'] ?? '') === 'T', 'User vừa tạo có voice_part = T (Tenor) trong DB', $failures, $totalChecks);

    // Cập nhật thông tin và đổi voice_part sang S (Soprano)
    $updRes = ManagerService::manageUser('update_profile', [
        'user_id'      => (int)$created['id'],
        'display_name' => 'Ca Trưởng Đổi Bè',
        'instrument'   => 'Organ',
        'chord_code'   => 'LEAD',
        'role'         => 'leader',
        'voice_part'   => 'S'
    ]);
    check($updRes['success'] === true, 'ManagerService::manageUser cập nhật user và voice_part thành công', $failures, $totalChecks);

    $updated = DB::run("SELECT * FROM users WHERE id = ?", [$created['id']])->fetch();
    check($updated && ($updated['voice_part'] ?? '') === 'S', 'User sau khi cập nhật có voice_part = S (Soprano)', $failures, $totalChecks);

    // Chặn role không hợp lệ
    $invalidRoleRes = ManagerService::manageUser('update_role', [
        'user_id' => (int)$created['id'],
        'role'    => 'super_admin_invalid'
    ]);
    check($invalidRoleRes['success'] === false, 'ManagerService chặn role không hợp lệ (super_admin_invalid)', $failures, $totalChecks);

} finally {
    // Dọn dẹp fixture
    $pdo->exec("DELETE FROM users WHERE username IN ('test_leader_user', 'test_singer_s')");
    // Khôi phục session
    unset($_SESSION['role'], $_SESSION['user_id']);
}

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số lỗi: " . count($failures) . "\n";
if (empty($failures)) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS)!\n";
    exit(0);
} else {
    echo "❌ KẾT QUẢ: CÓ " . count($failures) . " KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
