<?php
/**
 * api/services/SessionService.php — Business logic cho Sessions
 */
class SessionService {
    private const DIR = __DIR__ . '/../../storage/data/sessions/';

    public static function load(string $songId, int $userId = 0): array {
        if ($userId <= 0) return self::defaults($songId);
        $file = self::file($songId, $userId);
        if (!file_exists($file)) return self::defaults($songId);
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) return self::defaults($songId);
        $data['userSettings'] ??= self::defaultSettings();
        $data['perfNotes']    ??= (object)[];
        return $data;
    }

    public static function saveUserSettings(string $songId, int $userId, array $settings): array {
        if ($userId <= 0) throw new InvalidArgumentException('Thiếu người dùng');
        $existing = self::load($songId, $userId);
        $merged = array_merge($existing['userSettings'], $settings);
        if (isset($merged['history']) && is_array($merged['history'])) {
            usort($merged['history'], fn($a,$b) => strcmp($a['date']??'', $b['date']??''));
            $merged['history'] = array_slice($merged['history'], -50);
        }
        self::write($songId, $userId, array_merge($existing, ['lastSaved' => date('c'), 'userSettings' => $merged]));
        return $merged;
    }

    public static function savePerfNotes(string $songId, int $userId, array $notes): array {
        if ($userId <= 0) throw new InvalidArgumentException('Thiếu người dùng');
        $existing = self::load($songId, $userId);
        $safe = [
            'key'       => substr(trim($notes['key']  ?? ''), 0, 20),
            'bpm'       => substr(trim($notes['bpm']  ?? ''), 0, 10),
            'text'      => substr(trim($notes['text'] ?? ''), 0, 2000),
            'updatedAt' => $notes['updatedAt'] ?? date('c'),
        ];
        self::write($songId, $userId, array_merge($existing, ['lastSaved' => date('c'), 'perfNotes' => $safe]));
        return $safe;
    }

    private static function file(string $songId, int $userId): string {
        if (!is_dir(self::DIR)) mkdir(self::DIR, 0775, true);
        $prefix = preg_replace('/[^a-z0-9\-]/', '', strtolower(substr($songId, 0, 30)));
        $hash   = substr(md5($songId), 0, 8);
        return self::DIR . 'u' . $userId . '_' . ($prefix ? "{$prefix}_{$hash}" : $hash) . '.json';
    }

    private static function write(string $songId, int $userId, array $data): void {
        file_put_contents(self::file($songId, $userId), json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }

    private static function defaults(string $songId): array {
        return ['songId' => $songId, 'userSettings' => self::defaultSettings(), 'perfNotes' => (object)[]];
    }

    private static function defaultSettings(): array {
        return ['lastTranspose' => 0, 'zoomLevel' => 1.0, 'chordOverrides' => [], 'history' => []];
    }
}
