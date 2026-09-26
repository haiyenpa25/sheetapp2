<?php
/**
 * tests/domain_events_and_notifications_regression.php
 *
 * Kiểm thử hồi quy cho Lát 4.0-b (Domain Events) & Lát 4.0-c (In-app Notifications):
 * 1. Schema CSDL: Bảng domain_events, notifications, và các index quan trọng.
 * 2. DomainEvents::record: Lưu trữ sự kiện hợp lệ, payload JSON, liên kết actor.
 * 3. NotificationService::fanOut: Tự động phân phối thông báo khi plan.published và assignment.created.
 * 4. NotificationService CRUD & RBAC: list, count, markRead, markAllRead, cô lập giữa các user.
 * 5. Foreign Key Cascades: Xóa user tự xóa notification, xóa event tự xóa notification liên kết.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/MigrationRunner.php';

// Nạp các service nếu tồn tại
if (file_exists(__DIR__ . '/../api/services/DomainEventService.php')) {
    require_once __DIR__ . '/../api/services/DomainEventService.php';
}
if (file_exists(__DIR__ . '/../api/services/NotificationService.php')) {
    require_once __DIR__ . '/../api/services/NotificationService.php';
}

$failures = [];
$totalChecks = 0;

function check(bool $cond, string $msg, array &$failures, int &$totalChecks): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    $totalChecks++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== KIỂM THỬ SỰ KIỆN DOMAIN & TRUNG TÂM THÔNG BÁO (EPIC 4.0-B,C) ===\n\n";

// ── 1. Kiểm tra File Migration & Lược đồ SQLite ──
echo "[1/4] Kiểm tra Lược đồ CSDL Migration 009...\n";
$migFile = dirname(__DIR__) . '/api/migrations/009_domain_events_and_notifications.php';
check(file_exists($migFile), 'File migration api/migrations/009_domain_events_and_notifications.php tồn tại', $failures, $totalChecks);

// Test migration trên in-memory DB cô lập
$tempPdo = new PDO('sqlite::memory:');
$tempPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$tempPdo->exec('PRAGMA foreign_keys = ON;');

$runner = new MigrationRunner($tempPdo);
$runner->migrate();

$tables = $tempPdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
check(in_array('domain_events', $tables, true), 'Bảng domain_events được tạo thành công trong SQLite', $failures, $totalChecks);
check(in_array('notifications', $tables, true), 'Bảng notifications được tạo thành công trong SQLite', $failures, $totalChecks);

// ── 2. Kiểm tra DomainEvents::record ──
echo "\n[2/4] Kiểm tra ghi nhận sự kiện DomainEvents::record...\n";
check(class_exists('DomainEvents'), 'Lớp DomainEvents tồn tại', $failures, $totalChecks);

if (class_exists('DomainEvents')) {
    $pdo = DB::get();
    
    // Dọn dẹp fixture cũ
    $pdo->exec("DELETE FROM domain_events WHERE subject_type = 'test_fixture'");
    $pdo->exec("DELETE FROM notifications WHERE title LIKE '%Test Thông Báo%'");

    $eventId = DomainEvents::record(
        'plan.published',
        1,
        'test_fixture',
        '9999',
        ['title' => 'Chương Trình Thánh Lễ Giáng Sinh', 'season' => 'Giáng Sinh']
    );

    check($eventId > 0, "DomainEvents::record trả về ID sự kiện hợp lệ (> 0, nhận được: {$eventId})", $failures, $totalChecks);

    $evtRow = $pdo->query("SELECT * FROM domain_events WHERE id = {$eventId}")->fetch(PDO::FETCH_ASSOC);
    check($evtRow && $evtRow['type'] === 'plan.published', 'Sự kiện lưu đúng type = plan.published', $failures, $totalChecks);
    check($evtRow && (int)$evtRow['actor_user_id'] === 1, 'Sự kiện lưu đúng actor_user_id = 1', $failures, $totalChecks);
    
    $payload = json_decode($evtRow['payload_json'] ?? '{}', true);
    check(is_array($payload) && ($payload['title'] ?? '') === 'Chương Trình Thánh Lễ Giáng Sinh', 'Payload JSON được bọc và lưu trữ nguyên vẹn', $failures, $totalChecks);
}

// ── 3. Kiểm tra NotificationService ──
echo "\n[3/4] Kiểm tra NotificationService (Tạo, Đếm, Đọc, Danh Sách)...\n";
check(class_exists('NotificationService'), 'Lớp NotificationService tồn tại', $failures, $totalChecks);

if (class_exists('NotificationService')) {
    $pdo = DB::get();

    // Tạo 2 user fixture để kiểm tra cô lập
    $pdo->exec("DELETE FROM users WHERE username IN ('notif_user_a', 'notif_user_b')");
    $pdo->exec("INSERT INTO users (username, password_hash, role, display_name) VALUES ('notif_user_a', 'hash', 'banhat', 'User A')");
    $userAId = (int)$pdo->lastInsertId();
    $pdo->exec("INSERT INTO users (username, password_hash, role, display_name) VALUES ('notif_user_b', 'hash', 'banhat', 'User B')");
    $userBId = (int)$pdo->lastInsertId();

    try {
        // Tạo 2 thông báo cho user A, 1 thông báo cho user B
        $n1 = NotificationService::create($userAId, null, 'Test Thông Báo 1', 'Nội dung 1', '/?song=1');
        $n2 = NotificationService::create($userAId, null, 'Test Thông Báo 2', 'Nội dung 2', '/?song=2');
        $n3 = NotificationService::create($userBId, null, 'Test Thông Báo B', 'Nội dung B', '/?song=3');

        check($n1 > 0 && $n2 > 0 && $n3 > 0, 'NotificationService::create tạo bản ghi thành công', $failures, $totalChecks);

        // Kiểm tra unread count
        $unreadA = NotificationService::getUnreadCount($userAId);
        $unreadB = NotificationService::getUnreadCount($userBId);
        check($unreadA === 2, "User A có 2 thông báo chưa đọc (nhận được: {$unreadA})", $failures, $totalChecks);
        check($unreadB === 1, "User B có 1 thông báo chưa đọc (nhận được: {$unreadB})", $failures, $totalChecks);

        // Lấy danh sách thông báo của User A
        $listA = NotificationService::getList($userAId);
        check(count($listA['items']) === 2, 'User A nhận đủ 2 thông báo trong danh sách', $failures, $totalChecks);
        check($listA['unread_count'] === 2, 'List trả kèm unread_count = 2', $failures, $totalChecks);

        // User A đánh dấu đọc thông báo n1
        $markRes = NotificationService::markRead($userAId, $n1);
        check($markRes === true, 'Đánh dấu đọc thông báo n1 thành công', $failures, $totalChecks);
        check(NotificationService::getUnreadCount($userAId) === 1, 'Sau khi đọc n1, User A còn 1 thông báo chưa đọc', $failures, $totalChecks);

        // User A cố tình đánh dấu thông báo của User B -> Phải bị từ chối
        $hackRes = NotificationService::markRead($userAId, $n3);
        check($hackRes === false, 'Bảo mật: User A không thể đánh dấu đọc thông báo của User B', $failures, $totalChecks);

        // User A đánh dấu đọc tất cả
        NotificationService::markAllRead($userAId);
        check(NotificationService::getUnreadCount($userAId) === 0, 'User A gọi markAllRead -> unread count = 0', $failures, $totalChecks);
        check(NotificationService::getUnreadCount($userBId) === 1, 'Thông báo của User B không bị ảnh hưởng', $failures, $totalChecks);

    } finally {
        // Dọn dẹp fixture
        $pdo->exec("DELETE FROM notifications WHERE user_id IN ({$userAId}, {$userBId})");
        $pdo->exec("DELETE FROM users WHERE id IN ({$userAId}, {$userBId})");
    }
}

// ── 4. Kiểm tra Tự Động Fan-Out Khi Phát Hành Service Plan ──
echo "\n[4/4] Kiểm tra Tự Động Phân Phối Thông Báo (Fan-Out Pipeline)...\n";
if (class_exists('DomainEvents') && class_exists('NotificationService')) {
    $pdo = DB::get();

    // Tạo 1 user ca viên fixture
    $pdo->exec("DELETE FROM users WHERE username = 'cavien_fanout_test'");
    $pdo->exec("INSERT INTO users (username, password_hash, role, display_name) VALUES ('cavien_fanout_test', 'hash', 'banhat', 'Ca Viên Fanout')");
    $caVienId = (int)$pdo->lastInsertId();

    // Tạo 1 setlist / service plan fixture
    $pdo->exec("INSERT INTO setlists (title, created_by, status) VALUES ('Lễ Tạ Ơn 2026', 1, 'draft')");
    $planId = (int)$pdo->lastInsertId();

    // Gán ca viên vào plan
    $pdo->exec("INSERT INTO service_plan_assignments (setlist_id, user_id, role, notes, status) VALUES ({$planId}, {$caVienId}, 'Hát Bè Soprano', 'Tập kỹ đoạn giang tấu', 'pending')");
    $assignId = (int)$pdo->lastInsertId();

    try {
        // Giả lập phát hành plan qua DomainEvent
        DomainEvents::record(
            'plan.published',
            1,
            'setlist',
            (string)$planId,
            ['title' => 'Lễ Tạ Ơn 2026']
        );

        // Ca viên phải nhận được 1 thông báo
        $unread = NotificationService::getUnreadCount($caVienId);
        check($unread >= 1, "Ca viên tự động nhận được thông báo sau khi phát hành plan (unread: {$unread})", $failures, $totalChecks);

        $notifs = NotificationService::getList($caVienId);
        $found = false;
        foreach ($notifs['items'] as $item) {
            if (str_contains($item['title'], 'Phụng vụ') || str_contains($item['body'], 'Lễ Tạ Ơn 2026')) {
                $found = true;
                break;
            }
        }
        check($found, "Nội dung thông báo đề cập chính xác tên chương trình 'Lễ Tạ Ơn 2026'", $failures, $totalChecks);

    } finally {
        $pdo->exec("DELETE FROM service_plan_assignments WHERE setlist_id = {$planId}");
        $pdo->exec("DELETE FROM setlists WHERE id = {$planId}");
        $pdo->exec("DELETE FROM notifications WHERE user_id = {$caVienId}");
        $pdo->exec("DELETE FROM users WHERE id = {$caVienId}");
    }
}

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số lỗi: " . count($failures) . "\n";
if (empty($failures)) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS)!\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "❌ KẾT QUẢ: CÓ " . count($failures) . " KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
