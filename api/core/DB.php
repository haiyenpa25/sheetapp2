<?php
/**
 * api/core/DB.php — Singleton PDO wrapper
 */

declare(strict_types=1);

class DB {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        // 1. Mock PDO được gán trước (dành cho Unit / Integration Tests với in-memory DB)
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // 2. Single-Tenant DB từ Config
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

    public static function pdo(): PDO {
        return self::get();
    }

    public static function setPdo(?PDO $pdo): void {
        self::$pdo = $pdo;
    }

    public static function resetConnections(): void {
        self::$pdo = null;
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
