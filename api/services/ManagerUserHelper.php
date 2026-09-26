<?php
/**
 * api/services/ManagerUserHelper.php
 * Trợ thủ xử lý nghiệp vụ quản trị người dùng, phân quyền và tài khoản cho ManagerService
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/UserService.php';

class ManagerUserHelper {

    /**
     * Quản lý danh sách thành viên cho Admin & Ban Hát
     */
    public static function getUsersList(): array {
        $pdo = DB::get();
        return $pdo->query("
            SELECT u.id, u.username, u.role, u.display_name, u.instrument, u.chord_code, u.voice_part, u.avatar_url, u.status, u.created_at,
                   COUNT(DISTINCT cs.id) as chord_sets_count,
                   COUNT(DISTINCT sv.id) as versions_count
            FROM users u
            LEFT JOIN user_chord_sets cs ON u.id = cs.user_id
            LEFT JOIN song_versions sv ON u.id = sv.user_id
            GROUP BY u.id
            ORDER BY u.created_at ASC
        ")->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Thao tác quản trị tài khoản người dùng (Admin Only)
     */
    public static function manageUser(string $action, array $data): array {
        Auth::requireAdmin();
        $pdo = DB::get();

        switch ($action) {
            case 'create':
                $username    = trim($data['username'] ?? '');
                $password    = $data['password'] ?? '';
                $role        = $data['role'] ?? 'banhat';
                $displayName = trim($data['display_name'] ?? $username);
                $instrument  = trim($data['instrument'] ?? 'Guitar');
                $chordCode   = strtoupper(trim($data['chord_code'] ?? ''));
                $voicePart   = !empty($data['voice_part']) ? strtoupper(trim($data['voice_part'])) : null;
                if ($voicePart !== null && !in_array($voicePart, ['S', 'A', 'T', 'B', 'INSTR'], true)) {
                    $voicePart = null;
                }

                if (!$username || !$password) {
                    return ['success' => false, 'message' => 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu'];
                }
                if (strlen($password) < 4) {
                    return ['success' => false, 'message' => 'Mật khẩu phải có ít nhất 4 ký tự'];
                }
                if (UserService::isWeakPassword($password, $username)) {
                    return ['success' => false, 'message' => 'Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn'];
                }
                if (!in_array($role, ['viewer', 'banhat', 'leader', 'admin'], true)) {
                    return ['success' => false, 'message' => 'Quyền người dùng không hợp lệ'];
                }
                if (empty($chordCode)) {
                    $chordCode = strtoupper(substr($username, 0, 4));
                }

                $check = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
                $check->execute([$username]);
                if ($check->fetchColumn() > 0) {
                    return ['success' => false, 'message' => 'Tên đăng nhập này đã tồn tại'];
                }

                $hash = password_hash($password, PASSWORD_DEFAULT);
                $ins = $pdo->prepare("INSERT INTO users (username, password_hash, role, display_name, instrument, chord_code, voice_part) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $ins->execute([$username, $hash, $role, $displayName, $instrument, $chordCode, $voicePart]);
                $newId = (int)$pdo->lastInsertId();

                AuditLogger::log('user_create', Auth::userId(), $newId, [
                    'username'   => $username,
                    'role'       => $role,
                    'chord_code' => $chordCode,
                    'instrument' => $instrument,
                    'voice_part' => $voicePart
                ]);

                return ['success' => true, 'id' => $newId, 'chord_code' => $chordCode, 'message' => "Đã tạo tài khoản @{$username} thành công!"];

            case 'update_profile':
            case 'update':
                $userId = (int)($data['user_id'] ?? 0);
                if (!$userId) return ['success' => false, 'message' => 'Thiếu user_id'];

                $checkTarget = $pdo->prepare("SELECT * FROM users WHERE id = ?");
                $checkTarget->execute([$userId]);
                $target = $checkTarget->fetch(PDO::FETCH_ASSOC);
                if (!$target) return ['success' => false, 'message' => 'Không tìm thấy người dùng'];

                $displayName  = isset($data['display_name']) ? trim($data['display_name']) : $target['display_name'];
                $instrument   = isset($data['instrument']) ? trim($data['instrument']) : $target['instrument'];
                $chordCode    = isset($data['chord_code']) ? strtoupper(trim($data['chord_code'])) : ($target['chord_code'] ?? '');
                $newRole      = isset($data['role']) ? trim($data['role']) : $target['role'];
                $newPass      = !empty($data['password']) ? $data['password'] : null;
                $newVoicePart = isset($data['voice_part'])
                    ? (!empty($data['voice_part']) ? strtoupper(trim($data['voice_part'])) : null)
                    : ($target['voice_part'] ?? null);
                if ($newVoicePart !== null && !in_array($newVoicePart, ['S', 'A', 'T', 'B', 'INSTR'], true)) {
                    $newVoicePart = null;
                }

                if (!in_array($newRole, ['viewer', 'banhat', 'leader', 'admin'], true)) {
                    return ['success' => false, 'message' => 'Quyền người dùng không hợp lệ'];
                }

                // Chặn tự hạ quyền admin của chính mình
                if ($userId === Auth::userId() && $newRole !== 'admin') {
                    return ['success' => false, 'message' => 'Không thể tự hạ quyền Admin của chính bạn'];
                }

                // Bảo vệ không thể hạ admin cuối cùng
                if ($target['role'] === 'admin' && $newRole !== 'admin') {
                    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
                    if ($adminCount <= 1) {
                        return ['success' => false, 'message' => 'Không thể hạ quyền: Hệ thống phải có ít nhất 1 Quản Trị Viên hoạt động!'];
                    }
                }

                if ($newPass) {
                    if (strlen($newPass) < 10) {
                        return ['success' => false, 'message' => 'Mật khẩu phải có ít nhất 10 ký tự'];
                    }
                    if (UserService::isWeakPassword($newPass, $target['username'] ?? '')) {
                        return ['success' => false, 'message' => 'Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn'];
                    }
                    $hash = password_hash($newPass, PASSWORD_DEFAULT);
                    $upd = $pdo->prepare("UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ?, voice_part = ?, password_hash = ? WHERE id = ?");
                    $upd->execute([$displayName, $instrument, $chordCode, $newRole, $newVoicePart, $hash, $userId]);
                } else {
                    $upd = $pdo->prepare("UPDATE users SET display_name = ?, instrument = ?, chord_code = ?, role = ?, voice_part = ? WHERE id = ?");
                    $upd->execute([$displayName, $instrument, $chordCode, $newRole, $newVoicePart, $userId]);
                }

                AuditLogger::log('user_profile_update', Auth::userId(), $userId, [
                    'display_name'     => $displayName,
                    'instrument'       => $instrument,
                    'chord_code'       => $chordCode,
                    'role'             => $newRole,
                    'voice_part'       => $newVoicePart,
                    'password_changed' => !empty($newPass)
                ]);

                return ['success' => true, 'message' => 'Đã cập nhật thông tin thành viên thành công!'];

            case 'update_role':
                $userId = (int)($data['user_id'] ?? 0);
                $role = $data['role'] ?? 'banhat';
                if (!$userId) return ['success' => false, 'message' => 'Thiếu user_id'];
                if (!in_array($role, ['viewer', 'banhat', 'leader', 'admin'], true)) {
                    return ['success' => false, 'message' => 'Quyền người dùng không hợp lệ'];
                }

                // Chặn tự hạ quyền admin của chính mình
                if ($userId === Auth::userId() && $role !== 'admin') {
                    return ['success' => false, 'message' => 'Không thể tự hạ quyền Admin của chính bạn'];
                }

                // Đảm bảo hệ thống luôn còn ít nhất 1 admin hoạt động
                $checkTarget = $pdo->prepare("SELECT role, status FROM users WHERE id = ?");
                $checkTarget->execute([$userId]);
                $target = $checkTarget->fetch(PDO::FETCH_ASSOC);
                if (!$target) return ['success' => false, 'message' => 'Không tìm thấy người dùng'];

                if ($target['role'] === 'admin' && $role !== 'admin') {
                    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
                    if ($adminCount <= 1) {
                        return ['success' => false, 'message' => 'Không thể hạ quyền: Hệ thống phải có ít nhất 1 Quản Trị Viên hoạt động!'];
                    }
                }

                $upd = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
                $upd->execute([$role, $userId]);

                AuditLogger::log('user_role_change', Auth::userId(), $userId, [
                    'old_role' => $target['role'],
                    'new_role' => $role
                ]);

                return ['success' => true, 'message' => 'Đã cập nhật vai trò người dùng'];

            case 'reset_password':
                $userId = (int)($data['user_id'] ?? 0);
                $newPass = $data['new_password'] ?? '';
                if (!$userId || !$newPass) return ['success' => false, 'message' => 'Thiếu tham số'];

                if (strlen($newPass) < 10) {
                    return ['success' => false, 'message' => 'Mật khẩu phải có ít nhất 10 ký tự'];
                }

                $checkUser = $pdo->prepare("SELECT username FROM users WHERE id = ?");
                $checkUser->execute([$userId]);
                $target = $checkUser->fetch(PDO::FETCH_ASSOC);
                $targetUsername = $target ? ($target['username'] ?? '') : '';

                if (UserService::isWeakPassword($newPass, $targetUsername)) {
                    return ['success' => false, 'message' => 'Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn'];
                }

                $hash = password_hash($newPass, PASSWORD_DEFAULT);
                $upd = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $upd->execute([$hash, $userId]);

                AuditLogger::log('user_password_reset', Auth::userId(), $userId, []);

                return ['success' => true, 'message' => 'Đã đặt lại mật khẩu mới thành công'];

            case 'delete':
                $userId = (int)($data['user_id'] ?? 0);
                if (!$userId || $userId === Auth::userId()) {
                    return ['success' => false, 'message' => 'Không thể xóa tài khoản của chính bạn'];
                }

                $checkTarget = $pdo->prepare("SELECT username, role FROM users WHERE id = ?");
                $checkTarget->execute([$userId]);
                $target = $checkTarget->fetch(PDO::FETCH_ASSOC);
                if (!$target) return ['success' => false, 'message' => 'Không tìm thấy người dùng'];

                if ($target['role'] === 'admin') {
                    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
                    if ($adminCount <= 1) {
                        return ['success' => false, 'message' => 'Không thể xóa Quản Trị Viên duy nhất của hệ thống!'];
                    }
                }

                $del = $pdo->prepare("DELETE FROM users WHERE id = ?");
                $del->execute([$userId]);

                AuditLogger::log('user_delete', Auth::userId(), $userId, [
                    'username' => $target['username']
                ]);

                return ['success' => true, 'message' => 'Đã xóa tài khoản'];

            case 'toggle_status':
                $userId = (int)($data['user_id'] ?? 0);
                if (!$userId || $userId === Auth::userId()) {
                    return ['success' => false, 'message' => 'Không thể khóa tài khoản của chính bạn'];
                }
                $currStatus = $pdo->prepare("SELECT role, status FROM users WHERE id = ?");
                $currStatus->execute([$userId]);
                $target = $currStatus->fetch(PDO::FETCH_ASSOC);
                if (!$target) return ['success' => false, 'message' => 'Không tìm thấy người dùng'];

                $newStatus = ($target['status'] === 'locked') ? 'active' : 'locked';
                if ($newStatus === 'locked' && $target['role'] === 'admin') {
                    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
                    if ($adminCount <= 1) {
                        return ['success' => false, 'message' => 'Không thể khóa Quản Trị Viên hoạt động duy nhất!'];
                    }
                }

                $upd = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
                $upd->execute([$newStatus, $userId]);

                AuditLogger::log('user_status_toggle', Auth::userId(), $userId, [
                    'new_status' => $newStatus
                ]);

                return ['success' => true, 'status' => $newStatus, 'message' => $newStatus === 'locked' ? 'Đã khóa tài khoản' : 'Đã kích hoạt lại tài khoản'];

            default:
                return ['success' => false, 'message' => 'Action không hợp lệ'];
        }
    }
}
