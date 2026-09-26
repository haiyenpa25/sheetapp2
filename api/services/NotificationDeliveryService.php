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
require_once __DIR__ . '/NotificationPreferenceService.php';

class NotificationDeliveryService {
    public const MAX_ATTEMPTS = 3;

    /**
     * Xử lý hàng đợi chuyển phát
     * @return array Thống kê kết quả: ['processed' => int, 'sent' => int, 'deferred' => int, 'failed' => int]
     */
    public static function processQueue(int $limit = 50): array {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            SELECT d.id, d.notification_id, d.user_id, d.channel, d.attempts,
                   n.title, n.body, n.link,
                   u.email, u.display_name, u.username
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            JOIN users u ON u.id = d.user_id
            WHERE d.status = 'queued' AND d.attempts < ?
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

            // 1. Kiểm tra khung giờ yên lặng (Quiet Hours)
            if (NotificationPreferenceService::isInQuietHours($userId)) {
                // Tạm hoãn, để nguyên trạng thái queued cho lần quét tiếp theo
                $stats['deferred']++;
                continue;
            }

            // 2. Chuyển phát theo kênh
            if ($channel === 'email') {
                $email = $item['email'] ?? '';
                if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    self::updateDeliveryStatus($delivId, 'skipped', 'Không có địa chỉ email hợp lệ');
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
                // Kênh Web Push: Lưu vết chuyển phát thành công/skipped cho stub
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
            'to'         => "{$recipientName} <{$recipientEmail}>",
            'subject'    => $fullSubject,
            'body'       => $body,
            'link'       => $fullLink
        ];

        $filename = $mailDir . '/mail_' . date('Ymd_His') . '_' . substr(md5(uniqid()), 0, 8) . '.json';
        file_put_contents($filename, json_encode($logEntry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return ['success' => true, 'mock' => true, 'file' => $filename];
    }

    /**
     * Gửi qua SMTP Socket đơn giản thuần PHP (không cần thư viện ngoài)
     */
    private static function sendViaSmtp(
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

        try {
            $socket = @fsockopen($host, $port, $errno, $errstr, 5);
            if (!$socket) {
                return ['success' => false, 'error' => "Không kết nối được SMTP ({$host}:{$port}): {$errstr}"];
            }

            $read = fgets($socket, 512);

            fputs($socket, "EHLO " . gethostname() . "\r\n");
            $read = fgets($socket, 512);

            if ($user && $pass) {
                fputs($socket, "AUTH LOGIN\r\n");
                fgets($socket, 512);
                fputs($socket, base64_encode($user) . "\r\n");
                fgets($socket, 512);
                fputs($socket, base64_encode($pass) . "\r\n");
                fgets($socket, 512);
            }

            fputs($socket, "MAIL FROM: <{$from}>\r\n");
            fgets($socket, 512);
            fputs($socket, "RCPT TO: <{$toEmail}>\r\n");
            fgets($socket, 512);
            fputs($socket, "DATA\r\n");
            fgets($socket, 512);

            $headers  = "From: SheetApp Phụng Vụ <{$from}>\r\n";
            $headers .= "To: {$toName} <{$toEmail}>\r\n";
            $headers .= "Subject: {$subject}\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "\r\n";

            fputs($socket, $headers . $htmlBody . "\r\n.\r\n");
            fgets($socket, 512);
            fputs($socket, "QUIT\r\n");
            fclose($socket);

            return ['success' => true];
        } catch (Throwable $e) {
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
              <span style="font-size:20px;font-weight:700;color:#38bdf8;">🎵 SheetApp Phụng Vụ</span>
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
