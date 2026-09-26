<?php
declare(strict_types=1);

/**
 * tools/setup_e2e_notification.php
 *
 * Helper CLI để chuẩn bị và dọn dẹp dữ liệu kiểm thử E2E cho Trung Tâm Thông Báo (Notifications Flow).
 * Chỉ chạy qua dòng lệnh CLI.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/NotificationService.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';

$action = $argv[1] ?? 'setup';
$param = $argv[2] ?? 'banhat';

try {
    $db = DB::get();

    if ($action === 'setup') {
        $username = $param;
        $userStmt = $db->prepare('SELECT id, username FROM users WHERE username = ? LIMIT 1');
        $userStmt->execute([$username]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            echo json_encode(['error' => "User {$username} not found"]);
            exit(1);
        }

        $userId = (int)$user['id'];

        // 1. Tạo 1 setlist thử nghiệm
        $planTitle = 'Thánh Lễ Chúa Nhật E2E ' . bin2hex(random_bytes(3));
        $planDate = date('Y-m-d', strtotime('+3 days'));
        $planId = SetlistService::create($planTitle, $planDate, 1, ['status' => 'draft']);

        // 2. Phân công user vào plan
        SetlistService::assignUser($planId, $userId, 'Ca viên Bè S', 'Ghi chú tập bè', 1);

        // 3. Publish plan -> kích hoạt DomainEvents và Fan-Out Notification
        SetlistService::publish($planId, 1);

        // 4. Lấy ID thông báo vừa được tạo cho user
        $notifStmt = $db->prepare('SELECT id, title, body FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1');
        $notifStmt->execute([$userId]);
        $notif = $notifStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'user_id' => $userId,
            'username' => $username,
            'plan_id' => $planId,
            'plan_title' => $planTitle,
            'notification' => $notif
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit(0);

    } elseif ($action === 'cleanup') {
        $planId = (int)$param;
        if ($planId > 0) {
            $db->prepare('DELETE FROM service_plan_assignments WHERE setlist_id = ?')->execute([$planId]);
            $db->prepare('DELETE FROM setlist_items WHERE setlist_id = ?')->execute([$planId]);
            $db->prepare('DELETE FROM setlists WHERE id = ?')->execute([$planId]);
            $db->prepare("DELETE FROM domain_events WHERE subject_type = 'setlist' AND subject_id = ?")->execute([(string)$planId]);
        }
        $userId = isset($argv[3]) ? (int)$argv[3] : 0;
        if ($userId > 0) {
            $db->prepare("DELETE FROM notifications WHERE user_id = ? AND title LIKE '%Chương trình Phụng vụ%'")->execute([$userId]);
        }
        echo json_encode(['success' => true, 'cleaned_plan_id' => $planId]);
        exit(0);
    }
} catch (Throwable $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit(1);
}
