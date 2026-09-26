<?php
/**
 * api/services/PracticeService.php
 * Quản lý phiên luyện tập (practice session), batch checkpoint, metrics độ chính xác và dashboard cá nhân / ca trưởng có consent
 */
require_once __DIR__ . '/../core/DB.php';

class PracticeService {
    public static function isOwner(int $sessionId, int $userId): bool {
        if ($sessionId <= 0 || $userId <= 0) return false;
        $ownerId = DB::run(
            'SELECT user_id FROM practice_sessions WHERE id = ?',
            [$sessionId]
        )->fetchColumn();
        return $ownerId !== false && (int)$ownerId === $userId;
    }

    /**
     * Bắt đầu một phiên luyện tập
     */
    public static function startSession(int $userId, mixed $songId, string $mode = 'piano', int $startBpm = 76, ?int $assignmentId = null): array {
        $songIdStr = trim((string)$songId);
        if (empty($songIdStr)) {
            throw new InvalidArgumentException('Mã bài hát không hợp lệ');
        }

        $now = time();
        $sql = "INSERT INTO practice_sessions 
                    (user_id, song_id, mode, started_at, start_bpm, max_bpm, accuracy_total, notes_total, notes_correct, timing_score, assignment_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0.0, 0, 0, 100.0, ?, CURRENT_TIMESTAMP)";
        DB::run($sql, [$userId, $songIdStr, $mode, $now, $startBpm, $startBpm, $assignmentId]);

        $id = (int)DB::lastId();
        return [
            'session_id'    => $id,
            'song_id'       => $songIdStr,
            'mode'          => $mode,
            'started_at'    => $now,
            'assignment_id' => $assignmentId
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
                $attempts     = max(1, (int)($stat['attempts'] ?? 1));
                $accuracy     = max(0.0, min(100.0, (float)($stat['accuracy'] ?? 0.0)));
                $timingScore  = max(0.0, min(100.0, (float)($stat['timing_score'] ?? 100.0)));
                $bestBpm      = max(20, (int)($stat['best_bpm'] ?? 76));

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
     * Kết thúc phiên luyện tập (hỗ trợ lưu kèm stats từ sendBeacon / pagehide)
     */
    public static function finishSession(
        int $sessionId, 
        int $durationSec, 
        int $maxBpm, 
        float $accuracyTotal = 0.0, 
        int $notesTotal = 0, 
        int $notesCorrect = 0, 
        float $timingScore = 100.0, 
        ?array $stats = null
    ): bool {
        if ($sessionId <= 0) return false;

        $db = DB::get();
        $db->beginTransaction();

        try {
            // 1. Lưu batch checkpoint nếu có gửi kèm (pagehide flush)
            if (!empty($stats)) {
                $stmt = $db->prepare("
                    INSERT INTO practice_measure_stats 
                        (practice_session_id, measure_no, attempts, accuracy, timing_score, best_bpm)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $sumAccuracy = 0.0;
                $statCount = 0;

                foreach ($stats as $stat) {
                    $measureNo   = (int)($stat['measure_no'] ?? 1);
                    $attempts    = max(1, (int)($stat['attempts'] ?? 1));
                    $accVal      = max(0.0, min(100.0, (float)($stat['accuracy'] ?? 0.0)));
                    $timingVal   = max(0.0, min(100.0, (float)($stat['timing_score'] ?? 100.0)));
                    $bpmVal      = max(20, (int)($stat['best_bpm'] ?? $maxBpm));

                    $stmt->execute([$sessionId, $measureNo, $attempts, $accVal, $timingVal, $bpmVal]);
                    $sumAccuracy += $accVal;
                    $statCount++;
                }

                // Nếu notesTotal chưa được set, tính từ stats trung bình
                if ($notesTotal <= 0 && $statCount > 0 && $accuracyTotal <= 0.0) {
                    $accuracyTotal = round($sumAccuracy / $statCount, 1);
                }
            }

            // 2. Tính toán accuracy thực tế không hard-code
            if ($notesTotal > 0) {
                $notesCorrect = max(0, min($notesTotal, $notesCorrect));
                $accuracyTotal = round(($notesCorrect / $notesTotal) * 100, 1);
            }
            $accuracyTotal = max(0.0, min(100.0, $accuracyTotal));
            $timingScore   = max(0.0, min(100.0, $timingScore));

            $sql = "UPDATE practice_sessions SET 
                        ended_at = ?, duration_seconds = ?, max_bpm = ?, 
                        accuracy_total = ?, notes_total = ?, notes_correct = ?, timing_score = ?
                    WHERE id = ?";
            $stmtUpdate = $db->prepare($sql);
            $stmtUpdate->execute([time(), $durationSec, $maxBpm, $accuracyTotal, $notesTotal, $notesCorrect, $timingScore, $sessionId]);

            // Lấy thông tin assignment_id và user_id trước khi commit
            $sessionInfo = $db->query("SELECT user_id, assignment_id FROM practice_sessions WHERE id = {$sessionId}")->fetch(PDO::FETCH_ASSOC);

            $db->commit();

            if (!empty($sessionInfo['assignment_id']) && !empty($sessionInfo['user_id'])) {
                try {
                    require_once __DIR__ . '/PracticeAssignmentService.php';
                    PracticeAssignmentService::recordProgress(
                        $sessionId,
                        (int)$sessionInfo['user_id'],
                        (int)$sessionInfo['assignment_id'],
                        $durationSec,
                        $accuracyTotal
                    );
                } catch (Throwable $e) {
                    error_log('[PracticeService] Failed to record assignment progress: ' . $e->getMessage());
                }
            }

            return true;
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Lấy tiến độ luyện tập theo bài hát của người dùng
     */
    public static function getProgress(mixed $songId, int $userId = 0): array {
        $songIdStr = trim((string)$songId);
        $sql = "SELECT id, mode, started_at, ended_at, duration_seconds, start_bpm, max_bpm, 
                       accuracy_total, notes_total, notes_correct, timing_score 
                FROM practice_sessions 
                WHERE song_id = ? AND (user_id = ? OR user_id = 0)
                ORDER BY id DESC LIMIT 20";
        $sessions = DB::run($sql, [$songIdStr, $userId])->fetchAll();

        $totalMinutes = 0;
        $highestBpm = 0;
        $totalAccuracy = 0.0;
        $validSessions = 0;

        foreach ($sessions as $s) {
            $totalMinutes += round(($s['duration_seconds'] ?? 0) / 60, 1);
            if (($s['max_bpm'] ?? 0) > $highestBpm) $highestBpm = (int)$s['max_bpm'];
            if (($s['accuracy_total'] ?? 0) > 0) {
                $totalAccuracy += (float)$s['accuracy_total'];
                $validSessions++;
            }
        }

        // Lấy danh sách ô nhịp cần rèn luyện (accuracy < 80% hoặc nhiều attempts nhất)
        $weakSql = "SELECT pms.measure_no, AVG(pms.accuracy) as avg_acc, SUM(pms.attempts) as total_attempts, MAX(pms.best_bpm) as max_bpm
                    FROM practice_measure_stats pms
                    JOIN practice_sessions ps ON pms.practice_session_id = ps.id
                    WHERE ps.song_id = ? AND (ps.user_id = ? OR ps.user_id = 0)
                    GROUP BY pms.measure_no
                    ORDER BY avg_acc ASC, total_attempts DESC
                    LIMIT 5";
        $weakMeasures = DB::run($weakSql, [$songIdStr, $userId])->fetchAll();

        return [
            'song_id' => $songIdStr,
            'total_sessions' => count($sessions),
            'total_practice_minutes' => $totalMinutes,
            'highest_bpm' => $highestBpm,
            'avg_accuracy' => $validSessions > 0 ? round($totalAccuracy / $validSessions, 1) : 0.0,
            'weak_measures' => $weakMeasures,
            'recent_sessions' => $sessions
        ];
    }

    /**
     * Bảng điều khiển cá nhân (Personal Dashboard)
     */
    public static function getPersonalDashboard(int $userId): array {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Người dùng không hợp lệ');
        }

        // 1. Thông tin consent của người dùng
        $userRow = DB::run("SELECT id, display_name, username, instrument, consent_practice_share FROM users WHERE id = ?", [$userId])->fetch();
        $consent = $userRow ? (int)($userRow['consent_practice_share'] ?? 1) : 1;

        // 2. Thống kê KPI tổng thể
        $kpiSql = "SELECT 
                    COUNT(id) as total_sessions,
                    SUM(duration_seconds) as total_seconds,
                    COUNT(DISTINCT song_id) as total_songs,
                    AVG(NULLIF(accuracy_total, 0)) as avg_accuracy,
                    MAX(max_bpm) as top_bpm
                   FROM practice_sessions 
                   WHERE user_id = ?";
        $kpi = DB::run($kpiSql, [$userId])->fetch();

        $totalSeconds = (int)($kpi['total_seconds'] ?? 0);
        $totalSessions = (int)($kpi['total_sessions'] ?? 0);
        $totalSongs = (int)($kpi['total_songs'] ?? 0);
        $avgAccuracy = round((float)($kpi['avg_accuracy'] ?? 0.0), 1);
        $topBpm = (int)($kpi['top_bpm'] ?? 0);

        // 3. Tính streak ngày luyện tập liên tục
        $datesSql = "SELECT DISTINCT date(started_at, 'unixepoch', 'localtime') as p_date 
                     FROM practice_sessions 
                     WHERE user_id = ? AND duration_seconds >= 10
                     ORDER BY p_date DESC";
        $practicedDates = DB::run($datesSql, [$userId])->fetchAll(PDO::FETCH_COLUMN);

        $streak = 0;
        if (!empty($practicedDates)) {
            $today = date('Y-m-d');
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            
            // Streak chỉ tính nếu hôm nay hoặc hôm qua có tập
            if ($practicedDates[0] === $today || $practicedDates[0] === $yesterday) {
                $checkDate = $practicedDates[0];
                $streak = 1;
                for ($i = 1; $i < count($practicedDates); $i++) {
                    $expected = date('Y-m-d', strtotime($checkDate . ' -1 day'));
                    if ($practicedDates[$i] === $expected) {
                        $streak++;
                        $checkDate = $expected;
                    } else {
                        break;
                    }
                }
            }
        }

        // 4. Biểu đồ nhiệt 30 ngày qua (Heatmap activity)
        $heatmapSql = "SELECT date(started_at, 'unixepoch', 'localtime') as day, 
                              SUM(duration_seconds) as total_sec, 
                              COUNT(id) as sessions
                       FROM practice_sessions
                       WHERE user_id = ? AND started_at >= ?
                       GROUP BY day
                       ORDER BY day ASC";
        $thirtyDaysAgo = strtotime('-30 days midnight');
        $rawDays = DB::run($heatmapSql, [$userId, $thirtyDaysAgo])->fetchAll();
        $daysMap = [];
        foreach ($rawDays as $rd) {
            $daysMap[$rd['day']] = [
                'minutes' => round(((int)$rd['total_sec']) / 60, 1),
                'sessions' => (int)$rd['sessions']
            ];
        }

        $heatmap30d = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $heatmap30d[] = [
                'date' => $d,
                'minutes' => $daysMap[$d]['minutes'] ?? 0,
                'sessions' => $daysMap[$d]['sessions'] ?? 0
            ];
        }

        // 5. Phiên gần đây (kèm tên bài hát)
        $recentSql = "SELECT ps.id, ps.song_id, COALESCE(s.title, ps.song_id) as song_title,
                             ps.mode, ps.started_at, ps.duration_seconds, ps.start_bpm, ps.max_bpm, 
                             ps.accuracy_total, ps.notes_total, ps.notes_correct, ps.timing_score
                      FROM practice_sessions ps
                      LEFT JOIN songs s ON ps.song_id = s.id
                      WHERE ps.user_id = ?
                      ORDER BY ps.started_at DESC LIMIT 15";
        $recentSessions = DB::run($recentSql, [$userId])->fetchAll();

        // 6. Top các ô nhịp yếu (weak measures) cần chú ý
        $weakSql = "SELECT pms.measure_no, AVG(pms.accuracy) as avg_acc, SUM(pms.attempts) as total_attempts,
                           ps.song_id, COALESCE(s.title, ps.song_id) as song_title
                    FROM practice_measure_stats pms
                    JOIN practice_sessions ps ON pms.practice_session_id = ps.id
                    LEFT JOIN songs s ON ps.song_id = s.id
                    WHERE ps.user_id = ?
                    GROUP BY ps.song_id, pms.measure_no
                    HAVING avg_acc < 85
                    ORDER BY avg_acc ASC, total_attempts DESC
                    LIMIT 6";
        $weakMeasures = DB::run($weakSql, [$userId])->fetchAll();

        return [
            'user' => [
                'id' => $userId,
                'display_name' => $userRow['display_name'] ?? $userRow['username'] ?? '',
                'consent_practice_share' => $consent
            ],
            'kpi' => [
                'total_hours' => round($totalSeconds / 3600, 1),
                'total_minutes' => round($totalSeconds / 60, 1),
                'total_sessions' => $totalSessions,
                'total_songs' => $totalSongs,
                'avg_accuracy' => $avgAccuracy,
                'streak_days' => $streak,
                'top_bpm' => $topBpm
            ],
            'heatmap_30d' => $heatmap30d,
            'recent_sessions' => $recentSessions,
            'weak_measures' => $weakMeasures
        ];
    }

    /**
     * Bật / tắt quyền cho phép Ca Trưởng theo dõi tiến độ luyện tập
     */
    public static function setConsent(int $userId, bool $consent): bool {
        if ($userId <= 0) return false;
        $val = $consent ? 1 : 0;
        DB::run("UPDATE users SET consent_practice_share = ? WHERE id = ?", [$val, $userId]);
        return true;
    }

    /**
     * Góc nhìn Ca Trưởng có Consent (Leader View)
     * Quyền yêu cầu: Ban Hát hoặc Admin
     */
    public static function getLeaderView(int $requesterUserId, ?string $songId = null): array {
        $filterSongId = trim((string)$songId);

        // Lấy danh sách thành viên đang hoạt động
        $users = DB::run("SELECT id, username, display_name, role, instrument, consent_practice_share FROM users WHERE status = 'active' ORDER BY id ASC")->fetchAll();

        $leaderboard = [];

        foreach ($users as $u) {
            $uId = (int)$u['id'];
            $hasConsent = ((int)$u['consent_practice_share']) === 1;

            // Thống kê luyện tập của thành viên
            $sql = "SELECT 
                        COUNT(id) as sessions_count,
                        SUM(duration_seconds) as total_seconds,
                        MAX(max_bpm) as highest_bpm,
                        AVG(NULLIF(accuracy_total, 0)) as avg_accuracy,
                        MAX(started_at) as last_practice_at
                    FROM practice_sessions
                    WHERE user_id = ?";
            $params = [$uId];

            if ($filterSongId !== '') {
                $sql .= " AND song_id = ?";
                $params[] = $filterSongId;
            }

            $stats = DB::run($sql, $params)->fetch();
            $sessionsCount = (int)($stats['sessions_count'] ?? 0);
            $totalMinutes = round(((int)($stats['total_seconds'] ?? 0)) / 60, 1);
            $avgAcc = round((float)($stats['avg_accuracy'] ?? 0.0), 1);
            $highestBpm = (int)($stats['highest_bpm'] ?? 0);
            $lastAt = $stats['last_practice_at'] ? (int)$stats['last_practice_at'] : null;

            // Áp dụng bảo vệ riêng tư nếu thành viên chưa đồng ý (No Consent)
            if ($hasConsent) {
                $displayName = $u['display_name'] ?: $u['username'];
                $username    = $u['username'];
                $instrument  = $u['instrument'] ?? 'Thành viên';
            } else {
                $displayName = "Thành viên ẩn danh #" . $uId;
                $username    = "anonymous";
                $instrument  = "Bảo mật";
            }

            // Bài tập gần đây nếu có consent
            $recentSongs = [];
            if ($hasConsent && $sessionsCount > 0) {
                $recentSongsSql = "SELECT DISTINCT COALESCE(s.title, ps.song_id) as song_title, ps.accuracy_total, ps.max_bpm
                                   FROM practice_sessions ps
                                   LEFT JOIN songs s ON ps.song_id = s.id
                                   WHERE ps.user_id = ?
                                   ORDER BY ps.started_at DESC LIMIT 3";
                $recentSongs = DB::run($recentSongsSql, [$uId])->fetchAll();
            }

            $leaderboard[] = [
                'user_id' => $uId,
                'display_name' => $displayName,
                'username' => $username,
                'role' => $u['role'],
                'instrument' => $instrument,
                'has_consent' => $hasConsent,
                'sessions_count' => $sessionsCount,
                'total_minutes' => $totalMinutes,
                'avg_accuracy' => $avgAcc,
                'highest_bpm' => $highestBpm,
                'last_practice_at' => $lastAt,
                'recent_songs' => $recentSongs
            ];
        }

        return [
            'filter_song_id' => $filterSongId ?: null,
            'total_members' => count($leaderboard),
            'members' => $leaderboard
        ];
    }
}
