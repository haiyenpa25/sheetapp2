<?php
/**
 * api/services/UserService.php
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class UserService {
    public static function getAll(): array {
        return DB::query("SELECT id, username, role, display_name, instrument, chord_code, voice_part, avatar_url, bio, status, created_at FROM users ORDER BY created_at DESC");
    }

    /**
     * Tìm user theo username (dùng cho AuthController login).
     * Trả false nếu không tìm thấy.
     */
    public static function findByUsername(string $username): array|false {
        return DB::run(
            "SELECT id, username, password_hash, role, display_name, instrument, chord_code, voice_part, avatar_url, bio, status FROM users WHERE username = ?",
            [$username]
        )->fetch();
    }

    public static function findById(int $id): array|false {
        return DB::run(
            "SELECT id, username, role, display_name, instrument, chord_code, voice_part, avatar_url, bio, status, created_at FROM users WHERE id = ?",
            [$id]
        )->fetch();
    }

    /**
     * Nhận diện mật khẩu yếu hoặc dễ đoán
     */
    public static function isWeakPassword(string $password, string $username = ''): bool {
        $p = trim($password);
        if ($p === '') {
            return true;
        }
        $weakList = [
            '123456',
            'password',
            '12345678',
            '123456789',
            '1234567890',
            'admin',
            'sheetapp',
            'qwerty',
            '111111',
            '000000',
        ];
        if (in_array(strtolower($p), $weakList, true)) {
            return true;
        }
        if ($username !== '' && strtolower($p) === strtolower(trim($username))) {
            return true;
        }
        return false;
    }

    public static function create(string $username, string $password, string $role): int {
        if (strlen($password) < 4) {
            throw new Exception("Mật khẩu phải có ít nhất 4 ký tự");
        }
        if (self::isWeakPassword($password, $username)) {
            throw new Exception("Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn");
        }
        if (!in_array($role, ['viewer', 'banhat', 'leader', 'admin'], true)) {
            throw new Exception("Quyền người dùng không hợp lệ");
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [$username, $hash, $role]);
        return (int)DB::lastId();
    }

    public static function createWithProfile(string $username, string $password, string $role, string $displayName, string $instrument, ?string $chordCode = null, ?string $voicePart = null): int {
        if (strlen($password) < 4) {
            throw new Exception("Mật khẩu phải có ít nhất 4 ký tự");
        }
        if (self::isWeakPassword($password, $username)) {
            throw new Exception("Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn");
        }
        if (!in_array($role, ['viewer', 'banhat', 'leader', 'admin'], true)) {
            throw new Exception("Quyền người dùng không hợp lệ");
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $chordCode = !empty($chordCode) ? strtoupper(trim($chordCode)) : null;
        $voicePart = !empty($voicePart) ? strtoupper(trim($voicePart)) : null;
        if ($voicePart !== null && !in_array($voicePart, ['S', 'A', 'T', 'B', 'INSTR'], true)) {
            $voicePart = null;
        }

        DB::run(
            "INSERT INTO users (username, password_hash, role, display_name, instrument, chord_code, voice_part) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [$username, $hash, $role, $displayName, $instrument, $chordCode, $voicePart]
        );
        $newId = (int)DB::lastId();
        AuditLogger::log('user_create', Auth::isLoggedIn() ? Auth::userId() : null, $newId, [
            'username'   => $username,
            'role'       => $role,
            'chord_code' => $chordCode,
            'voice_part' => $voicePart
        ]);
        return $newId;
    }

    public static function updateMusician(int $id, string $displayName, string $instrument, string $chordCode, string $role, ?string $password = null, ?string $voicePart = null): void {
        $existing = self::findById($id);
        if (!$existing) {
            throw new Exception("Không tìm thấy tài khoản người dùng");
        }

        if (!in_array($role, ['viewer', 'banhat', 'leader', 'admin'], true)) {
            throw new Exception("Quyền người dùng không hợp lệ");
        }

        // Chặn tự hạ quyền admin của chính mình
        if (Auth::isLoggedIn() && $id === Auth::userId() && $role !== 'admin') {
            throw new Exception("Không thể tự hạ quyền Admin của chính bạn");
        }

        // Đảm bảo không hạ quyền admin cuối cùng
        if ($existing['role'] === 'admin' && $role !== 'admin') {
            $adminCount = (int)DB::query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
            if ($adminCount <= 1) {
                throw new Exception("Hệ thống phải có ít nhất 1 Quản Trị Viên hoạt động");
            }
        }

        $chordCode = strtoupper(trim($chordCode));
        $voicePart = $voicePart !== null ? strtoupper(trim($voicePart)) : ($existing['voice_part'] ?? null);
        if ($voicePart !== null && !in_array($voicePart, ['S', 'A', 'T', 'B', 'INSTR'], true)) {
            $voicePart = null;
        }

        if (!empty($password)) {
            if (strlen($password) < 10) {
                throw new Exception("Mật khẩu phải có ít nhất 10 ký tự");
            }
            if (self::isWeakPassword($password, $existing['username'])) {
                throw new Exception("Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn");
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            DB::run(
                "UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ?, voice_part = ?, password_hash = ? WHERE id = ?",
                [$displayName, $instrument, $chordCode, $role, $voicePart, $hash, $id]
            );
        } else {
            DB::run(
                "UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ?, voice_part = ? WHERE id = ?",
                [$displayName, $instrument, $chordCode, $role, $voicePart, $id]
            );
        }

        AuditLogger::log('user_profile_update', Auth::isLoggedIn() ? Auth::userId() : null, $id, [
            'display_name'     => $displayName,
            'instrument'       => $instrument,
            'chord_code'       => $chordCode,
            'role'             => $role,
            'voice_part'       => $voicePart,
            'password_changed' => !empty($password)
        ]);
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
            if (strlen($newPassword) < 10) {
                throw new Exception("Mật khẩu mới phải có ít nhất 10 ký tự");
            }
            if (self::isWeakPassword($newPassword, $user['username'])) {
                throw new Exception("Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn");
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
        $existing = self::findById($id);
        if (!$existing) {
            throw new Exception("Không tìm thấy người dùng");
        }

        if (Auth::isLoggedIn() && $id === Auth::userId() && $role !== 'admin') {
            throw new Exception("Không thể tự hạ quyền Admin của chính bạn");
        }

        if ($existing['role'] === 'admin' && $role !== 'admin') {
            $adminCount = (int)DB::query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
            if ($adminCount <= 1) {
                throw new Exception("Hệ thống phải có ít nhất 1 Quản Trị Viên hoạt động");
            }
        }

        DB::run("UPDATE users SET role = ? WHERE id = ?", [$role, $id]);
        AuditLogger::log('user_role_change', Auth::isLoggedIn() ? Auth::userId() : null, $id, [
            'old_role' => $existing['role'],
            'new_role' => $role
        ]);
    }

    public static function updatePassword(int $id, string $password): void {
        $user = self::findById($id);
        $username = $user ? $user['username'] : '';
        if (strlen($password) < 10) {
            throw new Exception("Mật khẩu phải có ít nhất 10 ký tự");
        }
        if (self::isWeakPassword($password, $username)) {
            throw new Exception("Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn");
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("UPDATE users SET password_hash = ? WHERE id = ?", [$hash, $id]);
        AuditLogger::log('user_password_reset', Auth::isLoggedIn() ? Auth::userId() : null, $id, []);
    }

    public static function delete(int $id): void {
        $existing = self::findById($id);
        if (!$existing) {
            return;
        }

        if (Auth::isLoggedIn() && $id === Auth::userId()) {
            throw new Exception("Không thể xóa tài khoản của chính bạn");
        }

        if ($existing['role'] === 'admin') {
            $adminCount = (int)DB::query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
            if ($adminCount <= 1) {
                throw new Exception("Hệ thống phải có ít nhất 1 Quản Trị Viên hoạt động");
            }
        }

        DB::run("DELETE FROM users WHERE id = ?", [$id]);
        AuditLogger::log('user_delete', Auth::isLoggedIn() ? Auth::userId() : null, $id, [
            'username' => $existing['username']
        ]);
    }
}
