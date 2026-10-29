<?php
declare(strict_types=1);
require_once __DIR__ . '/../core/DB.php';

/** Public programs expose an explicit performance view, never personnel or internal notes. */
class SetlistPublicReadService {
    private const PLAN_COLUMNS = 's.id, s.title, s.scheduled_date, s.service_time, s.theme, s.status';

    public static function getAll(): array {
        return DB::run('SELECT ' . self::PLAN_COLUMNS . ",
            (SELECT COUNT(*) FROM setlist_items WHERE setlist_id=s.id) AS item_count
            FROM setlists s WHERE s.status='published' ORDER BY s.scheduled_date DESC, s.created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function getById(int $id): ?array {
        $plan = DB::run('SELECT ' . self::PLAN_COLUMNS . " FROM setlists s WHERE s.id=? AND s.status='published'", [$id])->fetch(PDO::FETCH_ASSOC);
        if (!$plan) return null;
        $plan['items'] = DB::run("SELECT i.id, i.setlist_id, i.song_id, i.display_order,
            i.chord_profile, i.transpose_key, i.bpm, i.beats_per_measure, i.item_type,
            i.custom_title, i.duration_minutes, i.selected_verses,
            so.title AS song_title, so.defaultKey, so.httlvnId
            FROM setlist_items i LEFT JOIN songs so ON so.id=i.song_id
            WHERE i.setlist_id=? ORDER BY i.display_order, i.id", [$id])->fetchAll(PDO::FETCH_ASSOC);
        return $plan;
    }

    public static function getSongUsageHistory(string $songId): array {
        $history = DB::run("SELECT h.id, h.song_id, h.setlist_id, h.service_date,
            h.chord_profile, h.transpose_key, s.title AS service_title, s.theme, s.status AS service_status
            FROM song_usage_history h JOIN setlists s ON s.id=h.setlist_id
            WHERE h.song_id=? AND s.status='published' ORDER BY h.service_date DESC, h.id DESC", [$songId])->fetchAll(PDO::FETCH_ASSOC);
        return ['song_id' => $songId, 'total_used' => count($history),
            'last_used_date' => $history[0]['service_date'] ?? null, 'history' => $history];
    }
}
