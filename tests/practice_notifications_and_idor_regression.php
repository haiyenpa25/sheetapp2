<?php
/**
 * tests/practice_notifications_and_idor_regression.php
 * 
 * Kiểm thử hồi quy cho Ticket F5 (ROADMAP3):
 * 1. Giao bài tập cho 3 người -> fan-out sinh đúng 3 thông báo practice.assigned.
 * 2. Link trong thông báo dùng đường dẫn tương đối (không có gạch chéo đầu).
 * 3. Chống IDOR: Người dùng không nằm trong danh sách được giao bài và không phải người tạo gọi detail -> 403 Forbidden.
 * 4. Người được giao bài, người tạo, Leader và Admin gọi detail -> thành công.
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/HttpException.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentService.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentCreationHelper.php';
require_once __DIR__ . '/../api/services/NotificationService.php';

$testCount = 0;
$passCount = 0;
$failCount = 0;

function check(string $name, bool $condition, string $detail = ''): void {
    global $suiteTotalChecks;
    $suiteTotalChecks++;
    global $testCount, $passCount, $failCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo "  [PASS:B] [{$name}] {$detail}\n";
    } else {
        $failCount++;
        echo "  [FAIL:B] [{$name}] {$detail}\n";
    }
}

echo "========================================================\n";
echo "   SheetApp2 — F5: Practice Notifications & Anti-IDOR   \n";
echo "========================================================\n\n";

$pdo = createTestDatabase();
DB::setPdo($pdo);

// Chuẩn bị người dùng:
// ID 1: admin
// ID 2: leader_user
// ID 3: member_a (target 1)
// ID 4: member_b (target 2)
// ID 5: member_c (target 3)
// ID 6: stranger_user (kẻ lạ mặt, ngoài danh sách)
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (1, 'admin', 'hash', 'admin', 'active')");
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (2, 'leader_user', 'hash', 'leader', 'active')");
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (3, 'member_a', 'hash', 'viewer', 'active')");
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (4, 'member_b', 'hash', 'viewer', 'active')");
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (5, 'member_c', 'hash', 'viewer', 'active')");
$pdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, status) VALUES (6, 'stranger', 'hash', 'viewer', 'active')");

// Tạo bài hát mẫu
$songId = '001-thanh-chua-yeu-thuong';

// ── Test 1: Giao bài tập cho 3 người -> đúng 3 notification ─────────────
echo "--- 1. Kiểm tra Fan-out Thông báo khi giao bài tập cho 3 người ---\n";

$_SESSION = ['user_id' => 2, 'username' => 'leader_user', 'role' => 'leader'];

$notifCountBefore = (int)$pdo->query("SELECT COUNT(*) FROM notifications")->fetchColumn();

// Leader giao bài tập ad-hoc cho 3 ca viên: 3, 4, 5
$assignmentData = [
    'song_id' => $songId,
    'title' => 'Luyện tập bè Nữ',
    'due_at' => date('Y-m-d H:i:s', strtotime('+3 days')),
    'target_user_ids' => [3, 4, 5],
    'target_bpm' => 85,
    'notes' => 'Chú ý ngắt câu ở ô nhịp 4'
];

$assignmentId = PracticeAssignmentCreationHelper::createAdHoc($assignmentData, 2);
check("F5-1.1", $assignmentId > 0, "Tạo bài tập ad-hoc cho 3 người thành công với ID = {$assignmentId}");

// Đếm số thông báo mới được tạo
$notifCountAfter = (int)$pdo->query("SELECT COUNT(*) FROM notifications")->fetchColumn();
$newNotifCount = $notifCountAfter - $notifCountBefore;
check("F5-1.2", $newNotifCount === 3, "Fan-out sinh ra ĐÚNG 3 thông báo (mỗi người nhận 1 thông báo)");

// Kiểm tra chi tiết thông báo của 3 thành viên
$stmtNotif = $pdo->prepare("SELECT user_id, title, body, link FROM notifications WHERE event_id IN (SELECT id FROM domain_events WHERE type = 'practice.assigned')");
$stmtNotif->execute();
$notifs = $stmtNotif->fetchAll(PDO::FETCH_ASSOC);

$notifUserIds = array_column($notifs, 'user_id');
sort($notifUserIds);
check("F5-1.3", $notifUserIds === [3, 4, 5], "3 thông báo gửi chính xác đến 3 thành viên [3, 4, 5]");

// Kiểm tra đường dẫn trong thông báo là đường dẫn tương đối (không bắt đầu bằng '/')
$linkSample = $notifs[0]['link'] ?? '';
check("F5-1.4", !str_starts_with($linkSample, '/') && str_starts_with($linkSample, 'learn/index.php'), "Link thông báo dùng đường dẫn tương đối chuẩn ('{$linkSample}')");

// ── Test 2: Chống IDOR ở action=detail ──────────────────────────────────
echo "\n--- 2. Kiểm tra Chống IDOR khi xem chi tiết bài tập ---\n";

// 2.1: Người lạ mặt (stranger, id=6) gọi detail -> Phải bị 403 Forbidden
$strangerBlocked = false;
$strangerCode = 0;
$_SESSION = ['user_id' => 6, 'username' => 'stranger', 'role' => 'viewer'];

try {
    PracticeAssignmentService::getDetail($assignmentId, 6, false);
} catch (HttpException $e) {
    $strangerBlocked = true;
    $strangerCode = $e->getCode();
}

check("F5-2.1", $strangerBlocked === true && $strangerCode === 403, "Người ngoài danh sách xem bài tập bị chặn 403 Forbidden (Chống IDOR)");

// 2.2: Thành viên được giao bài (member_a, id=3) gọi detail -> Thành công
$_SESSION = ['user_id' => 3, 'username' => 'member_a', 'role' => 'viewer'];
$detailMember = PracticeAssignmentService::getDetail($assignmentId, 3, false);
check("F5-2.2", $detailMember !== null && isset($detailMember['my_target']), "Thành viên được giao bài xem chi tiết thành công và có my_target");

// 2.3: Người tạo bài tập (leader_user, id=2) gọi detail (dù truyền isLeader=false) -> Thành công
$_SESSION = ['user_id' => 2, 'username' => 'leader_user', 'role' => 'leader'];
$detailCreator = PracticeAssignmentService::getDetail($assignmentId, 2, false);
check("F5-2.3", $detailCreator !== null, "Người tạo bài tập xem chi tiết thành công");

// 2.4: Admin (id=1) gọi detail -> Thành công và thấy danh sách targets
$_SESSION = ['user_id' => 1, 'username' => 'admin', 'role' => 'admin'];
$detailAdmin = PracticeAssignmentService::getDetail($assignmentId, 1, true);
check("F5-2.4", $detailAdmin !== null && count($detailAdmin['targets'] ?? []) === 3, "Admin xem được toàn bộ danh sách 3 targets");

echo "\n--------------------------------------------------------\n";
echo "Tổng số kiểm tra: {$testCount} | Đạt: {$passCount} | Lỗi: {$failCount}\n";

if ($failCount > 0) {
    echo "❌ KẾT QUẢ: THẤT BẠI!\n";
    exit(1);
}

echo "✅ KẾT QUẢ: TẤT CẢ KIỂM TRA F5 ĐỀU ĐẠT (PASS 100%)!\n";

echo "\nSUITE_COMPLETE total={$suiteTotalChecks}\n";
exit(0);
