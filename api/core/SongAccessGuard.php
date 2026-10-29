<?php
declare(strict_types=1);

/**
 * api/core/SongAccessGuard.php
 *
 * Chốt chặn trung tâm: mọi route làm việc theo mã bài (hợp âm, ghi chú, xuất ChordPro kèm lời, bản phối,
 * tập luyện, phiên, đánh giá, chương trình) chỉ chạy tiếp nếu người dùng hiện tại được XEM bài đó.
 * Bài không tồn tại → để controller tự xử lý; bài tồn tại nhưng không được xem → 404 (không lộ sự tồn tại).
 */
final class SongAccessGuard {
    private const ROUTES = ['annotations', 'chord_sets', 'sessions', 'export', 'learning', 'practice', 'arrangements', 'reviews', 'setlists'];
    private const PARAMS = ['songId', 'song_id'];

    public static function enforce(string $route): void {
        if (!self::isAllowed($route)) {
            Response::notFound('Không tìm thấy bài hát');
            exit;
        }
    }

    /** true nếu route không theo mã bài, hoặc mọi mã bài trong yêu cầu đều được người dùng hiện tại xem. */
    public static function isAllowed(string $route): bool {
        if (!in_array($route, self::ROUTES, true)) return true;
        foreach (self::candidateIds() as $songId) {
            if (!self::viewable($songId)) return false;
        }
        return true;
    }

    /** @return list<string> */
    private static function candidateIds(): array {
        $ids = [];
        foreach (self::PARAMS as $param) {
            if (isset($_GET[$param]) && is_scalar($_GET[$param])) $ids[] = trim((string)$_GET[$param]);
        }
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $body = json_decode((string)file_get_contents('php://input'), true);
            if (is_array($body)) {
                foreach (self::PARAMS as $param) {
                    if (isset($body[$param]) && is_scalar($body[$param])) $ids[] = trim((string)$body[$param]);
                }
            }
        }
        return array_values(array_unique(array_filter($ids, static fn(string $id): bool => $id !== '')));
    }

    private static function viewable(string $songId): bool {
        require_once __DIR__ . '/DB.php';
        require_once __DIR__ . '/Auth.php';
        require_once __DIR__ . '/../services/SongService.php';
        $song = DB::run('SELECT id, visibility, is_public, category_id FROM songs WHERE id = ?', [$songId])->fetch(PDO::FETCH_ASSOC);
        if (!$song) return true;
        return Auth::canViewSong($song) && SongService::viewerMayViewCategory((int)($song['category_id'] ?? 1));
    }
}
