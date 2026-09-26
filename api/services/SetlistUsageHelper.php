<?php
/**
 * api/services/SetlistUsageHelper.php
 * Trợ thủ phân tích lịch sử sử dụng bài hát & thống kê phụng vụ cho SetlistService (Epic 4.3)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';

class SetlistUsageHelper {

    public static function hasColumn(string $table, string $column): bool {
        try {
            $cols = DB::run("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($cols as $c) {
                if (strcasecmp($c['name'] ?? '', $column) === 0) {
                    return true;
                }
            }
        } catch (Throwable $e) {}
        return false;
    }

    public static function hasTable(string $table): bool {
        try {
            return (int)DB::run("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", [$table])->fetchColumn() > 0;
        } catch (Throwable $e) {}
        return false;
    }

    public static function recordSongUsage(int $setlistId): int {
        if (!self::hasTable('song_usage_history')) return 0;
        $setlist = DB::run("SELECT scheduled_date FROM setlists WHERE id = ?", [$setlistId])->fetch(PDO::FETCH_ASSOC);
        if (!$setlist) return 0;
        $serviceDate = $setlist['scheduled_date'] ?: date('Y-m-d');

        $hasItemType = self::hasColumn('setlist_items', 'item_type');
        $itemSql = $hasItemType
            ? "SELECT song_id, chord_profile, transpose_key FROM setlist_items WHERE setlist_id = ? AND item_type = 'song' AND song_id != ''"
            : "SELECT song_id, chord_profile, transpose_key FROM setlist_items WHERE setlist_id = ? AND song_id != ''";
        
        $items = DB::run($itemSql, [$setlistId])->fetchAll(PDO::FETCH_ASSOC);

        $recorded = 0;
        foreach ($items as $item) {
            DB::run(
                "INSERT INTO song_usage_history (song_id, setlist_id, service_date, chord_profile, transpose_key)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(song_id, setlist_id) DO UPDATE SET
                 service_date = excluded.service_date,
                 chord_profile = excluded.chord_profile,
                 transpose_key = excluded.transpose_key",
                [$item['song_id'], $setlistId, $serviceDate, $item['chord_profile'] ?? 'HD', (int)($item['transpose_key'] ?? 0)]
            );
            $recorded++;
        }
        return $recorded;
    }

    public static function getSongUsageHistory(string $songId): array {
        if (!self::hasTable('song_usage_history')) {
            return ['song_id' => $songId, 'total_used' => 0, 'last_used_date' => null, 'history' => []];
        }

        $totalUsed = (int)DB::run("SELECT COUNT(*) FROM song_usage_history WHERE song_id = ?", [$songId])->fetchColumn();
        $lastUsed = DB::run("SELECT MAX(service_date) FROM song_usage_history WHERE song_id = ?", [$songId])->fetchColumn();

        $hasTheme = self::hasColumn('setlists', 'theme');
        $sql = $hasTheme
            ? "SELECT h.*, s.title AS service_title, s.theme, s.status AS service_status FROM song_usage_history h JOIN setlists s ON s.id = h.setlist_id WHERE h.song_id = ? ORDER BY h.service_date DESC"
            : "SELECT h.*, s.title AS service_title, '' AS theme, '' AS service_status FROM song_usage_history h JOIN setlists s ON s.id = h.setlist_id WHERE h.song_id = ? ORDER BY h.service_date DESC";
        
        $history = DB::run($sql, [$songId])->fetchAll(PDO::FETCH_ASSOC);

        return [
            'song_id' => $songId,
            'total_used' => $totalUsed,
            'last_used_date' => $lastUsed ?: null,
            'history' => $history
        ];
    }

    /**
     * Cảnh báo lặp bài hát (Quyết định D15):
     * Kiểm tra bài hát có được sử dụng trong vòng N tuần gần nhất hay không.
     */
    public static function checkRecentUsage(string $songId, int $weeks = 4): array {
        if (!self::hasTable('song_usage_history')) {
            return [
                'song_id' => $songId,
                'is_recent' => false,
                'weeks_threshold' => $weeks,
                'last_used_date' => null,
                'days_ago' => null,
                'weeks_ago' => null,
                'service_title' => null,
                'service_id' => null,
                'warning' => false,
                'warning_message' => null
            ];
        }

        $thresholdDate = date('Y-m-d', strtotime("-{$weeks} weeks"));
        $sql = "
            SELECT h.*, s.title AS service_title, s.scheduled_date
            FROM song_usage_history h
            JOIN setlists s ON s.id = h.setlist_id
            WHERE h.song_id = ?
            ORDER BY h.service_date DESC, h.id DESC
            LIMIT 1
        ";
        $lastRecord = DB::run($sql, [$songId])->fetch(PDO::FETCH_ASSOC);

        if (!$lastRecord || empty($lastRecord['service_date'])) {
            return [
                'song_id' => $songId,
                'is_recent' => false,
                'weeks_threshold' => $weeks,
                'last_used_date' => null,
                'days_ago' => null,
                'weeks_ago' => null,
                'service_title' => null,
                'service_id' => null,
                'warning' => false,
                'warning_message' => null
            ];
        }

        $lastDate = $lastRecord['service_date'];
        $daysAgo = (int)floor((time() - strtotime($lastDate)) / 86400);
        if ($daysAgo < 0) $daysAgo = 0;
        $weeksAgo = round($daysAgo / 7, 1);
        $isRecent = $lastDate >= $thresholdDate;

        $serviceTitle = $lastRecord['service_title'] ?: 'Chương trình buổi nhóm';
        $warningMsg = $isRecent
            ? "Bài này đã được dùng cách đây {$weeksAgo} tuần ({$lastDate} — \"{$serviceTitle}\"). Bạn vẫn có thể chọn theo nhu cầu phụng vụ."
            : null;

        return [
            'song_id' => $songId,
            'is_recent' => $isRecent,
            'weeks_threshold' => $weeks,
            'last_used_date' => $lastDate,
            'days_ago' => $daysAgo,
            'weeks_ago' => $weeksAgo,
            'service_title' => $serviceTitle,
            'service_id' => (int)$lastRecord['setlist_id'],
            'warning' => $isRecent,
            'warning_message' => $warningMsg
        ];
    }

    /**
     * Báo cáo Thống kê Lịch sử Sử dụng Bài hát trong Phụng vụ (Epic 4.3)
     */
    public static function getUsageReport(?string $fromDate = null, ?string $toDate = null, int $limit = 20): array {
        if (!self::hasTable('song_usage_history')) {
            return [
                'summary' => [
                    'total_services' => 0,
                    'total_song_plays' => 0,
                    'unique_songs_used' => 0,
                    'total_library_songs' => 0,
                    'coverage_percent' => 0
                ],
                'most_used' => [],
                'dormant_songs' => [],
                'recent_history' => []
            ];
        }

        $whereClauses = [];
        $params = [];
        if ($fromDate) {
            $whereClauses[] = "h.service_date >= ?";
            $params[] = $fromDate;
        }
        if ($toDate) {
            $whereClauses[] = "h.service_date <= ?";
            $params[] = $toDate;
        }
        $whereSql = !empty($whereClauses) ? "WHERE " . implode(" AND ", $whereClauses) : "";

        // 1. KPIs
        $totalServices = (int)DB::run("SELECT COUNT(DISTINCT setlist_id) FROM song_usage_history h {$whereSql}", $params)->fetchColumn();
        $totalPlays = (int)DB::run("SELECT COUNT(*) FROM song_usage_history h {$whereSql}", $params)->fetchColumn();
        $uniqueSongs = (int)DB::run("SELECT COUNT(DISTINCT song_id) FROM song_usage_history h {$whereSql}", $params)->fetchColumn();

        $totalLibrarySongs = 0;
        if (self::hasTable('songs')) {
            $totalLibrarySongs = (int)DB::run("SELECT COUNT(*) FROM songs")->fetchColumn();
        }
        $coveragePercent = $totalLibrarySongs > 0 ? round(($uniqueSongs / $totalLibrarySongs) * 100, 1) : 0;

        // 2. Most Used Songs
        $hasSongTable = self::hasTable('songs');
        $mostUsedSql = $hasSongTable
            ? "
                SELECT h.song_id,
                       COUNT(*) AS usage_count,
                       MAX(h.service_date) AS last_used_date,
                       so.title AS song_title,
                       so.defaultKey,
                       so.httlvnId,
                       (SELECT chord_profile FROM song_usage_history WHERE song_id = h.song_id GROUP BY chord_profile ORDER BY COUNT(*) DESC LIMIT 1) AS frequent_profile,
                       (SELECT transpose_key FROM song_usage_history WHERE song_id = h.song_id GROUP BY transpose_key ORDER BY COUNT(*) DESC LIMIT 1) AS frequent_transpose
                FROM song_usage_history h
                LEFT JOIN songs so ON so.id = h.song_id
                {$whereSql}
                GROUP BY h.song_id
                ORDER BY usage_count DESC, last_used_date DESC
                LIMIT {$limit}
            "
            : "
                SELECT h.song_id,
                       COUNT(*) AS usage_count,
                       MAX(h.service_date) AS last_used_date,
                       h.song_id AS song_title,
                       '' AS defaultKey,
                       '' AS httlvnId,
                       'HD' AS frequent_profile,
                       0 AS frequent_transpose
                FROM song_usage_history h
                {$whereSql}
                GROUP BY h.song_id
                ORDER BY usage_count DESC, last_used_date DESC
                LIMIT {$limit}
            ";
        $mostUsed = DB::run($mostUsedSql, $params)->fetchAll(PDO::FETCH_ASSOC);

        // 3. Dormant or Unused Songs (Các bài > 12 tuần chưa dùng hoặc chưa từng dùng)
        $dormantSongs = [];
        if ($hasSongTable) {
            $twelveWeeksAgo = date('Y-m-d', strtotime('-12 weeks'));
            $dormantSql = "
                SELECT so.id AS song_id, so.title AS song_title, so.defaultKey, so.httlvnId,
                       MAX(h.service_date) AS last_used_date,
                       COUNT(h.id) AS past_usage_count
                FROM songs so
                LEFT JOIN song_usage_history h ON h.song_id = so.id
                GROUP BY so.id
                HAVING last_used_date IS NULL OR last_used_date < ?
                ORDER BY last_used_date ASC, so.id ASC
                LIMIT {$limit}
            ";
            $dormantSongs = DB::run($dormantSql, [$twelveWeeksAgo])->fetchAll(PDO::FETCH_ASSOC);
        }

        // 4. Recent Usage History (30 lần dùng gần nhất)
        $historySql = $hasSongTable
            ? "
                SELECT h.*, s.title AS service_title, s.theme AS service_theme, s.status AS service_status,
                       so.title AS song_title, so.defaultKey
                FROM song_usage_history h
                JOIN setlists s ON s.id = h.setlist_id
                LEFT JOIN songs so ON so.id = h.song_id
                ORDER BY h.service_date DESC, h.id DESC
                LIMIT 30
            "
            : "
                SELECT h.*, s.title AS service_title, '' AS service_theme, '' AS service_status,
                       h.song_id AS song_title, '' AS defaultKey
                FROM song_usage_history h
                JOIN setlists s ON s.id = h.setlist_id
                ORDER BY h.service_date DESC, h.id DESC
                LIMIT 30
            ";
        $recentHistory = DB::run($historySql)->fetchAll(PDO::FETCH_ASSOC);

        return [
            'summary' => [
                'total_services' => $totalServices,
                'total_song_plays' => $totalPlays,
                'unique_songs_used' => $uniqueSongs,
                'total_library_songs' => $totalLibrarySongs,
                'coverage_percent' => $coveragePercent
            ],
            'most_used' => $mostUsed,
            'dormant_songs' => $dormantSongs,
            'recent_history' => $recentHistory
        ];
    }
}
