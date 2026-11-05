<?php
/**
 * api/migrations/018_multi_church.php
 *
 * Nền đa Hội Thánh (HT): bảng churches + church_members, cột church_id cho setlists và categories.
 * Cộng thêm, chạy lại an toàn. Dữ liệu cũ gom vào một HT mặc định (slug 'mac-dinh'); mọi tài khoản hiện có thành
 * thành viên với vai trò tương ứng. Hành vi chỉ đổi khi bật cờ MULTI_CHURCH (xem api/core/FeatureFlags.php).
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS churches (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            slug        TEXT NOT NULL UNIQUE,
            invite_code TEXT NOT NULL UNIQUE,
            status      TEXT NOT NULL DEFAULT 'active',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS church_members (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            church_id  INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role       TEXT NOT NULL DEFAULT 'member',
            status     TEXT NOT NULL DEFAULT 'active',
            joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (church_id, user_id)
        );
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_church_members_user ON church_members(user_id, status);");

    foreach (['setlists', 'categories'] as $table) {
        $cols = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC), 'name');
        if ($cols && !in_array('church_id', $cols, true)) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN church_id INTEGER REFERENCES churches(id);");
        }
    }

    $default = $pdo->query("SELECT id FROM churches WHERE slug = 'mac-dinh'")->fetchColumn();
    if (!$default) {
        $stmt = $pdo->prepare("INSERT INTO churches (name, slug, invite_code) VALUES ('Hội Thánh mặc định', 'mac-dinh', ?)");
        $stmt->execute([strtoupper(substr(bin2hex(random_bytes(5)), 0, 8))]);
        $default = (int)$pdo->lastInsertId();
    }
    $default = (int)$default;

    // Chương trình lễ cũ thuộc HT mặc định. Danh mục giữ NULL = dùng chung toàn hệ thống.
    $pdo->prepare("UPDATE setlists SET church_id = ? WHERE church_id IS NULL")->execute([$default]);

    $map = ['admin' => 'church_admin', 'leader' => 'leader', 'bannhac' => 'member', 'banhat' => 'member', 'viewer' => 'viewer'];
    $insert = $pdo->prepare("INSERT OR IGNORE INTO church_members (church_id, user_id, role, status) VALUES (?, ?, ?, ?)");
    foreach ($pdo->query("SELECT id, role, status FROM users")->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $status = ($u['status'] ?? 'active') === 'active' ? 'active' : 'disabled';
        $insert->execute([$default, (int)$u['id'], $map[$u['role']] ?? 'viewer', $status]);
    }
};
