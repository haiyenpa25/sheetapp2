<?php
/**
 * api/services/SongService.php — Business logic cho Songs
 */
require_once __DIR__ . '/../core/DB.php';

class SongService {
    private static function cachePath(): string {
        return __DIR__ . '/../../storage/data/songs_cache.json';
    }

    public static function invalidateCache(): void {
        $file = self::cachePath();
        if (file_exists($file)) {
            @unlink($file);
        }
    }

    public static function getAll(): array {
        $cacheFile = self::cachePath();
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
            $data = json_decode(file_get_contents($cacheFile), true);
            if (is_array($data) && !empty($data)) return $data;
        }

        $songs = DB::query("
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   c.name as category
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            ORDER BY s.httlvnId ASC, s.title ASC
        ");

        @file_put_contents($cacheFile, json_encode($songs, JSON_UNESCAPED_UNICODE));
        return $songs;
    }


    public static function searchByLyric(string $q): array {
        $keyword = '%' . $q . '%';
        $rows = DB::run("
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   c.name as category, s.lyrics_text
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.lyrics_text LIKE ?
            ORDER BY s.httlvnId ASC, s.title ASC LIMIT 50
        ", [$keyword])->fetchAll();

        foreach ($rows as &$song) {
            $pos = mb_stripos($song['lyrics_text'] ?? '', $q);
            if ($pos !== false) {
                $start = max(0, $pos - 25);
                $song['lyric_snippet'] = '...' . trim(mb_substr($song['lyrics_text'], $start, 80)) . '...';
            }
            unset($song['lyrics_text']);
        }
        return $rows;
    }

    public static function add(array $data): array {
        $id = self::slugify($data['title'] ?? 'bai-hat-' . time());
        $base = $id; $i = 1;
        while (DB::run("SELECT COUNT(*) FROM songs WHERE id = ?", [$id])->fetchColumn() > 0) {
            $id = $base . '-' . $i++;
        }
        $title      = $data['title']      ?? 'Bài hát mới';
        $xmlPath    = $data['xmlPath']    ?? '';
        $defaultKey = $data['defaultKey'] ?? '';
        $httlvnId   = isset($data['httlvnId']) && $data['httlvnId'] !== '' ? intval($data['httlvnId']) : null;
        $catId      = isset($data['categoryId']) ? intval($data['categoryId']) : 1;

        DB::run("INSERT INTO songs (id,title,httlvnId,xmlPath,defaultKey,category_id) VALUES (?,?,?,?,?,?)",
            [$id, $title, $httlvnId, $xmlPath, $defaultKey, $catId]);
        self::invalidateCache();

        return compact('id','title','xmlPath','defaultKey','httlvnId') + ['category_id' => $catId];
    }

    public static function update(string $id, array $data): array {
        $fields = []; $params = [];
        foreach (['title','defaultKey','xmlPath'] as $f) {
            if (isset($data[$f])) { $fields[] = "$f = ?"; $params[] = $data[$f]; }
        }
        if (isset($data['categoryId'])) { $fields[] = 'category_id = ?'; $params[] = intval($data['categoryId']); }
        // INC-7 fix: Cho phép admin update httlvnId (số thứ tự bài hát)
        if (array_key_exists('httlvnId', $data)) {
            $fields[] = 'httlvnId = ?';
            $params[] = $data['httlvnId'] !== '' && $data['httlvnId'] !== null ? intval($data['httlvnId']) : null;
        }
        if (!$fields) return ['error' => 'No data to update'];
        $params[] = $id;
        DB::run("UPDATE songs SET " . implode(', ', $fields) . " WHERE id = ?", $params);
        self::invalidateCache();
        return DB::run("SELECT * FROM songs WHERE id = ?", [$id])->fetch() ?: [];
    }

    public static function delete(string $id): array {
        $song = DB::run("SELECT xmlPath FROM songs WHERE id = ?", [$id])->fetch();
        if (!$song) return ['error' => 'Song not found'];
        DB::run("DELETE FROM songs WHERE id = ?", [$id]);
        self::invalidateCache();

        if (!empty($song['xmlPath'])) {
            $f = __DIR__ . '/../../' . $song['xmlPath'];
            if (file_exists($f)) @unlink($f);
        }
        // BUG-6 fix: SessionService dùng {prefix}_{hash}.json, không phải {id}.json
        // Dùng cùng logic để tìm đúng tên file session
        $sessDir = __DIR__ . '/../../storage/data/sessions/';
        $prefix = preg_replace('/[^a-z0-9\-]/', '', strtolower(substr($id, 0, 30)));
        $hash   = substr(md5($id), 0, 8);
        $sf = $sessDir . ($prefix ? "{$prefix}_{$hash}" : $hash) . '.json';
        if (file_exists($sf)) @unlink($sf);
        return ['success' => true, 'id' => $id];
    }

    public static function saveXml(string $filepath, string $xmlContent): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        $targetPath = realpath($filepath);

        if (!$targetPath && !file_exists($filepath)) {
            $targetPath = realpath(__DIR__ . '/../../' . ltrim($filepath, '/\\'));
        }

        if (!$targetPath || !file_exists($targetPath)) {
            return ['success' => false, 'message' => 'Lỗi: File gốc không tồn tại trên server: ' . htmlspecialchars($filepath)];
        }

        if (strpos($targetPath, $storageRoot) !== 0) {
            return ['success' => false, 'message' => 'Lỗi: Truy cập file ngoài vùng quản lý bị từ chối.'];
        }

        if (pathinfo($targetPath, PATHINFO_EXTENSION) !== 'xml') {
             return ['success' => false, 'message' => 'Lỗi: Chỉ cho phép ghi file .xml'];
        }

        $result = file_put_contents($targetPath, $xmlContent);

        if ($result === false) {
            return ['success' => false, 'message' => 'Lỗi: Không có quyền ghi đè (Permission denied). Hãy kiểm tra Folder Permissions!'];
        }

        return ['success' => true, 'message' => 'Đã lưu vĩnh viễn hợp âm vào file gốc.'];
    }

    private static function slugify(string $text): string {
        $text = mb_strtolower($text, 'UTF-8');
        $from = ['à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ',
                 'đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ',
                 'ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ',
                 'ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ',
                 'ỳ','ý','ỷ','ỹ','ỵ'];
        $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
                 'd','e','e','e','e','e','e','e','e','e','e','e',
                 'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
                 'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
                 'y','y','y','y','y'];
        $text = str_replace($from, $to, $text);
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        return substr(preg_replace('/[\s-]+/', '-', trim($text)), 0, 80);
    }
}
