<?php
declare(strict_types=1);

/** Size-bounded logs. A stable sidecar lock serializes rotation and append. */
final class RotatingLog {
    public const MAX_BYTES = 5 * 1024 * 1024;
    public const ARCHIVES = 3;

    public static function append(string $path, string $entry, int $maxBytes = self::MAX_BYTES, int $archives = self::ARCHIVES): bool {
        if ($maxBytes < 1 || $archives < 1) return false;
        $lock = @fopen($path . '.lock', 'c');
        if ($lock === false) {
            error_log('SheetApp log: sidecar lock unavailable; using locked append');
            return @file_put_contents($path, $entry, FILE_APPEND | LOCK_EX) === strlen($entry);
        }
        try {
            if (!flock($lock, LOCK_EX)) {
                error_log('SheetApp log: cannot lock sidecar; using locked append');
                return @file_put_contents($path, $entry, FILE_APPEND | LOCK_EX) === strlen($entry);
            }
            clearstatcache(true, $path);
            $size = is_file($path) ? @filesize($path) : 0;
            if ($size > 0 && $size + strlen($entry) > $maxBytes && !self::rotate($path, $archives)) {
                error_log('SheetApp log: rotation failed; retaining current log and appending');
            }
            return @file_put_contents($path, $entry, FILE_APPEND | LOCK_EX) === strlen($entry);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private static function rotate(string $path, int $archives): bool {
        $oldest = $path . '.' . $archives;
        if (is_file($oldest) && !@unlink($oldest)) return false;
        for ($index = $archives - 1; $index >= 1; $index--) {
            $source = $path . '.' . $index;
            if (is_file($source) && !@rename($source, $path . '.' . ($index + 1))) return false;
        }
        return @rename($path, $path . '.1');
    }
}
