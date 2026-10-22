<?php
/**
 * api/services/SongService.php — Business logic cho Songs
 * Facade điều phối quản lý bài hát, tìm kiếm FTS5 và phiên bản MusicXML
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/SongSearchHelper.php';
require_once __DIR__ . '/SongVersionHelper.php';

class SongService {

    /** Resolve an existing MusicXML file strictly below a managed XML root. */
    public static function resolveManagedXmlPath(string $path): ?string {
        if ($path === '') return null;

        $candidate = realpath($path);
        if ($candidate === false) {
            $candidate = realpath(__DIR__ . '/../../' . ltrim($path, '/\\'));
        }
        if ($candidate === false || strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) !== 'xml') {
            return null;
        }

        foreach (['../../storage/Thanh ca', '../../storage/users'] as $relativeRoot) {
            $root = realpath(__DIR__ . '/' . $relativeRoot);
            if ($root === false) continue;
            $prefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
            if ($candidate === $root || str_starts_with($candidate, $prefix)) return $candidate;
        }
        return null;
    }

    public static function cachePath(): string {
        $default = __DIR__ . '/../../storage/data/songs_cache.json';
        try {
            $rows = DB::get()->query('PRAGMA database_list')->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            return $default;
        }
        $file = '';
        foreach ($rows as $row) {
            if (($row['name'] ?? '') === 'main') $file = (string)($row['file'] ?? '');
        }
        $prodDb = realpath(__DIR__ . '/../../storage/data/app.sqlite');
        $realFile = $file !== '' ? (realpath($file) ?: $file) : '';
        if ($prodDb !== false && $realFile === $prodDb) return $default;
        // DB bản sao (test, staging, CLI --db) hoặc in-memory: cache riêng, nếu không khách sẽ thấy danh sách của DB khác.
        $key = $realFile !== '' ? $realFile : 'memory-' . getmypid() . '-' . spl_object_id(DB::get());
        return sys_get_temp_dir() . '/sheetapp_songs_cache_' . md5($key) . '.json';
    }

    public static function invalidateCache(): void {
        $file = self::cachePath();
        $lock = self::lockPublicCache($file);
        if ($lock === false) {
            foreach ([$file, $file . '.etag'] as $path) if (is_file($path)) @unlink($path);
            return;
        }
        try {
            rewind($lock); ftruncate($lock, 0);
            fwrite($lock, bin2hex(random_bytes(16))); fflush($lock);
            foreach ([$file, $file . '.etag'] as $path) if (is_file($path)) @unlink($path);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** A stable lock keeps the JSON and ETag pair consistent across replacement. */
    private static function lockPublicCache(string $file) {
        if (!is_dir(dirname($file))) @mkdir(dirname($file), 0755, true);
        $lock = @fopen($file . '.lock', 'c+');
        if ($lock === false) return false;
        if (!flock($lock, LOCK_EX)) { fclose($lock); return false; }
        return $lock;
    }

    private static function cacheGeneration(string $file): ?string {
        $lock = self::lockPublicCache($file);
        if ($lock === false) return null;
        try { rewind($lock); return (string)stream_get_contents($lock); }
        finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    public static function publicCacheSnapshot(): ?array {
        $file = self::cachePath();
        $lock = self::lockPublicCache($file);
        if ($lock === false) return null;
        try {
            if (!is_file($file)) return null;
            $json = @file_get_contents($file);
            if ($json === false) return null;
            $etag = is_file($file . '.etag') ? trim((string)@file_get_contents($file . '.etag')) : '';
            if (!preg_match('/^[a-f0-9]{64}$/D', $etag)) {
                $etag = hash('sha256', $json);
                @file_put_contents($file . '.etag', $etag, LOCK_EX);
            }
            return ['json' => $json, 'etag' => $etag];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /* ─── Search & Taxonomy Operations (Delegated to SongSearchHelper) ─── */

    public static function removeAccents(string $str): string {
        return SongSearchHelper::removeAccents($str);
    }

    public static function getTaxonomy(): array {
        return SongSearchHelper::getTaxonomy();
    }

    public static function syncSongFts(string $songId): void {
        SongSearchHelper::syncSongFts($songId);
    }

    public static function rebuildFtsIndex(): int {
        return SongSearchHelper::rebuildFtsIndex();
    }

    public static function search(string $query, array $filters = []): array {
        return SongSearchHelper::search($query, $filters);
    }

    public static function searchPage(string $query, array $filters = []): array {
        return SongSearchHelper::searchPage($query, $filters);
    }

    public static function vietnameseAccentRegex(string $str): string {
        return SongSearchHelper::vietnameseAccentRegex($str);
    }

    public static function createLyricSnippet(string $lyrics, string $cleanQuery, string $unaccentedQuery): ?string {
        return SongSearchHelper::createLyricSnippet($lyrics, $cleanQuery, $unaccentedQuery);
    }

    public static function searchByLyric(string $q): array {
        return SongSearchHelper::searchByLyric($q);
    }

    /* ─── CRUD Operations ─── */

    public static function visibilitySqlClause(string $alias = 's'): string {
        $prefix = $alias !== '' ? $alias . '.' : '';
        if (Auth::isAdmin()) {
            return '1=1';
        }
        if (Auth::isBanhat()) {
            return "COALESCE({$prefix}visibility, 'public') != 'admin_only'";
        }
        return "(COALESCE({$prefix}is_public, 1) = 1 AND COALESCE({$prefix}visibility, 'public') = 'public')";
    }

    public static function normalizeVisibility(array $data, ?string $defaultVisibility = 'public'): array {
        $vis = isset($data['visibility']) ? strtolower(trim((string)$data['visibility'])) : null;
        if ($vis !== null && in_array($vis, ['public', 'private', 'internal', 'admin_only'], true)) {
            $isPub = ($vis === 'public') ? 1 : 0;
            return ['visibility' => $vis, 'is_public' => $isPub];
        }
        if (array_key_exists('is_public', $data)) {
            $isPub = ((int)$data['is_public'] === 0) ? 0 : 1;
            return ['visibility' => $isPub ? 'public' : 'private', 'is_public' => $isPub];
        }
        $defVis = $defaultVisibility ?: 'public';
        return ['visibility' => $defVis, 'is_public' => ($defVis === 'public' ? 1 : 0)];
    }

    public static function getAll(): array {
        $isGuest = !Auth::isBanhat() && !Auth::isAdmin();
        $cacheFile = self::cachePath();

        if ($isGuest && file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
            $data = json_decode((string)file_get_contents($cacheFile), true);
            if (is_array($data)) return $data;
        }

        $generation = $isGuest ? self::cacheGeneration($cacheFile) : null;
        $whereVis = self::visibilitySqlClause('s');
        $sql = "SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id, s.liturgical_season, s.theme, s.composer, s.tags, s.tempo, COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public, s.created_by, c.name as category FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE {$whereVis} ORDER BY COALESCE(c.display_order, s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC, s.title ASC";
        $songs = DB::run($sql)->fetchAll();

        // Chỉ ghi cache dùng chung cho danh sách bài hát Public (Guest)
        if ($isGuest && $generation !== null) {
            self::writePublicCache($songs, $generation);
        }

        return $songs;
    }

    public static function writePublicCache(?array $publicSongs = null, ?string $generation = null): void {
        $cacheFile = self::cachePath();
        $generation ??= self::cacheGeneration($cacheFile);
        if ($generation === null) return;
        if ($publicSongs === null) {
            $sql = "SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id, s.liturgical_season, s.theme, s.composer, s.tags, s.tempo, COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public, s.created_by, c.name as category FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE (COALESCE(s.is_public, 1) = 1 AND COALESCE(s.visibility, 'public') = 'public') ORDER BY COALESCE(c.display_order, s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC, s.title ASC";
            $publicSongs = DB::run($sql)->fetchAll();
        }
        $jsonPayload = json_encode($publicSongs, JSON_UNESCAPED_UNICODE);
        if ($jsonPayload !== false) self::storePublicCache($cacheFile, $jsonPayload, $generation);
    }

    private static function storePublicCache(string $cacheFile, string $jsonPayload, string $generation): void {
        $lock = self::lockPublicCache($cacheFile);
        if ($lock === false) return;
        $tmpFile = $cacheFile . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(2));
        try {
            rewind($lock);
            if ((string)stream_get_contents($lock) !== $generation) return;
            // A crash after JSON replacement leaves a missing ETag, rebuilt on the next read.
            if (is_file($cacheFile . '.etag') && !@unlink($cacheFile . '.etag')) return;
            if (@file_put_contents($tmpFile, $jsonPayload, LOCK_EX) !== false) {
                if (@rename($tmpFile, $cacheFile)) {
                    @file_put_contents($cacheFile . '.etag', hash('sha256', $jsonPayload), LOCK_EX);
                } else {
                    error_log('SheetApp public song cache: atomic replacement failed; retaining previous cache');
                }
            }
        } finally {
            if (is_file($tmpFile)) @unlink($tmpFile);
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public static function getById(string $id): ?array {
        $sql = "SELECT s.*, c.name as category FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = ?";
        $song = DB::run($sql, [$id])->fetch();
        if (!$song) {
            $num = (int)$id;
            if ($num > 0) {
                $sql = "SELECT s.*, c.name as category FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE s.httlvnId = ? ORDER BY COALESCE(s.category_id, 1) ASC LIMIT 1";
                $song = DB::run($sql, [$num])->fetch();
            }
        }
        if ($song && !Auth::canViewSong($song)) {
            return null;
        }
        return $song ?: null;
    }

    public static function add(array $data): array {
        self::invalidateCache();

        $title = trim($data['title'] ?? '');
        if (!$title) {
            return ['success' => false, 'message' => 'Tiêu đề không được để trống'];
        }

        $id = trim($data['id'] ?? '');
        if (!$id) {
            $slug = SongVersionHelper::slugify($title);
            $id = $slug ?: 'song-' . time() . '-' . bin2hex(random_bytes(2));
        }

        $xmlPath = trim($data['xmlPath'] ?? '');
        if (!$xmlPath) {
            $xmlPath = "storage/Thanh ca/{$id}.xml";
        }

        $category_id = !empty($data['category_id']) ? (int)$data['category_id'] : (!empty($data['categoryId']) ? (int)$data['categoryId'] : 1);
        $httlvnId = !empty($data['httlvnId']) ? (int)$data['httlvnId'] : null;
        $defaultKey = trim($data['defaultKey'] ?? 'C');
        $lyrics = trim($data['lyrics_text'] ?? '');
        $theme = trim($data['theme'] ?? '');
        $season = trim($data['liturgical_season'] ?? '');
        $composer = trim($data['composer'] ?? '');
        $tags = trim($data['tags'] ?? '');
        $visInfo = self::normalizeVisibility($data, 'public');
        $createdBy = isset($data['created_by']) ? (int)$data['created_by'] : Auth::userId();

        $sql = "INSERT INTO songs (id, title, httlvnId, xmlPath, defaultKey, category_id, lyrics_text, theme, liturgical_season, composer, tags, visibility, is_public, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try {
            DB::run($sql, [$id, $title, $httlvnId, $xmlPath, $defaultKey, $category_id, $lyrics, $theme, $season, $composer, $tags, $visInfo['visibility'], $visInfo['is_public'], $createdBy]);
            self::syncSongFts($id);
            return [
                'success' => true,
                'message' => 'Thêm bài hát thành công',
                'id' => $id,
                'title' => $title,
                'httlvnId' => $httlvnId,
                'xmlPath' => $xmlPath,
                'defaultKey' => $defaultKey,
                'category_id' => $category_id,
                'visibility' => $visInfo['visibility'],
                'is_public' => $visInfo['is_public']
            ];
        } catch (\PDOException $e) {
            error_log('SheetApp song add failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Không thể thêm bài hát.'];
        }
    }

    public static function update(string $id, array $data): array {
        if (!DB::run('SELECT 1 FROM songs WHERE id=?', [$id])->fetchColumn()) return ['success' => false, 'code' => 'not_found', 'message' => 'Không tìm thấy bài hát.'];
        self::invalidateCache();

        // Hỗ trợ alias categoryId -> category_id
        if (array_key_exists('categoryId', $data) && !array_key_exists('category_id', $data)) {
            $data['category_id'] = $data['categoryId'] !== null && $data['categoryId'] !== '' ? (int)$data['categoryId'] : 1;
        }

        // Đồng bộ visibility & is_public nếu một trong hai được truyền vào
        if (array_key_exists('visibility', $data) || array_key_exists('is_public', $data)) {
            $visInfo = self::normalizeVisibility($data);
            $data['visibility'] = $visInfo['visibility'];
            $data['is_public']  = $visInfo['is_public'];
        }

        // TV4-3: Kiểm tra xmlPath bằng resolveManagedXmlPath nếu được truyền vào
        if (array_key_exists('xmlPath', $data)) {
            if (self::resolveManagedXmlPath((string)$data['xmlPath']) === null) {
                return ['success' => false, 'message' => 'Đường dẫn xmlPath không hợp lệ hoặc nằm ngoài vùng quản lý'];
            }
        }

        $fields = [];
        $params = [];
        $allowed = ['title', 'httlvnId', 'xmlPath', 'defaultKey', 'category_id', 'lyrics_text', 'theme', 'liturgical_season', 'composer', 'tags', 'tempo', 'visibility', 'is_public'];

        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $params[] = $data[$f];
            }
        }

        if (empty($fields)) {
            return ['success' => false, 'message' => 'Không có dữ liệu cập nhật'];
        }

        $params[] = $id;
        $sql = "UPDATE songs SET " . implode(', ', $fields) . " WHERE id = ?";
        try {
            DB::run($sql, $params);
            self::syncSongFts($id);
            return ['success' => true, 'message' => 'Cập nhật thành công'];
        } catch (\PDOException $e) {
            error_log('SheetApp song update failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Không thể cập nhật bài hát.'];
        }
    }

    public static function delete(string $id): array {
        self::invalidateCache();

        try {
            $song = self::getById($id);
            if ($song && !empty($song['xmlPath'])) {
                $xmlFile = self::resolveManagedXmlPath($song['xmlPath']);
                if ($xmlFile !== null && file_exists($xmlFile)) {
                    // Không xóa trực tiếp thư viện gốc, chỉ xóa nếu nằm trong uploads
                    if (($up = realpath(__DIR__ . '/../../storage/uploads')) !== false && str_starts_with($xmlFile, rtrim($up, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
                        @unlink($xmlFile);
                    }
                }
            }

            DB::run("DELETE FROM songs WHERE id = ?", [$id]);
            try {
                DB::run("DELETE FROM songs_fts WHERE song_id = ?", [$id]);
            } catch (\Throwable $e) {}

            return ['success' => true, 'message' => 'Xóa bài hát thành công'];
        } catch (\PDOException $e) {
            error_log('SheetApp song delete failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Không thể xóa bài hát.'];
        }
    }

    /* ─── XML & Version Operations (Delegated to SongVersionHelper) ─── */

    public static function saveXml(string $filepath, string $xmlContent): array {
        return SongVersionHelper::saveXml($filepath, $xmlContent);
    }

    public static function restoreXmlBackup(string $filepath): array {
        return SongVersionHelper::restoreXmlBackup($filepath);
    }

    public static function getVersions(string $songId): array {
        return SongVersionHelper::getVersions($songId);
    }

    public static function saveVersion(string $songId, string $xmlContent, string $versionName, ?int $versionId = null, ?string $description = null): array {
        return SongVersionHelper::saveVersion($songId, $xmlContent, $versionName, $versionId, $description);
    }

    public static function deleteVersion(int $versionId): array {
        return SongVersionHelper::deleteVersion($versionId);
    }
}
