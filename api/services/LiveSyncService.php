<?php
/**
 * api/services/LiveSyncService.php — Performance Protocol V2 Live Sync Service
 * 
 * Rules:
 * - Sync Musical Position (measure, beat, progress), NOT pixel scrollTop.
 * - Master-Follower authority with hostToken validation.
 * - Auto-incrementing revision to prevent race conditions.
 * - Revision-diffing (modified: false) for ultra-fast, low-bandwidth polling (< 40 bytes).
 */
class LiveSyncService {
    private const ROOM_EXPIRE_HOURS = 12;

    private static function roomDir(): string {
        $dir = __DIR__ . '/../../storage/data/live_sync';
        if (!file_exists($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    private static function roomFile(string $room): string {
        $safeRoom = preg_replace('/[^a-zA-Z0-9_\-]/', '', $room);
        return self::roomDir() . '/' . strtolower($safeRoom) . '.json';
    }

    public static function createRoom(string $room, array $leader = []): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        self::cleanupExpiredRooms();

        $safeRoom  = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $hostToken = bin2hex(random_bytes(16));
        $file      = self::roomFile($safeRoom);

        $initialState = [
            'protocolVersion' => 2,
            'room'            => $safeRoom,
            'hostToken'       => $hostToken,
            'revision'        => 1,
            'active'          => true,
            'createdAt'       => time(),
            'expiresAt'       => time() + (self::ROOM_EXPIRE_HOURS * 3600),
            'serverTime'      => microtime(true),

            'leader' => [
                'clientId' => $leader['clientId'] ?? 'client-host',
                'name'     => $leader['name'] ?? ($leader['leader'] ?? 'Ca Trưởng')
            ],

            'song' => [
                'songId'        => $leader['songId'] ?? '',
                'songTitle'     => $leader['songTitle'] ?? '',
                'arrangementId' => 'default',
                'setlistId'     => $leader['setlistId'] ?? null,
                'setlistIndex'  => (int)($leader['setlistIndex'] ?? 0)
            ],

            'music' => [
                'baseKey'      => $leader['baseKey'] ?? 'C',
                'transpose'    => (int)($leader['transpose'] ?? 0),
                'chordProfile' => $leader['chordProfile'] ?? 'HD',
                'bpm'          => (int)($leader['bpm'] ?? 80),
                'meter'        => [
                    'beats'    => (int)($leader['beats'] ?? 4),
                    'beatUnit' => 4
                ]
            ],

            'position' => [
                'measure'     => (int)($leader['measure'] ?? 1),
                'beat'        => 1,
                'progress'    => 0.0,
                'sectionId'   => 'intro',
                'roadmapStep' => 0
            ],

            'transport' => [
                'state'   => 'stopped', // stopped | count_in | playing | paused
                'startAt' => 0.0
            ],

            'cue' => null
        ];

        @file_put_contents($file, json_encode($initialState, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

        // Trả về cho host có kèm hostToken
        return [
            'success'   => true,
            'room'      => $safeRoom,
            'hostToken' => $hostToken,
            'state'     => self::sanitizeForFollower($initialState)
        ];
    }

    public static function updateRoom(string $room, string $hostToken, array $data): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        $file = self::roomFile($room);
        if (!file_exists($file)) {
            // Nếu chưa có, tự động tạo phòng mới
            return self::createRoom($room, $data);
        }

        $content = @file_get_contents($file);
        $current = json_decode($content, true);
        if (!is_array($current)) {
            return ['success' => false, 'error' => 'Dữ liệu phòng không hợp lệ'];
        }

        // Kiểm tra host token nếu phòng đã được xác lập token
        if (!empty($current['hostToken']) && !empty($hostToken) && $current['hostToken'] !== $hostToken) {
            return ['success' => false, 'error' => 'Không có quyền cập nhật phòng này (Sai Host Token)'];
        }

        $current['revision']   = ($current['revision'] ?? 0) + 1;
        $current['serverTime'] = microtime(true);
        $current['active']     = true;

        if (isset($data['leader']) && is_array($data['leader'])) {
            $current['leader'] = array_merge($current['leader'] ?? [], $data['leader']);
        } elseif (isset($data['leader']) && is_string($data['leader'])) {
            $current['leader']['name'] = $data['leader'];
        }

        if (isset($data['song']) && is_array($data['song'])) {
            $current['song'] = array_merge($current['song'] ?? [], $data['song']);
        } elseif (isset($data['songId'])) {
            $current['song']['songId']    = $data['songId'];
            $current['song']['songTitle'] = $data['songTitle'] ?? ($current['song']['songTitle'] ?? '');
            if (isset($data['setlistId']))    $current['song']['setlistId']    = $data['setlistId'];
            if (isset($data['setlistIndex'])) $current['song']['setlistIndex'] = (int)$data['setlistIndex'];
        }

        if (isset($data['music']) && is_array($data['music'])) {
            $current['music'] = array_merge($current['music'] ?? [], $data['music']);
        } else {
            if (isset($data['transpose']))    $current['music']['transpose']    = (int)$data['transpose'];
            if (isset($data['chordProfile'])) $current['music']['chordProfile'] = $data['chordProfile'];
            if (isset($data['bpm']))          $current['music']['bpm']          = (int)$data['bpm'];
            if (isset($data['baseKey']))      $current['music']['baseKey']      = $data['baseKey'];
        }

        if (isset($data['position']) && is_array($data['position'])) {
            $current['position'] = array_merge($current['position'] ?? [], $data['position']);
        } elseif (isset($data['measure'])) {
            $current['position']['measure'] = (int)$data['measure'];
            if (isset($data['beat']))        $current['position']['beat']        = (int)$data['beat'];
            if (isset($data['progress']))    $current['position']['progress']    = (float)$data['progress'];
            if (isset($data['sectionId']))   $current['position']['sectionId']   = $data['sectionId'];
            if (isset($data['roadmapStep'])) $current['position']['roadmapStep'] = (int)$data['roadmapStep'];
        }

        if (isset($data['transport']) && is_array($data['transport'])) {
            $current['transport'] = array_merge($current['transport'] ?? [], $data['transport']);
        }

        if (array_key_exists('cue', $data)) {
            $current['cue'] = $data['cue'];
        }

        @file_put_contents($file, json_encode($current, JSON_UNESCAPED_UNICODE), LOCK_EX);

        return [
            'success'  => true,
            'revision' => $current['revision'],
            'state'    => self::sanitizeForFollower($current)
        ];
    }

    public static function pollRoom(string $room, int $clientRevision = 0, string $clientId = '', string $role = ''): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        $file = self::roomFile($room);
        if (!file_exists($file)) {
            return ['success' => true, 'active' => false, 'message' => 'Phòng chưa được khởi tạo'];
        }

        $content = @file_get_contents($file);
        $data = json_decode($content, true);
        if (!is_array($data)) {
            return ['success' => true, 'active' => false];
        }

        // Kiểm tra hết hạn phòng
        if (isset($data['expiresAt']) && time() > $data['expiresAt']) {
            @unlink($file);
            return ['success' => true, 'active' => false, 'message' => 'Phòng đã hết hạn'];
        }

        // Presence & Roster Tracking
        $now = time();
        $roster = ['total' => 0, 'roles' => []];
        $dirty = false;

        if (!isset($data['members']) || !is_array($data['members'])) {
            $data['members'] = [];
        }

        if (!empty($clientId)) {
            $prev = $data['members'][$clientId] ?? null;
            if (!$prev || ($now - ($prev['lastSeen'] ?? 0)) >= 4 || ($prev['role'] ?? '') !== $role) {
                $data['members'][$clientId] = [
                    'role'     => $role ?: 'viewer',
                    'lastSeen' => $now
                ];
                $dirty = true;
            }
        }

        foreach ($data['members'] as $cId => $mInfo) {
            $lastSeen = (int)($mInfo['lastSeen'] ?? 0);
            if ($now - $lastSeen > 15) {
                unset($data['members'][$cId]);
                $dirty = true;
            } else {
                $r = $mInfo['role'] ?? 'viewer';
                $roster['total']++;
                $roster['roles'][$r] = ($roster['roles'][$r] ?? 0) + 1;
            }
        }

        $data['roster'] = $roster;

        if ($dirty) {
            @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        $currentRev = (int)($data['revision'] ?? 1);

        // Fast Polling optimization: nếu client đã có revision mới nhất, trả về modified = false siêu nhẹ
        if ($clientRevision > 0 && $clientRevision >= $currentRev) {
            return [
                'success'    => true,
                'active'     => $data['active'] ?? true,
                'modified'   => false,
                'revision'   => $currentRev,
                'roster'     => $roster,
                'serverTime' => microtime(true)
            ];
        }

        return [
            'success'    => true,
            'active'     => $data['active'] ?? true,
            'modified'   => true,
            'revision'   => $currentRev,
            'roster'     => $roster,
            'serverTime' => microtime(true),
            'data'       => self::sanitizeForFollower($data)
        ];
    }

    public static function closeRoom(string $room, string $hostToken): array {
        $file = self::roomFile($room);
        if (file_exists($file)) {
            $content = @file_get_contents($file);
            $data = json_decode($content, true);
            if (is_array($data) && (!empty($data['hostToken']) && $data['hostToken'] === $hostToken)) {
                $data['active'] = false;
                $data['revision'] = ($data['revision'] ?? 0) + 1;
                @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
                return ['success' => true, 'message' => 'Đã đóng phòng Live'];
            }
        }
        return ['success' => false, 'error' => 'Không thể đóng phòng'];
    }

    private static function sanitizeForFollower(array $state): array {
        // Giấu hostToken khỏi followers
        $sanitized = $state;
        unset($sanitized['hostToken']);
        return $sanitized;
    }

    public static function cleanupExpiredRooms(): void {
        $dir = self::roomDir();
        $files = glob($dir . '/*.json') ?: [];
        $cutoff = time() - (self::ROOM_EXPIRE_HOURS * 3600);
        foreach ($files as $f) {
            if (filemtime($f) < $cutoff) {
                @unlink($f);
            }
        }
    }
}
