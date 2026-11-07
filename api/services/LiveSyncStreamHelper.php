<?php
/**
 * api/services/LiveSyncStreamHelper.php
 * Vòng lặp Server-Sent Events (SSE) của Live Sync: replay theo Last-Event-ID, state, ping 15s.
 * Tách khỏi LiveSyncService để giữ file < 600 dòng.
 */

class LiveSyncStreamHelper {
    /**
     * @param array|null $roomData Dữ liệu phòng đã đọc (null nếu chưa có) — dùng để replay ring buffer
     */
    public static function stream(string $room, int $clientRevision, string $clientId, string $role, ?array $roomData): void {
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
            $initPoll = LiveSyncService::pollRoom($room, $lastRev, $clientId, $role);
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

            usleep(LiveSyncService::SSE_POLL_INTERVAL_US);

            $poll = LiveSyncService::pollRoom($room, $lastRev, $clientId, $role);
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
}
