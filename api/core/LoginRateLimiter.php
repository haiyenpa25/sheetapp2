<?php
declare(strict_types=1);

final class LoginRateLimiter {
    private const MAX_ATTEMPTS = 10;
    private const WINDOW_SECONDS = 900;

    public static function key(string $ipAddress, string $username): string {
        return hash('sha256', strtolower(trim($ipAddress)) . '|' . strtolower(trim($username)));
    }

    public static function isBlocked(string $key): bool {
        return count(self::read($key)) >= self::MAX_ATTEMPTS;
    }

    public static function recordFailure(string $key): void {
        self::mutate($key, static function(array $attempts): array {
            $attempts[] = time();
            return $attempts;
        });
    }

    public static function clear(string $key): void {
        $file = self::file($key);
        if (is_file($file)) @unlink($file);
    }

    private static function directory(): string {
        $configured = getenv('LOGIN_RATE_LIMIT_DIR');
        $dir = $configured !== false && $configured !== '' ? $configured : __DIR__ . '/../../storage/data/login_rate_limits';
        if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
            throw new RuntimeException('Cannot create login rate-limit storage');
        }
        return $dir;
    }

    private static function file(string $key): string {
        return self::directory() . '/' . preg_replace('/[^a-f0-9]/', '', strtolower($key)) . '.json';
    }

    private static function activeAttempts(array $attempts): array {
        $cutoff = time() - self::WINDOW_SECONDS;
        return array_values(array_filter($attempts, static fn($at) => is_int($at) && $at >= $cutoff));
    }

    private static function read(string $key): array {
        $file = self::file($key);
        if (!is_file($file)) return [];
        $decoded = json_decode((string)file_get_contents($file), true);
        return self::activeAttempts(is_array($decoded['attempts'] ?? null) ? $decoded['attempts'] : []);
    }

    private static function mutate(string $key, callable $mutation): void {
        $file = self::file($key);
        $handle = fopen($file, 'c+');
        if ($handle === false) throw new RuntimeException('Cannot open login rate-limit state');
        try {
            if (!flock($handle, LOCK_EX)) throw new RuntimeException('Cannot lock login rate-limit state');
            rewind($handle);
            $decoded = json_decode((string)stream_get_contents($handle), true);
            $attempts = self::activeAttempts(is_array($decoded['attempts'] ?? null) ? $decoded['attempts'] : []);
            $attempts = $mutation($attempts);
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode(['attempts' => $attempts], JSON_UNESCAPED_SLASHES));
            fflush($handle);
            flock($handle, LOCK_UN);
        } finally {
            fclose($handle);
        }
    }
}
