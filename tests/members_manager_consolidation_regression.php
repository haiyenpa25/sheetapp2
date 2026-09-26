<?php
/**
 * tests/members_manager_consolidation_regression.php
 * 
 * Bộ kiểm thử hồi quy Task 2.5: Gộp Members vào Manager Portal.
 * 
 * Kiểm tra 7 tiêu chí cốt lõi:
 * 1. Chuyển hướng an toàn từ /members/ sang /manager/#tab-users & liên kết UI.
 * 2. Phân quyền chặt chẽ (RBAC): Chỉ Admin mới được thực thi manageUser.
 * 3. Ngăn chặn tự hạ quyền Admin (Anti Self-Demotion) & tự khóa/xóa chính mình.
 * 4. Bảo vệ Quản Trị Viên hoạt động duy nhất (Last Admin Protection).
 * 5. Quản lý Mã Hợp Âm Cá Nhân (Chord Code) & tự sinh khi để trống.
 * 6. Khóa / Mở khóa tài khoản (toggle_status) & đặt lại mật khẩu (reset_password).
 * 7. Ghi nhận nhật ký kiểm toán hoàn chỉnh (Audit Trail Logging).
 */

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuditLogger.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/UserService.php';

$testCount = 0;
$passCount = 0;
$failCount = 0;

function assertCondition(string $name, bool $condition, string $detail = ''): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $testCount, $passCount, $failCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo "  ✅ PASS: [{$name}] {$detail}\n";
    } else {
        $failCount++;
        echo "  ❌ FAIL: [{$name}] {$detail}\n";
    }
}

echo "========================================================\n";
echo "   SheetApp2 — Members & Manager Consolidation Tests    \n";
echo "========================================================\n\n";

// Khởi tạo DB test in-memory
$pdo = createTestDatabase();
DB::setPdo($pdo);

// Cấu hình AuditLogger ghi vào file log tạm thời
$tmpAuditLog = sys_get_temp_dir() . '/test_audit_' . uniqid() . '.log';
AuditLogger::setLogPath($tmpAuditLog);

// -------------------------------------------------------------
// Test 1: Chuyển hướng an toàn từ /members/ & liên kết UI
// -------------------------------------------------------------
$membersIndexSrc = file_get_contents(__DIR__ . '/../members/index.php') ?: '';
$toolbarSrc = file_get_contents(__DIR__ . '/../includes/toolbar.php') ?: '';
$chordCanvasSrc = file_get_contents(__DIR__ . '/../assets/js/chord-canvas.js') ?: '';

$has302Redirect = str_contains($membersIndexSrc, "header('Location: /manager/#tab-users', true, 302)")
    || (str_contains($membersIndexSrc, "header('Location: ' . \$target, true, 302)") && str_contains($membersIndexSrc, '/manager/#tab-users'));
$hasHtmlRedirect = str_contains($membersIndexSrc, '/manager/#tab-users')
    && (str_contains($membersIndexSrc, "window.location.replace('/manager/#tab-users')") || str_contains($membersIndexSrc, "window.location.replace("));
$hasSafeHtml = str_contains($membersIndexSrc, 'assets/js/core/SafeHtml.js');
$toolbarPointsToManager = str_contains($toolbarSrc, 'href="/manager/#tab-users"') || str_contains($toolbarSrc, '/manager/#tab-users');
$chordCanvasPointsToManager = str_contains($chordCanvasSrc, "window.open('/manager/#tab-users'")
    || (str_contains($chordCanvasSrc, "window.open(") && str_contains($chordCanvasSrc, "/manager/#tab-users"));

assertCondition(
    '1. Safe Redirect & UI Linkage',
    $has302Redirect && $hasHtmlRedirect && $hasSafeHtml && $toolbarPointsToManager && $chordCanvasPointsToManager,
    'Trang /members/ chuyển hướng 302 an toàn sang /manager/#tab-users, toolbar & chord canvas trỏ đúng đích'
);

// -------------------------------------------------------------
// Test 2: Phân quyền RBAC (Chỉ Admin mới gọi được manageUser)
// -------------------------------------------------------------
$nonAdminBlocked = false;
try {
    // Giả lập session viewer (user_id = 3)
    $_SESSION['user_id'] = 3;
    $_SESSION['username'] = 'viewer';
    $_SESSION['role'] = 'viewer';
    $_SESSION['chord_code'] = 'VIEW';

    ManagerService::manageUser('update_role', ['user_id' => 2, 'role' => 'admin']);
} catch (Throwable $e) {
    // Auth::requireAdmin ném ra lỗi hoặc gọi Response::forbidden
    $nonAdminBlocked = true;
}

assertCondition(
    '2. RBAC Enforcement',
    $nonAdminBlocked,
    'Tài khoản không phải Admin (Viewer/Banhat) bị chặn hoàn toàn khi gọi manageUser'
);

// -------------------------------------------------------------
// Test 3: Ngăn chặn tự hạ quyền Admin & tự xóa/khóa
// -------------------------------------------------------------
// Đăng nhập Admin (user_id = 1)
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin';
$_SESSION['role'] = 'admin';
$_SESSION['chord_code'] = 'ADMIN';

$selfDemoteRoleRes = ManagerService::manageUser('update_role', ['user_id' => 1, 'role' => 'viewer']);
$selfDemoteProfileRes = ManagerService::manageUser('update_profile', ['user_id' => 1, 'display_name' => 'Admin Self', 'role' => 'banhat']);
$selfLockRes = ManagerService::manageUser('toggle_status', ['user_id' => 1]);
$selfDeleteRes = ManagerService::manageUser('delete', ['user_id' => 1]);

$selfProtected = !$selfDemoteRoleRes['success'] 
    && !$selfDemoteProfileRes['success'] 
    && !$selfLockRes['success'] 
    && !$selfDeleteRes['success'];

assertCondition(
    '3. Anti Self-Demotion & Self-Harm',
    $selfProtected,
    'Admin không thể tự hạ quyền của chính mình, không thể tự khóa hoặc xóa tài khoản của mình'
);

// -------------------------------------------------------------
// Test 4: Bảo vệ Quản Trị Viên hoạt động duy nhất
// -------------------------------------------------------------
// Tạo thêm admin thứ hai
$createAdmin2 = ManagerService::manageUser('create', [
    'username'     => 'admin2',
    'password'     => 'admin2_pass',
    'role'         => 'admin',
    'display_name' => 'Admin Phụ',
    'instrument'   => 'Organ',
    'chord_code'   => 'ADM2'
]);

$admin2Id = (int)($createAdmin2['id'] ?? 0);
$canDemoteWhenMultiple = false;
$cannotDemoteWhenOnlyOne = false;

if ($admin2Id > 0) {
    // Có 2 admin -> cho phép hạ quyền admin2 xuống banhat
    $demoteRes = ManagerService::manageUser('update_role', ['user_id' => $admin2Id, 'role' => 'banhat']);
    $canDemoteWhenMultiple = $demoteRes['success'];

    // Giờ chỉ còn 1 admin duy nhất (user 1, ID: 1)
    // Giả lập phiên gọi từ một tài khoản quản trị khác (ID: 9999) thử hạ quyền user 1
    $_SESSION['user_id'] = 9999;
    $_SESSION['username'] = 'remote_admin';
    $_SESSION['role'] = 'admin';

    // Thử hạ quyền user 1 khi user 1 là admin DUY NHẤT đang active trong hệ thống
    $tryDemoteLast = ManagerService::manageUser('update_role', ['user_id' => 1, 'role' => 'banhat']);
    $cannotDemoteWhenOnlyOne = ($tryDemoteLast['success'] === false) 
        && str_contains($tryDemoteLast['message'] ?? '', 'Quản Trị Viên');

    // Khôi phục session cho user 1
    $_SESSION['user_id'] = 1;
    $_SESSION['username'] = 'admin';
    $_SESSION['role'] = 'admin';
}

assertCondition(
    '4. Last Admin Protection',
    $canDemoteWhenMultiple && $cannotDemoteWhenOnlyOne,
    'Cho phép điều chỉnh vai trò khi có nhiều Quản Trị Viên; bảo vệ Quản Trị Viên cuối cùng của hệ thống'
);

// -------------------------------------------------------------
// Test 5: Quản lý Mã Hợp Âm Cá Nhân (Chord Code) & Auto-generation
// -------------------------------------------------------------
// Tạo user có chỉ định chord_code cụ thể
$resWithCode = ManagerService::manageUser('create', [
    'username'     => 'hoaidinh',
    'password'     => 'hd_pass',
    'role'         => 'banhat',
    'display_name' => 'Hoài Dinh',
    'instrument'   => 'Guitar',
    'chord_code'   => 'hd' // thường -> phải tự động UPPERCASE
]);

// Tạo user không điền chord_code -> tự động lấy 4 ký tự đầu
$resNoCode = ManagerService::manageUser('create', [
    'username'     => 'quangtuan',
    'password'     => 'qt_pass',
    'role'         => 'banhat',
    'display_name' => 'Quang Tuấn',
    'instrument'   => 'Piano',
    'chord_code'   => ''
]);

// Kiểm tra trong DB
$stmtUser = $pdo->prepare("SELECT chord_code FROM users WHERE username = ?");
$stmtUser->execute(['hoaidinh']);
$codeHd = $stmtUser->fetchColumn();

$stmtUser->execute(['quangtuan']);
$codeAuto = $stmtUser->fetchColumn();

// Cập nhật thông tin thành viên (update_profile)
$updateProfRes = ManagerService::manageUser('update_profile', [
    'user_id'      => (int)($resWithCode['id'] ?? 0),
    'display_name' => 'Hoài Dinh Trưởng Ban',
    'instrument'   => 'Lead Guitar',
    'chord_code'   => 'HD_LEAD',
    'role'         => 'banhat'
]);

$stmtUser->execute(['hoaidinh']);
$codeUpdated = $stmtUser->fetchColumn();

$chordCodeValid = ($codeHd === 'HD') && ($codeAuto === 'QUAN') && ($codeUpdated === 'HD_LEAD') && $updateProfRes['success'];

assertCondition(
    '5. Chord Code Management & Auto-generation',
    $chordCodeValid,
    'Mã hợp âm cá nhân được chuẩn hóa chữ hoa, tự sinh khi để trống, cập nhật toàn vẹn qua update_profile'
);

// -------------------------------------------------------------
// Test 6: Khóa / Mở khóa tài khoản & Đặt lại mật khẩu
// -------------------------------------------------------------
$targetUserId = (int)($resNoCode['id'] ?? 0);

// Khóa tài khoản
$lockRes = ManagerService::manageUser('toggle_status', ['user_id' => $targetUserId]);
$statusLocked = $pdo->query("SELECT status FROM users WHERE id = {$targetUserId}")->fetchColumn();

// Mở khóa tài khoản
$unlockRes = ManagerService::manageUser('toggle_status', ['user_id' => $targetUserId]);
$statusUnlocked = $pdo->query("SELECT status FROM users WHERE id = {$targetUserId}")->fetchColumn();

// Đặt lại mật khẩu mới
$newSecret = 'new_secure_pwd_999';
$resetPassRes = ManagerService::manageUser('reset_password', [
    'user_id'      => $targetUserId,
    'new_password' => $newSecret
]);

$pwdHash = $pdo->query("SELECT password_hash FROM users WHERE id = {$targetUserId}")->fetchColumn();
$passVerified = password_verify($newSecret, $pwdHash);

$statusPassOk = ($statusLocked === 'locked') && ($statusUnlocked === 'active') && $resetPassRes['success'] && $passVerified;

assertCondition(
    '6. Account Status & Password Reset',
    $statusPassOk,
    'Chuyển đổi trạng thái active/locked chuẩn xác và đặt lại mật khẩu mã hóa an toàn'
);

// -------------------------------------------------------------
// Test 7: Ghi nhận nhật ký kiểm toán (Audit Trail)
// -------------------------------------------------------------
$auditContent = file_exists($tmpAuditLog) ? file_get_contents($tmpAuditLog) : '';
@unlink($tmpAuditLog); // Dọn dẹp file tạm

$hasCreateLog = str_contains($auditContent, '"action":"user_create"');
$hasRoleLog = str_contains($auditContent, '"action":"user_role_change"');
$hasProfileLog = str_contains($auditContent, '"action":"user_profile_update"');
$hasStatusLog = str_contains($auditContent, '"action":"user_status_toggle"');
$hasResetLog = str_contains($auditContent, '"action":"user_password_reset"');

$auditAllPresent = $hasCreateLog && $hasRoleLog && $hasProfileLog && $hasStatusLog && $hasResetLog;

assertCondition(
    '7. Audit Trail Logging',
    $auditAllPresent,
    'Mọi hành vi nhạy cảm (tạo user, đổi quyền, sửa profile, khóa/mở khóa, đổi pass) đều được ghi nhận vào nhật ký kiểm toán'
);

// -------------------------------------------------------------
// Tổng kết
// -------------------------------------------------------------
echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Members & Manager Consolidation:\n";
echo "  - Tổng số test: {$testCount}\n";
echo "  - Đạt: {$passCount}\n";
echo "  - Thất bại: {$failCount}\n";
echo "  - Trạng thái: " . ($failCount === 0 ? "✅ TẤT CẢ 7 TIÊU CHÍ ĐẠT CHUẨN (PASS)" : "❌ CÓ {$failCount} TIÊU CHÍ THẤT BẠI") . "\n";
echo "--------------------------------------------------------\n\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit($failCount === 0 ? 0 : 1);
