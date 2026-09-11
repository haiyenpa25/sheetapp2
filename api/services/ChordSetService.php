<?php
/**
 * api/services/ChordSetService.php
 */
class ChordSetService {
    // BUG-B fix: lưu trong storage/ cùng với DB và sessions
    public const BASE_DIR = __DIR__ . '/../../storage/data/chord_sets';

    private static function getSongDir(string $songId): string {
        $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
        $dir  = self::BASE_DIR . '/' . $safe;
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return $dir;
    }

    /**
     * Chuẩn hóa tên set thành tên file an toàn.
     * Quy tắc: chỉ giữ ký tự alphanumeric + dấu gạch dưới + gạch ngang.
     * "HD" → "HD.json", "Hoài Dinh" → "Ho_i_Dinh.json"
     * KHÔNG dùng str_replace(' ', '_') vì bị mất ký tự đặc biệt có dấu.
     */
    private static function sanitizeName(string $name): string {
        // Chuẩn hóa Unicode: loại bỏ dấu (NFD decompose rồi strip non-ASCII)
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        if ($normalized === false || $normalized === '') {
            // Fallback: giữ nguyên nếu iconv fail
            $normalized = $name;
        }
        // Chỉ giữ lại a-z, A-Z, 0-9, gạch dưới, gạch ngang
        return preg_replace('/[^a-zA-Z0-9_\-]+/', '_', trim($normalized));
    }

    private static function getSetFile(string $songId, string $name): string {
        $safe = self::sanitizeName($name);
        return self::getSongDir($songId) . '/' . $safe . '.json';
    }

    public static function listSets(string $songId): array {
        $dir   = self::getSongDir($songId);
        $files = glob($dir . '/*.json') ?: [];

        $names = [];
        foreach ($files as $f) {
            $filename = pathinfo($f, PATHINFO_FILENAME);
            // Trả về tên file gốc (đã sanitize) — client dùng chính tên này để load/save
            // Không cần đổi _ thành space vì tên set quan trọng là nhất quán, không phải đẹp
            $names[] = $filename;
        }
        return array_values($names);
    }

    public static function loadSet(string $songId, string $name): array {
        $file = self::getSetFile($songId, $name);
        if (!file_exists($file)) {
            // Thử fallback tìm tên file khớp không phân biệt hoa thường
            $dir   = self::getSongDir($songId);
            $safe  = self::sanitizeName($name);
            $files = glob($dir . '/*.json') ?: [];
            foreach ($files as $f) {
                if (strcasecmp(pathinfo($f, PATHINFO_FILENAME), $safe) === 0) {
                    return json_decode(file_get_contents($f), true) ?? [];
                }
            }
            return [];
        }
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    public static function saveSet(string $songId, string $name, array $chords): bool {
        // RULE: Không cho phép ghi đè lên bộ gốc TLH / default
        if ($name === 'default' || $name === 'TLH') {
            return false;
        }
        $file = self::getSetFile($songId, $name);
        $json = json_encode($chords, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return file_put_contents($file, $json) !== false;
    }

    public static function cloneSet(string $songId, string $sourceName, string $targetName): bool {
        $sourceChords = self::loadSet($songId, $sourceName);
        return self::saveSet($songId, $targetName, $sourceChords);
    }

    public static function deleteSet(string $songId, string $name): void {
        if ($name === 'default' || $name === 'TLH' || $name === 'HD') {
            return;
        }
        $file = self::getSetFile($songId, $name);
        if (file_exists($file)) unlink($file);
    }
}
