<?php
// api/init_db.php
// Chạy file này từ command line để khởi tạo Database SQLite từ đầu (Fresh Install).

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/core/DB.php';
require_once __DIR__ . '/core/MigrationRunner.php';

try {
    $pdo = DB::get();
    echo "=== Khởi tạo CSDL SheetApp2 qua Migration Runner ===\n";

    // 1. Chạy toàn bộ migrations có phiên bản
    $runner = new MigrationRunner($pdo);
    $executed = $runner->migrate();

    if (empty($executed)) {
        echo "Lược đồ cơ sở dữ liệu đã ở phiên bản mới nhất.\n";
    } else {
        echo "Đã áp dụng " . count($executed) . " migrations thành công.\n";
    }

    // 2. Tạo các danh mục phụng vụ chuẩn (nếu chưa có)
    $defaultCategories = [
        ['name' => 'Thánh Ca', 'slug' => 'thanh-ca', 'icon' => '📖', 'description' => 'Thánh ca truyền thống HTTLVN 1 - 540', 'order' => 1],
        ['name' => 'Tôn Vinh & Thờ Phượng', 'slug' => 'ton-vinh-tho-phuong', 'icon' => '🙌', 'description' => 'Ca khúc thờ phượng hiện đại, ca ngợi', 'order' => 2],
        ['name' => 'Biệt Thánh Ca & Hợp Xướng', 'slug' => 'biet-thanh-ca', 'icon' => '🎼', 'description' => 'Bài thánh ca biểu diễn hợp xướng 4 bè SATB', 'order' => 3],
        ['name' => 'Giáng Sinh & Phục Sinh', 'slug' => 'giang-sinh-phuc-sinh', 'icon' => '✨', 'description' => 'Thánh ca theo mùa lễ phụng vụ lớn', 'order' => 4],
        ['name' => 'Giới Trẻ & Thiếu Nhi', 'slug' => 'gioi-tre-thieu-nhi', 'icon' => '🎸', 'description' => 'Bài hát sinh hoạt, thanh niên và thiếu nhi', 'order' => 5],
    ];

    foreach ($defaultCategories as $cat) {
        $exists = $pdo->prepare("SELECT COUNT(*) FROM categories WHERE slug = ?");
        $exists->execute([$cat['slug']]);
        if ($exists->fetchColumn() == 0) {
            $ins = $pdo->prepare("INSERT INTO categories (name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?)");
            $ins->execute([$cat['name'], $cat['slug'], $cat['icon'], $cat['description'], $cat['order']]);
        }
    }

    // 3. Tạo tài khoản mặc định (nếu chưa có)
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $count = $stmt->fetchColumn();

    if ($count == 0) {
        $adminPass    = bin2hex(random_bytes(8));
        $hoaidinhPass = bin2hex(random_bytes(8));
        $banhatPass   = bin2hex(random_bytes(8));

        $insert = $pdo->prepare("INSERT INTO users (username, password_hash, role, display_name, instrument, chord_code) VALUES (?, ?, ?, ?, ?, ?)");
        $insert->execute(['admin', password_hash($adminPass, PASSWORD_DEFAULT), 'admin', 'Quản Trị Viên', 'Admin / Tổng Chỉ Huy', 'ADMIN']);
        $insert->execute(['hoaidinh', password_hash($hoaidinhPass, PASSWORD_DEFAULT), 'banhat', 'Hoài Dinh', 'Piano / Đệm Hát', 'HD']);
        $insert->execute(['banhat', password_hash($banhatPass, PASSWORD_DEFAULT), 'banhat', 'Ban Hát', 'Guitar', 'BH']);

        echo "Đã tạo các tài khoản mặc định với mật khẩu ngẫu nhiên:\n";
        echo "  - admin:    {$adminPass}\n";
        echo "  - hoaidinh: {$hoaidinhPass}\n";
        echo "  - banhat:   {$banhatPass}\n";
        echo "LƯU Ý: Vui lòng lưu lại mật khẩu này ngay lập tức. Mật khẩu sẽ không hiển thị lại.\n";
    }

    // 4. Khóa tải file SQLite qua .htaccess
    $htaccessPath = __DIR__ . '/../storage/data/.htaccess';
    $htaccessRule = "<FilesMatch \"\\.sqlite$\">\nRequire all denied\n</FilesMatch>";

    if (!file_exists($htaccessPath) || strpos(file_get_contents($htaccessPath), '.sqlite') === false) {
        file_put_contents($htaccessPath, $htaccessRule . "\n", FILE_APPEND);
        echo "Đã ghi file bảo vệ .htaccess để ngăn tải CSDL\n";
    }

    $status = $runner->verifyDatabase();
    echo "\nKiểm tra tính toàn vẹn: {$status['integrity']}, Khóa ngoại: {$status['foreign_keys']}, Chế độ: {$status['journal_mode']}\n";
    echo "=== Quá trình khởi tạo Cơ sở dữ liệu SQLite hoàn tất thành công! ===\n";

} catch (Throwable $e) {
    echo "Lỗi: " . $e->getMessage() . "\n";
    exit(1);
}
