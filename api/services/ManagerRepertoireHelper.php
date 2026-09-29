<?php
/**
 * api/services/ManagerRepertoireHelper.php
 * Trợ thủ xử lý nghiệp vụ kho bài hát, thể loại và tìm kiếm chi tiết cho ManagerService
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/ChordSetService.php';

class ManagerRepertoireHelper {

    /**
     * Lấy danh sách kho bài hát kết hợp danh mục và các bản clone/hợp âm của thành viên
     */
    public static function getRepertoire(array $filters = []): array {
        $pdo = DB::get();

        $where = ["1=1"];
        $params = [];

        if (!empty($filters['category_id'])) {
            $where[] = "s.category_id = ?";
            $params[] = (int)$filters['category_id'];
        }

        if (!empty($filters['keyword'])) {
            $kw = '%' . trim($filters['keyword']) . '%';
            $where[] = "(s.title LIKE ? OR s.id LIKE ? OR CAST(s.httlvnId AS TEXT) LIKE ? OR s.lyrics_text LIKE ?)";
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $sqlWhere = implode(" AND ", $where);
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : 50;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        // Đếm tổng số bài thỏa mãn điều kiện
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM songs s WHERE $sqlWhere");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        // Lấy danh sách bài
        $sql = "
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   s.liturgical_season, s.theme, s.tags, s.tempo,
                   c.name as category_name, c.icon as category_icon, c.slug as category_slug
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE $sqlWhere
            ORDER BY s.httlvnId ASC, s.title ASC
            LIMIT $limit OFFSET $offset
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $songs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Lấy tất cả user_chord_sets liên quan
        if (!empty($songs)) {
            $songIds = array_column($songs, 'id');
            $inClause = implode(',', array_fill(0, count($songIds), '?'));

            // User chord sets
            $stmtChords = $pdo->prepare("
                SELECT cs.id, cs.song_id, cs.user_id, cs.username, cs.set_name,
                       cs.instrument_type, cs.capo_fret, cs.custom_tempo, cs.chord_count,
                       cs.notes_guide, cs.is_public, cs.is_recommended, cs.review_status, cs.views_count, cs.created_at,
                       u.display_name, u.avatar_url
                FROM user_chord_sets cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE cs.song_id IN ($inClause) AND cs.is_public = 1
                ORDER BY cs.is_recommended DESC, cs.created_at DESC
            ");
            $stmtChords->execute($songIds);
            $allChords = $stmtChords->fetchAll(PDO::FETCH_ASSOC);

            // Group by song_id
            $chordsBySong = [];
            foreach ($allChords as $ch) {
                $chordsBySong[$ch['song_id']][] = $ch;
            }

            // Song versions (MusicXML Forks)
            $stmtVers = $pdo->prepare("
                SELECT v.id, v.song_id, v.user_id, v.username, v.version_name, v.version_slug,
                       v.xml_path, v.description, v.is_default, v.is_recommended, v.review_status, v.created_at,
                       u.display_name
                FROM song_versions v
                LEFT JOIN users u ON v.user_id = u.id
                WHERE v.song_id IN ($inClause)
                ORDER BY v.created_at DESC
            ");
            $stmtVers->execute($songIds);
            $allVers = $stmtVers->fetchAll(PDO::FETCH_ASSOC);

            $versBySong = [];
            foreach ($allVers as $ver) {
                $versBySong[$ver['song_id']][] = $ver;
            }

            foreach ($songs as &$song) {
                $sid = $song['id'];
                $song['user_chord_sets'] = $chordsBySong[$sid] ?? [];
                $song['song_versions']   = $versBySong[$sid] ?? [];
            }
        }

        return [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'songs' => $songs
        ];
    }

    /**
     * Quản lý cây thể loại danh mục (Admin Only)
     */
    public static function manageCategory(string $action, array $data): array {
        $pdo = DB::get();

        if ($action === 'list') {
            return $pdo->query("
                SELECT c.id, c.name, c.slug, c.icon, c.description, c.display_order,
                       COUNT(s.id) as song_count
                FROM categories c
                LEFT JOIN songs s ON c.id = s.category_id
                GROUP BY c.id
                ORDER BY c.display_order ASC, c.id ASC
            ")->fetchAll(PDO::FETCH_ASSOC);
        }

        Auth::requireAdmin();

        switch ($action) {
            case 'create':
                $name = trim($data['name'] ?? '');
                $icon = trim($data['icon'] ?? '🎵');
                $desc = trim($data['description'] ?? '');
                $order = (int)($data['display_order'] ?? 10);
                if (!$name) return ['success' => false, 'message' => 'Tên danh mục không được để trống'];

                $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower(str_replace(' ', '-', $name))) ?: 'cat-' . time();
                $ins = $pdo->prepare("INSERT INTO categories (name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?)");
                $ins->execute([$name, $slug, $icon, $desc, $order]);
                return ['success' => true, 'message' => "Đã thêm danh mục '{$name}'!"];

            case 'update':
                $id = (int)($data['id'] ?? 0);
                $name = trim($data['name'] ?? '');
                $icon = trim($data['icon'] ?? '🎵');
                $desc = trim($data['description'] ?? '');
                $order = (int)($data['display_order'] ?? 0);
                if (!$id || !$name) return ['success' => false, 'message' => 'Thiếu dữ liệu'];

                $upd = $pdo->prepare("UPDATE categories SET name = ?, icon = ?, description = ?, display_order = ? WHERE id = ?");
                $upd->execute([$name, $icon, $desc, $order, $id]);
                return ['success' => true, 'message' => "Đã cập nhật danh mục '{$name}'!"];

            case 'delete':
                $id = (int)($data['id'] ?? 0);
                if (!$id || $id === 1) return ['success' => false, 'message' => 'Không thể xóa danh mục mặc định'];

                // Chuyển các bài hát thuộc danh mục này về danh mục 1 (Thánh ca)
                $pdo->prepare("UPDATE songs SET category_id = 1 WHERE category_id = ?")->execute([$id]);
                $pdo->prepare("DELETE FROM categories WHERE id = ?")->execute([$id]);
                return ['success' => true, 'message' => 'Đã xóa danh mục thành công'];

            default:
                return ['success' => false, 'message' => 'Action không hợp lệ'];
        }
    }

    /**
     * Tìm kiếm bài hát siêu tốc cho Live Autocomplete Picker trên toàn bộ 903 bài
     */
    public static function searchSongsFast(string $keyword): array {
        $pdo = DB::get();
        $q = trim($keyword);
        if ($q === '') {
            // Trả 25 bài đầu tiên
            $stmt = $pdo->query("
                SELECT s.id, s.title, s.httlvnId, s.defaultKey, s.category_id,
                       c.name as category_name, c.icon as category_icon,
                       (SELECT COUNT(*) FROM user_chord_sets WHERE song_id = s.id AND is_public = 1) as chord_sets_count
                FROM songs s
                LEFT JOIN categories c ON s.category_id = c.id
                ORDER BY s.httlvnId ASC LIMIT 25
            ");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $variants = class_exists('SongSearchHelper') ? SongSearchHelper::getQueryVariants($q) : [$q];
        $whereClauses = []; $params = [];
        foreach ($variants as $v) {
            $kw = '%' . $v . '%';
            $whereClauses[] = "(s.title LIKE ? OR s.id LIKE ? OR CAST(s.httlvnId AS TEXT) LIKE ? OR s.lyrics_text LIKE ?)";
            $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw;
        }
        $preClauses = []; $preParams = [];
        foreach ($variants as $v) {
            $preClauses[] = "s.title LIKE ?";
            $preParams[] = $v . '%';
        }
        $preSql = implode(' OR ', $preClauses);
        $whereSql = implode(' OR ', $whereClauses);

        $sql = "
            SELECT s.id, s.title, s.httlvnId, s.defaultKey, s.category_id,
                   c.name as category_name, c.icon as category_icon,
                   (SELECT COUNT(*) FROM user_chord_sets WHERE song_id = s.id AND is_public = 1) as chord_sets_count
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE {$whereSql}
            ORDER BY 
                CASE 
                    WHEN CAST(s.httlvnId AS TEXT) = ? THEN 1
                    WHEN ({$preSql}) THEN 2
                    ELSE 3
                END,
                s.httlvnId ASC
            LIMIT 30
        ";
        $execParams = array_merge($params, [$q], $preParams);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Lấy toàn bộ thông tin chi tiết của 1 bài hát được chọn (Metadata + Master HD + Toàn bộ hợp âm thành viên)
     */
    public static function getSongDetails(string $songId): array {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id, s.lyrics_text,
                   c.name as category_name, c.icon as category_icon, c.slug as category_slug
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.id = ?
        ");
        $stmt->execute([$songId]);
        $song = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$song) return [];

        // Lấy tất cả user chord sets của bài này
        $stmtChords = $pdo->prepare("
            SELECT cs.*, u.display_name, u.role as user_role, u.instrument as user_instrument, u.avatar_url
            FROM user_chord_sets cs
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.song_id = ? AND cs.is_public = 1
            ORDER BY cs.is_recommended DESC, cs.created_at DESC
        ");
        $stmtChords->execute([$songId]);
        $song['user_chord_sets'] = $stmtChords->fetchAll(PDO::FETCH_ASSOC);

        // Kiểm tra xem có bộ HD chuẩn không
        $hdFile = ChordSetService::BASE_DIR . '/' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId) . '/HD.json';
        $hasHd = file_exists($hdFile);
        $hdChords = $hasHd ? (json_decode(file_get_contents($hdFile), true) ?? []) : [];
        $song['has_master_hd'] = $hasHd;
        $song['master_hd_chord_count'] = count($hdChords);

        // Lấy MusicXML versions
        $stmtVers = $pdo->prepare("
            SELECT v.*, u.display_name
            FROM song_versions v
            LEFT JOIN users u ON v.user_id = u.id
            WHERE v.song_id = ?
            ORDER BY v.created_at DESC
        ");
        $stmtVers->execute([$songId]);
        $song['song_versions'] = $stmtVers->fetchAll(PDO::FETCH_ASSOC);

        return $song;
    }

    /**
     * Cập nhật thể loại cho bài hát
     */
    public static function updateSongCategory(string $songId, int $categoryId): array {
        Auth::requireBanhat();
        $pdo = DB::get();

        $catCheck = $pdo->prepare("SELECT COUNT(*) FROM categories WHERE id = ?");
        $catCheck->execute([$categoryId]);
        if ($catCheck->fetchColumn() == 0) {
            return ['success' => false, 'message' => 'Thể loại không tồn tại'];
        }

        $upd = $pdo->prepare("UPDATE songs SET category_id = ? WHERE id = ?");
        $upd->execute([$categoryId, $songId]);
        SongService::invalidateCache();

        return ['success' => true, 'message' => 'Đã cập nhật thể loại bài hát thành công!'];
    }

    /**
     * Gắn nhãn mùa lễ / chủ đề hàng loạt cho nhiều bài hát (Ticket L6-3)
     */
    public static function bulkUpdateLabels(array $songIds, array $labels): array {
        Auth::requireBanhat();
        $pdo = DB::get();

        if (empty($songIds)) {
            return ['success' => false, 'message' => 'Danh sách bài hát rỗng'];
        }

        $fields = [];
        $params = [];

        if (array_key_exists('liturgical_season', $labels)) {
            $fields[] = "liturgical_season = ?";
            $val = trim((string)$labels['liturgical_season']);
            $params[] = $val === '' ? null : $val;
        }

        if (array_key_exists('theme', $labels)) {
            $fields[] = "theme = ?";
            $val = trim((string)$labels['theme']);
            $params[] = $val === '' ? null : $val;
        }

        if (array_key_exists('tags', $labels)) {
            $fields[] = "tags = ?";
            $val = trim((string)$labels['tags']);
            $params[] = $val === '' ? null : $val;
        }

        if (empty($fields)) {
            return ['success' => false, 'message' => 'Không có nhãn nào được chỉ định để cập nhật'];
        }

        $fieldsSql = implode(', ', $fields);
        $placeholders = implode(',', array_fill(0, count($songIds), '?'));
        $sql = "UPDATE songs SET {$fieldsSql} WHERE id IN ({$placeholders})";

        $execParams = array_merge($params, $songIds);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        $affected = $stmt->rowCount();

        // Đồng bộ FTS5 cho các bài hát vừa được gắn nhãn
        foreach ($songIds as $sid) {
            try {
                SongSearchHelper::syncSongFts((string)$sid);
            } catch (\Throwable $e) {}
        }

        // Xóa cache danh sách bài hát
        SongService::invalidateCache();

        return [
            'success' => true,
            'message' => "Đã gắn nhãn thành công cho {$affected} bài hát",
            'affected' => $affected
        ];
    }
}
