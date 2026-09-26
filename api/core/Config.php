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
                $customPath = getenv('SHEETAPP_DB_PATH') ?: (getenv('DB_PATH') ?: ($_ENV['SHEETAPP_DB_PATH'] ?? ($_SERVER['SHEETAPP_DB_PATH'] ?? null)));
                if ($customPath && is_string($customPath) && trim($customPath) !== '') {
                    return trim($customPath);
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
