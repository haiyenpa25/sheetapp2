<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/RotatingLog.php';

final class ClientLogService {
    public static function record(array $data, string $ip): bool {
        $path = getenv('SHEETAPP_CLIENT_ERROR_LOG') ?: __DIR__ . '/../../storage/logs/client_errors.log';
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) return false;
        // One client report occupies exactly one physical log line.
        $clean = static fn(string $value, int $length): string => str_replace(["\r", "\n"], ' ', substr(trim($value), 0, $length));
        $entry = sprintf("[%s] [%s] %s | Source: %s:%d | IP: %s\n",
            date('Y-m-d H:i:s'), $clean($data['type'] ?? 'error', 30),
            $clean($data['message'] ?? $data['reason'] ?? 'unknown', 1000),
            $clean($data['source'] ?? 'unknown', 200), (int)($data['lineno'] ?? 0), $clean($ip, 64));
        return RotatingLog::append($path, $entry);
    }
}
