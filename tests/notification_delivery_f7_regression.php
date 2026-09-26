<?php
/**
 * tests/notification_delivery_f7_regression.php
 *
 * Kiểm thử hồi quy Ticket F7 (Roadmap 3 — Giai đoạn 4.9):
 * 1. Chống CRLF Header Injection & Mã hóa RFC 2047 cho Subject và Tên hiển thị.
 * 2. Dot-stuffing theo RFC 5321 (Section 4.5.2) cho nội dung email SMTP.
 * 3. Chống tắc nghẽn hàng đợi (Non-blocking Quiet Hours Queue):
 *    - 60 dòng hoãn do giờ yên lặng + 1 dòng đến hạn -> dòng đến hạn vẫn được xử lý chuyển phát.
 * 4. Kiểm soát Feature Flags (B6):
 *    - Khi cờ NOTIFICATIONS_EMAIL / NOTIFICATIONS_PUSH tắt -> đánh dấu skipped, không đánh sent.
 * 5. Bắt buộc email_verified_at:
 *    - Tài khoản chưa xác thực email -> đánh dấu skipped, không gửi mail.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/FeatureFlags.php';
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

echo "=== KIỂM THỬ HỒI QUY TICKET F7: EMAIL & PUSH AN TOÀN (B6) ===\n\n";

$db = createTestDatabase();
DB::setPdo($db);

// ── TEST 1: Chống CRLF Header Injection & RFC 2047 ──
echo "[1/5] Kiểm tra Chống CRLF Header Injection & Mã hóa RFC 2047...\n";

$maliciousSubject = "Thông Báo Lễ\r\nBcc: hacker@sheetapp.test\r\nContent-Type: text/plain";
$maliciousName    = "Ca Trưởng\r\nCc: spy@sheetapp.test";
$headers = NotificationDeliveryService::buildSmtpHeaders(
    'no-reply@sheet.hyb.io.vn',
    'caviern@sheetapp.test',
    $maliciousName,
    $maliciousSubject
);

check(!str_contains($headers, "\r\nBcc:"), 'Header SMTP không chứa dòng Bcc bị tiêm qua CRLF', $failures, $totalChecks);
check(!str_contains($headers, "\r\nCc:"), 'Header SMTP không chứa dòng Cc bị tiêm qua CRLF', $failures, $totalChecks);
check(str_contains($headers, 'Subject: =?UTF-8?B?'), 'Subject được mã hóa chuẩn RFC 2047 Base64', $failures, $totalChecks);
check(str_contains($headers, 'To: =?UTF-8?B?'), 'Tên người nhận được mã hóa chuẩn RFC 2047 Base64', $failures, $totalChecks);

// Giải mã base64 bên trong RFC 2047 để xác minh nội dung đã sạch CRLF
if (preg_match('/Subject: =\?UTF-8\?B\?([^?]+)\?=/', $headers, $m)) {
    $decodedSubject = base64_decode($m[1]);
    check(!str_contains($decodedSubject, "\r") && !str_contains($decodedSubject, "\n"), 'Subject sau giải mã hoàn toàn không còn ký tự CRLF', $failures, $totalChecks);
    check(str_contains($decodedSubject, 'Thông Báo LễBcc: hacker@sheetapp.testContent-Type: text/plain'), 'Ký tự \r và \n đã bị strip sạch khỏi subject', $failures, $totalChecks);
} else {
    check(false, 'Không trích xuất được RFC 2047 subject từ header', $failures, $totalChecks);
}

// ── TEST 2: Dot-stuffing theo RFC 5321 ──
echo "\n[2/5] Kiểm tra Dot-stuffing theo RFC 5321...\n";

$rawBody = "Dòng 1 bình thường\n.Dòng 2 bắt đầu bằng dấu chấm\n..Dòng 3 bắt đầu bằng 2 dấu chấm\nDòng 4 kết thúc.";
$stuffedBody = NotificationDeliveryService::applyDotStuffing($rawBody);

check(str_contains($stuffedBody, "\r\n..Dòng 2 bắt đầu bằng dấu chấm\r\n"), 'Dòng bắt đầu bằng dấu chấm đơn được thêm dấu chấm thành ..', $failures, $totalChecks);
check(str_contains($stuffedBody, "\r\n...Dòng 3 bắt đầu bằng 2 dấu chấm\r\n"), 'Dòng bắt đầu bằng 2 dấu chấm được thêm thành 3 dấu chấm', $failures, $totalChecks);
check(str_contains($stuffedBody, "Dòng 1 bình thường\r\n"), 'Dòng bình thường không bị biến đổi đầu dòng', $failures, $totalChecks);

// ── TEST 3: Giờ Yên Lặng Không Gây Tắc Nghẽn Hàng Đợi (60 dòng hoãn + 1 dòng đến hạn) ──
echo "\n[3/5] Kiểm tra Giờ Yên Lặng Non-blocking (60 hoãn + 1 đến hạn)...\n";

// Bật cờ NOTIFICATIONS_EMAIL để test logic xử lý hàng đợi
FeatureFlags::setOverride('NOTIFICATIONS_EMAIL', true);

// Tạo 1 thông báo mẫu
$db->exec("
    INSERT INTO notifications (id, user_id, title, body, link) 
    VALUES (9001, 1, 'Lễ Chúa Nhật Sắp Tới', 'Nội dung thông báo', '/service-plan/1');
");

// User 2: Thiết lập giờ yên lặng bao trùm hiện tại
$tz = new DateTimeZone('Asia/Ho_Chi_Minh');
$now = new DateTime('now', $tz);
$curH = (int)$now->format('H');
$startH = str_pad((string)(($curH - 1 + 24) % 24), 2, '0', STR_PAD_LEFT) . ':00';
$endH   = str_pad((string)(($curH + 2) % 24), 2, '0', STR_PAD_LEFT) . ':00';
$db->prepare("UPDATE users SET email = 'quiet@sheetapp.test', email_verified_at = CURRENT_TIMESTAMP, quiet_hours_start = ?, quiet_hours_end = ? WHERE id = 2")
   ->execute([$startH, $endH]);

// User 1: Không có giờ yên lặng, email đã verified
$db->exec("UPDATE users SET email = 'active@sheetapp.test', email_verified_at = CURRENT_TIMESTAMP, quiet_hours_start = NULL, quiet_hours_end = NULL WHERE id = 1");

// Dọn dẹp bảng notification_deliveries cũ
$db->exec("DELETE FROM notification_deliveries;");

// Chèn 60 dòng delivery cho User 2 (sẽ bị hoãn do trúng giờ yên lặng)
$insDeliv = $db->prepare("
    INSERT INTO notification_deliveries (notification_id, user_id, channel, status, attempts, created_at)
    VALUES (9001, 2, 'email', 'queued', 0, datetime('now', '-10 minutes'))
");
for ($i = 0; $i < 60; $i++) {
    $insDeliv->execute();
}

// Chèn 1 dòng delivery cho User 1 (đến hạn xử lý) nằm ở vị trí sau 60 dòng trên
$db->exec("
    INSERT INTO notification_deliveries (id, notification_id, user_id, channel, status, attempts, created_at)
    VALUES (9999, 9001, 1, 'email', 'queued', 0, datetime('now', '-5 minutes'));
");

// Lượt quét 1: Bốc 50 dòng đầu (tất cả đều của User 2) -> Tất cả 50 dòng bị hoãn và được cập nhật next_attempt_at tương lai
$stats1 = NotificationDeliveryService::processQueue(50);
check($stats1['deferred'] === 50, 'Lượt quét 1 hoãn đúng 50 dòng rơi vào Quiet Hours', $failures, $totalChecks);

// Kiểm tra 50 dòng đã được gán next_attempt_at
$countDeferredWithNext = (int)$db->query("SELECT COUNT(*) FROM notification_deliveries WHERE next_attempt_at IS NOT NULL")->fetchColumn();
check($countDeferredWithNext === 50, '50 dòng hoãn đã được cập nhật next_attempt_at trong tương lai', $failures, $totalChecks);

// Lượt quét 2: 50 dòng trên đã có next_attempt_at > now, hàng đợi không còn bị nghẽn
// Lượt quét này sẽ lấy 10 dòng còn lại của User 2 và dòng 9999 của User 1!
$stats2 = NotificationDeliveryService::processQueue(50);
check($stats2['deferred'] === 10, 'Lượt quét 2 hoãn 10 dòng còn lại của User 2', $failures, $totalChecks);
check($stats2['sent'] === 1, 'Dòng đến hạn của User 1 ở cuối hàng đợi vẫn được gửi thành công (Không bị kẹt)', $failures, $totalChecks);

$status9999 = $db->query("SELECT status FROM notification_deliveries WHERE id = 9999")->fetchColumn();
check($status9999 === 'sent', 'Bản ghi delivery id 9999 có trạng thái sent', $failures, $totalChecks);

// ── TEST 4: Feature Flags B6 (Mặc định tắt -> skipped) ──
echo "\n[4/5] Kiểm tra Feature Flag B6 (NOTIFICATIONS_EMAIL & NOTIFICATIONS_PUSH tắt)...\n";

FeatureFlags::reset(); // Trả về mặc định (NOTIFICATIONS_EMAIL = false, NOTIFICATIONS_PUSH = false)

$db->exec("DELETE FROM notification_deliveries;");
$db->exec("
    INSERT INTO notification_deliveries (id, notification_id, user_id, channel, status, attempts, created_at) VALUES 
    (8001, 9001, 1, 'email', 'queued', 0, CURRENT_TIMESTAMP),
    (8002, 9001, 1, 'push',  'queued', 0, CURRENT_TIMESTAMP);
");

$statsFlagOff = NotificationDeliveryService::processQueue(10);
check($statsFlagOff['sent'] === 0, 'Không có thông báo nào được gửi (sent = 0) khi cờ tắt', $failures, $totalChecks);
check($statsFlagOff['skipped'] === 2, 'Cả 2 kênh email & push đều bị đánh dấu skipped', $failures, $totalChecks);

$delivEmail = $db->query("SELECT status, last_error FROM notification_deliveries WHERE id = 8001")->fetch(PDO::FETCH_ASSOC);
check($delivEmail['status'] === 'skipped', 'Delivery email có status = skipped', $failures, $totalChecks);
check(str_contains($delivEmail['last_error'] ?? '', 'Feature Flag B6'), 'Ghi rõ lý do tạm tắt qua Feature Flag B6', $failures, $totalChecks);

$delivPush = $db->query("SELECT status, last_error FROM notification_deliveries WHERE id = 8002")->fetch(PDO::FETCH_ASSOC);
check($delivPush['status'] === 'skipped', 'Delivery push có status = skipped', $failures, $totalChecks);

// ── TEST 5: Bắt buộc Email Đã Xác Thực (email_verified_at) ──
echo "\n[5/5] Kiểm tra Bắt buộc Email Đã Xác Thực (email_verified_at)...\n";

FeatureFlags::setOverride('NOTIFICATIONS_EMAIL', true);

// User 3: Có email hợp lệ nhưng email_verified_at = NULL
$db->exec("UPDATE users SET email = 'unverified@sheetapp.test', email_verified_at = NULL, quiet_hours_start = NULL, quiet_hours_end = NULL WHERE id = 3");
$db->exec("
    INSERT INTO notification_deliveries (id, notification_id, user_id, channel, status, attempts, created_at)
    VALUES (8003, 9001, 3, 'email', 'queued', 0, CURRENT_TIMESTAMP);
");

$statsUnverified = NotificationDeliveryService::processQueue(10);
check($statsUnverified['sent'] === 0, 'Không gửi email cho người dùng chưa xác thực email', $failures, $totalChecks);
check($statsUnverified['skipped'] === 1, 'Bản ghi của người dùng chưa xác thực bị skipped', $failures, $totalChecks);

$delivUnver = $db->query("SELECT status, last_error FROM notification_deliveries WHERE id = 8003")->fetch(PDO::FETCH_ASSOC);
check($delivUnver['status'] === 'skipped', 'Status là skipped', $failures, $totalChecks);
check(str_contains($delivUnver['last_error'] ?? '', 'chưa được xác thực'), 'Ghi nhận lý do email chưa được xác thực', $failures, $totalChecks);

// Reset flags
FeatureFlags::reset();

echo "\n=======================================================\n";
if (empty($failures)) {
    echo "🎉 TẤT CẢ {$totalChecks} KIỂM THỬ TICKET F7 ĐÃ PASS HOÀN TOÀN!\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ " . count($failures) . "/{$totalChecks} KIỂM THỬ THẤT BẠI:\n";
    foreach ($failures as $f) {
        echo "   - {$f}\n";
    }
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(1);
}
