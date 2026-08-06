<?php
/**
 * api/core/Config.php
 * Quản lý các cấu hình toàn cục.
 */
class Config {
    public static function get(string $key, $default = null) {
        $env = getenv($key);
        if ($env !== false) {
            return $env;
        }

        $dbPath = __DIR__ . '/../../storage/data/app.sqlite';
        if (!file_exists($dbPath)) {
            $dbPath = __DIR__ . '/../../storage/data/sheetapp.sqlite';
        }

        $config = [
            'OMR_ENGINE_URL' => 'http://localhost:5555', // Mặc định cho Docker
            'DB_PATH' => $dbPath
        ];

        return $config[$key] ?? $default;

    }
}
