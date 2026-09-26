<?php
/**
 * api/core/AuditLogger.php
 * Ghi nhận nhật ký kiểm toán (Audit Trail) cho các thao tác quản trị và bảo mật nhạy cảm.
 */

class AuditLogger {
    private static ?string $customLogPath = null;

    /**
     * Cho phép cấu hình file log tạm thời trong quá trình kiểm thử tự động
     */
    public static function setLogPath(?string $path): void {
        self::$customLogPath = $path;
    }

    public static function getLogPath(): string {
        if (self::$customLogPath !== null) {
            return self::$customLogPath;
        }
        return dirname(__DIR__, 2) . '/storage/logs/audit.log';
    }

    /**
     * Ghi một mục kiểm toán vào tệp nhật ký
     */
    public static function log(string $action, ?int $actorId, ?int $targetId, array $details = []): bool {
        $entry = [
            'timestamp' => date('c'),
            'action'    => $action,
            'actor_id'  => $actorId,
            'target_id' => $targetId,
            'ip'        => $_SERVER['REMOTE_ADDR'] ?? 'CLI',
            'details'   => $details
        ];

        $filePath = self::getLogPath();
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $jsonLine = json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n";
        return @file_put_contents($filePath, $jsonLine, FILE_APPEND | LOCK_EX) !== false;
    }
}
