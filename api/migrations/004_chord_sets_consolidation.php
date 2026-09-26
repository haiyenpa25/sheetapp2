<?php
/**
 * api/migrations/004_chord_sets_consolidation.php
 *
 * Migration hợp nhất dữ liệu bộ hợp âm:
 * 1. Bổ sung các cột phục vụ Fork & Attribution (parent_id, attribution)
 * 2. Bổ sung trường checksum để đối soát tính toàn vẹn và chống trùng lặp dữ liệu
 * 3. Thiết lập các chỉ mục tra cứu hiệu năng cao
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Kiểm tra các cột hiện tại của bảng user_chord_sets
    $cols = [];
    $stmt = $pdo->query("PRAGMA table_info(user_chord_sets)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cols[strtolower($row['name'])] = true;
    }

    // 2. Thêm cột parent_id nếu chưa có
    if (!isset($cols['parent_id'])) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN parent_id INTEGER DEFAULT NULL;");
    }

    // 3. Thêm cột attribution nếu chưa có
    if (!isset($cols['attribution'])) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN attribution TEXT DEFAULT NULL;");
    }

    // 4. Thêm cột checksum nếu chưa có
    if (!isset($cols['checksum'])) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN checksum TEXT DEFAULT NULL;");
    }

    // 5. Đảm bảo cột chords_json tồn tại
    if (!isset($cols['chords_json'])) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN chords_json TEXT NOT NULL DEFAULT '[]';");
    }

    // 6. Thêm chỉ mục tra cứu
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_parent_id ON user_chord_sets(parent_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_checksum ON user_chord_sets(checksum);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_song_set ON user_chord_sets(song_id, set_name);");
};
