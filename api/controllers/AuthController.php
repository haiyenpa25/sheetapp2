<?php
/**
 * api/controllers/AuthController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/UserService.php';

class AuthController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? '';

        switch ($action) {
            case 'login':
                $data     = json_decode(file_get_contents('php://input'), true) ?? [];
                $username = trim($data['username'] ?? '');
                $password = $data['password'] ?? '';
                if (!$username || !$password) { Response::error('Thiếu username/password'); return; }

                $user = UserService::findByUsername($username);
                if ($user && password_verify($password, $user['password_hash'])) {
                    $_SESSION['user_id']      = $user['id'];
                    $_SESSION['username']     = $user['username'];
                    $_SESSION['role']         = $user['role'];
                    $_SESSION['display_name'] = $user['display_name'] ?? $user['username'];
                    $_SESSION['instrument']   = $user['instrument'] ?? 'Guitar';

                    Response::ok([
                        'user_id'      => $user['id'],
                        'role'         => $user['role'],
                        'username'     => $user['username'],
                        'display_name' => $user['display_name'] ?? $user['username'],
                        'instrument'   => $user['instrument'] ?? 'Guitar'
                    ], 'Đăng nhập thành công!');
                } else {
                    Response::error('Sai tài khoản hoặc mật khẩu', 401);
                }
                break;

            case 'register':
                $data        = json_decode(file_get_contents('php://input'), true) ?? [];
                $username    = trim($data['username'] ?? '');
                $password    = $data['password'] ?? '';
                $displayName = trim($data['display_name'] ?? $username);
                $instrument  = trim($data['instrument'] ?? 'Guitar');

                if (!$username || !$password) {
                    Response::error('Vui lòng điền tên đăng nhập và mật khẩu');
                    return;
                }
                if (strlen($username) < 3) {
                    Response::error('Tên đăng nhập phải có ít nhất 3 ký tự');
                    return;
                }
                if (strlen($password) < 4) {
                    Response::error('Mật khẩu phải có ít nhất 4 ký tự');
                    return;
                }
                if (preg_match('/[^a-zA-Z0-9_\-]/', $username)) {
                    Response::error('Tên đăng nhập chỉ chứa chữ cái, số, gạch dưới và gạch ngang');
                    return;
                }

                $existing = UserService::findByUsername($username);
                if ($existing) {
                    Response::error('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.');
                    return;
                }

                try {
                    // Mặc định tài khoản tạo mới có quyền 'banhat' để được tạo và tùy biến hợp âm
                    $newId = UserService::createWithProfile($username, $password, 'banhat', $displayName, $instrument);
                    $_SESSION['user_id']      = $newId;
                    $_SESSION['username']     = $username;
                    $_SESSION['role']         = 'banhat';
                    $_SESSION['display_name'] = $displayName;
                    $_SESSION['instrument']   = $instrument;

                    Response::ok([
                        'user_id'      => $newId,
                        'username'     => $username,
                        'display_name' => $displayName,
                        'role'         => 'banhat',
                        'instrument'   => $instrument
                    ], "Đăng ký tài khoản @{$username} thành công!");
                } catch (Throwable $e) {
                    Response::error('Lỗi tạo tài khoản: ' . $e->getMessage(), 500);
                }
                break;

            case 'update_profile':
                Auth::requireLogin();
                $userId = Auth::userId();
                $data = json_decode(file_get_contents('php://input'), true) ?? [];

                $displayName = isset($data['display_name']) ? trim($data['display_name']) : null;
                $instrument  = isset($data['instrument']) ? trim($data['instrument']) : null;
                $currentPass = $data['current_password'] ?? '';
                $newPass     = $data['new_password'] ?? '';

                try {
                    $updatedUser = UserService::updateProfile($userId, $displayName, $instrument, $currentPass, $newPass);
                    if ($displayName !== null) $_SESSION['display_name'] = $displayName;
                    if ($instrument !== null) $_SESSION['instrument'] = $instrument;
                    Response::ok($updatedUser, 'Cập nhật thông tin tài khoản thành công!');
                } catch (Throwable $e) {
                    Response::error($e->getMessage(), 400);
                }
                break;

            case 'logout':
                session_destroy();
                Response::ok([], 'Đã đăng xuất');
                break;

            case 'me':
                if (Auth::isLoggedIn()) {
                    $u = UserService::findByUsername(Auth::username());
                    Response::ok([
                        'loggedIn'     => true,
                        'user_id'      => Auth::userId(),
                        'username'     => Auth::username(),
                        'role'         => $_SESSION['role'] ?? 'viewer',
                        'display_name' => $u['display_name'] ?? Auth::username(),
                        'instrument'   => $u['instrument'] ?? 'Guitar'
                    ]);
                } else {
                    Response::ok(['loggedIn' => false, 'role' => 'viewer']);
                }
                break;

            default:
                Response::error('Invalid action');
        }
    }
}
