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

    /** Mọi HT (admin hệ thống) kèm số thành viên hoạt động / chờ duyệt. */
    public static function listAll(): array {
        if (!self::isReady()) return [];
        return DB::run(
            "SELECT c.id, c.name, c.slug, c.status,
                    (SELECT COUNT(*) FROM church_members m WHERE m.church_id = c.id AND m.status = 'active')  AS active_members,
                    (SELECT COUNT(*) FROM church_members m WHERE m.church_id = c.id AND m.status = 'pending') AS pending_members
               FROM churches c ORDER BY c.id"
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function members(int $churchId): array {
        if (!self::isReady()) return [];
        return DB::run(
            "SELECT m.user_id, u.username, u.display_name, m.role, m.status, m.joined_at
               FROM church_members m JOIN users u ON u.id = m.user_id
              WHERE m.church_id = ?
              ORDER BY CASE m.status WHEN 'pending' THEN 0 ELSE 1 END, u.username",
            [$churchId]
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function create(string $name): array {
        $name = self::validName($name);
        DB::run('INSERT INTO churches (name, slug, invite_code) VALUES (?, ?, ?)', [$name, self::uniqueSlug($name), self::generateInviteCode()]);
        return self::find((int)DB::get()->lastInsertId());
    }

    public static function rename(int $churchId, string $name): void {
        DB::run('UPDATE churches SET name = ? WHERE id = ?', [self::validName($name), $churchId]);
    }

    public static function regenerateInviteCode(int $churchId): string {
        $code = self::generateInviteCode();
        DB::run('UPDATE churches SET invite_code = ? WHERE id = ?', [$code, $churchId]);
        return $code;
    }

    /** Vào HT bằng mã mời: tạo thành viên "chờ duyệt". Trả trạng thái hiện tại của người dùng trong HT. */
    public static function join(int $userId, string $code): array {
        $code = strtoupper(trim($code));
        $church = $code === '' ? false : DB::run("SELECT id, name FROM churches WHERE invite_code = ? AND status = 'active'", [$code])->fetch(PDO::FETCH_ASSOC);
        if (!$church) throw new InvalidArgumentException('Mã mời không đúng');
        $churchId = (int)$church['id'];
        $row = DB::run('SELECT status FROM church_members WHERE church_id = ? AND user_id = ?', [$churchId, $userId])->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            DB::run('INSERT INTO church_members (church_id, user_id, role, status) VALUES (?, ?, ?, ?)', [$churchId, $userId, self::ROLE_VIEWER, self::STATUS_PENDING]);
            return ['church_id' => $churchId, 'name' => $church['name'], 'status' => self::STATUS_PENDING];
        }
        // Người đã bị khóa không tự mở lại bằng mã mời; chờ duyệt/hoạt động giữ nguyên.
        if ($row['status'] === self::STATUS_DISABLED) throw new InvalidArgumentException('Tài khoản đã bị khóa trong Hội Thánh này, hãy liên hệ quản trị Hội Thánh');
        return ['church_id' => $churchId, 'name' => $church['name'], 'status' => $row['status']];
    }

    /** Duyệt / đổi vai trò / khóa thành viên. Không bỏ được admin HT cuối cùng. */
    public static function updateMember(int $churchId, int $userId, ?string $role, ?string $status): void {
        if ($role !== null && !in_array($role, self::ROLES, true)) throw new InvalidArgumentException('Vai trò không hợp lệ');
        if ($status !== null && !in_array($status, [self::STATUS_ACTIVE, self::STATUS_DISABLED], true)) throw new InvalidArgumentException('Trạng thái không hợp lệ');
        $cur = DB::run('SELECT role, status FROM church_members WHERE church_id = ? AND user_id = ?', [$churchId, $userId])->fetch(PDO::FETCH_ASSOC);
        if (!$cur) throw new InvalidArgumentException('Không có thành viên này trong Hội Thánh');
        $newRole = $role ?? $cur['role'];
        $newStatus = $status ?? $cur['status'];
        $wasAdmin = $cur['role'] === self::ROLE_ADMIN && $cur['status'] === self::STATUS_ACTIVE;
        $stillAdmin = $newRole === self::ROLE_ADMIN && $newStatus === self::STATUS_ACTIVE;
        if ($wasAdmin && !$stillAdmin && self::activeAdminCount($churchId) <= 1) {
            throw new DomainException('Hội Thánh phải còn ít nhất một quản trị viên');
        }
        DB::run('UPDATE church_members SET role = ?, status = ? WHERE church_id = ? AND user_id = ?', [$newRole, $newStatus, $churchId, $userId]);
    }

    private static function validName(string $name): string {
        $name = trim($name);
        if ($name === '' || mb_strlen($name) > 80) throw new InvalidArgumentException('Tên Hội Thánh không hợp lệ (1–80 ký tự)');
        return $name;
    }

    private static function uniqueSlug(string $name): string {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', str_replace(['đ', 'Đ'], ['d', 'D'], $name)) ?: '';
        $base = trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)), '-');
        if ($base === '') $base = 'ht';
        $slug = $base;
        while (DB::run('SELECT 1 FROM churches WHERE slug = ?', [$slug])->fetchColumn()) {
            $slug = $base . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
        }
        return $slug;
    }
}
