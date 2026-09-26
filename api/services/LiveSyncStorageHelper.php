<?php
/**
 * api/services/LiveSyncStorageHelper.php
 *
 * Helper quản lý file storage, atomic write, safe read và flock cho LiveSync.
 * Tách từ LiveSyncService nhằm tuân thủ ngân sách mã nguồn (Code Budget < 600 dòng).
 */

declare(strict_types=1);

class LiveSyncStorageHelper {
    public const ROOM_EXPIRE_HOURS = 12;
    private static ?string $customRoomDir = null;

    public static function setRoomDir(?string $dir): void {
        self::$customRoomDir = $dir;
    }

    public static function roomDir(): string {
        if (self::$customRoomDir !== null) {
            $dir = self::$customRoomDir;
        } else {
            $env = getenv('SHEETAPP_LIVE_SYNC_DIR');
            $dir = !empty($env) ? $env : (__DIR__ . '/../../storage/data/live_sync');
        }
        if (!file_exists($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    public static function roomFile(string $room): string {
        $safeRoom = preg_replace('/[^a-zA-Z0-9_\-]/', '', $room);
        return self::roomDir() . '/' . strtolower($safeRoom) . '.json';
    }

    public static function presenceFile(string $room): string {
        $safeRoom = preg_replace('/[^a-zA-Z0-9_\-]/', '', $room);
        return self::roomDir() . '/' . strtolower($safeRoom) . '.presence.json';
    }

    public static function lockFile(string $room): string {
        $safeRoom = preg_replace('/[^a-zA-Z0-9_\-]/', '', $room);
        return self::roomDir() . '/' . strtolower($safeRoom) . '.lock';
    }

    public static function withLock(string $room, callable $callback) {
        $lockFilePath = self::lockFile($room);
        $fp = @fopen($lockFilePath, 'c+');
        if (!$fp) {
            return $callback();
        }
        if (!@flock($fp, LOCK_EX)) {
            @fclose($fp);
            return $callback();
        }
        try {
            return $callback();
        } finally {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
    }

    public static function readJsonSafe(string $file, int $maxRetries = 3): ?array {
        for ($i = 0; $i < $maxRetries; $i++) {
            if (!file_exists($file)) {
                return null;
            }
            $content = @file_get_contents($file);
            if ($content !== false && $content !== '') {
                $data = json_decode($content, true);
                if (is_array($data)) {
                    return $data;
                }
            }
            usleep(3000); // 3ms chờ atomic rename hoàn tất nếu đang có write
        }
        return null;
    }

    public static function writeJsonAtomic(string $file, array $data): bool {
        $tmpFile = $file . '.tmp.' . bin2hex(random_bytes(4));
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            return false;
        }
        if (@file_put_contents($tmpFile, $json, LOCK_EX) === false) {
            return false;
        }
        if (!@rename($tmpFile, $file)) {
            @unlink($file);
            if (!@rename($tmpFile, $file)) {
                @copy($tmpFile, $file);
                @unlink($tmpFile);
            }
        }
        return true;
    }

    public static function cleanupExpiredRooms(): void {
        $dir = self::roomDir();
        $files = glob($dir . '/*.*') ?: [];
        $cutoff = time() - (self::ROOM_EXPIRE_HOURS * 3600);
        foreach ($files as $f) {
            if (filemtime($f) < $cutoff) {
                @unlink($f);
            }
        }
    }
}
