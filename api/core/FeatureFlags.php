<?php
declare(strict_types=1);

/**
 * api/core/FeatureFlags.php — Server-side Feature Flags for Phase 4 (Ticket F1)
 */
class FeatureFlags {
    public const DEFAULTS = [
        'PRACTICE_ASSIGNMENTS' => false,
        'REVIEW_WORKFLOW'      => false,
        'EXPORT_CHORDPRO'      => false,
        'USAGE_REPORT'         => false,
        'NOTIFICATIONS_INAPP'  => false,
        'NOTIFICATIONS_EMAIL'  => false,
        'NOTIFICATIONS_PUSH'   => false,
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

        $configFile = dirname(__DIR__, 2) . '/storage/config/features.json';
        if (file_exists($configFile)) {
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
