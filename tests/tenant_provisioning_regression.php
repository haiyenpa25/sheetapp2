<?php
/**
 * tests/tenant_provisioning_regression.php
 *
 * Kiểm thử Hồi quy & Nghiệm thu: Khởi Tạo & Vòng Đời Đa Hội Thánh (Multi-Tenant Lifecycle ADR-005)
 * Epic 4.5 — Quyết định D7 & ADR-005:
 * 1. Khởi tạo Tenant mới hoàn chỉnh (Database-per-Tenant SQLite).
 * 2. Tự động thực thi toàn bộ 12 baseline migrations trên DB tenant mới.
 * 3. Tạo tài khoản Admin hội thánh ban đầu, mã hóa mật khẩu an toàn.
 * 4. Chống khởi tạo trùng lặp (Duplicate Tenant Guard).
 * 5. Danh sách Tenant, thống kê chi tiết và kiểm tra tính toàn vẹn (integrity_check = ok).
 * 6. Tích hợp TenantContext + DB::get() thực hiện thao tác nghiệp vụ riêng biệt.
 * 7. Sao lưu riêng biệt từng tenant (Encrypted Backup).
 * 8. Dọn dẹp / Deprovisioning an toàn sau khi thử nghiệm.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/TenantContext.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/TenantProvisioningService.php';

$passed = 0;
$failed = 0;

function check(bool $cond, string $msg): void {
    global $passed, $failed;
    if ($cond) {
        echo "  ✅ PASS: {$msg}\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: {$msg}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY: KHỞI TẠO & VÒNG ĐỜI MULTI-TENANT (ADR-005) ===\n\n";

// Sử dụng thư mục tạm để đảm bảo an toàn tuyệt đối, không ảnh hưởng storage thật
$tempBaseDir = sys_get_temp_dir() . '/sheetapp_tenants_regtest_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
TenantContext::setBaseDir($tempBaseDir);

$testSlug = 'hoi-thanh-bien-hoa';
$testName = 'Hội Thánh Tin Lành Biên Hòa';

try {
    // ── 1. Kiểm tra phòng vệ tham số đầu vào ──
    echo "[1/5] Kiểm tra phòng vệ tham số khởi tạo Tenant...\n";
    $caughtInvalidSlug = false;
    try {
        TenantProvisioningService::provisionTenant('../malicious_slug', 'Hội Thánh Lạ');
    } catch (InvalidArgumentException $e) {
        $caughtInvalidSlug = true;
    }
    check($caughtInvalidSlug, "Chặn đứng khởi tạo tenant với slug chứa ký tự Path Traversal");

    $caughtEmptyName = false;
    try {
        TenantProvisioningService::provisionTenant('valid-slug', '');
    } catch (InvalidArgumentException $e) {
        $caughtEmptyName = true;
    }
    check($caughtEmptyName, "Từ chối khởi tạo tenant khi tên hội thánh bị bỏ trống");

    // ── 2. Khởi tạo Tenant mới hoàn chỉnh ──
    echo "\n[2/5] Khởi tạo Tenant mới và tự động thực thi 12 migrations...\n";
    $result = TenantProvisioningService::provisionTenant($testSlug, $testName, [
        'username' => 'pastor_bienhoa',
        'password' => 'BienHoaP@ss2026',
        'email' => 'pastor@bienhoa.org',
        'display_name' => 'Mục Sư Quản Nhiệm'
    ]);

    check($result['success'] === true, "Khởi tạo tenant '{$testSlug}' thành công");
    check($result['migrations_count'] >= 12, "Đã áp dụng đủ {$result['migrations_count']} migrations lên DB mới");
    check(is_file($result['db_path']), "Tệp cơ sở dữ liệu data.sqlite vật lý đã được tạo");
    check(is_file($tempBaseDir . "/{$testSlug}/tenant.json"), "Tệp metadata tenant.json đã được lưu");

    // ── 3. Kiểm chứng tính toàn vẹn CSDL và tài khoản Admin ──
    echo "\n[3/5] Kiểm chứng tính toàn vẹn CSDL và phân quyền Admin...\n";
    $tenantPdo = new PDO('sqlite:' . $result['db_path']);
    $tenantPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $integrity = $tenantPdo->query("PRAGMA integrity_check")->fetchColumn();
    check($integrity === 'ok', "PRAGMA integrity_check của DB tenant mới đạt 'ok'");

    $fks = $tenantPdo->query("PRAGMA foreign_key_check")->fetchAll(PDO::FETCH_ASSOC);
    check(empty($fks), "PRAGMA foreign_key_check không có vi phạm khóa ngoại");

    $adminUser = $tenantPdo->query("SELECT * FROM users WHERE username = 'pastor_bienhoa'")->fetch(PDO::FETCH_ASSOC);
    check($adminUser !== false, "Tài khoản admin 'pastor_bienhoa' được tạo trong DB tenant");
    check($adminUser['role'] === 'admin', "Vai trò người dùng là 'admin'");
    check(password_verify('BienHoaP@ss2026', $adminUser['password_hash']), "Mật khẩu được mã hóa an toàn bằng BCRYPT");

    // Thử tạo trùng lặp
    $caughtDuplicate = false;
    try {
        TenantProvisioningService::provisionTenant($testSlug, 'Tên Khác');
    } catch (RuntimeException $e) {
        $caughtDuplicate = true;
    }
    check($caughtDuplicate, "Chống tạo trùng lặp tenant slug đã tồn tại");

    // ── 4. Tích hợp TenantContext, DB::get() và Quản lý danh sách ──
    echo "\n[4/5] Tích hợp TenantContext, DB::get() và truy vấn danh sách...\n";
    $list = TenantProvisioningService::listTenants();
    check(count($list) === 1, "listTenants() trả về chính xác 1 tenant");
    check($list[0]['slug'] === $testSlug, "Slug trong danh sách khớp '{$testSlug}'");
    check($list[0]['status'] === 'active', "Trạng thái tenant là 'active'");

    $info = TenantProvisioningService::getTenantInfo($testSlug);
    check($info !== null && $info['name'] === $testName, "getTenantInfo() trả về thông tin chính xác");
    check(($info['users_count'] ?? 0) === 1, "Thống kê chính xác số lượng users = 1");

    // Chuyển TenantContext sang tenant mới và ghi dữ liệu nghiệp vụ
    TenantContext::setTenant($testSlug);
    DB::resetConnections();
    $activeDb = DB::get();

    $activeDb->exec("INSERT INTO setlists (title, created_by, scheduled_date) VALUES ('Thánh Lễ Ra Mắt', {$adminUser['id']}, '2026-10-01')");
    $setlistCount = (int)$activeDb->query("SELECT COUNT(*) FROM setlists")->fetchColumn();
    check($setlistCount === 1, "Thao tác ghi dữ liệu qua DB::get() thành công trên database của tenant");

    // ── 5. Sao lưu và Deprovisioning ──
    echo "\n[5/5] Sao lưu mã hóa và dọn dẹp (Deprovisioning)...\n";
    $backupFile = TenantProvisioningService::backupTenant($testSlug, 'TenantSecretBackup2026!');
    check(is_file($backupFile), "Tệp sao lưu mã hóa của tenant đã được tạo");
    $backupHeader = file_get_contents($backupFile, false, null, 0, 8);
    check($backupHeader === 'Salted__', "Tệp sao lưu mang header chuẩn OpenSSL 'Salted__'");

    $tenantPdo = null;
    $activeDb = null;
    TenantContext::reset();
    DB::resetConnections();

    $deprovisionOk = TenantProvisioningService::deprovisionTenant($testSlug, true);
    check($deprovisionOk === true, "deprovisionTenant(permanent: true) thực thi thành công");
    check(!is_dir($tempBaseDir . "/{$testSlug}"), "Thư mục tenant đã được dọn sạch hoàn toàn");

} finally {
    // Dọn dẹp thư mục tạm gốc
    TenantContext::reset();
    TenantContext::setBaseDir('');
    if (is_dir($tempBaseDir)) {
        $files = glob($tempBaseDir . '/*');
        foreach ($files as $f) {
            if (is_dir($f)) {
                foreach (glob($f . '/*') as $sub) @unlink($sub);
                @rmdir($f);
            } else {
                @unlink($f);
            }
        }
        @rmdir($tempBaseDir);
    }
}

echo "\n--------------------------------------------------------\n";
echo "Kết quả kiểm thử Multi-Tenant Provisioning: {$passed} checks PASS, {$failed} checks FAIL\n";
echo "--------------------------------------------------------\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
