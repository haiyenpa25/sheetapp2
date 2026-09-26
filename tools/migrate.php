<?php
/**
 * tools/migrate.php — CLI Migration Tool
 *
 * Chạy các migration cơ sở dữ liệu SQLite theo phiên bản.
 * Cách dùng: php tools/migrate.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../api/core/MigrationRunner.php';

echo "=== SheetApp2 Database Migration Runner ===\n";

try {
    $runner = new MigrationRunner();
    $alreadyApplied = $runner->getAppliedMigrations();
    echo "Các migration đã áp dụng trước đó: " . count($alreadyApplied) . "\n";
    foreach ($alreadyApplied as $m) {
        echo "  - {$m}\n";
    }

    echo "\nBắt đầu chạy migration mới...\n";
    $executed = $runner->migrate();

    if (empty($executed)) {
        echo "✅ Cơ sở dữ liệu đã ở trạng thái mới nhất, không có migration mới.\n";
    } else {
        echo "✅ Đã thực thi thành công " . count($executed) . " migration:\n";
        foreach ($executed as $m) {
            echo "  + {$m}\n";
        }
    }

    $status = $runner->verifyDatabase();
    echo "\nKết quả kiểm tra toàn vẹn:\n";
    echo "  - Integrity Check: {$status['integrity']}\n";
    echo "  - Foreign Keys: {$status['foreign_keys']}\n";
    echo "  - Journal Mode: {$status['journal_mode']}\n";

    exit(0);
} catch (Throwable $e) {
    echo "❌ LỖI MIGRATION: " . $e->getMessage() . "\n";
    exit(1);
}
