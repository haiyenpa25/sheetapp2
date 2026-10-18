<?php
/**
 * api/core/Auth.php — Session auth helpers
 *
 * Roles:
 *  viewer  — khách (guest): chỉ xem bài public, không sửa (mặc định khi chưa đăng nhập)
 *  banhat  — ban hát: xem bài public & nội bộ, luyện bè SATB, ghi chú tập luyện
 *  bannhac — ban nhạc: nhạc công, thêm/sửa bộ hợp âm cá nhân, đề xuất HD, setlist
 *  leader  — ca trưởng: quản lý chương trình, duyệt hợp âm
 *  admin   — quản trị viên: toàn quyền quản trị tài khoản & upload bài hát XML (public/private)
 */
class Auth {
    public const VALID_ROLES = ['viewer', 'banhat', 'bannhac', 'leader', 'admin'];
    private static bool $dbChecked = false;

    public static function normalizeRole(string $role): string {
        $r = strtolower(trim($role));
        if ($r === 'guest') return 'viewer';
        return $r;
    }

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

    /** Ban Nhạc, Ca Trưởng hoặc Admin */
    public static function isBannhac(): bool {
        self::checkDb();
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['bannhac', 'leader', 'admin'], true);
    }

    /** Thành viên Ban Hát, Ban Nhạc, Ca Trưởng hoặc Admin */
    public static function isBanhat(): bool {
        self::checkDb();
        return isset($_SESSION['role']) && in_array($_SESSION['role'], ['banhat', 'bannhac', 'leader', 'admin'], true);
    }

    /** Kiểm tra quyền xem một bài hát dựa theo visibility / is_public */
    public static function canViewSong(array $song): bool {
        if (self::isAdmin()) {
            return true;
        }
        $visibility = strtolower((string)($song['visibility'] ?? 'public'));
        $isPublic = isset($song['is_public']) ? (int)$song['is_public'] : ($visibility === 'public' ? 1 : 0);

        if ($visibility === 'admin_only') {
            return false;
        }
        if ($isPublic === 0 || $visibility === 'private' || $visibility === 'internal') {
            return self::isBanhat();
        }
        return true;
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

    /** Yêu cầu quyền Ban Nhạc, Ca Trưởng hoặc Admin */
    public static function requireBannhac(): void {
        if (!self::isBannhac()) {
            Response::abort(403, 'Cần quyền Ban Nhạc để thực hiện');
        }
    }

    /** Yêu cầu ít nhất là thành viên Ban Hát / Ban Nhạc */
    public static function requireBanhat(): void {
        if (!self::isBanhat()) {
            Response::abort(403, 'Cần quyền Ban Hát hoặc Ban Nhạc để thực hiện');
        }
    }

    public static function requireLogin(): void {
        if (!self::isLoggedIn()) {
            Response::abort(401, 'Cần đăng nhập');
        }
    }
}
