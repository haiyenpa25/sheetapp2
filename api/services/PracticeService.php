<?php
/**
 * api/services/PracticeService.php
 * Quản lý phiên luyện tập (practice session), batch checkpoint và tiến độ của người dùng
 */
require_once __DIR__ . '/../core/DB.php';

class PracticeService {
    /**
     * Bắt đầu một phiên luyện tập
     */
    public static function startSession(int $userId, mixed $songId, string $mode = 'piano', int $startBpm = 76): array {
        $songIdStr = trim((string)$songId);
        if (empty($songIdStr)) {
            throw new InvalidArgumentException('Mã bài hát không hợp lệ');
        }

        $sql = "INSERT INTO practice_sessions 
                    (user_id, song_id, mode, started_at, start_bpm, max_bpm, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
        DB::run($sql, [$userId, $songIdStr, $mode, time(), $startBpm, $startBpm]);

        $id = (int)DB::lastId();
        return [
            'session_id' => $id,
            'song_id' => $songIdStr,
            'mode' => $mode,
            'started_at' => time()
        ];
    }

    /**
     * Lưu checkpoint thống kê theo batch (KHÔNG gọi từng nốt đơn lẻ)
     */
    public static function checkpoint(int $sessionId, array $stats): bool {
        if ($sessionId <= 0 || empty($stats)) return false;

        $db = DB::get();
        $db->beginTransaction();

        try {
            $stmt = $db->prepare("
                INSERT INTO practice_measure_stats 
                    (practice_session_id, measure_no, attempts, accuracy, timing_score, best_bpm)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            foreach ($stats as $stat) {
                $measureNo    = (int)($stat['measure_no'] ?? 1);
                $attempts     = (int)($stat['attempts'] ?? 1);
                $accuracy     = (float)($stat['accuracy'] ?? 100.0);
                $timingScore  = (float)($stat['timing_score'] ?? 100.0);
                $bestBpm      = (int)($stat['best_bpm'] ?? 76);

                $stmt->execute([$sessionId, $measureNo, $attempts, $accuracy, $timingScore, $bestBpm]);
            }

            $db->commit();
            return true;
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Kết thúc phiên luyện tập
     */
    public static function finishSession(int $sessionId, int $durationSec, int $maxBpm, float $accuracyTotal): bool {
        if ($sessionId <= 0) return false;

        $sql = "UPDATE practice_sessions SET 
                    ended_at = ?, duration_seconds = ?, max_bpm = ?, accuracy_total = ?
                WHERE id = ?";
        DB::run($sql, [time(), $durationSec, $maxBpm, $accuracyTotal, $sessionId]);
        return true;
    }

    /**
     * Lấy tiến độ luyện tập theo bài hát của người dùng
     */
    public static function getProgress(mixed $songId, int $userId = 0): array {
        $songIdStr = trim((string)$songId);
        $sql = "SELECT id, mode, started_at, ended_at, duration_seconds, start_bpm, max_bpm, accuracy_total 
                FROM practice_sessions 
                WHERE song_id = ? AND (user_id = ? OR user_id = 0)
                ORDER BY id DESC LIMIT 20";
        $sessions = DB::run($sql, [$songIdStr, $userId])->fetchAll();

        // Tổng số phút luyện tập
        $totalMinutes = 0;
        $highestBpm = 0;
        foreach ($sessions as $s) {
            $totalMinutes += round(($s['duration_seconds'] ?? 0) / 60, 1);
            if ($s['max_bpm'] > $highestBpm) $highestBpm = $s['max_bpm'];
        }

        return [
            'song_id' => $songId,
            'total_sessions' => count($sessions),
            'total_practice_minutes' => $totalMinutes,
            'highest_bpm' => $highestBpm,
            'recent_sessions' => $sessions
        ];
    }
}
