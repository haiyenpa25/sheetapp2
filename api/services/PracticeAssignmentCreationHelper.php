<?php
/**
 * api/services/PracticeAssignmentCreationHelper.php
 *
 * Helper xử lý việc tạo bài tập ca đoàn (tự động từ Service Plan hoặc tạo Ad-hoc).
 * Tách từ PracticeAssignmentService nhằm bảo đảm ngân sách mã nguồn (Code Budget < 600 dòng).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/DomainEventService.php';

class PracticeAssignmentCreationHelper {

    /**
     * Tạo bài tập luyện bè tự động từ Chương trình Phụng vụ (Service Plan)
     */
    public static function createFromServicePlan(int $planId, int $actorId): array {
        $pdo = DB::get();

        // 1. Kiểm tra plan tồn tại
        $planStmt = $pdo->prepare("SELECT id, title, scheduled_date FROM setlists WHERE id = ? LIMIT 1");
        $planStmt->execute([$planId]);
        $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
        if (!$plan) {
            throw new InvalidArgumentException("Không tìm thấy chương trình phụng vụ #{$planId}");
        }

        // 2. Lấy danh sách các bài hát trong plan
        $itemsStmt = $pdo->prepare("
            SELECT song_id, chord_profile, transpose_key, bpm
            FROM setlist_items
            WHERE setlist_id = ? AND song_id IS NOT NULL AND song_id != ''
            ORDER BY display_order ASC
        ");
        $itemsStmt->execute([$planId]);
        $songs = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($songs)) {
            return ['created_count' => 0, 'assignments' => []];
        }

        // 3. Lấy danh sách ca viên được phân công trong chương trình (không bao gồm người từ chối)
        $assignStmt = $pdo->prepare("
            SELECT a.user_id, a.role, u.voice_part
            FROM service_plan_assignments a
            JOIN users u ON u.id = a.user_id
            WHERE a.setlist_id = ? AND (a.status IS NULL OR a.status != 'declined')
        ");
        $assignStmt->execute([$planId]);
        $assignees = $assignStmt->fetchAll(PDO::FETCH_ASSOC);

        $createdAssignments = [];

        $pdo->beginTransaction();
        try {
            foreach ($songs as $song) {
                $songId = $song['song_id'];

                // Tránh tạo trùng: kiểm tra xem bài hát này trong plan đã có assignment active chưa
                $checkStmt = $pdo->prepare("
                    SELECT id FROM practice_assignments
                    WHERE setlist_id = ? AND song_id = ? AND status = 'active'
                    LIMIT 1
                ");
                $checkStmt->execute([$planId, $songId]);
                $existingId = $checkStmt->fetchColumn();

                if ($existingId) {
                    $assignmentId = (int)$existingId;
                } else {
                    $insertStmt = $pdo->prepare("
                        INSERT INTO practice_assignments (
                            setlist_id, song_id, created_by, title, due_at,
                            target_bpm, target_transpose, chord_profile,
                            completion_rule, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'active')
                    ");
                    $title = "Tập bài: " . $songId . " — " . ($plan['title'] ?? 'Phụng vụ');
                    $dueAt = !empty($plan['scheduled_date']) ? $plan['scheduled_date'] . ' 23:59:59' : null;
                    $bpm = !empty($song['bpm']) ? (int)$song['bpm'] : null;
                    $transpose = isset($song['transpose_key']) ? (int)$song['transpose_key'] : 0;
                    $chordProfile = !empty($song['chord_profile']) ? $song['chord_profile'] : 'HD';

                    $insertStmt->execute([
                        $planId, $songId, $actorId, $title, $dueAt,
                        $bpm, $transpose, $chordProfile
                    ]);
                    $assignmentId = (int)$pdo->lastInsertId();

                    // Gán target cho từng ca viên trong ban và thu thập user_ids để gửi thông báo (F5)
                    $targetUserIds = [];
                    foreach ($assignees as $assignee) {
                        $targetUserId = (int)$assignee['user_id'];
                        $targetUserIds[] = $targetUserId;
                        $voicePart = $assignee['voice_part'] ?? null;
                        if (!$voicePart && !empty($assignee['role'])) {
                            // Tự suy đoán nếu role chứa S/A/T/B
                            if (preg_match('/\b(S|A|T|B|Soprano|Alto|Tenor|Bass)\b/i', $assignee['role'], $m)) {
                                $voicePart = strtoupper(substr($m[1], 0, 1));
                            }
                        }

                        $pdo->prepare("
                            INSERT OR IGNORE INTO practice_assignment_targets (
                                assignment_id, user_id, voice_part, status
                            ) VALUES (?, ?, ?, 'assigned')
                        ")->execute([$assignmentId, $targetUserId, $voicePart]);
                    }

                    // Ghi nhận sự kiện miền practice.assigned với đầy đủ danh sách user_ids
                    DomainEvents::record(
                        'practice.assigned',
                        $actorId,
                        'practice_assignment',
                        (string)$assignmentId,
                        [
                            'plan_id'  => $planId,
                            'song_id'  => $songId,
                            'title'    => $title,
                            'user_ids' => $targetUserIds
                        ]
                    );

                    $createdAssignments[] = $assignmentId;
                }
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        AuditLogger::log('practice_assignment_create_from_plan', $actorId, $planId, [
            'assignments_count' => count($createdAssignments)
        ]);

        return [
            'created_count' => count($createdAssignments),
            'assignments'   => $createdAssignments
        ];
    }

    /**
     * Tạo bài tập lẻ (ad-hoc) cho ca đoàn hoặc cá nhân
     */
    public static function createAdHoc(array $data, int $actorId): int {
        $pdo = DB::get();

        $songId = trim($data['song_id'] ?? '');
        if (empty($songId)) {
            throw new InvalidArgumentException("Thiếu mã bài hát (song_id)");
        }

        $title = trim($data['title'] ?? '') ?: "Bài tập cá nhân: {$songId}";
        $dueAt = !empty($data['due_at']) ? trim($data['due_at']) : null;
        $targetBpm = isset($data['target_bpm']) && (int)$data['target_bpm'] > 0 ? (int)$data['target_bpm'] : null;
        $targetTranspose = isset($data['target_transpose']) ? (int)$data['target_transpose'] : 0;
        $chordProfile = trim($data['chord_profile'] ?? 'HD') ?: 'HD';
        $rule = in_array($data['completion_rule'] ?? '', ['manual', 'minutes', 'accuracy'], true) ? $data['completion_rule'] : 'manual';
        $threshold = isset($data['completion_threshold']) ? (float)$data['completion_threshold'] : null;
        $notes = trim($data['notes'] ?? '');

        // Xác định danh sách target user IDs (hỗ trợ cả user_ids và target_user_ids)
        $targetUserIds = [];
        $rawUserIds = $data['user_ids'] ?? $data['target_user_ids'] ?? [];
        if (!empty($rawUserIds) && is_array($rawUserIds)) {
            $targetUserIds = array_map('intval', $rawUserIds);
        } elseif (!empty($data['voice_part'])) {
            $vPart = trim($data['voice_part']);
            $uStmt = $pdo->prepare("SELECT id FROM users WHERE voice_part = ? AND status = 'active'");
            $uStmt->execute([$vPart]);
            $targetUserIds = $uStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($targetUserIds)) {
            // Mặc định gán cho chính actor nếu không có ai
            $targetUserIds = [$actorId];
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("
                INSERT INTO practice_assignments (
                    song_id, created_by, title, due_at, target_bpm,
                    target_transpose, chord_profile, completion_rule,
                    completion_threshold, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([
                $songId, $actorId, $title, $dueAt, $targetBpm,
                $targetTranspose, $chordProfile, $rule, $threshold, $notes
            ]);
            $assignmentId = (int)$pdo->lastInsertId();

            foreach ($targetUserIds as $uid) {
                // Lấy bè mặc định của user
                $vPartStmt = $pdo->prepare("SELECT voice_part FROM users WHERE id = ? LIMIT 1");
                $vPartStmt->execute([$uid]);
                $vPart = $vPartStmt->fetchColumn() ?: ($data['voice_part'] ?? null);

                $pdo->prepare("
                    INSERT OR IGNORE INTO practice_assignment_targets (
                        assignment_id, user_id, voice_part, status
                    ) VALUES (?, ?, ?, 'assigned')
                ")->execute([$assignmentId, $uid, $vPart]);
            }

            DomainEvents::record(
                'practice.assigned',
                $actorId,
                'practice_assignment',
                (string)$assignmentId,
                ['song_id' => $songId, 'title' => $title, 'user_ids' => $targetUserIds]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        AuditLogger::log('practice_assignment_create_adhoc', $actorId, $assignmentId, [
            'song_id' => $songId,
            'targets' => count($targetUserIds)
        ]);

        return $assignmentId;
    }
}
