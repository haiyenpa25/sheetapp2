<?php
declare(strict_types=1);

/**
 * tests/tenant_web_portal_regression.php
 *
 * Kiểm thử hồi quy cho API Quản lý Đa Hội Thánh (TenantController)
 * Đảm bảo phân quyền nghiêm ngặt (Admin-only) và tính toàn vẹn của vòng đời Tenant qua Web API.
 */

$checks = 0;
$passed = 0;

function assertCheck(bool $condition, string $msg): void {
    global $checks, $passed;
    $checks++;
    if ($condition) {
        $passed++;
        echo "  ✅ PASS: {$msg}\n";
    } else {
        echo "  ❌ FAIL: {$msg}\n";
    }
}

function runPhpCode(string $code): string {
    $cmd = defined('PHP_BINARY') && PHP_BINARY ? PHP_BINARY : 'C:\\xampp\\php\\php.exe';
    $desc = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];
    $proc = proc_open($cmd, $desc, $pipes, dirname(__DIR__));
    if (!is_resource($proc)) {
        return '';
    }
    fwrite($pipes[0], "<?php\n" . $code);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($proc);
    return (string)$out . (string)$err;
}

echo "=== KIỂM THỬ HỒI QUY: TENANT CONTROLLER WEB API (EPIC 4.5) ===\n\n";

// 1. Kiểm tra cấu trúc file và phân quyền tĩnh
$ctrlCode = file_get_contents(__DIR__ . '/../api/controllers/TenantController.php');
$routerCode = file_get_contents(__DIR__ . '/../api/index.php');

assertCheck(str_contains($ctrlCode, 'Auth::requireAdmin();'), "TenantController bắt buộc quyền Admin (Auth::requireAdmin)");
assertCheck(str_contains($routerCode, "case 'tenants':"), "api/index.php đã định tuyến route 'tenants'");
assertCheck(str_contains($ctrlCode, 'TenantProvisioningService::listTenants()'), "TenantController tích hợp hàm listTenants");
assertCheck(str_contains($ctrlCode, 'TenantProvisioningService::provisionTenant('), "TenantController tích hợp hàm provisionTenant");
assertCheck(str_contains($ctrlCode, 'TenantProvisioningService::backupTenant('), "TenantController tích hợp hàm backupTenant");

// 2. Chạy sub-process: Kiểm tra người dùng chưa đăng nhập bị chặn 403
$scriptNonAuth = '
session_start();
$_SESSION = [];
require_once "api/controllers/TenantController.php";
$ctrl = new TenantController();
$ctrl->handleRequest("GET");
';
$outputNonAuth = runPhpCode($scriptNonAuth);
assertCheck(str_contains($outputNonAuth, 'Chỉ Admin mới có quyền thực hiện') || str_contains($outputNonAuth, '403'), "Người dùng chưa đăng nhập bị từ chối truy cập (HTTP 403)");

// 3. Chạy sub-process: Kiểm tra role leader không phải admin bị chặn 403
$scriptLeader = '
session_start();
$_SESSION["role"] = "leader";
$_SESSION["user_id"] = 2;
require_once "api/controllers/TenantController.php";
$ctrl = new TenantController();
$ctrl->handleRequest("GET");
';
$outputLeader = runPhpCode($scriptLeader);
assertCheck(str_contains($outputLeader, 'Chỉ Admin mới có quyền thực hiện') || str_contains($outputLeader, '403'), "Role leader không có quyền quản trị tenants (HTTP 403)");

// 4. Chạy sub-process: Admin gọi action=list trả về danh sách tenants hợp lệ
$scriptAdminList = '
session_start();
$_SESSION["role"] = "admin";
$_SESSION["user_id"] = 1;
$_GET["action"] = "list";
require_once "api/controllers/TenantController.php";
$ctrl = new TenantController();
$ctrl->handleRequest("GET");
';
$outputAdminList = runPhpCode($scriptAdminList);
$jsonList = json_decode($outputAdminList, true);
assertCheck(is_array($jsonList) && ($jsonList['success'] ?? false) === true && isset($jsonList['tenants']), "Admin lấy thành công danh sách tenants qua action=list");

// 5. Chạy sub-process: Admin POST tạo tenant mới nhưng thiếu tham số thì bị 400 Bad Request
$scriptAdminCreateInvalid = '
session_start();
$_SESSION["role"] = "admin";
$_SESSION["user_id"] = 1;
$_GET["action"] = "create";
require_once "api/controllers/TenantController.php";
$ctrl = new TenantController();
$ctrl->handleRequest("POST");
';
$outputCreateInvalid = runPhpCode($scriptAdminCreateInvalid);
$jsonCreateInvalid = json_decode($outputCreateInvalid, true);
assertCheck(is_array($jsonCreateInvalid) && ($jsonCreateInvalid['success'] ?? true) === false, "Validation từ chối khi POST thiếu slug hoặc name (400 Bad Request)");

// 6. Chạy sub-process: Action không hợp lệ trả về lỗi
$scriptInvalidAction = '
session_start();
$_SESSION["role"] = "admin";
$_SESSION["user_id"] = 1;
$_GET["action"] = "invalid_action_xyz";
require_once "api/controllers/TenantController.php";
$ctrl = new TenantController();
$ctrl->handleRequest("GET");
';
$outputInvalidAction = runPhpCode($scriptInvalidAction);
$jsonInvalid = json_decode($outputInvalidAction, true);
assertCheck(is_array($jsonInvalid) && ($jsonInvalid['success'] ?? true) === false, "Từ chối action không hợp lệ (400 Bad Request)");

echo "\nTổng kết: {$passed}/{$checks} checks pass.\n";
if ($passed === $checks) {
    exit(0);
}
exit(1);
