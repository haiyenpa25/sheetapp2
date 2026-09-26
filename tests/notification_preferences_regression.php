<?php
/**
 * tests/notification_preferences_regression.php
 *
 * Kiểm thử hồi quy toàn diện cho Epic 4.4 — Tùy chọn thông báo đa kênh & Nhật ký chuyển phát:
 * 1. Schema CSDL Migration 012 (notification_preferences, notification_deliveries, user email & quiet hours).
 * 2. NotificationPreferenceService: Lấy ma trận mặc định, lưu cấu hình tùy biến, cập nhật email & quiet hours.
 * 3. Quiet Hours Logic: Kiểm tra chính xác cả khung giờ trong ngày (13:00-15:00) và qua đêm (22:00-07:00).
 * 4. Multi-channel Fan-out: Phân phối thông minh theo tùy chọn người dùng (In-app + Email Queue).
 * 5. Delivery Queue Processing: Xử lý hàng đợi, chuyển trạng thái sent/queued, tôn trọng giờ yên lặng.
 * 6. Assignment Due Reminder: Quét bài tập sắp đến hạn và chống gửi lặp trong vòng 24h.
 * 7. CLI-only Security Guard: Worker và Reminder script chặn truy cập trực tiếp từ web.
 */

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/MigrationRunner.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';
require_once __DIR__ . '/../api/services/NotificationService.php';
require_once __DIR__ . '/../api/services/NotificationPreferenceService.php';
require_once __DIR__ . '/../api/services/NotificationDeliveryService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';

$failures = [];
$totalChecks = 0;

function check(bool $cond, string $msg, array &$failures, int &$totalChecks): void {
    $totalChecks++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== KIỂM THỬ HỒI QUY TÙY CHỌN THÔNG BÁO ĐA KÊNH & EMAIL (EPIC 4.4) ===\n\n";

// ── 1. Khởi tạo In-Memory Database & Kiểm tra Schema ──
echo "[1/7] Kiểm tra Schema Migration 012 & SQLite In-Memory...\n";
$db = createTestDatabase();
DB::setPdo($db);

$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
check(in_array('notification_preferences', $tables, true), 'Bảng notification_preferences tồn tại', $failures, $totalChecks);
check(in_array('notification_deliveries', $tables, true), 'Bảng notification_deliveries tồn tại', $failures, $totalChecks);

$userCols = $db->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
$userColNames = array_column($userCols, 'name');
check(in_array('email', $userColNames, true), 'Bảng users có cột email', $failures, $totalChecks);
check(in_array('email_verified_at', $userColNames, true), 'Bảng users có cột email_verified_at', $failures, $totalChecks);
check(in_array('quiet_hours_start', $userColNames, true), 'Bảng users có cột quiet_hours_start', $failures, $totalChecks);
check(in_array('quiet_hours_end', $userColNames, true), 'Bảng users có cột quiet_hours_end', $failures, $totalChecks);

// ── 2. Kiểm tra NotificationPreferenceService CRUD & Ma Trận ──
echo "\n[2/7] Kiểm tra NotificationPreferenceService CRUD & Ma Trận...\n";
$userId = 1; // admin

// Lấy cấu hình ban đầu (chưa lưu gì) -> Trả về defaults
$initial = NotificationPreferenceService::getPreferences($userId);
check(isset($initial['matrix']['plan.published']), 'Có cấu hình cho sự kiện plan.published', $failures, $totalChecks);
check($initial['matrix']['plan.published']['channels']['inapp'] === 1, 'Mặc định inapp = 1', $failures, $totalChecks);
check($initial['matrix']['plan.published']['channels']['email'] === 1, 'Mặc định email = 1', $failures, $totalChecks);
check($initial['matrix']['plan.published']['channels']['push'] === 0, 'Mặc định push = 0', $failures, $totalChecks);

// Cập nhật email và quiet hours
$settingsRes = NotificationPreferenceService::updateUserSettings($userId, 'admin@sheetapp.test', '22:30', '06:30');
check($settingsRes['success'] === true, 'Cập nhật email và quiet hours thành công', $failures, $totalChecks);
check($settingsRes['email'] === 'admin@sheetapp.test', 'Email được cập nhật đúng', $failures, $totalChecks);

// Validate email không hợp lệ
$invalidEmailCaught = false;
try {
    NotificationPreferenceService::updateUserSettings($userId, 'invalid-email-format', null, null);
} catch (InvalidArgumentException $e) {
    $invalidEmailCaught = true;
}
check($invalidEmailCaught, 'Chặn định dạng email không hợp lệ (InvalidArgumentException)', $failures, $totalChecks);

// Validate định dạng giờ yên lặng sai format
$invalidTimeCaught = false;
try {
    NotificationPreferenceService::updateUserSettings($userId, 'admin@sheetapp.test', '25:99', '06:00');
} catch (InvalidArgumentException $e) {
    $invalidTimeCaught = true;
}
check($invalidTimeCaught, 'Chặn định dạng giờ yên lặng không hợp lệ (InvalidArgumentException)', $failures, $totalChecks);

// Lưu tùy chọn tùy biến: Tắt email cho plan.published, bật push cho assignment.created
$customPrefs = [
    ['event_type' => 'plan.published', 'channel' => 'email', 'enabled' => 0],
    ['event_type' => 'assignment.created', 'channel' => 'push', 'enabled' => 1]
];
NotificationPreferenceService::updatePreferences($userId, $customPrefs);

$updated = NotificationPreferenceService::getPreferences($userId);
check($updated['matrix']['plan.published']['channels']['email'] === 0, 'Tắt email cho plan.published thành công', $failures, $totalChecks);
check($updated['matrix']['assignment.created']['channels']['push'] === 1, 'Bật push cho assignment.created thành công', $failures, $totalChecks);
check($updated['matrix']['plan.published']['channels']['inapp'] === 1, 'Kênh inapp giữ nguyên bật', $failures, $totalChecks);

// ── 3. Kiểm tra Logic Khung Giờ Yên Lặng (Quiet Hours) ──
echo "\n[3/7] Kiểm tra Logic Khung Giờ Yên Lặng (Quiet Hours)...\n";

// Thiết lập khung giờ yên lặng qua đêm: 22:00 -> 07:00
NotificationPreferenceService::updateUserSettings($userId, 'admin@sheetapp.test', '22:00', '07:00');

// Lúc 23:30 (đang trong giờ yên lặng ban đêm)
$timeNight = new DateTime('2026-09-26 23:30:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
check(NotificationPreferenceService::isInQuietHours($userId, $timeNight) === true, '23:30 rơi vào giờ yên lặng qua đêm (22:00-07:00)', $failures, $totalChecks);

// Lúc 05:00 sáng (đang trong giờ yên lặng sáng sớm)
$timeEarly = new DateTime('2026-09-26 05:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
check(NotificationPreferenceService::isInQuietHours($userId, $timeEarly) === true, '05:00 rơi vào giờ yên lặng qua đêm (22:00-07:00)', $failures, $totalChecks);

// Lúc 14:00 chiều (ngoài giờ yên lặng)
$timeDay = new DateTime('2026-09-26 14:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
check(NotificationPreferenceService::isInQuietHours($userId, $timeDay) === false, '14:00 không rơi vào giờ yên lặng', $failures, $totalChecks);

// Thiết lập khung giờ yên lặng trong ngày: 13:00 -> 15:00 (nghỉ trưa)
NotificationPreferenceService::updateUserSettings($userId, 'admin@sheetapp.test', '13:00', '15:00');
$timeNoon = new DateTime('2026-09-26 14:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
check(NotificationPreferenceService::isInQuietHours($userId, $timeNoon) === true, '14:00 rơi vào giờ yên lặng nghỉ trưa (13:00-15:00)', $failures, $totalChecks);

$timeMorning = new DateTime('2026-09-26 09:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
check(NotificationPreferenceService::isInQuietHours($userId, $timeMorning) === false, '09:00 không rơi vào giờ nghỉ trưa', $failures, $totalChecks);

// Không thiết lập khung giờ yên lặng
NotificationPreferenceService::updateUserSettings($userId, 'admin@sheetapp.test', null, null);
check(NotificationPreferenceService::isInQuietHours($userId, $timeNight) === false, 'Khi không cài đặt quiet hours, luôn trả về false', $failures, $totalChecks);

// ── 4. Kiểm tra Phân Phối Đa Kênh Thông Minh (Fan-Out Pipeline) ──
echo "\n[4/7] Kiểm tra Phân Phối Đa Kênh Thông Minh (Fan-Out Pipeline)...\n";

// Chuẩn bị 3 User cho kịch bản Fan-out:
// User 1 (admin): có email + bật cả inapp và email
// User 2 (banhat): có email + TẮT email cho plan.published
// User 3 (viewer): KHÔNG có email (email = NULL)
$db->exec("
    UPDATE users SET email = 'user1@sheetapp.test' WHERE id = 1;
    UPDATE users SET email = 'user2@sheetapp.test' WHERE id = 2;
    UPDATE users SET email = NULL WHERE id = 3;
");

NotificationPreferenceService::updatePreferences(1, [
    ['event_type' => 'plan.published', 'channel' => 'inapp', 'enabled' => 1],
    ['event_type' => 'plan.published', 'channel' => 'email', 'enabled' => 1]
]);

NotificationPreferenceService::updatePreferences(2, [
    ['event_type' => 'plan.published', 'channel' => 'inapp', 'enabled' => 1],
    ['event_type' => 'plan.published', 'channel' => 'email', 'enabled' => 0] // TẮT email
]);

// Giả lập một setlist và phân công cho cả 3 user
$db->exec("
    INSERT INTO domain_events (id, type, actor_user_id, subject_type, subject_id, payload_json) 
    VALUES (1001, 'plan.published', 1, 'setlist', '901', '{\"title\":\"Lễ Chúa Nhật Thử Nghiệm\"}');
    INSERT INTO setlists (id, title, created_by, status) VALUES (901, 'Lễ Chúa Nhật Thử Nghiệm', 1, 'draft');
    INSERT INTO service_plan_assignments (setlist_id, user_id, role) VALUES 
    (901, 1, 'Hát Chính'),
    (901, 2, 'Guitar Đệm'),
    (901, 3, 'Piano Đệm');
");

// Kích hoạt Fan-out sự kiện plan.published
NotificationService::fanOut(
    1001,
    'plan.published',
    1,
    'setlist',
    901,
    ['title' => 'Lễ Chúa Nhật Thử Nghiệm']
);

// Kiểm tra User 1: có thông báo in-app VÀ có bản ghi delivery email queued
$notifUser1 = $db->query("SELECT id FROM notifications WHERE user_id = 1 ORDER BY id DESC LIMIT 1")->fetchColumn();
check(!empty($notifUser1), 'User 1 nhận thông báo in-app', $failures, $totalChecks);

$delivUser1 = $db->query("SELECT * FROM notification_deliveries WHERE user_id = 1 AND channel = 'email' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($delivUser1), 'User 1 có bản ghi delivery email được đưa vào hàng đợi queued', $failures, $totalChecks);
check($delivUser1['status'] === 'queued', 'Trạng thái delivery ban đầu là queued', $failures, $totalChecks);

// Kiểm tra User 2: có thông báo in-app NHƯNG KHÔNG CÓ delivery email (do đã tắt)
$notifUser2 = $db->query("SELECT id FROM notifications WHERE user_id = 2 ORDER BY id DESC LIMIT 1")->fetchColumn();
check(!empty($notifUser2), 'User 2 nhận thông báo in-app', $failures, $totalChecks);

$delivUser2 = $db->query("SELECT * FROM notification_deliveries WHERE user_id = 2 AND channel = 'email' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(empty($delivUser2), 'User 2 KHÔNG có bản ghi delivery email vì đã tắt tùy chọn email', $failures, $totalChecks);

// Kiểm tra User 3: có thông báo in-app NHƯNG KHÔNG CÓ delivery email (vì không có email)
$delivUser3 = $db->query("SELECT * FROM notification_deliveries WHERE user_id = 3 AND channel = 'email' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(empty($delivUser3), 'User 3 không có email nên không tạo delivery email', $failures, $totalChecks);

// ── 5. Kiểm tra Xử Lý Hàng Đợi Chuyển Phát (NotificationDeliveryService) ──
echo "\n[5/7] Kiểm tra Xử Lý Hàng Đợi Chuyển Phát (NotificationDeliveryService)...\n";

// Chạy xử lý hàng đợi
$queueStats = NotificationDeliveryService::processQueue(10);
check($queueStats['processed'] >= 1, 'Đã xử lý ít nhất 1 bản ghi trong hàng đợi', $failures, $totalChecks);
check($queueStats['sent'] >= 1, 'Gửi thành công ít nhất 1 thông báo email', $failures, $totalChecks);

// Kiểm tra bản ghi delivery sau khi xử lý
$delivUpdated = $db->query("SELECT * FROM notification_deliveries WHERE id = {$delivUser1['id']}")->fetch(PDO::FETCH_ASSOC);
check($delivUpdated['status'] === 'sent', 'Trạng thái delivery chuyển sang sent', $failures, $totalChecks);
check(!empty($delivUpdated['sent_at']), 'sent_at được cập nhật thời gian gửi', $failures, $totalChecks);
check((int)$delivUpdated['attempts'] === 1, 'attempts tăng lên 1', $failures, $totalChecks);

// Test hoãn gửi khi trúng giờ yên lặng
$db->exec("
    INSERT INTO notification_deliveries (notification_id, user_id, channel, status, attempts, created_at)
    VALUES ({$notifUser1}, 1, 'email', 'queued', 0, CURRENT_TIMESTAMP);
");
$newDelivId = (int)$db->lastInsertId();

// Đặt quiet hours bao trùm thời điểm hiện tại (sử dụng cùng timezone Asia/Ho_Chi_Minh)
$tz = new DateTimeZone(getenv('APP_TIMEZONE') ?: 'Asia/Ho_Chi_Minh');
$nowInTz = new DateTime('now', $tz);
$currentHour = (int)$nowInTz->format('H');
$startH = str_pad((string)(($currentHour - 1 + 24) % 24), 2, '0', STR_PAD_LEFT) . ':00';
$endH   = str_pad((string)(($currentHour + 2) % 24), 2, '0', STR_PAD_LEFT) . ':00';
NotificationPreferenceService::updateUserSettings(1, 'admin@sheetapp.test', $startH, $endH);

$deferredStats = NotificationDeliveryService::processQueue(10);
check($deferredStats['deferred'] >= 1, 'Hệ thống hoãn gửi (deferred) khi người dùng đang trong giờ yên lặng', $failures, $totalChecks);

$delivStillQueued = $db->query("SELECT status FROM notification_deliveries WHERE id = {$newDelivId}")->fetchColumn();
check($delivStillQueued === 'queued', 'Trạng thái bản ghi vẫn giữ nguyên queued chờ quét tiếp', $failures, $totalChecks);

// Dọn dẹp quiet hours
NotificationPreferenceService::updateUserSettings(1, 'admin@sheetapp.test', null, null);

// ── 6. Kiểm tra Job Nhắc Bài Tập Sắp Hạn (assignment_due_reminder) ──
echo "\n[6/7] Kiểm tra Nhắc Bài Tập Sắp Hạn & Chống Gửi Trùng (assignment.due_soon)...\n";

// Tạo bài tập sắp tới hạn vào ngày mai
$tomorrow = date('Y-m-d H:i:s', strtotime('+24 hours'));
$db->exec("
    INSERT INTO practice_assignments (id, setlist_id, song_id, created_by, title, due_at, status)
    VALUES (501, 901, '001-thanh-chua-yeu-thuong', 1, 'Tập bài Thánh Chúa Yêu Thương', '{$tomorrow}', 'active');
    
    INSERT INTO practice_assignment_targets (assignment_id, user_id, voice_part, status)
    VALUES (501, 2, 'Tenor', 'assigned');
");

// Chạy logic quét bài tập
$stmtDue = $db->prepare("
    SELECT a.id as assignment_id, a.song_id, a.due_at, t.user_id, s.title as song_title
    FROM practice_assignment_targets t
    JOIN practice_assignments a ON a.id = t.assignment_id
    JOIN songs s ON s.id = a.song_id
    WHERE a.status = 'active'
      AND t.status != 'completed'
      AND a.due_at IS NOT NULL
      AND datetime(a.due_at) > datetime('now')
      AND datetime(a.due_at) <= datetime('now', '+2 days')
");
$stmtDue->execute();
$targets = $stmtDue->fetchAll(PDO::FETCH_ASSOC);
check(count($targets) === 1, 'Phát hiện chính xác 1 bài tập sắp tới hạn trong 48h', $failures, $totalChecks);

// Bắn sự kiện nhắc nhở
$remindTarget = $targets[0];
DomainEvents::record(
    'assignment.due_soon',
    null,
    'assignment_target',
    "501_2",
    [
        'assignment_id' => 501,
        'user_id'       => 2,
        'song_id'       => $remindTarget['song_id'],
        'song_title'    => $remindTarget['song_title'],
        'due_at'        => $remindTarget['due_at']
    ]
);

// Kiểm tra user 2 nhận được thông báo nhắc nhở
$dueNotif = $db->query("SELECT * FROM notifications WHERE user_id = 2 AND title LIKE '%sắp tới hạn%' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($dueNotif), 'User 2 nhận thông báo nhắc nhở bài tập sắp tới hạn', $failures, $totalChecks);

// Kiểm tra chống spam: sự kiện đã tồn tại trong 24h
$checkDupe = $db->query("
    SELECT COUNT(*) FROM domain_events 
    WHERE type = 'assignment.due_soon' AND subject_id = '501_2' AND created_at >= datetime('now', '-24 hours')
")->fetchColumn();
check((int)$checkDupe === 1, 'Cơ chế chống spam ghi nhận sự kiện đã được bắn trong 24h', $failures, $totalChecks);

// ── 7. Kiểm tra Bảo Mật Chặn Web Truy Cập Worker Scripts ──
echo "\n[7/7] Kiểm tra Bảo Mật Chặn Web Truy Cập Worker Scripts...\n";

$workerContent = file_get_contents(__DIR__ . '/../tools/notification_worker.php');
check(str_contains($workerContent, "php_sapi_name() !== 'cli'"), 'tools/notification_worker.php có guard chặn web (CLI-only)', $failures, $totalChecks);
check(str_contains($workerContent, "403"), 'tools/notification_worker.php trả về HTTP 403 nếu bị gọi từ web', $failures, $totalChecks);

$reminderContent = file_get_contents(__DIR__ . '/../tools/assignment_due_reminder.php');
check(str_contains($reminderContent, "php_sapi_name() !== 'cli'"), 'tools/assignment_due_reminder.php có guard chặn web (CLI-only)', $failures, $totalChecks);
check(str_contains($reminderContent, "403"), 'tools/assignment_due_reminder.php trả về HTTP 403 nếu bị gọi từ web', $failures, $totalChecks);

// Tổng kết
echo "\n=======================================================\n";
if (empty($failures)) {
    echo "🎉 TẤT CẢ {$totalChecks} KIỂM THỬ ĐÃ PASS HOÀN TOÀN!\n";
    exit(0);
} else {
    echo "❌ CÓ " . count($failures) . "/{$totalChecks} KIỂM THỬ THẤT BẠI:\n";
    foreach ($failures as $f) {
        echo "   - {$f}\n";
    }
    exit(1);
}
