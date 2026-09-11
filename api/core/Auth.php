<?php
/**
 * api/core/Auth.php — Session auth helpers
 *
 * Roles:
 *  viewer  — chỉ xem, không sửa (mặc định khi chưa đăng nhập)
 *  banhat  — ban hát: thêm/sửa hợp âm cá nhân
 *  admin   — toàn quyền
 */
class Auth {
    public static function isAdmin(): bool {
        return isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
    }

    /** Ban hát hoặc Admin đều có quyền thêm/sửa hợp âm */
    public static function isBanhat(): bool {
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['banhat', 'admin']);
    }

    public static function isLoggedIn(): bool {
        return isset($_SESSION['user_id']);
    }

    public static function userId(): ?int {
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    public static function username(): string {
        return $_SESSION['username'] ?? '';
    }

    public static function role(): string {
        return $_SESSION['role'] ?? 'viewer';
    }

    public static function chordCode(): string {
        return $_SESSION['chord_code'] ?? '';
    }

    public static function requireAdmin(): void {
        if (!self::isAdmin()) {
            Response::forbidden('Chỉ Admin mới có quyền thực hiện');
            exit;
        }
    }

    /** Yêu cầu ít nhất là Ban Hát */
    public static function requireBanhat(): void {
        if (!self::isBanhat()) {
            Response::forbidden('Cần quyền Ban Hát để thực hiện');
            exit;
        }
    }

    public static function requireLogin(): void {
        if (!self::isLoggedIn()) {
            Response::forbidden('Cần đăng nhập');
            exit;
        }
    }
}
