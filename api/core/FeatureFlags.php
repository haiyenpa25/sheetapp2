<?php
declare(strict_types=1);

/**
 * api/core/FeatureFlags.php — Server-side Feature Flags for Phase 4 (Ticket F1)
 */
class FeatureFlags {
    public const DEFAULTS = [
        'csrf_enforce'         => false,
        'PRACTICE_ASSIGNMENTS' => false,
        'REVIEW_WORKFLOW'      => false,
        'EXPORT_CHORDPRO'      => false,
        'USAGE_REPORT'         => false,
        'NOTIFICATIONS_INAPP'  => false,
        'NOTIFICATIONS_EMAIL'  => false,
        'NOTIFICATIONS_PUSH'   => false,
        'MULTI_CHURCH'         => false, // đa Hội Thánh: cô lập chương trình lễ theo HT (migration 018)
    ];

    private static ?array $flags = null;

    public static function isEnabled(string $flag): bool {
        self::load();
        return self::$flags[$flag] ?? (self::DEFAULTS[$flag] ?? false);
    }

    public static function all(): array {
        self::load();
        return self::$flags ?? self::DEFAULTS;
    }

    public static function setOverride(string $flag, bool $value): void {
        self::load();
        self::$flags[$flag] = $value;
    }

    public static function reset(): void {
        self::$flags = null;
    }

    private static function load(): void {
        if (self::$flags !== null) {
            return;
        }

        self::$flags = self::DEFAULTS;

        $configDir = dirname(__DIR__, 2) . '/storage/config/';
        // Bộ test đặt biến này để kết quả không phụ thuộc cờ máy dev (vd. bật MULTI_CHURCH ở features.local.json).
        $files = getenv('SHEETAPP_IGNORE_LOCAL_FEATURES') ? ['features.json'] : ['features.json', 'features.local.json'];
        foreach ($files as $name) {
            $configFile = $configDir . $name;
            if (!is_file($configFile)) continue;
            $content = @file_get_contents($configFile);
            if ($content !== false) {
                $json = json_decode($content, true);
                if (is_array($json)) {
                    foreach (self::DEFAULTS as $k => $v) {
                        if (array_key_exists($k, $json)) {
                            self::$flags[$k] = (bool)$json[$k];
                        }
                    }
                }
            }
        }
    }
}
