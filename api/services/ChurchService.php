<?php
declare(strict_types=1);

/**
 * api/services/ChurchService.php
 * Hội Thánh (HT) và thành viên theo HT. Business logic + DB, không biết HTTP.
 * Chạy an toàn khi chưa có migration 018 (trả rỗng / null thay vì lỗi).
 */
require_once __DIR__ . '/../core/DB.php';

final class ChurchService {
    public const ROLE_ADMIN  = 'church_admin';
    public const ROLE_LEADER = 'leader';
    public const ROLE_MEMBER = 'member';
    public const ROLE_VIEWER = 'viewer';
    public const ROLES = [self::ROLE_ADMIN, self::ROLE_LEADER, self::ROLE_MEMBER, self::ROLE_VIEWER];

    public const STATUS_ACTIVE   = 'active';
    public const STATUS_PENDING  = 'pending';
    public const STATUS_DISABLED = 'disabled';

    public const DEFAULT_SLUG = 'mac-dinh';
    private const INVITE_CODE_BYTES = 5;
    private const INVITE_CODE_LENGTH = 8;

    /** Vai trò trong HT → vai trò của ma trận AuthPolicy (quyền hiệu lực trong HT đó). */
    private const POLICY_ROLE = [
        self::ROLE_ADMIN  => 'leader',
        self::ROLE_LEADER => 'leader',
        self::ROLE_MEMBER => 'banhat',
        self::ROLE_VIEWER => 'viewer',
    ];

    public static function isReady(): bool {
        return DB::hasTable('churches') && DB::hasTable('church_members');
    }

    public static function defaultChurchId(): ?int {
        if (!self::isReady()) return null;
        $id = DB::run('SELECT id FROM churches WHERE slug = ?', [self::DEFAULT_SLUG])->fetchColumn();
        return $id ? (int)$id : null;
    }

    public static function find(int $churchId): ?array {
        if (!self::isReady()) return null;
        $row = DB::run('SELECT * FROM churches WHERE id = ?', [$churchId])->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /** Các HT mà người dùng là thành viên đang hoạt động. */
    public static function forUser(int $userId): array {
        if (!self::isReady()) return [];
        return DB::run(
            "SELECT c.id, c.name, c.slug, m.role
               FROM church_members m JOIN churches c ON c.id = m.church_id
              WHERE m.user_id = ? AND m.status = 'active' AND c.status = 'active'
              ORDER BY c.id",
            [$userId]
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function memberRole(int $userId, int $churchId): ?string {
        if (!self::isReady()) return null;
        $role = DB::run(
            "SELECT m.role FROM church_members m JOIN churches c ON c.id = m.church_id
              WHERE m.user_id = ? AND m.church_id = ? AND m.status = 'active' AND c.status = 'active'",
            [$userId, $churchId]
        )->fetchColumn();
        return $role === false ? null : (string)$role;
    }

    /** Quyền hiệu lực (vai trò AuthPolicy) của người dùng trong một HT; null nếu không phải thành viên. */
    public static function policyRole(int $userId, int $churchId): ?string {
        $role = self::memberRole($userId, $churchId);
        return $role === null ? null : (self::POLICY_ROLE[$role] ?? 'viewer');
    }

    /** HT đang làm việc: ưu tiên lựa chọn trong phiên (nếu còn là thành viên), nếu không HT đầu tiên của người dùng. */
    public static function activeChurchId(int $userId): ?int {
        $chosen = (int)($_SESSION['church_id'] ?? 0);
        if ($chosen > 0 && self::memberRole($userId, $chosen) !== null) return $chosen;
        $mine = self::forUser($userId);
        return $mine ? (int)$mine[0]['id'] : null;
    }

    public static function setActive(int $userId, int $churchId): bool {
        if (self::memberRole($userId, $churchId) === null) return false;
        $_SESSION['church_id'] = $churchId;
        return true;
    }

    public static function activeAdminCount(int $churchId): int {
        return (int)DB::run(
            "SELECT COUNT(*) FROM church_members WHERE church_id = ? AND role = ? AND status = 'active'",
            [$churchId, self::ROLE_ADMIN]
        )->fetchColumn();
    }

    public static function generateInviteCode(): string {
        return strtoupper(substr(bin2hex(random_bytes(self::INVITE_CODE_BYTES)), 0, self::INVITE_CODE_LENGTH));
    }
}
