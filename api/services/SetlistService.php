<?php
/**
 * api/services/SetlistService.php
 *
 * Service Plan & Setlist Architecture (Epic 3.1):
 * - Quản lý chương trình buổi nhóm thờ phượng / phụng vụ (ngày, giờ, chủ đề, trạng thái).
 * - Quản lý bài hát, tiết mục phụng vụ, tông, BPM, profile hợp âm và ghi chú ban nhạc.
 * - Phân công nhân sự ban hát (ca trưởng, piano, guitar, trống, ca viên) & xác nhận tham gia.
 * - Theo dõi lịch sử sử dụng bài hát qua các buổi nhóm (Song Usage History).
 * - Nhật ký kiểm toán (Audit Trail) cho mọi thao tác quan trọng.
 * - Tương thích ngược 100% với cả môi trường kiểm thử schema tối giản.
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/DomainEventService.php';
require_once __DIR__ . '/SetlistUsageHelper.php';
require_once __DIR__ . '/SetlistOfflineHelper.php';

class SetlistService {
    private static function hasColumn(string $table, string $column): bool {
        try {
            $cols = DB::run("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($cols as $c) {
                if (strcasecmp($c['name'] ?? '', $column) === 0) {
                    return true;
                }
            }
        } catch (Throwable $e) {}
        return false;
    }

    private static function hasTable(string $table): bool {
        try {
            return (int)DB::run("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", [$table])->fetchColumn() > 0;
        } catch (Throwable $e) {}
        return false;
    }

    public static function isOwner(int $setlistId, int $userId): bool {
        return (int)DB::run("SELECT COUNT(*) FROM setlists WHERE id = ? AND created_by = ?", [$setlistId, $userId])->fetchColumn() > 0;
    }

    public static function isLeaderOrOwner(int $setlistId, int $userId): bool {
        if (self::hasColumn('setlists', 'leader_user_id')) {
            return (int)DB::run(
                "SELECT COUNT(*) FROM setlists WHERE id = ? AND (created_by = ? OR leader_user_id = ?)",
                [$setlistId, $userId, $userId]
            )->fetchColumn() > 0;
        }
        return self::isOwner($setlistId, $userId);
    }

    public static function isItemOwner(int $itemId, int $userId): bool {
        if (self::hasColumn('setlists', 'leader_user_id')) {
            return (int)DB::run(
                "SELECT COUNT(*) FROM setlist_items i JOIN setlists s ON s.id = i.setlist_id WHERE i.id = ? AND (s.created_by = ? OR s.leader_user_id = ?)",
                [$itemId, $userId, $userId]
            )->fetchColumn() > 0;
        }
        return (int)DB::run(
            "SELECT COUNT(*) FROM setlist_items i JOIN setlists s ON s.id = i.setlist_id WHERE i.id = ? AND s.created_by = ?",
            [$itemId, $userId]
        )->fetchColumn() > 0;
    }

    public static function isAssignmentOwner(int $assignmentId, int $userId): bool {
        if (!self::hasTable('service_plan_assignments')) return false;
        return (int)DB::run(
            "SELECT COUNT(*) FROM service_plan_assignments WHERE id = ? AND user_id = ?",
            [$assignmentId, $userId]
        )->fetchColumn() > 0;
    }

    /**
     * Lấy toàn bộ danh sách setlists / service plans kèm thống kê
     */
    public static function getAll(?int $currentUserId = null): array {
        if (self::hasTable('service_plan_assignments') && self::hasColumn('setlists', 'service_time')) {
            $sql = "
                SELECT s.*,
                       u.display_name AS creator_name,
                       l.display_name AS leader_name,
                       (SELECT COUNT(*) FROM setlist_items WHERE setlist_id = s.id) AS item_count,
                       (SELECT COUNT(*) FROM service_plan_assignments WHERE setlist_id = s.id) AS assignment_count,
                       (SELECT COUNT(*) FROM service_plan_assignments WHERE setlist_id = s.id AND status = 'confirmed') AS confirmed_count,
                       (SELECT status FROM service_plan_assignments WHERE setlist_id = s.id AND user_id = ?) AS my_assignment_status
                FROM setlists s
                LEFT JOIN users u ON u.id = s.created_by
                LEFT JOIN users l ON l.id = s.leader_user_id
                ORDER BY s.scheduled_date DESC, s.created_at DESC
            ";
            return DB::run($sql, [$currentUserId])->fetchAll(PDO::FETCH_ASSOC);
        }

        return DB::query("SELECT s.*, (SELECT COUNT(*) FROM setlist_items WHERE setlist_id = s.id) as item_count FROM setlists s ORDER BY s.created_at DESC");
    }

    /**
     * Lấy chi tiết 1 service plan: bài hát, phân công, trạng thái
     */
    public static function getById(int $id): ?array {
        $hasLeader = self::hasColumn('setlists', 'leader_user_id');
        $sql = $hasLeader
            ? "SELECT s.*, u.display_name AS creator_name, l.display_name AS leader_name FROM setlists s LEFT JOIN users u ON u.id = s.created_by LEFT JOIN users l ON l.id = s.leader_user_id WHERE s.id = ?"
            : "SELECT * FROM setlists WHERE id = ?";
        
        $setlist = DB::run($sql, [$id])->fetch(PDO::FETCH_ASSOC);
        if (!$setlist) return null;

        // Lấy danh sách bài hát & tiết mục phụng vụ
        $hasSongTable = self::hasTable('songs');
        $itemsSql = $hasSongTable
            ? "SELECT i.*, so.title AS song_title FROM setlist_items i LEFT JOIN songs so ON so.id = i.song_id WHERE i.setlist_id = ? ORDER BY i.display_order ASC"
            : "SELECT * FROM setlist_items WHERE setlist_id = ? ORDER BY display_order ASC";
        
        $items = DB::run($itemsSql, [$id])->fetchAll(PDO::FETCH_ASSOC);
        $setlist['items'] = $items;

        // Lấy danh sách phân công nhân sự
        $setlist['assignments'] = [];
        if (self::hasTable('service_plan_assignments') && self::hasTable('users')) {
            $assignSql = "
                SELECT a.*,
                       u.username,
                       u.display_name,
                       u.instrument,
                       u.chord_code,
                       u.role AS user_system_role
                FROM service_plan_assignments a
                JOIN users u ON u.id = a.user_id
                WHERE a.setlist_id = ?
                ORDER BY a.created_at ASC
            ";
            $setlist['assignments'] = DB::run($assignSql, [$id])->fetchAll(PDO::FETCH_ASSOC);
        }

        return $setlist;
    }

    /**
     * Tạo Service Plan mới (hỗ trợ cả chữ ký cũ lẫn mở rộng)
     */
    public static function create(string|array $titleOrData, string $date = '', ?int $userId = null, array $extra = []): int {
        if (is_array($titleOrData)) {
            $data = $titleOrData;
            $title = $data['title'] ?? 'Chương trình buổi nhóm';
            $date = $data['scheduled_date'] ?? date('Y-m-d');
            $userId = $userId ?? ($data['created_by'] ?? null);
            $time = $data['service_time'] ?? '08:30';
            $theme = $data['theme'] ?? null;
            $description = $data['description'] ?? null;
            $status = $data['status'] ?? 'draft';
            $leaderId = $data['leader_user_id'] ?? $userId;
        } else {
            $title = $titleOrData;
            $time = $extra['service_time'] ?? '08:30';
            $theme = $extra['theme'] ?? null;
            $description = $extra['description'] ?? null;
            $status = $extra['status'] ?? 'draft';
            $leaderId = $extra['leader_user_id'] ?? $userId;
        }

        if (self::hasColumn('setlists', 'service_time')) {
            DB::run(
                "INSERT INTO setlists (title, scheduled_date, service_time, theme, description, status, leader_user_id, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [$title, $date, $time, $theme, $description, $status, $leaderId, $userId]
            );
        } else {
            DB::run("INSERT INTO setlists (title, scheduled_date, created_by) VALUES (?, ?, ?)", [$title, $date, $userId]);
        }
        $newId = (int)DB::lastId();

        AuditLogger::log('service_plan_create', $userId, $newId, [
            'title' => $title,
            'scheduled_date' => $date,
            'status' => $status
        ]);

        return $newId;
    }

    /**
     * Cập nhật thông tin Service Plan
     */
    public static function update(int $id, array $data, ?int $actorId = null): bool {
        $allowed = ['title', 'scheduled_date', 'service_time', 'theme', 'description', 'status', 'leader_user_id'];
        $fields = [];
        $params = [];

        foreach ($allowed as $f) {
            if (array_key_exists($f, $data) && self::hasColumn('setlists', $f)) {
                $fields[] = "$f = ?";
                $params[] = $data[$f] !== '' && $data[$f] !== null ? $data[$f] : null;
            }
        }
        if (empty($fields)) return false;

        $params[] = $id;
        DB::run("UPDATE setlists SET " . implode(', ', $fields) . " WHERE id = ?", $params);

        // Nếu chuyển sang published hoặc completed, tự động ghi nhận lịch sử bài hát
        if (isset($data['status']) && in_array($data['status'], ['published', 'completed'], true)) {
            self::recordSongUsage($id);
        }

        AuditLogger::log('service_plan_update', $actorId, $id, $data);
        return true;
    }

    /**
     * Xóa Service Plan
     */
    public static function delete(int $id, ?int $actorId = null): void {
        AuditLogger::log('service_plan_delete', $actorId, $id, []);
        DB::run("DELETE FROM setlists WHERE id = ?", [$id]);
    }

    /**
     * Phát hành Service Plan cho toàn ban nhạc
     */
    public static function publish(int $id, ?int $actorId = null): bool {
        $res = self::update($id, ['status' => 'published'], $actorId);
        if ($res) {
            AuditLogger::log('service_plan_publish', $actorId, $id, ['status' => 'published']);
            $plan = self::getById($id);
            DomainEvents::record(
                'plan.published',
                $actorId,
                'setlist',
                (string)$id,
                ['title' => $plan['title'] ?? 'Chương trình Phụng vụ']
            );
        }
        return $res;
    }

    /* ─── Setlist Items Operations ─── */

    public static function addItem(
        int $setlistId,
        string $songId,
        string $chordProfile = 'HD',
        int $transposeKey = 0,
        ?int $bpm = null,
        ?int $beatsPerMeasure = null,
        array $extra = []
    ): int {
        $order = (int)DB::run("SELECT IFNULL(MAX(display_order), 0) + 1 FROM setlist_items WHERE setlist_id = ?", [$setlistId])->fetchColumn();
        $itemType = $extra['item_type'] ?? 'song';
        $customTitle = $extra['custom_title'] ?? null;
        $leaderNotes = $extra['leader_notes'] ?? null;
        $duration = isset($extra['duration_minutes']) ? (int)$extra['duration_minutes'] : 5;

        $selectedVerses = $extra['selected_verses'] ?? $extra['stanzas'] ?? null;

        if (self::hasColumn('setlist_items', 'selected_verses')) {
            DB::run(
                "INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile, transpose_key, bpm, beats_per_measure, item_type, custom_title, leader_notes, duration_minutes, selected_verses)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$setlistId, $songId, $order, $chordProfile, $transposeKey, $bpm, $beatsPerMeasure, $itemType, $customTitle, $leaderNotes, $duration, $selectedVerses]
            );
        } elseif (self::hasColumn('setlist_items', 'item_type')) {
            DB::run(
                "INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile, transpose_key, bpm, beats_per_measure, item_type, custom_title, leader_notes, duration_minutes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$setlistId, $songId, $order, $chordProfile, $transposeKey, $bpm, $beatsPerMeasure, $itemType, $customTitle, $leaderNotes, $duration]
            );
        } else {
            DB::run(
                "INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile, transpose_key, bpm, beats_per_measure) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [$setlistId, $songId, $order, $chordProfile, $transposeKey, $bpm, $beatsPerMeasure]
            );
        }
        return (int)DB::lastId();
    }

    public static function updateItem(int $itemId, array $data): bool {
        if (!isset($data['selected_verses']) && isset($data['stanzas'])) {
            $data['selected_verses'] = $data['stanzas'];
        }
        $allowed = ['chord_profile', 'transpose_key', 'bpm', 'beats_per_measure', 'display_order', 'item_type', 'custom_title', 'leader_notes', 'duration_minutes', 'selected_verses'];
        $fields = [];
        $params = [];

        foreach ($allowed as $f) {
            if (array_key_exists($f, $data) && self::hasColumn('setlist_items', $f)) {
                $fields[] = "$f = ?";
                $val = $data[$f];
                if (in_array($f, ['transpose_key', 'bpm', 'beats_per_measure', 'display_order', 'duration_minutes'], true)) {
                    $params[] = ($val !== '' && $val !== null) ? (int)$val : null;
                } else {
                    $params[] = ($val !== '' && $val !== null) ? (string)$val : null;
                }
            }
        }
        if (empty($fields)) return false;

        $params[] = $itemId;
        DB::run("UPDATE setlist_items SET " . implode(', ', $fields) . " WHERE id = ?", $params);
        return true;
    }

    public static function removeItem(int $itemId): void {
        DB::run("DELETE FROM setlist_items WHERE id = ?", [$itemId]);
    }

    /* ─── Team Assignments Operations ─── */

    public static function assignUser(int $setlistId, int $userId, string $role, ?string $notes = null, ?int $actorId = null): int {
        if (!self::hasTable('service_plan_assignments')) return 0;

        DB::run(
            "INSERT INTO service_plan_assignments (setlist_id, user_id, role, notes, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON CONFLICT(setlist_id, user_id, role) DO UPDATE SET
             notes = excluded.notes,
             status = 'pending',
             updated_at = CURRENT_TIMESTAMP",
            [$setlistId, $userId, $role, $notes]
        );
        $assignId = (int)DB::lastId();
        if ($assignId === 0) {
            $assignId = (int)DB::run(
                "SELECT id FROM service_plan_assignments WHERE setlist_id = ? AND user_id = ? AND role = ?",
                [$setlistId, $userId, $role]
            )->fetchColumn();
        }

        AuditLogger::log('assignment_create', $actorId, $setlistId, [
            'assignment_id' => $assignId,
            'user_id' => $userId,
            'role' => $role,
            'notes' => $notes
        ]);

        DomainEvents::record(
            'plan.role_assigned',
            $actorId,
            'assignment',
            (string)$assignId,
            [
                'setlist_id' => $setlistId,
                'user_id'    => $userId,
                'role'       => $role,
                'notes'      => $notes
            ]
        );

        return $assignId;
    }

    public static function removeAssignment(int $assignmentId, ?int $actorId = null): bool {
        if (!self::hasTable('service_plan_assignments')) return false;
        AuditLogger::log('assignment_delete', $actorId, $assignmentId, []);
        DB::run("DELETE FROM service_plan_assignments WHERE id = ?", [$assignmentId]);
        return true;
    }

    public static function respondAssignment(int $assignmentId, int $userId, string $status, ?string $notes = null): bool {
        if (!self::hasTable('service_plan_assignments')) return false;
        if (!in_array($status, ['confirmed', 'declined', 'pending'], true)) {
            return false;
        }

        $confirmedAt = ($status === 'confirmed') ? date('Y-m-d H:i:s') : null;
        DB::run(
            "UPDATE service_plan_assignments
             SET status = ?, notes = IFNULL(?, notes), confirmed_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?",
            [$status, $notes, $confirmedAt, $assignmentId, $userId]
        );

        AuditLogger::log('assignment_respond', $userId, $assignmentId, [
            'status' => $status,
            'notes' => $notes
        ]);

        return true;
    }

    public static function getAssignments(int $setlistId): array {
        if (!self::hasTable('service_plan_assignments') || !self::hasTable('users')) return [];
        $sql = "
            SELECT a.*,
                   u.username,
                   u.display_name,
                   u.instrument,
                   u.chord_code,
                   u.role AS user_system_role
            FROM service_plan_assignments a
            JOIN users u ON u.id = a.user_id
            WHERE a.setlist_id = ?
            ORDER BY a.created_at ASC
        ";
        return DB::run($sql, [$setlistId])->fetchAll(PDO::FETCH_ASSOC);
    }

    /* ─── Song Usage History Operations (Delegated to SetlistUsageHelper) ─── */
    public static function recordSongUsage(int $setlistId): int {
        return SetlistUsageHelper::recordSongUsage($setlistId);
    }

    public static function getSongUsageHistory(string $songId): array {
        return SetlistUsageHelper::getSongUsageHistory($songId);
    }

    public static function checkRecentUsage(string $songId, int $weeks = 4): array {
        return SetlistUsageHelper::checkRecentUsage($songId, $weeks);
    }

    public static function getUsageReport(?string $fromDate = null, ?string $toDate = null, int $limit = 20): array {
        return SetlistUsageHelper::getUsageReport($fromDate, $toDate, $limit);
    }

    /* ─── Offline Setlist Package Operations (Delegated to SetlistOfflineHelper) ─── */
    public static function getOfflinePackage(int $setlistId): ?array {
        return SetlistOfflineHelper::getOfflinePackage($setlistId);
    }
}

