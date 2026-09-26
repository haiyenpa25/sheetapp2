<?php
/**
 * api/services/TenantProvisioningService.php
 *
 * Dịch vụ Khởi tạo & Quản lý Vòng Đời Đa Hội Thánh (Tenant Lifecycle & Provisioning Service)
 * Hiện thực hóa thiết kế ADR-005 (Mô hình Database-per-Tenant SQLite):
 * 1. Khởi tạo tenant mới an toàn, biệt lập vật lý tuyệt đối (provisionTenant).
 * 2. Tự động áp dụng toàn bộ 12 baseline migrations lên file data.sqlite mới của tenant.
 * 3. Tạo tài khoản Tenant Admin ban đầu với mật khẩu an toàn.
 * 4. Liệt kê, kiểm tra trạng thái và sao lưu riêng biệt từng tenant (listTenants, backupTenant).
 * 5. Lưu trữ / Ngừng hoạt động (deprovisionTenant).
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/TenantContext.php';
require_once dirname(__DIR__) . '/core/MigrationRunner.php';

class TenantProvisioningService {

    /**
     * Khởi tạo một Tenant mới hoàn chỉnh
     *
     * @param string $slug Mã định danh tenant (ví dụ: 'saigon', 'ha-noi')
     * @param string $name Tên đầy đủ hội thánh (ví dụ: 'Hội Thánh Tin Lành Sài Gòn')
     * @param array $adminData Thông tin tài khoản quản trị ban đầu
     * @return array Kết quả khởi tạo
     * @throws InvalidArgumentException|RuntimeException
     */
    public static function provisionTenant(string $slug, string $name, array $adminData = []): array {
        $cleanSlug = strtolower(trim($slug));
        if (!TenantContext::validateSlug($cleanSlug)) {
            throw new InvalidArgumentException("Tenant slug không hợp lệ: '{$slug}'. Chỉ dùng a-z, 0-9, gạch ngang, 2-50 ký tự.");
        }

        $cleanName = trim($name);
        if ($cleanName === '') {
            throw new InvalidArgumentException("Tên hội thánh không được để trống.");
        }

        $baseDir = TenantContext::getBaseDir();
        $tenantDir = $baseDir . '/' . $cleanSlug;

        if (is_dir($tenantDir) && file_exists($tenantDir . '/data.sqlite')) {
            throw new RuntimeException("Tenant '{$cleanSlug}' đã tồn tại trong hệ thống.");
        }

        // 1. Tạo cây thư mục biệt lập
        if (!is_dir($tenantDir)) {
            mkdir($tenantDir, 0750, true);
        }
        $subDirs = ['logs', 'live_sync'];
        foreach ($subDirs as $sd) {
            $p = $tenantDir . '/' . $sd;
            if (!is_dir($p)) {
                mkdir($p, 0750, true);
            }
        }

        $dbPath = $tenantDir . '/data.sqlite';

        // 2. Khởi tạo kết nối SQLite với cấu hình hiệu năng cao (WAL, Foreign Keys)
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec("PRAGMA journal_mode = WAL;");
        $pdo->exec("PRAGMA foreign_keys = ON;");
        $pdo->exec("PRAGMA busy_timeout = 5000;");

        // 3. Thực thi toàn bộ Versioned Migrations trên DB của Tenant
        $migrationsDir = dirname(__DIR__) . '/migrations';
        $runner = new MigrationRunner($pdo, $migrationsDir);
        $executedMigrations = $runner->migrate();

        // 4. Tạo tài khoản Tenant Admin ban đầu
        $adminUser = trim((string)($adminData['username'] ?? ('admin_' . $cleanSlug)));
        $adminPass = (string)($adminData['password'] ?? bin2hex(random_bytes(6)));
        $adminEmail = !empty($adminData['email']) ? trim((string)$adminData['email']) : null;
        $displayName = !empty($adminData['display_name']) ? trim((string)$adminData['display_name']) : ('Quản trị viên ' . $cleanName);

        $passHash = password_hash($adminPass, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("
            INSERT INTO users (username, password_hash, display_name, email, role, status, voice_part)
            VALUES (?, ?, ?, ?, 'admin', 'active', 'S')
        ");
        $stmt->execute([$adminUser, $passHash, $displayName, $adminEmail]);
        $adminId = (int)$pdo->lastInsertId();

        // 5. Ghi tệp metadata tenant.json
        $metadata = [
            'slug' => $cleanSlug,
            'name' => $cleanName,
            'status' => 'active',
            'created_at' => date('Y-m-d H:i:s'),
            'admin_username' => $adminUser,
            'admin_id' => $adminId,
            'schema_version' => count($executedMigrations),
            'database_path' => "storage/tenants/{$cleanSlug}/data.sqlite"
        ];
        file_put_contents($tenantDir . '/tenant.json', json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return [
            'success' => true,
            'slug' => $cleanSlug,
            'name' => $cleanName,
            'db_path' => $dbPath,
            'migrations_count' => count($executedMigrations),
            'admin_user' => $adminUser,
            'admin_password' => $adminPass,
            'admin_id' => $adminId
        ];
    }

    /**
     * Lấy thông tin chi tiết của một tenant
     */
    public static function getTenantInfo(string $slug): ?array {
        $cleanSlug = strtolower(trim($slug));
        if (!TenantContext::validateSlug($cleanSlug)) {
            return null;
        }

        $tenantDir = TenantContext::getBaseDir() . '/' . $cleanSlug;
        $metaFile = $tenantDir . '/tenant.json';
        $dbPath = $tenantDir . '/data.sqlite';

        if (!file_exists($metaFile) || !file_exists($dbPath)) {
            return null;
        }

        $meta = json_decode((string)file_get_contents($metaFile), true) ?: [];
        $meta['db_size_bytes'] = filesize($dbPath);

        try {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $meta['users_count'] = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
            $meta['setlists_count'] = (int)$pdo->query("SELECT COUNT(*) FROM setlists")->fetchColumn();
            $meta['integrity'] = (string)$pdo->query("PRAGMA integrity_check")->fetchColumn();
        } catch (Throwable $e) {
            $meta['integrity'] = 'error: ' . $e->getMessage();
        }

        return $meta;
    }

    /**
     * Danh sách tất cả các tenants trong hệ thống
     */
    public static function listTenants(): array {
        $baseDir = TenantContext::getBaseDir();
        if (!is_dir($baseDir)) {
            return [];
        }

        $tenants = [];
        $entries = scandir($baseDir) ?: [];
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || !TenantContext::validateSlug($entry)) {
                continue;
            }
            $info = self::getTenantInfo($entry);
            if ($info !== null) {
                $tenants[] = $info;
            }
        }

        return $tenants;
    }

    /**
     * Tạo bản sao lưu riêng biệt cho một tenant
     */
    public static function backupTenant(string $slug, ?string $passphrase = null, ?string $outputPath = null): string {
        $cleanSlug = strtolower(trim($slug));
        $tenantDir = TenantContext::getBaseDir() . '/' . $cleanSlug;
        $dbPath = $tenantDir . '/data.sqlite';

        if (!file_exists($dbPath)) {
            throw new RuntimeException("Không tìm thấy cơ sở dữ liệu của tenant '{$cleanSlug}'");
        }

        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $timestamp = date('Ymd_His');
        $backupsDir = $tenantDir . '/backups';
        if (!is_dir($backupsDir)) {
            mkdir($backupsDir, 0750, true);
        }

        $snapshotPath = $backupsDir . "/snapshot_{$cleanSlug}_{$timestamp}.sqlite";
        try {
            $stmt = $pdo->prepare("VACUUM INTO :target");
            $stmt->execute([':target' => $snapshotPath]);
        } catch (Throwable $e) {
            copy($dbPath, $snapshotPath);
        }

        $finalOutput = $outputPath ?? ($backupsDir . "/backup_{$cleanSlug}_{$timestamp}" . ($passphrase ? '.enc' : '.sqlite'));

        if (!empty($passphrase)) {
            $plaintext = file_get_contents($snapshotPath);
            $salt = openssl_random_pseudo_bytes(8);
            $keyIv = openssl_pbkdf2($passphrase, $salt, 48, 100000, 'sha256');
            $key = substr($keyIv, 0, 32);
            $iv  = substr($keyIv, 32, 16);

            $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
            file_put_contents($finalOutput, "Salted__" . $salt . $encrypted);
            @unlink($snapshotPath);
        } else {
            rename($snapshotPath, $finalOutput);
        }

        return $finalOutput;
    }

    /**
     * Ngừng hoạt động hoặc xóa bỏ một tenant
     */
    public static function deprovisionTenant(string $slug, bool $permanent = false): bool {
        $cleanSlug = strtolower(trim($slug));
        $tenantDir = TenantContext::getBaseDir() . '/' . $cleanSlug;

        if (!is_dir($tenantDir)) {
            return false;
        }

        // Đóng toàn bộ kết nối tới tenant để giải phóng lock file SQLite trên Windows
        require_once dirname(__DIR__) . '/core/DB.php';
        DB::resetConnections();

        if ($permanent) {
            self::recursiveRmdir($tenantDir);
            return true;
        }

        // Lưu trữ (Archive)
        $metaFile = $tenantDir . '/tenant.json';
        if (file_exists($metaFile)) {
            $meta = json_decode((string)file_get_contents($metaFile), true) ?: [];
            $meta['status'] = 'archived';
            $meta['archived_at'] = date('Y-m-d H:i:s');
            file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        $archivedDir = $tenantDir . '.archived_' . date('Ymd_His');
        return rename($tenantDir, $archivedDir);
    }

    private static function recursiveRmdir(string $dir): void {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($files as $file) {
            $p = $dir . '/' . $file;
            is_dir($p) ? self::recursiveRmdir($p) : @unlink($p);
        }
        @rmdir($dir);
    }
}
