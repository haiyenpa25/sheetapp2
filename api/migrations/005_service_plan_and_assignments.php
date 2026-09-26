<?php
/**
 * api/migrations/005_service_plan_and_assignments.php
 *
 * Migration nâng cấp Setlist thành Service Plan (Chương trình buổi nhóm) & Phân công nhân sự:
 * 1. Mở rộng bảng `setlists`: service_time, theme, description, status, leader_user_id
 * 2. Mở rộng bảng `setlist_items`: item_type, custom_title, leader_notes, duration_minutes
 * 3. Tạo bảng `service_plan_assignments`: Phân công vai trò & trạng thái xác nhận thành viên
 * 4. Tạo bảng `song_usage_history`: Theo dõi tần suất & lịch sử sử dụng bài hát trong phụng vụ
 * 5. Thiết lập các chỉ mục hiệu năng cao phục vụ truy vấn và đối soát
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Mở rộng bảng setlists
    $setlistCols = [];
    $stmt = $pdo->query("PRAGMA table_info(setlists)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $setlistCols[strtolower($row['name'])] = true;
    }

    if (!isset($setlistCols['service_time'])) {
        $pdo->exec("ALTER TABLE setlists ADD COLUMN service_time TEXT DEFAULT '08:30';");
    }
    if (!isset($setlistCols['theme'])) {
        $pdo->exec("ALTER TABLE setlists ADD COLUMN theme TEXT DEFAULT NULL;");
    }
    if (!isset($setlistCols['description'])) {
        $pdo->exec("ALTER TABLE setlists ADD COLUMN description TEXT DEFAULT NULL;");
    }
    if (!isset($setlistCols['status'])) {
        $pdo->exec("ALTER TABLE setlists ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';");
    }
    if (!isset($setlistCols['leader_user_id'])) {
        $pdo->exec("ALTER TABLE setlists ADD COLUMN leader_user_id INTEGER DEFAULT NULL;");
    }

    // 2. Mở rộng bảng setlist_items
    $itemCols = [];
    $stmt = $pdo->query("PRAGMA table_info(setlist_items)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $itemCols[strtolower($row['name'])] = true;
    }

    if (!isset($itemCols['item_type'])) {
        $pdo->exec("ALTER TABLE setlist_items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'song';");
    }
    if (!isset($itemCols['custom_title'])) {
        $pdo->exec("ALTER TABLE setlist_items ADD COLUMN custom_title TEXT DEFAULT NULL;");
    }
    if (!isset($itemCols['leader_notes'])) {
        $pdo->exec("ALTER TABLE setlist_items ADD COLUMN leader_notes TEXT DEFAULT NULL;");
    }
    if (!isset($itemCols['duration_minutes'])) {
        $pdo->exec("ALTER TABLE setlist_items ADD COLUMN duration_minutes INTEGER DEFAULT 5;");
    }

    // 3. Tạo bảng service_plan_assignments
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS service_plan_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setlist_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'vocal',
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            confirmed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(setlist_id, user_id, role)
        );
    ");

    // 4. Tạo bảng song_usage_history
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS song_usage_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            setlist_id INTEGER NOT NULL,
            service_date DATE NOT NULL,
            chord_profile TEXT DEFAULT 'HD',
            transpose_key INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
            UNIQUE(song_id, setlist_id)
        );
    ");

    // 5. Tạo các chỉ mục tra cứu hiệu năng cao
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_spa_setlist ON service_plan_assignments(setlist_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_spa_user ON service_plan_assignments(user_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_suh_song ON song_usage_history(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_suh_date ON song_usage_history(service_date);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_setlists_status_date ON setlists(status, scheduled_date);");
};
