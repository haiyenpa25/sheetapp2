<?php
/**
 * api/core/MigrationRunner.php
 *
 * Bộ điều phối di chuyển cơ sở dữ liệu SQLite có phiên bản (Versioned Migration Runner)
 * Đảm bảo:
 * 1. Khởi tạo DB mới từ 0 (Fresh install).
 * 2. Nâng cấp DB hiện có không mất mát dữ liệu (Non-destructive upgrade).
 * 3. Chạy lại an toàn (Idempotent).
 * 4. Kiểm tra tính toàn vẹn (integrity_check) và khóa ngoại (foreign_key_check) sau mỗi lần chạy.
 */

declare(strict_types=1);

require_once __DIR__ . '/DB.php';

class MigrationRunner {
    private PDO $pdo;
    private string $migrationsDir;

    public function __construct(?PDO $pdo = null, ?string $migrationsDir = null) {
        $this->pdo = $pdo ?? DB::get();
        $this->migrationsDir = $migrationsDir ?? dirname(__DIR__) . '/migrations';
    }

    /**
     * Khởi tạo bảng lưu lịch sử migration
     */
    private function ensureMigrationTable(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ");
    }

    /**
     * Lấy danh sách các migration đã thực thi
     */
    public function getAppliedMigrations(): array {
        $this->ensureMigrationTable();
        $stmt = $this->pdo->query("SELECT version FROM schema_migrations ORDER BY version ASC");
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Thực thi toàn bộ các file migration còn thiếu
     */
    public function migrate(): array {
        $this->ensureMigrationTable();
        $applied = $this->getAppliedMigrations();
        $executed = [];

        if (!is_dir($this->migrationsDir)) {
            mkdir($this->migrationsDir, 0755, true);
        }

        $files = glob($this->migrationsDir . '/*.php');
        sort($files);

        foreach ($files as $file) {
            $version = basename($file, '.php');
            if (in_array($version, $applied, true)) {
                continue;
            }

            $migration = require $file;
            if (is_callable($migration)) {
                $migration($this->pdo);
            } elseif (is_array($migration) && isset($migration['up']) && is_callable($migration['up'])) {
                $migration['up']($this->pdo);
            }

            $stmt = $this->pdo->prepare("INSERT INTO schema_migrations (version) VALUES (?)");
            $stmt->execute([$version]);

            $executed[] = $version;
        }

        // Tự động kiểm tra tính toàn vẹn và khóa ngoại
        $this->verifyDatabase();

        return $executed;
    }

    /**
     * Kiểm tra toàn vẹn và khóa ngoại
     */
    public function verifyDatabase(): array {
        $integrity = $this->pdo->query("PRAGMA integrity_check")->fetchColumn();
        if ($integrity !== 'ok') {
            throw new RuntimeException("SQLite integrity check failed: {$integrity}");
        }

        $fkViolations = $this->pdo->query("PRAGMA foreign_key_check")->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($fkViolations)) {
            throw new RuntimeException("Foreign key violations found: " . json_encode($fkViolations));
        }

        $journalMode = $this->pdo->query("PRAGMA journal_mode")->fetchColumn();

        return [
            'integrity' => $integrity,
            'foreign_keys' => 'ok',
            'journal_mode' => $journalMode
        ];
    }
}
