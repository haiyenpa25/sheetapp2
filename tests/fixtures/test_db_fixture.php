<?php
/**
 * tests/fixtures/test_db_fixture.php
 * 
 * Fixture khởi tạo SQLite In-memory cô lập cho toàn bộ Unit & Regression Tests.
 */

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/core/DB.php';
require_once dirname(__DIR__, 2) . '/api/core/MigrationRunner.php';

function createTestDatabase(): PDO {
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON;');

    $runner = new MigrationRunner($pdo, dirname(__DIR__, 2) . '/api/migrations');
    $runner->migrate();

    // 1. Seed Categories
    $categories = [
        [1, 'Thánh Ca', 'thanh-ca', '📖', 'Thánh ca truyền thống HTTLVN 1 - 540', 1],
        [2, 'Tôn Vinh & Thờ Phượng', 'ton-vinh-tho-phuong', '🙌', 'Ca khúc thờ phượng hiện đại, ca ngợi', 2],
        [3, 'Biệt Thánh Ca & Hợp Xướng', 'biet-thanh-ca', '🎼', 'Bài thánh ca biểu diễn hợp xướng 4 bè SATB', 3],
        [4, 'Giáng Sinh & Phục Sinh', 'giang-sinh-phuc-sinh', '✨', 'Thánh ca các dịp lễ lớn của Hội Thánh', 4],
        [5, 'Giới Trẻ & Thiếu Nhi', 'gioi-tre-thieu-nhi', '🎸', 'Bài hát sinh hoạt, thanh niên và thiếu nhi', 5],
    ];
    $catStmt = $pdo->prepare("INSERT OR IGNORE INTO categories (id, name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($categories as $cat) {
        $catStmt->execute($cat);
    }

    // 2. Seed Users (3 users: admin, banhat, viewer)
    $pwd = password_hash('test_password', PASSWORD_DEFAULT);
    $userStmt = $pdo->prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, instrument, chord_code) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $userStmt->execute([1, 'admin', $pwd, 'admin', 'Quản Trị Viên', 'Admin / Tổng Chỉ Huy', 'ADMIN']);
    $userStmt->execute([2, 'banhat', $pwd, 'banhat', 'Ban Hát', 'Guitar', 'BH']);
    $userStmt->execute([3, 'viewer', $pwd, 'viewer', 'Người Xem', 'Vocal', 'VIEW']);

    // 3. Seed Songs (2 songs: 001-thanh-chua-yeu-thuong, 002-ngoi-khen-chua)
    $songStmt = $pdo->prepare("INSERT OR IGNORE INTO songs (id, title, httlvnId, xmlPath, defaultKey, category_id) VALUES (?, ?, ?, ?, ?, ?)");
    $songStmt->execute(['001-thanh-chua-yeu-thuong', 'Thánh Chúa Yêu Thương', 1, 'storage/Thanh ca/001.xml', 'F', 1]);
    $songStmt->execute(['002-ngoi-khen-chua', 'Ngợi Khen Chúa', 2, 'storage/Thanh ca/002.xml', 'G', 1]);

    return $pdo;
}
