<?php
/**
 * api/migrations/016_song_visibility_and_rbac_roles.php
 *
 * Bổ sung chế độ hiển thị bài hát (Public / Private) và người tạo (created_by) cho bảng songs,
 * đồng thời hỗ trợ phân quyền 4 nhóm tài khoản: Guest (viewer), Ban Hát (banhat), Ban Nhạc (bannhac), Admin (admin).
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $cols = $pdo->query("PRAGMA table_info(songs)")->fetchAll(PDO::FETCH_ASSOC);
    $existing = array_column($cols, 'name');

    if (!in_array('visibility', $existing, true)) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';");
    }

    if (!in_array('is_public', $existing, true)) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;");
    }

    if (!in_array('created_by', $existing, true)) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN created_by INTEGER DEFAULT NULL;");
    }

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_songs_visibility ON songs(visibility, is_public);");
};
