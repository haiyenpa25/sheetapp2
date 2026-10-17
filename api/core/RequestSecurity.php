<?php
declare(strict_types=1);

final class RequestSecurity {
    public static function isSameOrigin(array $server): bool {
        if (strtolower((string)($server['HTTP_SEC_FETCH_SITE'] ?? '')) === 'cross-site') {
            return false;
        }

        $origin = trim((string)($server['HTTP_ORIGIN'] ?? ''));
        if ($origin === '') {
            $origin = trim((string)($server['HTTP_REFERER'] ?? ''));
            if ($origin === '') return true;
        }

        $originParts = parse_url($origin);
        if (!is_array($originParts) || empty($originParts['host'])) return false;

        $forwardedProto = strtolower((string)($server['HTTP_X_FORWARDED_PROTO'] ?? ''));
        $scheme = (!empty($server['HTTPS']) && $server['HTTPS'] !== 'off') || $forwardedProto === 'https' ? 'https' : 'http';
        $host = strtolower((string)($server['HTTP_HOST'] ?? ''));
        $originHost = strtolower($originParts['host']);
        if (isset($originParts['port'])) $originHost .= ':' . $originParts['port'];

        return strtolower((string)($originParts['scheme'] ?? '')) === $scheme && hash_equals($host, $originHost);
    }

    public static function requiresOriginCheck(string $method): bool {
        return in_array(strtoupper($method), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    public static function ensureCsrfToken(array $server = []): string {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return '';
        }
        if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        if (!headers_sent() && empty($_COOKIE['XSRF-TOKEN'])) {
            $isHttps = !empty($server['HTTPS']) && $server['HTTPS'] !== 'off';
            @setcookie('XSRF-TOKEN', $_SESSION['csrf_token'], [
                'path' => '/',
                'secure' => $isHttps,
                'httponly' => false,
                'samesite' => 'Lax',
            ]);
        }
        return $_SESSION['csrf_token'];
    }

    public static function isValidCsrf(array $server): bool {
        $sent = trim((string)($server['HTTP_X_CSRF_TOKEN'] ?? ''));
        $real = (string)($_SESSION['csrf_token'] ?? '');
        return $real !== '' && $sent !== '' && hash_equals($real, $sent);
    }
}
