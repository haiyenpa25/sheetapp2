<?php
// api/init_db.php
// Chạy file này 1 lần duy nhất từ trình duyệt để khởi tạo Database SQLite

// Không cần db.php, dùng MVC DB Core
require_once __DIR__ . '/core/DB.php';

try {
    $pdo = DB::get();
    // 1. Tạo bảng users
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // 2. Tạo bảng songs (Danh mục kho nhạc)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            httlvnId INTEGER,
            xmlPath TEXT NOT NULL,
            defaultKey TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // 3. Tạo bảng setlists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS setlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_by INTEGER,
            scheduled_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    // 3. Tạo bảng setlist_items
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS setlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setlist_id INTEGER NOT NULL,
            song_id TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            chord_profile TEXT,
            transpose_key INTEGER DEFAULT 0,
            bpm INTEGER,
            beats_per_measure INTEGER,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE
        )
    ");

    // 4. Tạo bảng song_sections (Cấu trúc phân đoạn ô nhịp)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS song_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'verse',
            start_measure INTEGER NOT NULL DEFAULT 1,
            end_measure INTEGER NOT NULL DEFAULT 4,
            color TEXT NOT NULL DEFAULT '#6366f1',
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        )
    ");

    // 5. Tạo bảng arrangements (Kịch bản biểu diễn)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS arrangements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        )
    ");

    // 6. Tạo bảng arrangement_steps (Các bước kịch bản)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS arrangement_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arrangement_id INTEGER NOT NULL,
            seq INTEGER NOT NULL DEFAULT 0,
            section_id INTEGER NOT NULL,
            repeat_count INTEGER NOT NULL DEFAULT 1,
            transpose_delta INTEGER NOT NULL DEFAULT 0,
            bpm INTEGER,
            cue_text TEXT,
            FOREIGN KEY (arrangement_id) REFERENCES arrangements(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES song_sections(id) ON DELETE CASCADE
        )
    ");

    // 7. Tạo bảng song_versions (Quản lý các phiên bản sheet nhạc theo người dùng)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS song_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            version_name TEXT NOT NULL,
            version_slug TEXT NOT NULL,
            xml_path TEXT NOT NULL,
            description TEXT,
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_song_versions_song_id ON song_versions(song_id);
        CREATE INDEX IF NOT EXISTS idx_song_versions_user_id ON song_versions(user_id);
    ");

    // 8. Tạo bảng user_chord_sets (Bộ hợp âm người dùng tùy biến - Hiển thị công khai kèm tác quyền)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_chord_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            set_name TEXT NOT NULL,
            instrument_type TEXT NOT NULL DEFAULT 'guitar',
            capo_fret INTEGER NOT NULL DEFAULT 0,
            custom_tempo INTEGER,
            chord_count INTEGER NOT NULL DEFAULT 0,
            notes_guide TEXT,
            chords_json TEXT NOT NULL DEFAULT '[]',
            is_public INTEGER NOT NULL DEFAULT 1,
            is_recommended INTEGER NOT NULL DEFAULT 0,
            views_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ucs_song_id ON user_chord_sets(song_id);
        CREATE INDEX IF NOT EXISTS idx_ucs_user_id ON user_chord_sets(user_id);
        CREATE INDEX IF NOT EXISTS idx_ucs_public ON user_chord_sets(is_public);
        CREATE INDEX IF NOT EXISTS idx_ucs_recommended ON user_chord_sets(is_recommended);
    ");

    // 9. Cập nhật các cột mở rộng (Migration an toàn)
    $addColumnIfNotExists = function(PDO $pdo, string $table, string $column, string $type) {
        $cols = $pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
        $names = array_column($cols, 'name');
        if (!in_array($column, $names)) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN $column $type");
        }
    };

    // Users
    $addColumnIfNotExists($pdo, 'users', 'display_name', 'TEXT');
    $addColumnIfNotExists($pdo, 'users', 'instrument', 'TEXT');
    $addColumnIfNotExists($pdo, 'users', 'avatar_url', 'TEXT');
    $addColumnIfNotExists($pdo, 'users', 'bio', 'TEXT');
    $addColumnIfNotExists($pdo, 'users', 'status', 'TEXT DEFAULT "active"');

    // Categories
    $addColumnIfNotExists($pdo, 'categories', 'icon', 'TEXT DEFAULT "🎵"');
    $addColumnIfNotExists($pdo, 'categories', 'description', 'TEXT');
    $addColumnIfNotExists($pdo, 'categories', 'display_order', 'INTEGER DEFAULT 0');

    // Song Versions
    $addColumnIfNotExists($pdo, 'song_versions', 'is_public', 'INTEGER DEFAULT 1');
    $addColumnIfNotExists($pdo, 'song_versions', 'is_recommended', 'INTEGER DEFAULT 0');
    $addColumnIfNotExists($pdo, 'song_versions', 'parent_song_id', 'TEXT');

    // 10. Tạo các danh mục phụng vụ chuẩn (nếu chưa có)
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

    // 11. Tạo tài khoản mặc định (nếu chưa có)
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $count = $stmt->fetchColumn();

    if ($count == 0) {
        $defaultUser = 'banhat';
        $defaultPass = '123456';
        $hash = password_hash($defaultPass, PASSWORD_DEFAULT);
        
        $insert = $pdo->prepare("INSERT INTO users (username, password_hash, role, display_name, instrument) VALUES (?, ?, ?, ?, ?)");
        $insert->execute([$defaultUser, $hash, 'admin', 'Ban Hát Chính', 'All']);
        echo "<p>Đã tạo tài khoản mặc định: <b>{$defaultUser}</b> / <b>{$defaultPass}</b> (Quyền: Admin)</p>";
    }

    // 12. Khoá tải file SQLite qua .htaccess
    $htaccessPath = __DIR__ . '/../storage/data/.htaccess';
    $htaccessRule = "<FilesMatch \"\\.(sqlite|json|db)$\">\nOrder allow,deny\nDeny from all\n</FilesMatch>";
    
    // Ngoại lệ: Nếu có folder chord_sets là file tĩnh có thể đang bị chặn, ta chỉ cản file đuôi sqlite
    $htaccessRule = "<FilesMatch \"\\.sqlite$\">\nRequire all denied\n</FilesMatch>";

    if (!file_exists($htaccessPath) || strpos(file_get_contents($htaccessPath), '.sqlite') === false) {
        file_put_contents($htaccessPath, $htaccessRule . "\n", FILE_APPEND);
        echo "<p>Đã ghi file bảo vệ .htaccess để ngăn tải CSDL</p>";
    }

    echo "<h3>Quá trình khởi tạo Cơ sở dữ liệu SQLite thành công!</h3>";

} catch (PDOException $e) {
    echo "Lỗi: " . $e->getMessage();
}
