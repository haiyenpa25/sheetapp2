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
            return ['success' => false, 'message' => 'Lỗi: File không tồn tại trên server: ' . htmlspecialchars($filepath)];
        }

        if (strpos($targetPath, $storageRoot) !== 0) {
            return ['success' => false, 'message' => 'Lỗi: Truy cập file ngoài vùng quản lý bị từ chối.'];
        }

        // BẢO VỆ BẢN GỐC: Không cho ghi đè trực tiếp kho bản gốc nếu không phải Super Admin
        $thanhCaRoot = realpath(__DIR__ . '/../../storage/Thanh ca');
        if ($thanhCaRoot && strpos($targetPath, $thanhCaRoot) === 0 && !Auth::isAdmin()) {
            return [
                'success' => false,
                'message' => '🛡️ Bản gốc được khóa bảo vệ an toàn. Vui lòng chọn "Lưu Thành Phiên Bản" để tạo bản chỉnh sửa theo tài khoản của bạn.'
            ];
        }

        if (pathinfo($targetPath, PATHINFO_EXTENSION) !== 'xml') {
             return ['success' => false, 'message' => 'Lỗi: Chỉ cho phép ghi file .xml'];
        }

        // Tự động sao lưu an toàn bản gốc .xml.bak trước khi ghi đè
        $backupPath = $targetPath . '.bak';
        @copy($targetPath, $backupPath);

        $result = file_put_contents($targetPath, $xmlContent);

        if ($result === false) {
            return ['success' => false, 'message' => 'Lỗi: Không có quyền ghi đè (Permission denied). Hãy kiểm tra Folder Permissions!'];
        }

        return ['success' => true, 'message' => 'Đã lưu thành công vào file MusicXML. Đã tạo bản sao lưu dự phòng an toàn (.bak).'];
    }

    public static function restoreXmlBackup(string $filepath): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        $targetPath = realpath($filepath);
        if (!$targetPath && !file_exists($filepath)) {
            $targetPath = realpath(__DIR__ . '/../../' . ltrim($filepath, '/\\'));
        }
        if (!$targetPath || !file_exists($targetPath)) {
            return ['success' => false, 'message' => 'Lỗi: File gốc không tồn tại.'];
        }
        if (strpos($targetPath, $storageRoot) !== 0) {
            return ['success' => false, 'message' => 'Lỗi: Quyền truy cập bị từ chối.'];
        }
        $backupPath = $targetPath . '.bak';
        if (!file_exists($backupPath)) {
            return ['success' => false, 'message' => 'Chưa có bản sao lưu .bak cho bài hát này.'];
        }
        $res = @copy($backupPath, $targetPath);
        if (!$res) {
            return ['success' => false, 'message' => 'Không thể khôi phục từ file sao lưu.'];
        }
        return ['success' => true, 'message' => 'Đã khôi phục thành công bản nhạc từ file sao lưu .bak!'];
    }

    /**
     * Lấy danh sách các phiên bản của bài hát
     */
    public static function getVersions(string $songId): array {
        try {
            $stmt = DB::run("SELECT * FROM song_versions WHERE song_id = ? ORDER BY created_at DESC", [$songId]);
            return $stmt->fetchAll();
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Lưu phiên bản sheet nhạc theo người dùng
     */
    public static function saveVersion(string $songId, string $xmlContent, string $versionName, ?int $versionId = null, ?string $description = null): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        if (!$storageRoot) {
            return ['success' => false, 'message' => 'Lỗi: Thư mục storage không tồn tại'];
        }

        $userId = Auth::userId() ?? 1;
        $username = Auth::username() ?: 'banhat';
        $safeUsername = preg_replace('/[^a-zA-Z0-9_\-]/', '_', strtolower($username));
        $safeSongId   = preg_replace('/[^a-zA-Z0-9_\-]/', '_', strtolower($songId));

        $userSongDir = $storageRoot . '/users/' . $safeUsername . '/' . $safeSongId;
        if (!is_dir($userSongDir)) {
            if (!mkdir($userSongDir, 0775, true) && !is_dir($userSongDir)) {
                return ['success' => false, 'message' => 'Lỗi: Không thể tạo thư mục người dùng trên server'];
            }
        }

        // Trường hợp 1: Ghi đè phiên bản hiện có
        if ($versionId) {
            $ver = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
            if (!$ver) {
                return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
            }
            if ($ver['user_id'] != $userId && !Auth::isAdmin()) {
                return ['success' => false, 'message' => 'Bạn không có quyền sửa phiên bản của người khác'];
            }

            $targetPath = realpath(__DIR__ . '/../../' . ltrim($ver['xml_path'], '/\\'));
            if (!$targetPath) {
                $targetPath = $storageRoot . '/' . ltrim(str_replace('storage/', '', $ver['xml_path']), '/\\');
            }

            // Backup trước khi ghi đè
            if (file_exists($targetPath)) {
                @copy($targetPath, $targetPath . '.bak');
            }

            $res = file_put_contents($targetPath, $xmlContent);
            if ($res === false) {
                return ['success' => false, 'message' => 'Lỗi: Không thể ghi đè file phiên bản'];
            }

            $finalName = !empty($versionName) ? $versionName : $ver['version_name'];
            $finalDesc = $description !== null ? $description : $ver['description'];

            DB::run("UPDATE song_versions SET version_name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
                [$finalName, $finalDesc, $versionId]
            );

            $updated = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
            return [
                'success' => true,
                'message' => "Đã cập nhật thành công phiên bản '{$finalName}'!",
                'data' => $updated
            ];
        }

        // Trường hợp 2: Tạo phiên bản mới
        $existingCount = (int)DB::run("SELECT COUNT(*) FROM song_versions WHERE song_id = ? AND user_id = ?", [$songId, $userId])->fetchColumn();
        $nextIdx = $existingCount + 1;

        $cleanName = trim($versionName);
        if ($cleanName === '') {
            $cleanName = "Phiên bản {$nextIdx} (" . date('d/m/Y') . ")";
        }
        $slugPart = self::slugify($cleanName);
        $slugPart = substr(preg_replace('/[^a-z0-9\-]/', '', $slugPart), 0, 30);
        if (!$slugPart) $slugPart = "ver-{$nextIdx}";

        $versionSlug = "v{$nextIdx}_{$slugPart}";
        $filename = "{$versionSlug}.xml";
        $fullFilePath = $userSongDir . '/' . $filename;
        $relativeXmlPath = "storage/users/{$safeUsername}/{$safeSongId}/{$filename}";

        $res = file_put_contents($fullFilePath, $xmlContent);
        if ($res === false) {
            return ['success' => false, 'message' => 'Lỗi: Không thể lưu file MusicXML của phiên bản mới'];
        }
        // Tạo luôn bản .bak ban đầu
        @copy($fullFilePath, $fullFilePath . '.bak');

        DB::run(
            "INSERT INTO song_versions (song_id, user_id, username, version_name, version_slug, xml_path, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [$songId, $userId, $username, $cleanName, $versionSlug, $relativeXmlPath, $description ?? '']
        );
        $newId = DB::lastId();
        $newRecord = DB::run("SELECT * FROM song_versions WHERE id = ?", [$newId])->fetch();

        return [
            'success' => true,
            'message' => "Đã tạo thành công phiên bản mới: '{$cleanName}'!",
            'data' => $newRecord
        ];
    }

    /**
     * Xóa một phiên bản
     */
    public static function deleteVersion(int $versionId): array {
        $userId = Auth::userId() ?? 1;
        $ver = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
        if (!$ver) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }
        if ($ver['user_id'] != $userId && !Auth::isAdmin()) {
            return ['success' => false, 'message' => 'Bạn không có quyền xóa phiên bản này'];
        }

        $filePath = __DIR__ . '/../../' . ltrim($ver['xml_path'], '/\\');
        if (file_exists($filePath)) @unlink($filePath);
        if (file_exists($filePath . '.bak')) @unlink($filePath . '.bak');

        DB::run("DELETE FROM song_versions WHERE id = ?", [$versionId]);
        return ['success' => true, 'message' => 'Đã xóa phiên bản thành công'];
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
