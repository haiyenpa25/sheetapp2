<?php
/**
 * tools/assignment_due_reminder.php
 *
 * Job CLI định kỳ kiểm tra và nhắc nhở bài tập sắp tới hạn (Epic 4.4 Lát 4.4-3):
 * - Quét các bài tập có hạn chót trong vòng 48 giờ tới và ca viên chưa hoàn thành.
 * - Tránh spam: kiểm tra chống trùng lặp sự kiện trong vòng 24 giờ qua.
 * - BẢO MẬT: Chỉ được phép chạy từ dòng lệnh (CLI). Bị chặn truy cập từ web.
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Access Denied: This script must be executed via CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';

$startTime = microtime(true);
echo "[" . date('Y-m-d H:i:s') . "] Starting Assignment Due Reminder Job...\n";

try {
    $pdo = DB::get();

    // 1. Quét các bài tập có hạn chót trong vòng 48 giờ tới và target chưa hoàn thành
    // Cột due_at lưu chuỗi ngày 'YYYY-MM-DD' hoặc 'YYYY-MM-DD HH:MM:SS'
    $stmt = $pdo->prepare("
        SELECT a.id as assignment_id, a.song_id, a.due_at,
               t.user_id, t.voice_part,
               s.title as song_title,
               u.display_name, u.username
        FROM practice_assignment_targets t
        JOIN practice_assignments a ON a.id = t.assignment_id
        JOIN songs s ON s.id = a.song_id
        JOIN users u ON u.id = t.user_id
        WHERE a.status = 'active'
          AND t.status != 'completed'
          AND a.due_at IS NOT NULL
          AND datetime(a.due_at) > datetime('now')
          AND datetime(a.due_at) <= datetime('now', '+2 days')
    ");
    $stmt->execute();
    $dueTargets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countTriggered = 0;
    $countSkipped = 0;

    foreach ($dueTargets as $target) {
        $assignmentId = (int)$target['assignment_id'];
        $userId       = (int)$target['user_id'];

        // Kiểm tra xem trong 24 giờ qua đã bắn sự kiện assignment.due_soon cho cặp này chưa
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM domain_events 
            WHERE type = 'assignment.due_soon' 
              AND subject_id = ?
              AND created_at >= datetime('now', '-24 hours')
        ");
        $checkStmt->execute(["{$assignmentId}_{$userId}"]);
        if ((int)$checkStmt->fetchColumn() > 0) {
            $countSkipped++;
            continue;
        }

        // Bắn Domain Event
        DomainEvents::record(
            'assignment.due_soon',
            null, // System actor
            'assignment_target',
            "{$assignmentId}_{$userId}",
            [
                'assignment_id' => $assignmentId,
                'user_id'       => $userId,
                'song_id'       => $target['song_id'],
                'song_title'    => $target['song_title'],
                'due_at'        => $target['due_at'],
                'voice_part'    => $target['voice_part']
            ]
        );

        $countTriggered++;
    }

    $elapsed = round(microtime(true) - $startTime, 3);
    echo "Completed in {$elapsed}s:\n";
    echo "  - Candidates checked : " . count($dueTargets) . "\n";
    echo "  - Reminders sent     : {$countTriggered}\n";
    echo "  - Skipped (within 24h): {$countSkipped}\n";
    exit(0);
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
