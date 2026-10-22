<?php
/**
 * api/core/DB.php — Singleton PDO wrapper
 */

declare(strict_types=1);

class DB {
    private static ?PDO $pdo = null;
    private static ?WeakMap $schemaCache = null;

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

    /** Cache metadata per connection, refreshing after schema DDL/migrations. */
    private static function schemaMetadata(PDO $pdo): array {
        self::$schemaCache ??= new WeakMap();
        $version = (int)$pdo->query('PRAGMA schema_version')->fetchColumn();
        $cached = self::$schemaCache[$pdo] ?? [];
        if (($cached['version'] ?? null) !== $version) {
            $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
            $cached = ['version' => $version, 'tables' => array_map('strtolower', $tables), 'columns' => []];
            self::$schemaCache[$pdo] = $cached;
        }
        return $cached;
    }

    public static function hasTable(string $table): bool {
        try {
            return in_array(strtolower($table), self::schemaMetadata(self::get())['tables'], true);
        } catch (Throwable $e) {
            return false;
        }
    }

    public static function hasColumn(string $table, string $column): bool {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/D', $table)) return false;
        try {
            $pdo = self::get();
            $cache = self::schemaMetadata($pdo);
            $table = strtolower($table);
            if (!isset($cache['columns'][$table])) {
                $names = $pdo->query('PRAGMA table_info("' . $table . '")')->fetchAll(PDO::FETCH_COLUMN, 1);
                $cache['columns'][$table] = array_map('strtolower', $names);
                self::$schemaCache[$pdo] = $cache;
            }
            return in_array(strtolower($column), $cache['columns'][$table], true);
        } catch (Throwable $e) {
            return false;
        }
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
