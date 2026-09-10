<?php
/**
 * api/services/UserService.php
 */
require_once __DIR__ . '/../core/DB.php';

class UserService {
    public static function getAll(): array {
        return DB::query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
    }

    /**
     * T\u00ecm user theo username (d\u00f9ng cho AuthController login).
     * Tr\u1ea3 false n\u1ebfu kh\u00f4ng t\u00ecm th\u1ea5y.
     */
    public static function findByUsername(string $username): array|false {
        return DB::run(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            [$username]
        )->fetch();
    }

    public static function create(string $username, string $password, string $role): int {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [$username, $hash, $role]);
        return (int)DB::lastId();
    }

    public static function createWithProfile(string $username, string $password, string $role, string $displayName, string $instrument): int {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run(
            "INSERT INTO users (username, password_hash, role, display_name, instrument) VALUES (?, ?, ?, ?, ?)",
            [$username, $hash, $role, $displayName, $instrument]
        );
        return (int)DB::lastId();
    }

    public static function updateProfile(int $id, ?string $displayName, ?string $instrument, ?string $currentPassword, ?string $newPassword): array {
        $user = DB::run("SELECT * FROM users WHERE id = ?", [$id])->fetch();
        if (!$user) {
            throw new Exception("Không tìm thấy tài khoản người dùng");
        }

        $fields = [];
        $params = [];

        if ($displayName !== null && $displayName !== '') {
            $fields[] = "display_name = ?";
            $params[] = $displayName;
        }

        if ($instrument !== null && $instrument !== '') {
            $fields[] = "instrument = ?";
            $params[] = $instrument;
        }

        if (!empty($newPassword)) {
            if (empty($currentPassword) || !password_verify($currentPassword, $user['password_hash'])) {
                throw new Exception("Mật khẩu hiện tại không chính xác");
            }
            if (strlen($newPassword) < 4) {
                throw new Exception("Mật khẩu mới phải có ít nhất 4 ký tự");
            }
            $fields[] = "password_hash = ?";
            $params[] = password_hash($newPassword, PASSWORD_DEFAULT);
        }

        if (!empty($fields)) {
            $params[] = $id;
            DB::run("UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?", $params);
        }

        return DB::run("SELECT id, username, role, display_name, instrument, created_at FROM users WHERE id = ?", [$id])->fetch();
    }

    public static function updateRole(int $id, string $role): void {
        DB::run("UPDATE users SET role = ? WHERE id = ?", [$role, $id]);
    }

    public static function updatePassword(int $id, string $password): void {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("UPDATE users SET password_hash = ? WHERE id = ?", [$hash, $id]);
    }

    public static function delete(int $id): void {
        DB::run("DELETE FROM users WHERE id = ?", [$id]);
    }
}
