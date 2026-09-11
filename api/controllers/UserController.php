<?php
/**
 * api/controllers/UserController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/UserService.php';

class UserController {
    public function handleRequest(string $method): void {
        try {
            switch ($method) {
                case 'GET':
                    // Cho phép thành viên và quản trị xem danh sách ban nhạc
                    Auth::requireBanhat();
                    Response::ok(['users' => UserService::getAll()]);
                    break;

                case 'POST':
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $username    = trim($body['username'] ?? '');
                    $password    = $body['password'] ?? '';
                    $role        = $body['role'] ?? 'banhat';
                    $displayName = trim($body['display_name'] ?? $username);
                    $instrument  = trim($body['instrument'] ?? 'Guitar');
                    $chordCode   = strtoupper(trim($body['chord_code'] ?? ''));

                    if (empty($username) || empty($password)) {
                        Response::error('Vui lòng nhập tên đăng nhập và mật khẩu.');
                        return;
                    }

                    // Tự động sinh mã hợp âm nếu để trống
                    if (empty($chordCode)) {
                        $chordCode = strtoupper(substr($username, 0, 4));
                    }

                    try {
                        $id = UserService::createWithProfile($username, $password, $role, $displayName, $instrument, $chordCode);
                        Response::ok(['id' => $id, 'chord_code' => $chordCode, 'message' => "Đã tạo tài khoản {$username} thành công!"]);
                    } catch (PDOException $e) {
                        if ($e->getCode() == 23000) {
                            Response::error('Tên đăng nhập này đã tồn tại.');
                        } else {
                            throw $e;
                        }
                    }
                    break;

                case 'PUT':
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $id          = (int)($body['id'] ?? 0);
                    $role        = $body['role'] ?? 'banhat';
                    $displayName = isset($body['display_name']) ? trim($body['display_name']) : null;
                    $instrument  = isset($body['instrument']) ? trim($body['instrument']) : null;
                    $chordCode   = isset($body['chord_code']) ? strtoupper(trim($body['chord_code'])) : null;
                    $password    = !empty($body['password']) ? $body['password'] : null;

                    if (!$id) {
                        Response::error('Thiếu ID người dùng');
                        return;
                    }

                    $existing = UserService::findById($id);
                    if (!$existing) {
                        Response::error('Không tìm thấy tài khoản người dùng');
                        return;
                    }

                    $dName = $displayName !== null ? $displayName : ($existing['display_name'] ?? $existing['username']);
                    $inst  = $instrument !== null ? $instrument : ($existing['instrument'] ?? 'Guitar');
                    $code  = $chordCode !== null ? $chordCode : ($existing['chord_code'] ?? '');

                    UserService::updateMusician($id, $dName, $inst, $code, $role, $password);
                    Response::ok(['message' => 'Đã cập nhật thông tin thành công!']);
                    break;

                case 'DELETE':
                    $id = (int)($_GET['id'] ?? 0);
                    if (!$id || $id === Auth::userId()) {
                        Response::error('Không thể xoá tài khoản này.');
                        return;
                    }

                    UserService::delete($id);
                    Response::ok();
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (Exception $e) {
            Response::error('Lỗi Server: ' . $e->getMessage(), 500);
        }
    }
}
