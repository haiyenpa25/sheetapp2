<?php
/**
 * api/services/PracticeAssignmentService.php
 *
 * Dịch vụ Quản lý Giao bài & Tập bè cho Ca Đoàn (Epic 4.1):
 * - Tạo bài tập tự động từ Service Plan (không tạo trùng lặp).
 * - Tạo bài tập lẻ (ad-hoc) theo nhóm bè (voice_part) hoặc thành viên cụ thể.
 * - Danh sách "Bài tập của tôi" (My Assignments) cho từng ca viên.
 * - Bảng tiến độ ca đoàn (Team Board) với cơ chế bảo vệ quyền riêng tư (Privacy Guard D10).
 * - Ghi nhận tiến độ tập thật và tự động xét hoàn thành theo 3 loại luật (manual, minutes, accuracy).
 * - Tự động phát sinh sự kiện miền DomainEvents (assignment.created, assignment.completed).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/DomainEventService.php';
require_once __DIR__ . '/PracticeAssignmentCreationHelper.php';

class PracticeAssignmentService {

    /**
     * Tạo bài tập luyện bè tự động từ Chương trình Phụng vụ (Service Plan)
     */
    public static function createFromServicePlan(int $planId, int $actorId): array {
        return PracticeAssignmentCreationHelper::createFromServicePlan($planId, $actorId);
    }

    /**
     * Tạo bài tập lẻ (ad-hoc) cho ca đoàn hoặc cá nhân
     */
    public static function createAdHoc(array $data, int $actorId): int {
        return PracticeAssignmentCreationHelper::createAdHoc($data, $actorId);
    }


    /**
     * Lấy danh sách bài tập của cá nhân (My Assignments)
     */
    public static function getMyAssignments(int $userId): array {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            SELECT 
                a.id as assignment_id,
                a.setlist_id,
                a.song_id,
                a.title as assignment_title,
                a.due_at,
                a.target_bpm,
                a.target_transpose,
                a.chord_profile,
                a.completion_rule,
                a.completion_threshold,
                a.notes,
                a.status as assignment_status,
                t.id as target_id,
                t.voice_part,
                t.status as target_status,
                t.started_at,
                t.completed_at,
                t.last_practiced_at,
                s.title as song_title,
                s.composer
            FROM practice_assignment_targets t
            JOIN practice_assignments a ON a.id = t.assignment_id
            LEFT JOIN songs s ON s.id = a.song_id
            WHERE t.user_id = ? AND a.status = 'active'
            ORDER BY 
                CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
                CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END ASC,
                a.due_at ASC,
                a.id DESC
        ");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($r) {
            return [
                'assignment_id'       => (int)$r['assignment_id'],
                'target_id'           => (int)$r['target_id'],
                'setlist_id'          => $r['setlist_id'] ? (int)$r['setlist_id'] : null,
                'song_id'             => $r['song_id'],
                'song_title'          => $r['song_title'] ?? $r['song_id'],
                'composer'            => $r['composer'] ?? '',
                'title'               => $r['assignment_title'],
                'voice_part'          => $r['voice_part'] ?? 'S',
                'due_at'              => $r['due_at'],
                'target_bpm'          => $r['target_bpm'] ? (int)$r['target_bpm'] : null,
                'target_transpose'    => (int)($r['target_transpose'] ?? 0),
                'chord_profile'       => $r['chord_profile'] ?? 'HD',
                'completion_rule'     => $r['completion_rule'] ?? 'manual',
                'completion_threshold'=> $r['completion_threshold'] !== null ? (float)$r['completion_threshold'] : null,
                'notes'               => $r['notes'] ?? '',
                'status'              => $r['target_status'] ?? 'assigned',
                'started_at'          => $r['started_at'],
                'completed_at'        => $r['completed_at'],
                'last_practiced_at'   => $r['last_practiced_at'],
            ];
        }, $rows);
    }

    /**
     * Lưới tiến độ ca đoàn (Team Board) phục vụ góc nhìn Ca Trưởng
     * Bảo mật theo Quyết định D10: Chỉ trả chi tiết (accuracy, weak_measures) khi ca viên bật consent
     */
    public static function getTeamBoard(int $setlistId, int $actorId): array {
        $pdo = DB::get();

        // 1. Lấy danh sách bài tập của setlist
        $paStmt = $pdo->prepare("
            SELECT a.id, a.song_id, a.title, a.due_at, a.completion_rule, a.completion_threshold, s.title as song_title
            FROM practice_assignments a
            LEFT JOIN songs s ON s.id = a.song_id
            WHERE a.setlist_id = ? AND a.status = 'active'
            ORDER BY a.id ASC
        ");
        $paStmt->execute([$setlistId]);
        $assignments = $paStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($assignments)) {
            return [
                'setlist_id'  => $setlistId,
                'assignments' => [],
                'members'     => []
            ];
        }

        $assignmentIds = array_column($assignments, 'id');
        $inClause = implode(',', array_fill(0, count($assignmentIds), '?'));

        // 2. Lấy tiến độ của từng ca viên trên các bài tập này
        $targetStmt = $pdo->prepare("
            SELECT 
                t.assignment_id,
                t.user_id,
                t.voice_part,
                t.status,
                t.started_at,
                t.completed_at,
                t.last_practiced_at,
                u.username,
                u.display_name,
                u.consent_practice_share
            FROM practice_assignment_targets t
            JOIN users u ON u.id = t.user_id
            WHERE t.assignment_id IN ({$inClause})
            ORDER BY u.display_name ASC, t.assignment_id ASC
        ");
        $targetStmt->execute($assignmentIds);
        $targetRows = $targetStmt->fetchAll(PDO::FETCH_ASSOC);

        // Nhóm theo ca viên
        $membersMap = [];
        foreach ($targetRows as $row) {
            $uid = (int)$row['user_id'];
            if (!isset($membersMap[$uid])) {
                $membersMap[$uid] = [
                    'user_id'                => $uid,
                    'username'               => $row['username'],
                    'display_name'           => $row['display_name'] ?: $row['username'],
                    'voice_part'             => $row['voice_part'],
                    'consent_practice_share' => (int)$row['consent_practice_share'],
                    'assignments'            => []
                ];
            }

            $aid = (int)$row['assignment_id'];
            $hasConsent = (int)$row['consent_practice_share'] === 1;

            // Truy vấn số liệu thực tế từ practice_sessions nếu có consent
            $accuracy = null;
            $durationSeconds = null;
            if ($hasConsent) {
                $sessionStmt = $pdo->prepare("
                    SELECT AVG(accuracy_total) as avg_acc, SUM(duration_seconds) as total_dur
                    FROM practice_sessions
                    WHERE assignment_id = ? AND user_id = ?
                ");
                $sessionStmt->execute([$aid, $uid]);
                $sData = $sessionStmt->fetch(PDO::FETCH_ASSOC);
                if ($sData && $sData['avg_acc'] !== null) {
                    $accuracy = round((float)$sData['avg_acc'], 1);
                    $durationSeconds = (int)$sData['total_dur'];
                }
            }

            $membersMap[$uid]['assignments'][$aid] = [
                'status'            => $row['status'],
                'voice_part'        => $row['voice_part'],
                'started_at'        => $row['started_at'],
                'completed_at'      => $row['completed_at'],
                'last_practiced_at' => $row['last_practiced_at'],
                'accuracy'          => $accuracy,           // null nếu chưa consent
                'duration_seconds'  => $durationSeconds,   // null nếu chưa consent
                'has_consent'       => $hasConsent
            ];
        }

        return [
            'setlist_id'  => $setlistId,
            'assignments' => array_map(function($a) {
                return [
                    'id'                  => (int)$a['id'],
                    'song_id'             => $a['song_id'],
                    'song_title'          => $a['song_title'] ?? $a['song_id'],
                    'title'               => $a['title'],
                    'due_at'              => $a['due_at'],
                    'completion_rule'     => $a['completion_rule'],
                    'completion_threshold'=> $a['completion_threshold'] !== null ? (float)$a['completion_threshold'] : null
                ];
            }, $assignments),
            'members' => array_values($membersMap)
        ];
    }

    /**
     * Ghi nhận tiến độ tập thật từ phiên thực hành (PracticeSession)
     * Tự động chuyển đổi trạng thái và kiểm tra hoàn thành theo completion_rule
     */
    public static function recordProgress(int $sessionId, int $userId, int $assignmentId, int $durationSeconds, float $accuracy): array {
        $pdo = DB::get();

        // 1. Kiểm tra target tồn tại
        $targetStmt = $pdo->prepare("
            SELECT t.*, a.completion_rule, a.completion_threshold, a.song_id, a.title
            FROM practice_assignment_targets t
            JOIN practice_assignments a ON a.id = t.assignment_id
            WHERE t.assignment_id = ? AND t.user_id = ?
            LIMIT 1
        ");
        $targetStmt->execute([$assignmentId, $userId]);
        $target = $targetStmt->fetch(PDO::FETCH_ASSOC);

        if (!$target) {
            return ['updated' => false, 'reason' => 'Target not found'];
        }

        $now = date('Y-m-d H:i:s');
        $oldStatus = $target['status'];
        $newStatus = ($oldStatus === 'assigned') ? 'in_progress' : $oldStatus;
        $rule = $target['completion_rule'] ?? 'manual';
        $threshold = $target['completion_threshold'] !== null ? (float)$target['completion_threshold'] : null;

        $completedAt = $target['completed_at'];

        // 2. Đánh giá hoàn thành theo completion_rule
        if ($oldStatus !== 'completed') {
            if ($rule === 'accuracy' && $threshold !== null) {
                // Chuẩn hóa threshold: nếu threshold <= 1 thì tính là tỉ lệ (0.85 = 85%)
                $normThreshold = $threshold <= 1.0 ? ($threshold * 100.0) : $threshold;
                if ($accuracy >= $normThreshold) {
                    $newStatus = 'completed';
                    $completedAt = $now;
                }
            } elseif ($rule === 'minutes' && $threshold !== null) {
                // Tính tổng thời lượng tập của bài tập này (loại trừ sessionId hiện tại để tránh tính lặp nếu đã lưu vào DB)
                $durStmt = $pdo->prepare("
                    SELECT SUM(duration_seconds) FROM practice_sessions
                    WHERE assignment_id = ? AND user_id = ? AND id != ?
                ");
                $durStmt->execute([$assignmentId, $userId, $sessionId]);
                $otherSec = (int)$durStmt->fetchColumn();
                $totalSec = $otherSec + $durationSeconds;
                if ($totalSec >= ($threshold * 60)) {
                    $newStatus = 'completed';
                    $completedAt = $now;
                }
            }
        }

        // 3. Cập nhật bản ghi target
        $upStmt = $pdo->prepare("
            UPDATE practice_assignment_targets
            SET 
                status = ?,
                started_at = COALESCE(started_at, ?),
                completed_at = ?,
                last_practiced_at = ?
            WHERE assignment_id = ? AND user_id = ?
        ");
        $upStmt->execute([
            $newStatus,
            $now,
            $completedAt,
            $now,
            $assignmentId,
            $userId
        ]);

        // 4. Nếu vừa chuyển sang completed, ghi nhận sự kiện domain
        if ($oldStatus !== 'completed' && $newStatus === 'completed') {
            DomainEvents::record(
                'assignment.completed',
                $userId,
                'practice_assignment',
                (string)$assignmentId,
                [
                    'user_id'   => $userId,
                    'song_id'   => $target['song_id'],
                    'rule'      => $rule,
                    'accuracy'  => $accuracy,
                    'timestamp' => $now
                ]
            );
        }

        return [
            'updated'      => true,
            'old_status'   => $oldStatus,
            'new_status'   => $newStatus,
            'is_completed' => ($newStatus === 'completed'),
            'rule_applied' => $rule
        ];
    }

    /**
     * Thành viên tự đánh dấu bài tập là "Đã thuộc" (manual mark_done)
     */
    public static function markDone(int $assignmentId, int $userId): bool {
        $pdo = DB::get();
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            UPDATE practice_assignment_targets
            SET 
                status = 'completed',
                completed_at = COALESCE(completed_at, ?),
                last_practiced_at = ?
            WHERE assignment_id = ? AND user_id = ?
        ");
        $stmt->execute([$now, $now, $assignmentId, $userId]);
        $success = $stmt->rowCount() > 0;

        if ($success) {
            DomainEvents::record(
                'assignment.completed',
                $userId,
                'practice_assignment',
                (string)$assignmentId,
                ['user_id' => $userId, 'rule' => 'manual', 'timestamp' => $now]
            );
        }

        return $success;
    }

    /**
     * Ca Trưởng đánh dấu miễn tập (excused) cho thành viên
     */
    public static function markExcused(int $assignmentId, int $targetUserId, int $actorId): bool {
        $pdo = DB::get();
        $stmt = $pdo->prepare("
            UPDATE practice_assignment_targets
            SET status = 'excused'
            WHERE assignment_id = ? AND user_id = ?
        ");
        $stmt->execute([$assignmentId, $targetUserId]);
        $success = $stmt->rowCount() > 0;

        if ($success) {
            AuditLogger::log('practice_assignment_excuse', $actorId, $assignmentId, [
                'target_user_id' => $targetUserId
            ]);
        }
        return $success;
    }

    /**
     * Lưu trữ (archive) bài tập
     */
    public static function archive(int $assignmentId, int $actorId): bool {
        $pdo = DB::get();
        $stmt = $pdo->prepare("UPDATE practice_assignments SET status = 'archived' WHERE id = ?");
        $stmt->execute([$assignmentId]);
        $success = $stmt->rowCount() > 0;

        if ($success) {
            AuditLogger::log('practice_assignment_archive', $actorId, $assignmentId, []);
        }
        return $success;
    }

    /**
     * Lấy chi tiết một bài tập
     */
    public static function getDetail(int $assignmentId, int $userId, bool $isLeader = false): ?array {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            SELECT a.*, s.title as song_title, s.composer
            FROM practice_assignments a
            LEFT JOIN songs s ON s.id = a.song_id
            WHERE a.id = ?
            LIMIT 1
        ");
        $stmt->execute([$assignmentId]);
        $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$assignment) {
            return null;
        }

        // Lấy target tương ứng
        if ($isLeader || Auth::isAdmin()) {
            $tStmt = $pdo->prepare("
                SELECT t.*, u.username, u.display_name, u.voice_part as user_default_voice
                FROM practice_assignment_targets t
                JOIN users u ON u.id = t.user_id
                WHERE t.assignment_id = ?
            ");
            $tStmt->execute([$assignmentId]);
            $assignment['targets'] = $tStmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $tStmt = $pdo->prepare("
                SELECT * FROM practice_assignment_targets
                WHERE assignment_id = ? AND user_id = ?
                LIMIT 1
            ");
            $tStmt->execute([$assignmentId, $userId]);
            $myTarget = $tStmt->fetch(PDO::FETCH_ASSOC);

            // BẢO VỆ CHỐNG IDOR (Ticket F5):
            // Chỉ người tạo bài tập hoặc thành viên nằm trong danh sách targets mới được phép xem chi tiết
            $isCreator = ((int)$assignment['created_by'] === $userId);
            if (!$myTarget && !$isCreator) {
                Response::abort(403, 'Bạn không có quyền xem thông tin chi tiết bài tập này (chỉ dành cho người được giao hoặc người tạo)');
            }

            $assignment['my_target'] = $myTarget ?: null;
        }

        return $assignment;
    }
}
