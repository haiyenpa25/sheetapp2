<?php
/**
 * api/core/AuthPolicy.php — Ma trận quyền tập trung (RBAC Policy Matrix)
 *
 * Quản lý quyền hạn cho các vai trò trong hệ sinh thái SheetApp2:
 *  - viewer : Chỉ xem, không sửa, không xuất dữ liệu nhạy cảm
 *  - banhat : Thành viên ban hát / nhạc công: xem, sửa hợp âm cá nhân, luyện tập
 *  - leader : Ca Trưởng: giao bài, duyệt hợp âm, xem tiến độ tập ca đoàn
 *  - admin  : Quản trị viên: toàn quyền quản trị hệ thống, người dùng, cấu hình
 */

declare(strict_types=1);

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Response.php';

class AuthPolicy {
    /**
     * Ma trận ánh xạ quyền hạn (capability) -> các role được phép
     */
    private const MATRIX = [
        'view_songs' => [
            'viewer',
            'banhat',
            'leader',
            'admin',
        ],
        'edit_songs' => [
            'banhat',
            'leader',
            'admin',
        ],
        'assign_practice' => [
            'leader',
            'admin',
        ],
        'review_chord_set' => [
            'leader',
            'admin',
        ],
        'view_team_progress' => [
            'leader',
            'admin',
        ],
        'manage_users' => [
            'admin',
        ],
    ];

    /**
     * Kiểm tra xem một vai trò có quyền hạn cụ thể hay không
     */
    public static function can(string $role, string $capability): bool {
        $allowed = self::MATRIX[$capability] ?? [];
        return in_array($role, $allowed, true);
    }

    /**
     * Yêu cầu người dùng hiện tại trong phiên phải có quyền hạn mong muốn.
     * Nếu không đủ quyền, trả về HTTP 403 Forbidden và dừng xử lý.
     */
    public static function authorize(string $capability): void {
        Auth::requireLogin();
        $role = Auth::role();
        if (!self::can($role, $capability)) {
            Response::abort(403, "Bạn không có quyền thực hiện thao tác này ({$capability})");
        }
    }

    /**
     * Lấy toàn bộ ma trận quyền để frontend hoặc audit inspection tham chiếu
     */
    public static function getMatrix(): array {
        return self::MATRIX;
    }

    /**
     * Lấy danh sách các role được phép cho một capability
     */
    public static function getAllowedRoles(string $capability): array {
        return self::MATRIX[$capability] ?? [];
    }
}
