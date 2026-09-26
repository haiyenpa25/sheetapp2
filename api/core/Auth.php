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

    /** Ca Trưởng hoặc Admin */
    public static function isLeader(): bool {
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['leader', 'admin'], true);
    }

    /** Ban hát, Ca Trưởng hoặc Admin đều có quyền biểu diễn và sửa hợp âm */
    public static function isBanhat(): bool {
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['banhat', 'leader', 'admin'], true);
    }

    public static function isLoggedIn(): bool {
        return isset($_SESSION['user_id']);
    }

    public static function user(): ?array {
        if (!self::isLoggedIn()) {
            return null;
        }
        return [
            'id'           => self::userId(),
            'username'     => self::username(),
            'role'         => self::role(),
            'display_name' => $_SESSION['display_name'] ?? self::username(),
            'instrument'   => $_SESSION['instrument'] ?? 'guitar',
            'chord_code'   => self::chordCode(),
            'voice_part'   => $_SESSION['voice_part'] ?? null,
        ];
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

    /** Yêu cầu quyền Ca Trưởng hoặc Admin */
    public static function requireLeader(): void {
        if (!self::isLeader()) {
            Response::forbidden('Cần quyền Ca Trưởng để thực hiện');
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
            Response::unauthorized('Cần đăng nhập');
            exit;
        }
    }
}
