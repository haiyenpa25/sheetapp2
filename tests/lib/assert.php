<?php
declare(strict_types=1);

/**
 * tests/lib/assert.php — Assertion helpers for behavioral and static checks (Ticket K5)
 */

class TestAssert {
    private static int $total = 0;
    private static int $behavioralPass = 0;
    private static int $staticPass = 0;
    private static int $failed = 0;

    public static function checkBehavior(string $name, bool $condition, string $detail = ''): void {
        self::$total++;
        if ($condition) {
            self::$behavioralPass++;
            echo "  [PASS:B] [{$name}] {$detail}\n";
        } else {
            self::$failed++;
            echo "  [FAIL:B] [{$name}] {$detail}\n";
        }
    }

    public static function checkStatic(string $name, bool $condition, string $detail = ''): void {
        self::$total++;
        if ($condition) {
            self::$staticPass++;
            echo "  [PASS:S] [{$name}] {$detail}\n";
        } else {
            self::$failed++;
            echo "  [FAIL:S] [{$name}] {$detail}\n";
        }
    }

    public static function finish(): void {
        echo "\nSUITE_COMPLETE total=" . self::$total . "\n";
        if (self::$failed > 0) {
            exit(1);
        }
        exit(0);
    }
}

if (!function_exists('checkBehavior')) {
    function checkBehavior(string $name, bool $condition, string $detail = ''): void {
        TestAssert::checkBehavior($name, $condition, $detail);
    }
}

if (!function_exists('checkStatic')) {
    function checkStatic(string $name, bool $condition, string $detail = ''): void {
        TestAssert::checkStatic($name, $condition, $detail);
    }
}
