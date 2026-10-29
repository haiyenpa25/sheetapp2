<?php
/**
 * api/migrations/017_category_visibility.php
 *
 * Quyền xem theo danh mục bài hát: public (ai cũng thấy) | private (ban nhạc trở lên) | admin_only.
 * Cộng thêm, mặc định 'public' nên dữ liệu cũ không đổi hành vi. Chạy lại an toàn (kiểm cột trước).
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $existing = array_column($pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC), 'name');

    if (!in_array('visibility', $existing, true)) {
        $pdo->exec("ALTER TABLE categories ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';");
    }
};
