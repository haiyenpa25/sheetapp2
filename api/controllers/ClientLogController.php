<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/LoginRateLimiter.php';
require_once __DIR__ . '/../services/ClientLogService.php';

final class ClientLogController {
    private const MAX_BODY_BYTES = 8192;

    public function handleRequest(string $method): void {
        if ($method !== 'POST') { Response::methodNotAllowed(); return; }
        $body = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if ($body === false || strlen($body) > self::MAX_BODY_BYTES) {
            Response::error('Nội dung log vượt quá 8 KB.', 413);
            return;
        }
        $data = json_decode($body, true);
        if (!is_array($data) || !$data || !self::validFields($data)) {
            Response::error('Nội dung log không hợp lệ.');
            return;
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $key = LoginRateLimiter::key('client-log:' . $ip, session_id());
        $ipKey = LoginRateLimiter::key('client-log-ip:' . $ip, '');
        if (LoginRateLimiter::isBlocked($key, 60) || LoginRateLimiter::isBlocked($ipKey, 500)) {
            Response::error('Quá nhiều bản ghi log. Vui lòng thử lại sau.', 429);
            return;
        }
        LoginRateLimiter::recordFailure($key);
        LoginRateLimiter::recordFailure($ipKey);
        if (!ClientLogService::record($data, $ip)) {
            Response::error('Không thể ghi log.', 500);
            return;
        }
        Response::ok();
    }

    private static function validFields(array $data): bool {
        foreach (['type', 'message', 'reason', 'source'] as $field) {
            if (isset($data[$field]) && !is_string($data[$field])) return false;
        }
        return !isset($data['lineno']) || is_int($data['lineno']);
    }
}
