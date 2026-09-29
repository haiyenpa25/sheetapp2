<?php
/**
 * api/controllers/AuthController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/LoginRateLimiter.php';
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

                $rateKey = LoginRateLimiter::key($_SERVER['REMOTE_ADDR'] ?? 'unknown', $username);
                if (LoginRateLimiter::isBlocked($rateKey)) {
                    Response::error('Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.', 429);
                    return;
                }

                $user = UserService::findByUsername($username);
                if ($user && ($user['status'] ?? 'active') !== 'active') {
                    Response::error('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.', 403);
                    return;
                }
                if ($user && password_verify($password, $user['password_hash'])) {
                    LoginRateLimiter::clear($rateKey);
                    session_regenerate_id(true);
                    $mustChange = UserService::isWeakPassword($password, $user['username']);
                    $_SESSION['user_id']              = $user['id'];
                    $_SESSION['username']             = $user['username'];
                    $_SESSION['role']                 = $user['role'];
                    $_SESSION['display_name']         = $user['display_name'] ?? $user['username'];
                    $_SESSION['instrument']           = $user['instrument'] ?? 'Guitar';
                    $_SESSION['chord_code']           = $user['chord_code'] ?? '';
                    $_SESSION['voice_part']           = $user['voice_part'] ?? null;
                    $_SESSION['must_change_password'] = $mustChange;

                    Response::ok([
                        'user_id'              => $user['id'],
                        'role'                 => $user['role'],
                        'username'             => $user['username'],
                        'display_name'         => $user['display_name'] ?? $user['username'],
                        'instrument'           => $user['instrument'] ?? 'Guitar',
                        'chord_code'           => $user['chord_code'] ?? '',
                        'voice_part'           => $user['voice_part'] ?? null,
                        'must_change_password' => $mustChange,
                        'message'              => 'Đăng nhập thành công!'
                    ]);
                } else {
                    LoginRateLimiter::recordFailure($rateKey);
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
                if (strlen($password) < 10) {
                    Response::error('Mật khẩu phải có ít nhất 10 ký tự');
                    return;
                }
                if (UserService::isWeakPassword($password, $username)) {
                    Response::error('Mật khẩu quá yếu hoặc dễ đoán, vui lòng chọn mật khẩu mạnh hơn');
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
                    // Tài khoản tự đăng ký chỉ có quyền xem; admin chủ động nâng quyền khi cần.
                    $chordCode = strtoupper(substr($username, 0, 4));
                    $newId = UserService::createWithProfile($username, $password, 'viewer', $displayName, $instrument, $chordCode);
                    session_regenerate_id(true);
                    $_SESSION['user_id']              = $newId;
                    $_SESSION['username']             = $username;
                    $_SESSION['role']                 = 'viewer';
                    $_SESSION['display_name']         = $displayName;
                    $_SESSION['instrument']           = $instrument;
                    $_SESSION['chord_code']           = $chordCode;
                    $_SESSION['must_change_password'] = false;

                    Response::ok([
                        'user_id'              => $newId,
                        'username'             => $username,
                        'display_name'         => $displayName,
                        'role'                 => 'viewer',
                        'instrument'           => $instrument,
                        'chord_code'           => $chordCode,
                        'must_change_password' => false,
                        'message'              => "Đăng ký tài khoản @{$username} thành công!"
                    ]);
                } catch (Throwable $e) {
                    Response::serverError($e, 'Registration');
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
                    if (!empty($newPass)) {
                        $_SESSION['must_change_password'] = false;
                    }
                    Response::ok(array_merge($updatedUser, [
                        'must_change_password' => !empty($_SESSION['must_change_password']),
                        'message' => 'Cập nhật thông tin tài khoản thành công!'
                    ]));
                } catch (HttpException $e) {
                    Response::error($e->getMessage(), $e->getStatusCode());
                } catch (Throwable $e) {
                    Response::error($e->getMessage(), 400);
                }
                break;

            case 'logout':
                $_SESSION = [];
                if (ini_get('session.use_cookies')) {
                    $params = session_get_cookie_params();
                    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
                }
                session_destroy();
                Response::ok(['message' => 'Đã đăng xuất']);
                break;

            case 'me':
                if (Auth::isLoggedIn()) {
                    $u = UserService::findByUsername(Auth::username());
                    $chordCode = $u['chord_code'] ?? ($_SESSION['chord_code'] ?? '');
                    $_SESSION['chord_code'] = $chordCode;
                    $_SESSION['voice_part'] = $u['voice_part'] ?? null;
                    Response::ok([
                        'loggedIn'             => true,
                        'user_id'              => Auth::userId(),
                        'username'             => Auth::username(),
                        'role'                 => $_SESSION['role'] ?? 'viewer',
                        'display_name'         => $u['display_name'] ?? Auth::username(),
                        'instrument'           => $u['instrument'] ?? 'Guitar',
                        'chord_code'           => $chordCode,
                        'voice_part'           => $u['voice_part'] ?? null,
                        'must_change_password' => !empty($_SESSION['must_change_password'])
                    ]);
                } else {
                    Response::ok(['loggedIn' => false, 'role' => 'viewer', 'voice_part' => null, 'must_change_password' => false]);
                }
                break;

            default:
                Response::error('Invalid action');
        }
    }
}
