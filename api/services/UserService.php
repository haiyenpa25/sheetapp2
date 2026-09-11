<?php
/**
 * api/services/UserService.php
 */
require_once __DIR__ . '/../core/DB.php';

class UserService {
    public static function getAll(): array {
        return DB::query("SELECT id, username, role, display_name, instrument, chord_code, avatar_url, bio, status, created_at FROM users ORDER BY created_at DESC");
    }

    /**
     * Tìm user theo username (dùng cho AuthController login).
     * Trả false nếu không tìm thấy.
     */
    public static function findByUsername(string $username): array|false {
        return DB::run(
            "SELECT id, username, password_hash, role, display_name, instrument, chord_code, avatar_url, bio, status FROM users WHERE username = ?",
            [$username]
        )->fetch();
    }

    public static function findById(int $id): array|false {
        return DB::run(
            "SELECT id, username, role, display_name, instrument, chord_code, avatar_url, bio, status, created_at FROM users WHERE id = ?",
            [$id]
        )->fetch();
    }

    public static function create(string $username, string $password, string $role): int {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [$username, $hash, $role]);
        return (int)DB::lastId();
    }

    public static function createWithProfile(string $username, string $password, string $role, string $displayName, string $instrument, ?string $chordCode = null): int {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $chordCode = !empty($chordCode) ? strtoupper(trim($chordCode)) : null;
        DB::run(
            "INSERT INTO users (username, password_hash, role, display_name, instrument, chord_code) VALUES (?, ?, ?, ?, ?, ?)",
            [$username, $hash, $role, $displayName, $instrument, $chordCode]
        );
        return (int)DB::lastId();
    }

    public static function updateMusician(int $id, string $displayName, string $instrument, string $chordCode, string $role, ?string $password = null): void {
        $chordCode = strtoupper(trim($chordCode));
        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            DB::run(
                "UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ?, password_hash = ? WHERE id = ?",
                [$displayName, $instrument, $chordCode, $role, $hash, $id]
            );
        } else {
            DB::run(
                "UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ? WHERE id = ?",
                [$displayName, $instrument, $chordCode, $role, $id]
            );
        }
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

        return DB::run("SELECT id, username, role, display_name, instrument, chord_code, created_at FROM users WHERE id = ?", [$id])->fetch();
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
