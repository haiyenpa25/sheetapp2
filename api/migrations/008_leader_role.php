<?php
/**
 * api/migrations/008_leader_role.php
 *
 * Migration cho Epic 4.0 — Nền tảng Giai đoạn 4 (Lát 4.0-a: Vai trò Ca Trưởng & Bè)
 * 1. Bổ sung cột voice_part (S/A/T/B/INSTR) vào bảng users
 * 2. Tạo chỉ mục tối ưu phân nhóm theo vai trò và bè hát: idx_users_role_voice
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Kiểm tra và bổ sung cột voice_part vào bảng users
    $userCols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $userColNames = array_column($userCols, 'name');

    if (!in_array('voice_part', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN voice_part TEXT NULL DEFAULT NULL");
    }

    // 2. Tạo chỉ mục hỗ trợ lọc danh sách ca đoàn theo bè và vai trò
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_role_voice ON users(role, voice_part)");
};
