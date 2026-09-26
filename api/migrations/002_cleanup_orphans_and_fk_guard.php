<?php
/**
 * 002_cleanup_orphans_and_fk_guard.php
 * Dọn dẹp bản ghi mồ côi và bảo đảm ràng buộc khóa ngoại
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Dọn dẹp setlist_items không có setlist tương ứng (như bản ghi mồ côi setlist_id = 0)
    $pdo->exec("
        DELETE FROM setlist_items 
        WHERE setlist_id NOT IN (SELECT id FROM setlists);
    ");

    // 2. Dọn dẹp setlist_items nếu trỏ vào bài hát không tồn tại
    $pdo->exec("
        DELETE FROM setlist_items 
        WHERE song_id NOT IN (SELECT id FROM songs);
    ");
};
