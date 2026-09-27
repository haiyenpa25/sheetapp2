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
require_once __DIR__ . '/LiveSyncStorageHelper.php';

class LiveSyncService {
    public const ROOM_EXPIRE_HOURS = LiveSyncStorageHelper::ROOM_EXPIRE_HOURS;

    /**
     * Cho phép ghi đè thư mục lưu phòng (dùng cho test suite hoặc cấu hình môi trường)
     */
    public static function setRoomDir(?string $dir): void {
        LiveSyncStorageHelper::setRoomDir($dir);
    }

    private static function roomDir(): string {
        return LiveSyncStorageHelper::roomDir();
    }

    private static function roomFile(string $room): string {
        return LiveSyncStorageHelper::roomFile($room);
    }

    private static function presenceFile(string $room): string {
        return LiveSyncStorageHelper::presenceFile($room);
    }

    private static function withLock(string $room, callable $callback) {
        return LiveSyncStorageHelper::withLock($room, $callback);
    }

    private static function readJsonSafe(string $file, int $maxRetries = 3): ?array {
        return LiveSyncStorageHelper::readJsonSafe($file, $maxRetries);
    }

    /**
     * Ghi file JSON nguyên tử bằng rename($tmpFile, $file) thông qua LiveSyncStorageHelper
     */
    private static function writeJsonAtomic(string $file, array $data): bool {
        return LiveSyncStorageHelper::writeJsonAtomic($file, $data);
    }



    private static function syncPresence(string $safeRoom, string $clientId = '', string $role = ''): array {
        $pFile = self::presenceFile($safeRoom);
        $pLock = self::roomDir() . '/' . strtolower($safeRoom) . '.presence.lock';
        $fp = @fopen($pLock, 'c+');
        if ($fp) {
            @flock($fp, LOCK_EX);
        }

        try {
            $now = time();
            $roster = ['total' => 0, 'roles' => []];
            $members = self::readJsonSafe($pFile, 2) ?? [];
            $dirty = false;

            if (!empty($clientId)) {
                $prev = $members[$clientId] ?? null;
                if (!$prev || ($now - ($prev['lastSeen'] ?? 0)) >= 4 || ($prev['role'] ?? '') !== $role) {
                    $members[$clientId] = [
                        'role'     => $role ?: 'viewer',
                        'lastSeen' => $now
                    ];
                    $dirty = true;
                }
            }

            foreach ($members as $cId => $mInfo) {
                $lastSeen = (int)($mInfo['lastSeen'] ?? 0);
                if ($now - $lastSeen > 15) {
                    unset($members[$cId]);
                    $dirty = true;
                } else {
                    $r = $mInfo['role'] ?? 'viewer';
                    $roster['total']++;
                    $roster['roles'][$r] = ($roster['roles'][$r] ?? 0) + 1;
                }
            }

            if ($dirty) {
                self::writeJsonAtomic($pFile, $members);
            }

            return $roster;
        } finally {
            if ($fp) {
                @flock($fp, LOCK_UN);
                @fclose($fp);
            }
        }
    }

    public static function createRoom(string $room, array $leader = []): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        self::cleanupExpiredRooms();

        $safeRoom  = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $hostToken = bin2hex(random_bytes(16));
        $file      = self::roomFile($safeRoom);

        return self::withLock($safeRoom, function() use ($safeRoom, $hostToken, $file, $leader) {
            if (file_exists($file)) {
                return ['success' => false, 'error' => 'Mã phòng đang được sử dụng'];
            }

            $initialState = [
                'protocolVersion' => 2,
                'room'            => $safeRoom,
                'hostToken'       => $hostToken,
                'revision'        => 1,
                'lastEventId'     => 'EVT-' . $safeRoom . '-1',
                'events'          => [],
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

                'verse' => [
                    'verseIndex' => (int)($leader['verseIndex'] ?? ($leader['verse']['verseIndex'] ?? 1)),
                    'verseMode'  => $leader['verseMode'] ?? ($leader['verse']['verseMode'] ?? 'all')
                ],

                'servicePlanItem' => $leader['servicePlanItem'] ?? null,

                'cue' => null
            ];

            self::writeJsonAtomic($file, $initialState);
            self::writeJsonAtomic(self::presenceFile($safeRoom), []);

            return [
                'success'   => true,
                'room'      => $safeRoom,
                'hostToken' => $hostToken,
                'state'     => self::sanitizeForFollower($initialState)
            ];
        });
    }

    public static function updateRoom(string $room, string $hostToken, array $data): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        $safeRoom = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $file = self::roomFile($safeRoom);

        return self::withLock($safeRoom, function() use ($safeRoom, $file, $hostToken, $data) {
            if (!file_exists($file)) {
                return ['success' => false, 'error' => 'Phòng chưa được khởi tạo'];
            }

            $current = self::readJsonSafe($file, 3);
            if (!is_array($current)) {
                return ['success' => false, 'error' => 'Dữ liệu phòng không hợp lệ'];
            }

            // Mọi cập nhật đều phải chứng minh quyền host.
            if (empty($hostToken) || empty($current['hostToken']) || !hash_equals($current['hostToken'], $hostToken)) {
                return ['success' => false, 'error' => 'Không có quyền cập nhật phòng này (Sai Host Token)'];
            }

            $current['revision']   = ($current['revision'] ?? 0) + 1;
            $current['serverTime'] = microtime(true);
            $current['active']     = true;

            $eventId = 'EVT-' . $safeRoom . '-' . $current['revision'] . '-' . bin2hex(random_bytes(3));
            $current['lastEventId'] = $eventId;
            $eventType = 'state_change';

            if (isset($data['leader']) && is_array($data['leader'])) {
                $current['leader'] = array_merge($current['leader'] ?? [], $data['leader']);
            } elseif (isset($data['leader']) && is_string($data['leader'])) {
                $current['leader']['name'] = $data['leader'];
            }

            if (isset($data['song']) && is_array($data['song'])) {
                $current['song'] = array_merge($current['song'] ?? [], $data['song']);
                $eventType = 'song_change';
            } elseif (isset($data['songId'])) {
                $current['song']['songId']    = $data['songId'];
                $current['song']['songTitle'] = $data['songTitle'] ?? ($current['song']['songTitle'] ?? '');
                if (isset($data['setlistId']))    $current['song']['setlistId']    = $data['setlistId'];
                if (isset($data['setlistIndex'])) $current['song']['setlistIndex'] = (int)$data['setlistIndex'];
                $eventType = 'song_change';
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
                $eventType = 'position';
            } elseif (isset($data['measure'])) {
                $current['position']['measure'] = (int)$data['measure'];
                if (isset($data['beat']))        $current['position']['beat']        = (int)$data['beat'];
                if (isset($data['progress']))    $current['position']['progress']    = (float)$data['progress'];
                if (isset($data['sectionId']))   $current['position']['sectionId']   = $data['sectionId'];
                if (isset($data['roadmapStep'])) $current['position']['roadmapStep'] = (int)$data['roadmapStep'];
                $eventType = 'position';
            }

            if (isset($data['transport']) && is_array($data['transport'])) {
                $current['transport'] = array_merge($current['transport'] ?? [], $data['transport']);
                $eventType = 'transport';
                // Đồng bộ thời điểm Server Time cho Count-In
                if (($current['transport']['state'] ?? '') === 'count_in') {
                    if (empty($current['transport']['countInStartServerTime'])) {
                        $current['transport']['countInStartServerTime'] = microtime(true) + 0.15;
                    }
                }
            }

            // Xử lý Cue một lần (Exactly-Once Cue Delivery)
            if (array_key_exists('cue', $data)) {
                if (is_array($data['cue']) && !empty($data['cue']['text'])) {
                    $cue = $data['cue'];
                    $cue['cueId'] = $cue['cueId'] ?? ('CUE-' . bin2hex(random_bytes(5)));
                    $ttlSec = (float)($cue['ttlSec'] ?? (isset($cue['durationMs']) && $cue['durationMs'] ? $cue['durationMs'] / 1000 : 5.0));
                    $cue['createdAt'] = microtime(true);
                    $cue['expiresAt'] = microtime(true) + $ttlSec;
                    $current['cue'] = $cue;
                    $eventType = 'cue';
                } else {
                    $current['cue'] = null;
                    $eventType = 'cue_clear';
                }
            }

            if (array_key_exists('servicePlanItem', $data)) {
                $current['servicePlanItem'] = $data['servicePlanItem'];
                $eventType = 'service_plan_item';
            }

            if (isset($data['verse']) && is_array($data['verse'])) {
                $current['verse'] = array_merge($current['verse'] ?? [], $data['verse']);
                $eventType = 'verse';
            } elseif (isset($data['verseIndex'])) {
                $current['verse']['verseIndex'] = (int)$data['verseIndex'];
                if (isset($data['verseMode'])) {
                    $current['verse']['verseMode'] = $data['verseMode'];
                }
                $eventType = 'verse';
            }

            if (array_key_exists('loop', $data)) {
                $current['loop'] = $data['loop'];
            }

            if (array_key_exists('bandState', $data)) {
                $current['bandState'] = $data['bandState'];
            }

            if (array_key_exists('inkStroke', $data)) {
                $current['inkStroke'] = $data['inkStroke'];
                unset($current['inkClear']);
                $eventType = 'ink';
            }

            if (array_key_exists('inkClear', $data)) {
                $current['inkClear'] = (bool)$data['inkClear'];
                unset($current['inkStroke']);
                $eventType = 'ink';
            }

            // Bổ sung vào Ring Buffer (Tối đa 30 sự kiện gần nhất cho Replay)
            if (!isset($current['events']) || !is_array($current['events'])) {
                $current['events'] = [];
            }
            $current['events'][] = [
                'eventId'    => $eventId,
                'revision'   => $current['revision'],
                'type'       => $eventType,
                'serverTime' => $current['serverTime'],
                'cueId'      => $current['cue']['cueId'] ?? null
            ];
            if (count($current['events']) > 30) {
                array_shift($current['events']);
            }

            self::writeJsonAtomic($file, $current);

            return [
                'success'     => true,
                'revision'    => $current['revision'],
                'lastEventId' => $eventId,
                'state'       => self::sanitizeForFollower($current)
            ];
        });
    }

    public static function pollRoom(string $room, int $clientRevision = 0, string $clientId = '', string $role = ''): array {
        if (empty($room)) {
            return ['success' => false, 'error' => 'Thiếu mã phòng'];
        }

        $safeRoom = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $file = self::roomFile($safeRoom);
        if (!file_exists($file)) {
            return ['success' => true, 'active' => false, 'message' => 'Phòng chưa được khởi tạo'];
        }

        $data = self::readJsonSafe($file, 3);
        if (!is_array($data)) {
            return ['success' => true, 'active' => false, 'message' => 'Phòng đã kết thúc hoặc hỏng dữ liệu'];
        }

        // Kiểm tra hết hạn phòng
        if (isset($data['expiresAt']) && time() > $data['expiresAt']) {
            @unlink($file);
            @unlink(self::presenceFile($safeRoom));
            return ['success' => true, 'active' => false, 'message' => 'Phòng đã hết hạn'];
        }

        // Presence & Roster Tracking tách riêng ra file .presence.json
        // Follower KHÔNG BAO GIỜ ghi vào file state của Host
        $roster = self::syncPresence($safeRoom, $clientId, $role);
        $data['roster'] = $roster;

        $currentRev = (int)($data['revision'] ?? 1);
        $lastEventId = $data['lastEventId'] ?? ('EVT-' . $safeRoom . '-' . $currentRev);

        // Bounded Replay Buffer: tìm các event client đã bỏ lỡ
        $replayEvents = [];
        if ($clientRevision > 0 && $clientRevision < $currentRev && !empty($data['events'])) {
            foreach ($data['events'] as $evt) {
                if (($evt['revision'] ?? 0) > $clientRevision) {
                    $replayEvents[] = $evt;
                }
            }
        }

        // Fast Polling optimization: nếu client đã có revision mới nhất, trả về modified = false siêu nhẹ
        if ($clientRevision > 0 && $clientRevision >= $currentRev) {
            return [
                'success'     => true,
                'active'      => $data['active'] ?? true,
                'modified'    => false,
                'revision'    => $currentRev,
                'lastEventId' => $lastEventId,
                'roster'      => $roster,
                'serverTime'  => microtime(true)
            ];
        }

        return [
            'success'      => true,
            'active'       => $data['active'] ?? true,
            'modified'     => true,
            'revision'     => $currentRev,
            'lastEventId'  => $lastEventId,
            'replayEvents' => $replayEvents,
            'roster'       => $roster,
            'serverTime'   => microtime(true),
            'state'        => self::sanitizeForFollower($data),
            'data'         => self::sanitizeForFollower($data)
        ];
    }

    /**
     * Server-Sent Events (SSE) Streaming Endpoint
     */
    public static function streamEvents(string $room, int $clientRevision = 0, string $clientId = '', string $role = ''): void {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        @set_time_limit(40);

        if (empty($room)) {
            echo "event: error\ndata: " . json_encode(['error' => 'Thiếu mã phòng']) . "\n\n";
            return;
        }

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        if (!headers_sent()) {
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache, no-transform');
            header('Connection: keep-alive');
            header('X-Accel-Buffering: no');
        }

        $lastEventId = trim((string)($_SERVER['HTTP_LAST_EVENT_ID'] ?? ($_SERVER['HTTP_X_LAST_EVENT_ID'] ?? ($_GET['lastEventId'] ?? ''))));
        if (!empty($lastEventId) && $clientRevision === 0) {
            if (preg_match('/-(\d+)(?:-|$)/', $lastEventId, $m)) {
                $clientRevision = (int)$m[1];
            }
        }

        $lastRev = $clientRevision;
        $startTime = time();
        $lastPingTime = microtime(true);
        $maxDuration = 25; // 25s stream timeout for graceful reconnection

        $safeRoom = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $roomData = self::readJsonSafe(self::roomFile($safeRoom), 3);
        $replayedFromBuffer = false;

        // Nếu client cung cấp Last-Event-ID và có sự kiện trong ring buffer: replay trực tiếp
        if (is_array($roomData) && !empty($lastEventId) && !empty($roomData['events'])) {
            $eventsToReplay = [];
            $foundIndex = -1;
            foreach ($roomData['events'] as $idx => $evt) {
                if (($evt['eventId'] ?? '') === $lastEventId) {
                    $foundIndex = $idx;
                    break;
                }
            }

            if ($foundIndex !== -1) {
                for ($i = $foundIndex + 1; $i < count($roomData['events']); $i++) {
                    $eventsToReplay[] = $roomData['events'][$i];
                }
            } elseif ($clientRevision > 0) {
                foreach ($roomData['events'] as $evt) {
                    if ((int)($evt['revision'] ?? 0) > $clientRevision) {
                        $eventsToReplay[] = $evt;
                    }
                }
            }

            if (!empty($eventsToReplay)) {
                foreach ($eventsToReplay as $evt) {
                    $lastRev = max($lastRev, (int)($evt['revision'] ?? $lastRev));
                    echo "id: {$evt['eventId']}\n";
                    echo "event: {$evt['type']}\n";
                    echo "data: " . json_encode($evt, JSON_UNESCAPED_UNICODE) . "\n\n";
                }
                $replayedFromBuffer = true;
                flush();
            }
        }

        if (!$replayedFromBuffer) {
            $initPoll = self::pollRoom($room, $lastRev, $clientId, $role);
            if ($initPoll['success'] && ($initPoll['modified'] ?? false)) {
                $lastRev = (int)($initPoll['revision'] ?? $lastRev);
                $evtId = $initPoll['lastEventId'] ?? ('EVT-' . $room . '-' . $lastRev);
                echo "id: {$evtId}\n";
                echo "event: state\n";
                echo "data: " . json_encode($initPoll, JSON_UNESCAPED_UNICODE) . "\n\n";
                if (ob_get_level() > 0) ob_flush();
                flush();
            }
        }

        while (time() - $startTime < $maxDuration) {
            if (connection_aborted()) break;

            usleep(100000); // 100ms

            $poll = self::pollRoom($room, $lastRev, $clientId, $role);
            if (!$poll['success'] || !($poll['active'] ?? true)) {
                echo "event: closed\n";
                echo "data: " . json_encode($poll, JSON_UNESCAPED_UNICODE) . "\n\n";
                flush();
                break;
            }

            if ($poll['modified'] ?? false) {
                if (!empty($poll['replayEvents']) && count($poll['replayEvents']) > 1) {
                    foreach ($poll['replayEvents'] as $rEvt) {
                        $lastRev = max($lastRev, (int)($rEvt['revision'] ?? $lastRev));
                        echo "id: {$rEvt['eventId']}\n";
                        echo "event: {$rEvt['type']}\n";
                        echo "data: " . json_encode($rEvt, JSON_UNESCAPED_UNICODE) . "\n\n";
                    }
                }

                $lastRev = (int)($poll['revision'] ?? ($lastRev + 1));
                $evtId = $poll['lastEventId'] ?? ('EVT-' . $room . '-' . $lastRev);
                echo "id: {$evtId}\n";
                echo "event: state\n";
                echo "data: " . json_encode($poll, JSON_UNESCAPED_UNICODE) . "\n\n";
                flush();
            } else {
                if (microtime(true) - $lastPingTime >= 15.0) {
                    echo "event: ping\n";
                    echo "data: " . json_encode(['time' => microtime(true)]) . "\n\n";
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                    $lastPingTime = microtime(true);
                }
            }
        }
    }

    public static function closeRoom(string $room, string $hostToken): array {
        $safeRoom = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', $room));
        $file = self::roomFile($safeRoom);

        return self::withLock($safeRoom, function() use ($file, $safeRoom, $hostToken) {
            if (file_exists($file)) {
                $data = self::readJsonSafe($file, 3);
                if (is_array($data) && (!empty($data['hostToken']) && hash_equals($data['hostToken'], $hostToken))) {
                    $data['active'] = false;
                    $data['revision'] = ($data['revision'] ?? 0) + 1;
                    self::writeJsonAtomic($file, $data);
                    return ['success' => true, 'message' => 'Đã đóng phòng Live'];
                }
            }
            return ['success' => false, 'error' => 'Không thể đóng phòng'];
        });
    }

    private static function sanitizeForFollower(array $state): array {
        // Giấu hostToken khỏi followers
        $sanitized = $state;
        unset($sanitized['hostToken']);
        return $sanitized;
    }

    public static function cleanupExpiredRooms(): void {
        LiveSyncStorageHelper::cleanupExpiredRooms();
    }
}
