<?php
/**
 * api/migrations/019_users_must_change_password.php
 *
 * Cờ bắt đổi mật khẩu ở lần đăng nhập đầu cho tài khoản do hệ thống tự sinh mật khẩu
 * (vd. 3 tài khoản tạo kèm Hội Thánh). Cộng thêm, mặc định 0 nên tài khoản cũ không đổi hành vi.
 * Chạy lại an toàn (kiểm cột trước).
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    $existing = array_column($pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC), 'name');

    if (!in_array('must_change_password', $existing, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;");
    }
};
