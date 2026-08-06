<?php
/**
 * api/services/LiveSyncService.php — Fast Live Band Sync Service
 */
class LiveSyncService {
    private static function roomDir(): string {
        $dir = __DIR__ . '/../../storage/data/live_sync';
        if (!file_exists($dir)) {
            @mkdir($dir, 0777, true);
        }
        return $dir;
    }

    private static function roomFile(string $room): string {
        $safeRoom = preg_replace('/[^a-zA-Z0-9_\-]/', '', $room);
        return self::roomDir() . '/' . strtolower($safeRoom) . '.json';
    }

    public static function updateRoom(string $room, array $data): array {
        if (empty($room)) return ['error' => 'Thiếu room ID'];
        $file = self::roomFile($room);
        $payload = [
            'room'      => $room,
            'songId'    => $data['songId'] ?? '',
            'songTitle' => $data['songTitle'] ?? '',
            'page'      => (int)($data['page'] ?? 1),
            'scrollTop' => (float)($data['scrollTop'] ?? 0),
            'timestamp' => microtime(true),
            'leader'    => $data['leader'] ?? 'Ca Trưởng'
        ];

        @file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE));
        return ['success' => true, 'data' => $payload];
    }

    public static function pollRoom(string $room): array {
        if (empty($room)) return ['error' => 'Thiếu room ID'];
        $file = self::roomFile($room);
        if (!file_exists($file)) {
            return ['success' => true, 'active' => false, 'message' => 'Phòng chưa được khởi tạo'];
        }

        $content = @file_get_contents($file);
        $data = json_decode($content, true);
        if (!is_array($data)) {
            return ['success' => true, 'active' => false];
        }

        return ['success' => true, 'active' => true, 'data' => $data];
    }
}
