<?php
declare(strict_types=1);

/**
 * tools/tenant_manager.php
 *
 * CLI Utility Quản trị & Điều phối Hệ thống Đa Hội Thánh (Multi-Tenant Administrator CLI)
 * Theo đặc tả ADR-005 (Database-per-Tenant SQLite Architecture).
 *
 * Cú pháp:
 *   php tools/tenant_manager.php --action=create --slug=slug --name="Name" [--admin-user=...] [--admin-pass=...]
 *   php tools/tenant_manager.php --action=list
 *   php tools/tenant_manager.php --action=info --slug=slug
 *   php tools/tenant_manager.php --action=backup --slug=slug [--passphrase="..."]
 *   php tools/tenant_manager.php --action=migrate-all
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "403 Forbidden: CLI only\n";
    exit(1);
}

require_once __DIR__ . '/../api/services/TenantProvisioningService.php';

$options = getopt('', ['action:', 'slug:', 'name:', 'admin-user:', 'admin-pass:', 'admin-email:', 'passphrase:']);
$action = $options['action'] ?? ($argv[1] ?? 'list');
$slug = $options['slug'] ?? '';
$name = $options['name'] ?? '';
$adminUser = $options['admin-user'] ?? null;
$adminPass = $options['admin-pass'] ?? null;
$adminEmail = $options['admin-email'] ?? null;
$passphrase = $options['passphrase'] ?? null;

echo "======================================================================\n";
echo "           SHEETAPP 2.0 — MULTI-TENANT MANAGEMENT TOOL               \n";
echo "======================================================================\n\n";

switch ($action) {
    case 'create':
        if (empty($slug) || empty($name)) {
            fwrite(STDERR, "Lỗi: Thiếu tham số --slug và --name\n");
            fwrite(STDERR, "Ví dụ: php tools/tenant_manager.php --action=create --slug=saigon --name=\"Hội Thánh Sài Gòn\"\n");
            exit(1);
        }

        echo "Đang khởi tạo Tenant mới: '{$name}' (slug: '{$slug}')...\n";
        try {
            $adminData = [];
            if ($adminUser) $adminData['username'] = $adminUser;
            if ($adminPass) $adminData['password'] = $adminPass;
            if ($adminEmail) $adminData['email'] = $adminEmail;

            $result = TenantProvisioningService::provisionTenant($slug, $name, $adminData);
            echo "✅ KHỞI TẠO THÀNH CÔNG!\n";
            echo "  - Slug            : {$result['slug']}\n";
            echo "  - Tên hội thánh   : {$result['name']}\n";
            echo "  - Cơ sở dữ liệu   : {$result['db_path']}\n";
            echo "  - Migrations áp dụng: {$result['migrations_count']} migrations\n";
            echo "  - Admin User      : {$result['admin_user']}\n";
            echo "  - Admin Password  : {$result['admin_password']}\n";
        } catch (Throwable $e) {
            fwrite(STDERR, "❌ THẤT BẠI: " . $e->getMessage() . "\n");
            exit(1);
        }
        break;

    case 'list':
        echo "Danh sách các Tenant trong hệ thống:\n";
        $tenants = TenantProvisioningService::listTenants();
        if (empty($tenants)) {
            echo "  (Chưa có tenant nào được khởi tạo trong storage/tenants/)\n";
        } else {
            printf("  %-16s | %-32s | %-8s | %-6s | %-8s\n", "SLUG", "TÊN HỘI THÁNH", "STATUS", "USERS", "DB SIZE");
            echo "  " . str_repeat('-', 78) . "\n";
            foreach ($tenants as $t) {
                $sizeKb = round(($t['db_size_bytes'] ?? 0) / 1024, 1) . ' KB';
                printf("  %-16s | %-32s | %-8s | %-6d | %-8s\n",
                    $t['slug'],
                    mb_substr($t['name'], 0, 32),
                    $t['status'],
                    $t['users_count'] ?? 0,
                    $sizeKb
                );
            }
        }
        break;

    case 'info':
        if (empty($slug)) {
            fwrite(STDERR, "Lỗi: Vui lòng chỉ định --slug=slug_name\n");
            exit(1);
        }
        $info = TenantProvisioningService::getTenantInfo($slug);
        if (!$info) {
            fwrite(STDERR, "Lỗi: Không tìm thấy tenant '{$slug}'\n");
            exit(1);
        }
        echo "Thông tin chi tiết Tenant: '{$slug}'\n";
        foreach ($info as $k => $v) {
            echo "  - {$k}: " . (is_scalar($v) ? $v : json_encode($v)) . "\n";
        }
        break;

    case 'backup':
        if (empty($slug)) {
            fwrite(STDERR, "Lỗi: Vui lòng chỉ định --slug=slug_name\n");
            exit(1);
        }
        echo "Đang sao lưu tenant '{$slug}'...\n";
        try {
            $backupFile = TenantProvisioningService::backupTenant($slug, $passphrase);
            echo "✅ Sao lưu thành công: {$backupFile}\n";
        } catch (Throwable $e) {
            fwrite(STDERR, "❌ Thất bại: " . $e->getMessage() . "\n");
            exit(1);
        }
        break;

    case 'migrate-all':
        echo "Đang kiểm tra và áp dụng migrations cho toàn bộ tenants...\n";
        $tenants = TenantProvisioningService::listTenants();
        $updated = 0;
        foreach ($tenants as $t) {
            $dbPath = TenantContext::getBaseDir() . '/' . $t['slug'] . '/data.sqlite';
            try {
                $pdo = new PDO('sqlite:' . $dbPath);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $runner = new MigrationRunner($pdo);
                $applied = $runner->migrate();
                if (!empty($applied)) {
                    echo "  ✅ {$t['slug']}: Áp dụng " . count($applied) . " migrations (" . implode(', ', $applied) . ")\n";
                    $updated++;
                } else {
                    echo "  - {$t['slug']}: Đã ở phiên bản mới nhất\n";
                }
            } catch (Throwable $e) {
                echo "  ❌ {$t['slug']} LỖI: " . $e->getMessage() . "\n";
            }
        }
        echo "\nHoàn tất. Có {$updated} tenant đã được cập nhật.\n";
        break;

    default:
        fwrite(STDERR, "Hành động không hợp lệ: '{$action}'. Các lệnh hỗ trợ: create, list, info, backup, migrate-all\n");
        exit(1);
}

echo "\n";
exit(0);
