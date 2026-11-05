<?php
declare(strict_types=1);

/**
 * api/core/ChurchAccessGuard.php
 *
 * Chốt chặn cô lập dữ liệu theo Hội Thánh (giống SongAccessGuard). Khi cờ MULTI_CHURCH TẮT mọi hàm xem trả true
 * (hành vi một HT như trước). Khi BẬT: chỉ admin hệ thống hoặc thành viên đang hoạt động của HT mới truy cập được.
 */
final class ChurchAccessGuard {
    public static function enabled(): bool {
        require_once __DIR__ . '/FeatureFlags.php';
        return FeatureFlags::isEnabled('MULTI_CHURCH');
    }

    public static function canAccessChurch(int $churchId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        if (!Auth::isLoggedIn()) return false;
        if (Auth::isAdmin()) return true;
        return ChurchService::memberRole((int)Auth::userId(), $churchId) !== null;
    }

    /** Quản lý thành viên/mã mời: admin hệ thống hoặc admin của chính HT đó. */
    public static function canManageChurch(int $churchId): bool {
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        if (!Auth::isLoggedIn()) return false;
        if (Auth::isAdmin()) return true;
        if (!self::enabled()) return false;
        return ChurchService::memberRole((int)Auth::userId(), $churchId) === ChurchService::ROLE_ADMIN;
    }

    /**
     * HT đang làm việc để LỌC danh sách: null = không lọc (cờ tắt, hoặc admin hệ thống chưa thuộc HT nào);
     * 0 = không có HT nào hợp lệ (khách / chưa là thành viên) → không thấy gì.
     */
    public static function currentChurchFilter(): ?int {
        if (!self::enabled()) return null;
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        if (!Auth::isLoggedIn()) return 0;
        $userId = (int)Auth::userId();
        $chosen = (int)($_SESSION['church_id'] ?? 0);
        if ($chosen > 0 && Auth::isAdmin() && ChurchService::find($chosen)) return $chosen; // admin chuyển HT tùy ý
        $active = ChurchService::activeChurchId($userId);
        if ($active !== null) return $active;
        return Auth::isAdmin() ? null : 0;
    }

    /** Mệnh đề SQL " AND <cột setlist_id> IN (...)" + tham số; rỗng khi không lọc. @return array{0:string,1:array} */
    public static function setlistScope(string $setlistIdColumn): array {
        $church = self::currentChurchFilter();
        if ($church === null) return ['', []];
        return [" AND {$setlistIdColumn} IN (SELECT id FROM setlists WHERE church_id = ?)", [$church]];
    }

    /** HT gán cho chương trình lễ mới: HT đang làm việc khi cờ bật; HT mặc định khi cờ tắt hoặc chưa chọn. */
    public static function churchForNewRecord(): ?int {
        require_once __DIR__ . '/../services/ChurchService.php';
        try {
            $church = self::currentChurchFilter();
            return ($church !== null && $church > 0) ? $church : ChurchService::defaultChurchId();
        } catch (Throwable $e) {
            return null; // DB chưa sẵn sàng (vd. phòng Live chỉ dùng file): để trống, sẽ gán sau
        }
    }

    /** Người được phân công/giao bài phải là thành viên hoạt động của HT sở hữu chương trình (cờ tắt: luôn true). */
    public static function userBelongsToSetlistChurch(int $setlistId, int $userId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        $churchId = (int)DB::run('SELECT church_id FROM setlists WHERE id = ?', [$setlistId])->fetchColumn()
            ?: (int)ChurchService::defaultChurchId();
        return ChurchService::memberRole($userId, $churchId) !== null;
    }

    /**
     * Quyền GHI theo vai trò trong HT (cờ tắt: luôn true; admin hệ thống luôn true).
     * leaderOnly: tạo/sửa/phát hành/xóa chương trình, phân công → cần quản trị HT hoặc Ca trưởng của HT đó.
     * Còn lại (thêm/sửa/xóa bài trong chương trình): thêm cả Thành viên; "Chỉ xem" không ghi được.
     * Đây là TRẦN quyền trong HT, cộng thêm (không thay) kiểm tra vai trò hệ thống ở controller.
     */
    public static function churchRoleAllows(int $churchId, bool $leaderOnly): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        if (!Auth::isLoggedIn()) return false;
        if (Auth::isAdmin()) return true;
        $role = ChurchService::memberRole((int)Auth::userId(), $churchId);
        $allowed = $leaderOnly
            ? [ChurchService::ROLE_ADMIN, ChurchService::ROLE_LEADER]
            : [ChurchService::ROLE_ADMIN, ChurchService::ROLE_LEADER, ChurchService::ROLE_MEMBER];
        return in_array($role, $allowed, true);
    }

    public static function canWriteSetlist(int $setlistId, bool $leaderOnly = false): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        $row = DB::run('SELECT church_id FROM setlists WHERE id = ?', [$setlistId])->fetch(PDO::FETCH_ASSOC);
        if (!$row) return true; // không tồn tại: để controller tự trả 404
        $churchId = (int)($row['church_id'] ?? 0) ?: (int)ChurchService::defaultChurchId();
        return self::churchRoleAllows($churchId, $leaderOnly);
    }

    public static function canWriteItem(int $itemId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        $setlistId = DB::run('SELECT setlist_id FROM setlist_items WHERE id = ?', [$itemId])->fetchColumn();
        return $setlistId === false ? true : self::canWriteSetlist((int)$setlistId);
    }

    /** Tạo chương trình mới trong HT đang làm việc (admin hệ thống chưa chọn HT: cho phép). */
    public static function canCreateInCurrentChurch(): bool {
        if (!self::enabled()) return true;
        $church = self::currentChurchFilter();
        if ($church === null) return true;
        return $church > 0 && self::churchRoleAllows($church, true);
    }

    /** Mã các HT người xem được vào (thành viên hoạt động). null = không giới hạn (cờ tắt / admin hệ thống). */
    public static function viewerChurchIds(): ?array {
        if (!self::enabled()) return null;
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        if (Auth::isAdmin()) return null;
        if (!Auth::isLoggedIn()) return [];
        return array_map(fn($c) => (int)$c['id'], ChurchService::forUser((int)Auth::userId()));
    }

    /** Danh mục riêng của một HT (church_id) có được người xem thấy không. NULL/0 = dùng chung. */
    public static function viewerMayViewChurchOwned(?int $churchId): bool {
        if (!$churchId) return true;
        $ids = self::viewerChurchIds();
        return $ids === null || in_array($churchId, $ids, true);
    }

    /** Điều kiện SQL "danh mục người xem được thấy" (alias bảng categories); rỗng khi không giới hạn. */
    public static function categoryChurchCond(string $alias = 'c'): string {
        require_once __DIR__ . '/DB.php';
        $ids = self::viewerChurchIds();
        if ($ids === null || !DB::hasColumn('categories', 'church_id')) return '';
        $list = $ids ? implode(',', $ids) : '0';
        return "{$alias}.church_id IS NULL OR {$alias}.church_id IN ({$list})";
    }

    public static function canAccessItem(int $itemId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        $setlistId = DB::run('SELECT setlist_id FROM setlist_items WHERE id = ?', [$itemId])->fetchColumn();
        return $setlistId === false ? true : self::canAccessSetlist((int)$setlistId);
    }

    public static function canAccessAssignment(int $assignmentId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        $setlistId = DB::run('SELECT setlist_id FROM service_plan_assignments WHERE id = ?', [$assignmentId])->fetchColumn();
        return $setlistId === false ? true : self::canAccessSetlist((int)$setlistId);
    }

    /** Chương trình lễ không có church_id (dữ liệu cũ chưa chuyển) coi như thuộc HT mặc định. */
    public static function canAccessSetlist(int $setlistId): bool {
        if (!self::enabled()) return true;
        require_once __DIR__ . '/DB.php';
        require_once __DIR__ . '/../services/ChurchService.php';
        $row = DB::run('SELECT church_id FROM setlists WHERE id = ?', [$setlistId])->fetch(PDO::FETCH_ASSOC);
        if (!$row) return true; // không tồn tại: để controller tự trả 404
        $churchId = (int)($row['church_id'] ?? 0) ?: (int)ChurchService::defaultChurchId();
        return self::canAccessChurch($churchId);
    }
}
