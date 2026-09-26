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
    private static bool $dbChecked = false;

    public static function resetDbCache(): void {
        self::$dbChecked = false;
    }

    private static function checkDb(): void {
        if (self::$dbChecked) {
            return;
        }
        self::$dbChecked = true;
        if (!isset($_SESSION['user_id'])) {
            return;
        }

        try {
            require_once __DIR__ . '/DB.php';
            $pdo = DB::get();
            $stmt = $pdo->prepare("SELECT role, status, chord_code, display_name FROM users WHERE id = ?");
            $stmt->execute([(int)$_SESSION['user_id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row || ($row['status'] ?? 'active') !== 'active') {
                $_SESSION = [];
                return;
            }
            $_SESSION['role'] = $row['role'];
            if (isset($row['chord_code'])) {
                $_SESSION['chord_code'] = $row['chord_code'];
            }
            if (!empty($row['display_name'])) {
                $_SESSION['display_name'] = $row['display_name'];
            }
        } catch (Throwable $e) {
            // Safe fallback during mock/test environments
        }
    }

    public static function isAdmin(): bool {
        self::checkDb();
        return isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
    }

    /** Ca Trưởng hoặc Admin */
    public static function isLeader(): bool {
        self::checkDb();
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['leader', 'admin'], true);
    }

    /** Ban hát, Ca Trưởng hoặc Admin đều có quyền biểu diễn và sửa hợp âm */
    public static function isBanhat(): bool {
        self::checkDb();
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['banhat', 'leader', 'admin'], true);
    }

    public static function isLoggedIn(): bool {
        self::checkDb();
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
        self::checkDb();
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    public static function username(): string {
        return $_SESSION['username'] ?? '';
    }

    public static function role(): string {
        self::checkDb();
        return $_SESSION['role'] ?? 'viewer';
    }

    public static function chordCode(): string {
        self::checkDb();
        return $_SESSION['chord_code'] ?? '';
    }

    public static function requireAdmin(): void {
        if (!self::isAdmin()) {
            Response::abort(403, 'Chỉ Admin mới có quyền thực hiện');
        }
    }

    /** Yêu cầu quyền Ca Trưởng hoặc Admin */
    public static function requireLeader(): void {
        if (!self::isLeader()) {
            Response::abort(403, 'Cần quyền Ca Trưởng để thực hiện');
        }
    }

    /** Yêu cầu ít nhất là Ban Hát */
    public static function requireBanhat(): void {
        if (!self::isBanhat()) {
            Response::abort(403, 'Cần quyền Ban Hát để thực hiện');
        }
    }

    public static function requireLogin(): void {
        if (!self::isLoggedIn()) {
            Response::abort(401, 'Cần đăng nhập');
        }
    }
}
