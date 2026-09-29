<?php
/**
 * api/core/Response.php — JSON response helpers
 */
require_once __DIR__ . '/HttpException.php';

class Response {
    public static function ok(mixed $data = [], bool|string $pretty = false): void {
        $message = is_string($pretty) ? $pretty : null;
        $flags = JSON_UNESCAPED_UNICODE | ($pretty === true ? JSON_PRETTY_PRINT : 0);
        if (is_array($data)) {
            $payload = array_merge(['success' => true], $data);
            if ($message !== null && !array_key_exists('message', $payload)) {
                $payload['message'] = $message;
            }
            echo json_encode($payload, $flags);
            return;
        }
        echo json_encode($data, $flags);
    }

    public static function abort(int $code, string $msg = ''): never {
        throw new HttpException($code, $msg);
    }

    public static function error(string $message, int $code = 400): void {
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    }

    public static function notFound(string $msg = 'Không tìm thấy'): void {
        self::error($msg, 404);
    }

    public static function forbidden(string $msg = 'Không có quyền'): void {
        self::error($msg, 403);
    }

    public static function unauthorized(string $msg = 'Cần đăng nhập'): void {
        self::error($msg, 401);
    }

    public static function badRequest(string $msg = 'Yêu cầu không hợp lệ'): void {
        self::error($msg, 400);
    }

    public static function created(mixed $data = [], ?string $message = null): void {
        http_response_code(201);
        self::ok($data, $message ?? 'Đã tạo thành công');
    }

    public static function serverError(Throwable $error, string $context = 'API'): void {
        if ($error instanceof HttpException) {
            self::error($error->getMessage(), $error->getStatusCode());
            return;
        }
        error_log(sprintf(
            'SheetApp %s error: %s in %s:%d',
            $context,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine()
        ));
        self::error('Lỗi hệ thống. Vui lòng thử lại sau.', 500);
    }

    public static function methodNotAllowed(): void {
        self::error('Method không được hỗ trợ', 405);
    }
}
