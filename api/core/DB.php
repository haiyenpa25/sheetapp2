<?php
/**
 * api/core/DB.php — Singleton PDO wrapper with Multi-Tenant & Master Repertoire Support
 * Tuân thủ thiết kế ADR-005 (Database-per-Tenant SQLite kết hợp Master Repertoire)
 */

declare(strict_types=1);

require_once __DIR__ . '/TenantContext.php';

class DB {
    private static ?PDO $pdo = null;
    private static ?PDO $masterPdo = null;
    private static array $tenantPool = [];

    public static function get(): PDO {
        // 1. Mock PDO được gán trước (dành cho Unit / Integration Tests với in-memory DB)
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // 2. Nếu đang trong ngữ cảnh đa hội thánh (TenantContext active)
        $tenantSlug = TenantContext::getTenant();
        if ($tenantSlug !== null) {
            if (!isset(self::$tenantPool[$tenantSlug])) {
                $dbPath = TenantContext::getTenantDbPath($tenantSlug);
                self::$tenantPool[$tenantSlug] = self::createConnection($dbPath);
            }
            return self::$tenantPool[$tenantSlug];
        }

        // 3. Mặc định: Single-Tenant DB từ Config
        require_once __DIR__ . '/Config.php';
        $file = Config::get('DB_PATH');
        self::$pdo = self::createConnection($file);
        return self::$pdo;
    }

    /**
     * Tạo và cấu hình kết nối PDO SQLite với các PRAGMA chuẩn hiệu năng & an toàn
     */
    public static function createConnection(string $file, bool $readOnly = false): PDO {
        $dir = dirname($file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        if (!$readOnly) {
            $pdo->exec('PRAGMA foreign_keys = ON;');
            $pdo->exec('PRAGMA journal_mode = WAL;');
            $pdo->exec('PRAGMA synchronous = NORMAL;');
            $pdo->exec('PRAGMA busy_timeout = 5000;');
        }
        return $pdo;
    }

    /**
     * Kết nối CSDL Thư Viện Chung Master Repertoire (Read-Only) — ADR-005
     */
    public static function getMaster(): PDO {
        if (self::$masterPdo !== null) {
            return self::$masterPdo;
        }

        $masterPath = dirname(__DIR__, 2) . '/storage/data/master_repertoire.sqlite';
        if (file_exists($masterPath)) {
            self::$masterPdo = self::createConnection($masterPath, true);
            return self::$masterPdo;
        }

        // Nếu chưa tách riêng file master, fallback về CSDL hiện hành
        return self::get();
    }

    public static function pdo(): PDO {
        return self::get();
    }

    public static function setPdo(?PDO $pdo): void {
        self::$pdo = $pdo;
    }

    public static function setMasterPdo(?PDO $pdo): void {
        self::$masterPdo = $pdo;
    }

    public static function closeTenantPool(): void {
        self::$tenantPool = [];
    }

    public static function resetConnections(): void {
        self::$pdo = null;
        self::$masterPdo = null;
        self::$tenantPool = [];
    }

    // Shorthand helpers
    public static function query(string $sql): array {
        return self::get()->query($sql)->fetchAll();
    }

    public static function run(string $sql, array $params = []): \PDOStatement {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function lastId(): string {
        return self::get()->lastInsertId();
    }
}
