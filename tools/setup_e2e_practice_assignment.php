<?php
declare(strict_types=1);

/**
 * tools/setup_e2e_practice_assignment.php
 *
 * Helper CLI chuẩn bị và dọn dẹp dữ liệu kiểm thử E2E cho Epic 4.1 (Practice Assignments).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentService.php';

$action = $argv[1] ?? 'setup';
$param = $argv[2] ?? 'banhat';

try {
    $db = DB::get();

    if ($action === 'setup') {
        $username = $param;
        $userStmt = $db->prepare('SELECT id, username, voice_part FROM users WHERE username = ? LIMIT 1');
        $userStmt->execute([$username]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            echo json_encode(['error' => "User {$username} not found"]);
            exit(1);
        }

        $userId = (int)$user['id'];

        // Lấy một song_id thật có sẵn trong DB
        $songStmt = $db->query("SELECT id, title FROM songs LIMIT 1");
        $song = $songStmt->fetch(PDO::FETCH_ASSOC);
        $songId = $song ? $song['id'] : 'thanh-ca-001';

        $title = 'Luyện tập Phụng Vụ E2E ' . bin2hex(random_bytes(2));
        $dueAt = date('Y-m-d H:i:s', strtotime('+5 days'));

        $assignmentId = PracticeAssignmentService::createAdHoc([
            'song_id'              => $songId,
            'title'                => $title,
            'user_ids'             => [$userId],
            'voice_part'           => $user['voice_part'] ?: 'S',
            'due_at'               => $dueAt,
            'target_bpm'           => 92,
            'target_transpose'     => 1,
            'completion_rule'      => 'manual',
            'notes'                => 'Hãy tập nhuần nhuyễn bè này trước giờ phụng vụ'
        ], 1); // created_by admin

        echo json_encode([
            'success'       => true,
            'user_id'       => $userId,
            'username'      => $username,
            'assignment_id' => $assignmentId,
            'song_id'       => $songId,
            'title'         => $title,
            'voice_part'    => $user['voice_part'] ?: 'S',
            'bpm'           => 92
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit(0);

    } elseif ($action === 'cleanup') {
        $aid = (int)$param;
        if ($aid > 0) {
            $db->prepare("DELETE FROM practice_assignment_targets WHERE assignment_id = ?")->execute([$aid]);
            $db->prepare("DELETE FROM practice_assignments WHERE id = ?")->execute([$aid]);
            $db->prepare("DELETE FROM domain_events WHERE subject_type = 'practice_assignment' AND subject_id = ?")->execute([(string)$aid]);
        }
        echo json_encode(['success' => true, 'cleaned_id' => $aid]);
        exit(0);
    }
} catch (Throwable $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit(1);
}
