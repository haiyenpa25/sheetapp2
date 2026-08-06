<?php
/**
 * api/core/DB.php — Singleton PDO wrapper
 */
class DB {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        if (self::$pdo === null) {
            require_once __DIR__ . '/Config.php';
            $file = Config::get('DB_PATH');
            self::$pdo = new PDO('sqlite:' . $file);

            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            self::$pdo->exec('PRAGMA foreign_keys = ON;');
        }
        return self::$pdo;
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
