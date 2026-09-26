<?php
/**
 * api/core/Config.php
 * Quản lý các cấu hình toàn cục.
 */
class Config {
    public const SHEETAPP_CACHE_VERSION = 'v5';
    public const SHEETAPP_CACHE_NAME = 'sheetapp-musicxml-v5';

    public static function get(string $key, $default = null) {
        if ($key === 'DB_PATH') {
            if (PHP_SAPI === 'cli') {
                $customPath = getenv('DB_PATH') ?: (getenv('SHEETAPP_DB_PATH') ?: ($_ENV['SHEETAPP_DB_PATH'] ?? ($_SERVER['SHEETAPP_DB_PATH'] ?? null)));
                if ($customPath && is_string($customPath) && trim($customPath) !== '') {
                    return trim($customPath);
                }
                // Tự động cách ly vào temp dir nếu đang chạy test suite từ CLI mà chưa đặt SHEETAPP_DB_PATH
                $script = $_SERVER['SCRIPT_FILENAME'] ?? ($_SERVER['argv'][0] ?? '');
                if (str_contains(str_replace('\\', '/', $script), '/tests/')) {
                    $realDb = __DIR__ . '/../../storage/data/app.sqlite';
                    if (file_exists($realDb)) {
                        $tempDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sheetapp_cli_test_' . uniqid() . '.sqlite';
                        copy($realDb, $tempDb);
                        if (file_exists($realDb . '-wal')) @copy($realDb . '-wal', $tempDb . '-wal');
                        if (file_exists($realDb . '-shm')) @copy($realDb . '-shm', $tempDb . '-shm');
                        putenv("SHEETAPP_DB_PATH={$tempDb}");
                        $_ENV['SHEETAPP_DB_PATH'] = $tempDb;
                        register_shutdown_function(function() use ($tempDb) {
                            @unlink($tempDb);
                            @unlink($tempDb . '-wal');
                            @unlink($tempDb . '-shm');
                        });
                        return $tempDb;
                    }
                }
            }
            $dbPath = __DIR__ . '/../../storage/data/app.sqlite';
            if (!file_exists($dbPath)) {
                $dbPath = __DIR__ . '/../../storage/data/sheetapp.sqlite';
            }
            return $dbPath;
        }

        $env = getenv($key);
        if ($env !== false) {
            return $env;
        }

        $config = [
            'OMR_ENGINE_URL' => 'http://localhost:5555',
        ];

        return $config[$key] ?? $default;
    }
}
