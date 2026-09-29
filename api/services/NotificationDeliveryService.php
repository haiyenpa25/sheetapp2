<?php
/**
 * api/services/NotificationDeliveryService.php
 *
 * Dịch vụ Xử lý Hàng đợi & Chuyển phát Thông báo Đa Kênh (Email & Web Push — Epic 4.4):
 * - Xử lý hàng đợi chuyển phát từ bảng notification_deliveries.
 * - Tôn trọng khung giờ yên lặng (Quiet Hours): hoãn gửi khi người dùng đang nghỉ ngơi.
 * - Tích hợp Mailer chuẩn SMTP hoặc File/Log driver an toàn khi không có SMTP server.
 * - Bảo vệ quyền riêng tư: không gửi dữ liệu nhạy cảm, kèm link quản lý tùy chọn thông báo.
 * - Quản lý số lần thử lại (Retry max 3 lần), cập nhật sent_at và last_error.
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/FeatureFlags.php';
require_once __DIR__ . '/NotificationPreferenceService.php';

class NotificationDeliveryService {
    public const MAX_ATTEMPTS = 3;

    /**
     * Kiểm tra xem bảng notification_deliveries đã có cột next_attempt_at chưa
     */
    public static function hasNextAttemptColumn(?PDO $pdo = null): bool {
        static $hasCol = null;
        if ($hasCol !== null) {
            return $hasCol;
        }

        try {
            $db = $pdo ?: DB::get();
            $cols = $db->query("PRAGMA table_info(notification_deliveries)")->fetchAll(PDO::FETCH_ASSOC);
            $names = array_column($cols, 'name');
            $hasCol = in_array('next_attempt_at', $names, true);
        } catch (Throwable $e) {
            $hasCol = false;
        }
        return $hasCol;
    }

    /**
     * Xử lý hàng đợi chuyển phát
     * @return array Thống kê kết quả: ['processed' => int, 'sent' => int, 'deferred' => int, 'failed' => int, 'skipped' => int]
     */
    public static function processQueue(int $limit = 50): array {
        $pdo = DB::get();
        $hasCol = self::hasNextAttemptColumn($pdo);

        $whereNext = $hasCol ? "AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= datetime('now'))" : "";
        $stmt = $pdo->prepare("
            SELECT d.id, d.notification_id, d.user_id, d.channel, d.attempts,
                   n.title, n.body, n.link,
                   u.email, u.email_verified_at, u.display_name, u.username
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            JOIN users u ON u.id = d.user_id
            WHERE d.status = 'queued' AND d.attempts < ?
              {$whereNext}
            ORDER BY d.created_at ASC
            LIMIT ?
        ");
        $stmt->bindValue(1, self::MAX_ATTEMPTS, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stats = [
            'processed' => count($items),
            'sent'      => 0,
            'deferred'  => 0,
            'failed'    => 0,
            'skipped'   => 0
        ];

        foreach ($items as $item) {
            $delivId = (int)$item['id'];
            $userId  = (int)$item['user_id'];
            $channel = $item['channel'];

            // 1. Kiểm tra khung giờ yên lặng (Quiet Hours) - Không gây tắc nghẽn hàng đợi
            if (NotificationPreferenceService::isInQuietHours($userId)) {
                $resumeTime = NotificationPreferenceService::getQuietHoursResumeTime($userId);
                if ($hasCol && $resumeTime) {
                    $upd = $pdo->prepare("UPDATE notification_deliveries SET next_attempt_at = ?, last_error = 'Hoãn do trong giờ yên lặng' WHERE id = ?");
                    $upd->execute([$resumeTime, $delivId]);
                }
                $stats['deferred']++;
                continue;
            }

            // 2. Chuyển phát theo kênh
            if ($channel === 'email') {
                // Kiểm tra Feature Flag B6
                if (!FeatureFlags::isEnabled('NOTIFICATIONS_EMAIL')) {
                    self::updateDeliveryStatus($delivId, 'skipped', 'Tính năng gửi Email đang tạm tắt (Feature Flag B6)');
                    $stats['skipped']++;
                    continue;
                }

                $email = trim($item['email'] ?? '');
                if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    self::updateDeliveryStatus($delivId, 'skipped', 'Không có địa chỉ email hợp lệ');
                    $stats['skipped']++;
                    continue;
                }

                // Kiểm tra xác thực email (phải qua link token hết hạn)
                if (empty($item['email_verified_at'])) {
                    self::updateDeliveryStatus($delivId, 'skipped', 'Địa chỉ email chưa được xác thực (email_verified_at rỗng)');
                    $stats['skipped']++;
                    continue;
                }

                $res = self::sendEmail(
                    $email,
                    $item['display_name'] ?: $item['username'],
                    $item['title'],
                    $item['body'],
                    $item['link']
                );

                if ($res['success']) {
                    self::updateDeliveryStatus($delivId, 'sent', null);
                    $stats['sent']++;
                } else {
                    $newAttempts = ((int)$item['attempts']) + 1;
                    $newStatus = ($newAttempts >= self::MAX_ATTEMPTS) ? 'failed' : 'queued';
                    self::updateDeliveryStatus($delivId, $newStatus, $res['error'] ?? 'Lỗi gửi email', $newAttempts);
                    $stats['failed']++;
                }
            } elseif ($channel === 'push') {
                // Kiểm tra Feature Flag B6
                if (!FeatureFlags::isEnabled('NOTIFICATIONS_PUSH')) {
                    self::updateDeliveryStatus($delivId, 'skipped', 'Tính năng Web Push đang tạm tắt (Feature Flag B6)');
                    $stats['skipped']++;
                    continue;
                }

                // Stub Web Push khi được bật
                self::updateDeliveryStatus($delivId, 'sent', null);
                $stats['sent']++;
            } else {
                self::updateDeliveryStatus($delivId, 'skipped', "Kênh không hỗ trợ: {$channel}");
                $stats['skipped']++;
            }
        }

        return $stats;
    }

    /**
     * Cập nhật trạng thái của một bản ghi delivery
     */
    private static function updateDeliveryStatus(
        int $deliveryId,
        string $status,
        ?string $error = null,
        ?int $attempts = null
    ): void {
        $pdo = DB::get();

        if ($status === 'sent') {
            $upd = $pdo->prepare("
                UPDATE notification_deliveries 
                SET status = 'sent', sent_at = CURRENT_TIMESTAMP, attempts = attempts + 1, last_error = NULL
                WHERE id = ?
            ");
            $upd->execute([$deliveryId]);
        } elseif ($attempts !== null) {
            $upd = $pdo->prepare("
                UPDATE notification_deliveries 
                SET status = ?, attempts = ?, last_error = ?
                WHERE id = ?
            ");
            $upd->execute([$status, $attempts, $error, $deliveryId]);
        } else {
            $upd = $pdo->prepare("
                UPDATE notification_deliveries 
                SET status = ?, last_error = ?
                WHERE id = ?
            ");
            $upd->execute([$status, $error, $deliveryId]);
        }
    }

    /**
     * Chuẩn hóa và làm sạch tiêu đề email, chống CRLF Injection & mã hoá RFC 2047
     */
    public static function buildSmtpHeaders(
        string $from,
        string $toEmail,
        string $toName,
        string $subject
    ): string {
        $safeFrom    = str_replace(["\r", "\n"], '', $from);
        $safeToEmail = str_replace(["\r", "\n"], '', $toEmail);
        $safeToName  = str_replace(["\r", "\n"], '', $toName);
        $safeSubject = str_replace(["\r", "\n"], '', $subject);

        // Mã hóa Base64 RFC 2047 cho tên hiển thị và subject có dấu / Unicode
        $encodedName    = '=?UTF-8?B?' . base64_encode($safeToName) . '?=';
        $encodedSubject = '=?UTF-8?B?' . base64_encode($safeSubject) . '?=';

        $headers  = "From: SheetApp Thờ Phượng <{$safeFrom}>\r\n";
        $headers .= "To: {$encodedName} <{$safeToEmail}>\r\n";
        $headers .= "Subject: {$encodedSubject}\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "Content-Transfer-Encoding: 8bit\r\n";
        $headers .= "\r\n";

        return $headers;
    }

    /**
     * Áp dụng Dot-stuffing theo RFC 5321 (Section 4.5.2)
     */
    public static function applyDotStuffing(string $content): string {
        $normalized = str_replace(["\r\n", "\r"], "\n", $content);
        $lines = explode("\n", $normalized);
        $stuffed = array_map(static function(string $line): string {
            return str_starts_with($line, '.') ? '.' . $line : $line;
        }, $lines);
        return implode("\r\n", $stuffed);
    }

    /**
     * Gửi email thông báo (Hỗ trợ SMTP cấu hình qua ENV hoặc Mock File Log an toàn)
     */
    public static function sendEmail(
        string $recipientEmail,
        string $recipientName,
        string $subject,
        string $body,
        string $link = ''
    ): array {
        $fullSubject = "[SheetApp] " . $subject;
        $appUrl = getenv('APP_URL') ?: 'https://sheet.hyb.io.vn';
        $fullLink = $link ? (str_starts_with($link, 'http') ? $link : rtrim($appUrl, '/') . '/' . ltrim($link, '/')) : $appUrl;

        // Xây dựng nội dung HTML chuẩn mực
        $htmlContent = self::buildEmailHtml($recipientName, $subject, $body, $fullLink, $appUrl);

        // Kiểm tra cấu hình SMTP trong môi trường
        $smtpHost = getenv('SMTP_HOST');
        if (!empty($smtpHost)) {
            return self::sendViaSmtp($recipientEmail, $recipientName, $fullSubject, $htmlContent);
        }

        // Chế độ MOCK / Log Mailer (an toàn 100% trong dev/test khi không có SMTP server thực)
        $mailDir = __DIR__ . '/../../storage/logs/mail';
        if (!is_dir($mailDir)) {
            @mkdir($mailDir, 0755, true);
        }

        $logEntry = [
            'timestamp'  => date('c'),
            'to'         => str_replace(["\r", "\n"], '', "{$recipientName} <{$recipientEmail}>"),
            'subject'    => str_replace(["\r", "\n"], '', $fullSubject),
            'body'       => $body,
            'link'       => $fullLink
        ];

        $filename = $mailDir . '/mail_' . date('Ymd_His') . '_' . substr(md5(uniqid()), 0, 8) . '.json';
        file_put_contents($filename, json_encode($logEntry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return ['success' => true, 'mock' => true, 'file' => $filename];
    }

    /**
     * Đọc phản hồi từ SMTP Socket và xác thực mã trạng thái
     */
    private static function expectSmtpResponse($socket, array $expectedCodes, string $step): string {
        $response = '';
        while (($line = fgets($socket, 512)) !== false) {
            $response .= $line;
            if (strlen($line) >= 4 && substr($line, 3, 1) === ' ') {
                break;
            }
        }
        $code = (int)substr($response, 0, 3);
        if (!in_array($code, $expectedCodes, true)) {
            throw new RuntimeException("SMTP {$step} thất bại (mã phản hồi {$code}): " . trim($response));
        }
        return $response;
    }

    /**
     * Gửi qua SMTP Socket an toàn (STARTTLS, mã phản hồi chuẩn, CRLF protection, dot-stuffing)
     */
    public static function sendViaSmtp(
        string $toEmail,
        string $toName,
        string $subject,
        string $htmlBody
    ): array {
        $host = getenv('SMTP_HOST') ?: 'localhost';
        $port = (int)(getenv('SMTP_PORT') ?: 587);
        $user = getenv('SMTP_USER') ?: '';
        $pass = getenv('SMTP_PASS') ?: '';
        $from = getenv('SMTP_FROM') ?: 'no-reply@sheet.hyb.io.vn';
        $useTls = (getenv('SMTP_STARTTLS') === 'true') || ($port === 587);

        try {
            $socket = @fsockopen($host, $port, $errno, $errstr, 5);
            if (!$socket) {
                return ['success' => false, 'error' => "Không kết nối được SMTP ({$host}:{$port}): {$errstr}"];
            }

            // 1. Chào hỏi kết nối
            self::expectSmtpResponse($socket, [220], 'CONNECT');

            // 2. EHLO khởi đầu
            fputs($socket, "EHLO " . gethostname() . "\r\n");
            self::expectSmtpResponse($socket, [250], 'EHLO');

            // 3. STARTTLS nếu được cấu hình hoặc cổng 587
            if ($useTls) {
                fputs($socket, "STARTTLS\r\n");
                self::expectSmtpResponse($socket, [220], 'STARTTLS');

                $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if (!$crypto) {
                    fclose($socket);
                    return ['success' => false, 'error' => 'Kích hoạt STARTTLS thất bại'];
                }

                // Gửi lại EHLO sau khi nâng cấp TLS
                fputs($socket, "EHLO " . gethostname() . "\r\n");
                self::expectSmtpResponse($socket, [250], 'EHLO_POST_TLS');
            }

            // 4. Xác thực nếu có user/pass
            if ($user && $pass) {
                fputs($socket, "AUTH LOGIN\r\n");
                self::expectSmtpResponse($socket, [334], 'AUTH_LOGIN');

                fputs($socket, base64_encode($user) . "\r\n");
                self::expectSmtpResponse($socket, [334], 'AUTH_USER');

                fputs($socket, base64_encode($pass) . "\r\n");
                self::expectSmtpResponse($socket, [235], 'AUTH_PASS');
            }

            // 5. MAIL FROM
            $safeFrom = str_replace(["\r", "\n"], '', $from);
            fputs($socket, "MAIL FROM: <{$safeFrom}>\r\n");
            self::expectSmtpResponse($socket, [250], 'MAIL_FROM');

            // 6. RCPT TO
            $safeTo = str_replace(["\r", "\n"], '', $toEmail);
            fputs($socket, "RCPT TO: <{$safeTo}>\r\n");
            self::expectSmtpResponse($socket, [250], 'RCPT_TO');

            // 7. DATA
            fputs($socket, "DATA\r\n");
            self::expectSmtpResponse($socket, [354], 'DATA');

            // 8. Headers & Body (Dot-stuffing)
            $headers = self::buildSmtpHeaders($safeFrom, $safeTo, $toName, $subject);
            $stuffedBody = self::applyDotStuffing($htmlBody);

            fputs($socket, $headers . $stuffedBody . "\r\n.\r\n");
            self::expectSmtpResponse($socket, [250], 'SEND_DATA');

            // 9. QUIT
            fputs($socket, "QUIT\r\n");
            self::expectSmtpResponse($socket, [221], 'QUIT');
            fclose($socket);

            return ['success' => true];
        } catch (Throwable $e) {
            if (isset($socket) && is_resource($socket)) {
                @fclose($socket);
            }
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Tạo template email HTML chuẩn thương hiệu SheetApp
     */
    public static function buildEmailHtml(
        string $name,
        string $title,
        string $body,
        string $link,
        string $appUrl
    ): string {
        $safeName  = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
        $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $safeBody  = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
        $safeLink  = htmlspecialchars($link, ENT_QUOTES, 'UTF-8');
        $prefLink  = htmlspecialchars(rtrim($appUrl, '/') . '/manager/#profile-tab-notifs', ENT_QUOTES, 'UTF-8');

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$safeTitle}</title>
</head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0f172a;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:#090d16;border-bottom:1px solid #334155;">
              <span style="font-size:20px;font-weight:700;color:#38bdf8;">🎵 SheetApp Thờ Phượng</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;">Xin chào <strong>{$safeName}</strong>,</p>
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f8fafc;">{$safeTitle}</h2>
              <div style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-bottom:28px;">
                {$safeBody}
              </div>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="{$safeLink}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                  🚀 Mở Trong SheetApp
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                Bạn nhận được email này vì đã đăng ký thông báo trên SheetApp.<br>
                Để thay đổi tùy chọn kênh hoặc giờ không làm phiền, vui lòng truy cập 
                <a href="{$prefLink}" style="color:#38bdf8;text-decoration:none;">Cài đặt thông báo</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    }
}
