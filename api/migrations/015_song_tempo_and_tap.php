<?php
/**
 * api/migrations/015_song_tempo_and_tap.php
 *
 * Mở rộng bảng songs (Ticket L6-2 - ROADMAP4 Mục 8):
 * - Bổ sung cột tempo INTEGER DEFAULT NULL (xóa bỏ tempo giả 104, mặc định là NULL).
 * - Kiểm tra PRAGMA table_info trước khi ALTER TABLE để đảm bảo tính idempotent.
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $cols = $pdo->query("PRAGMA table_info(songs)")->fetchAll(PDO::FETCH_ASSOC);
    $existing = array_column($cols, 'name');

    if (!in_array('tempo', $existing, true)) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN tempo INTEGER DEFAULT NULL;");
    }
};
