<?php
declare(strict_types=1);

final class Session {
    public static function cookieOptions(?bool $isHttps = null): array {
        if ($isHttps === null) {
            $forwardedProto = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
            $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $forwardedProto === 'https';
        }
        return [
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }

    /** .htaccess `Header` không được máy chủ (OpenLiteSpeed) áp dụng → gửi các header an toàn từ PHP. */
    public static function sendSecurityHeaders(): void {
        if (PHP_SAPI === 'cli' || headers_sent()) return;
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header_remove('X-Powered-By');
    }

    public static function start(): void {
        self::sendSecurityHeaders();
        if (session_status() === PHP_SESSION_ACTIVE) return;
        if (headers_sent()) { @session_start(); return; } // đã có đầu ra (CLI/test): không đổi được tham số cookie
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_set_cookie_params(self::cookieOptions());
        session_start();
        require_once __DIR__ . '/RememberLogin.php';
        RememberLogin::restoreSession();
    }
}
