<?php
/**
 * api/migrations/014_setlist_item_selected_verses.php
 *
 * Mở rộng bảng setlist_items (Ticket L3-3):
 * - Bổ sung cột selected_verses TEXT DEFAULT NULL để lưu các khổ sẽ hát (ví dụ: "1, 3, 4" hoặc "1,3").
 * - Kiểm tra PRAGMA table_info trước khi ALTER TABLE để đảm bảo tính idempotent.
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $cols = $pdo->query("PRAGMA table_info(setlist_items)")->fetchAll(PDO::FETCH_ASSOC);
    $existing = array_column($cols, 'name');

    if (!in_array('selected_verses', $existing, true)) {
        $pdo->exec("ALTER TABLE setlist_items ADD COLUMN selected_verses TEXT DEFAULT NULL;");
    }
};
