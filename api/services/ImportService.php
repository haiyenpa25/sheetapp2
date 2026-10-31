<?php
/**
 * api/services/ImportService.php
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/../import_helpers.php';
require_once __DIR__ . '/../import_scrapers.php';

class ImportService {
    private const MAX_NAME_ATTEMPTS = 10;

    /**
     * Trả về thư mục lưu trữ MusicXML công khai theo danh mục: storage/Thanh ca/<category-slug>/
     * @return array{absDir: string, relDir: string, catSlug: string}
     */
    private static function resolveImportDir(int $categoryId = 1): array {
        $catSlug = 'thanh-ca';
        if ($categoryId > 1) {
            try {
                $row = DB::run('SELECT slug, name FROM categories WHERE id = ?', [$categoryId])->fetch();
                if ($row) {
                    $rawSlug = trim((string)($row['slug'] ?? ''));
                    $catSlug = preg_replace('/[^a-z0-9\-]/', '', strtolower($rawSlug))
                        ?: (_slugify((string)($row['name'] ?? '')) ?: 'thanh-ca');
                }
            } catch (Throwable $e) {
                $catSlug = 'thanh-ca';
            }
        }
        $relDir = ($categoryId <= 1 || $catSlug === 'thanh-ca')
            ? 'storage/Thanh ca/'
            : ('storage/Thanh ca/' . $catSlug . '/');
        $absDir = dirname(__DIR__, 2) . '/' . $relDir;
        if (!is_dir($absDir) && !@mkdir($absDir, 0775, true) && !is_dir($absDir)) {
            throw new Exception('Không thể khởi tạo thư mục lưu trữ bản nhạc theo danh mục trên máy chủ');
        }
        $libraryRoot = realpath(dirname(__DIR__, 2) . '/storage/Thanh ca');
        $resolvedDir = realpath($absDir);
        if ($libraryRoot === false || $resolvedDir === false ||
            ($resolvedDir !== $libraryRoot && !str_starts_with($resolvedDir, $libraryRoot . DIRECTORY_SEPARATOR))) {
            throw new RuntimeException('Thư mục nhập nhạc nằm ngoài vùng thư viện được quản lý');
        }
        return ['absDir' => $resolvedDir . DIRECTORY_SEPARATOR, 'relDir' => $relDir, 'catSlug' => $catSlug];
    }

    private static function finalizeImportedSong(array $song): void {
        if (!empty($song['id'])) {
            $songId = (string)$song['id'];
            SongService::syncSongFts($songId);
            if (($song['visibility'] ?? 'public') === 'public') {
                try {
                    $existingHd = DB::run("SELECT COUNT(*) FROM user_chord_sets WHERE song_id = ? AND set_name = 'HD'", [$songId])->fetchColumn();
                    if ((int)$existingHd === 0) {
                        DB::run(
                            "INSERT INTO user_chord_sets (song_id, user_id, username, set_name, chord_count, chords_json, checksum, attribution, is_public, is_recommended) VALUES (?, 1, 'system', 'HD', 0, '[]', ?, 'Khởi tạo khi thêm bài', 1, 1)",
                            [$songId, md5('[]')]
                        );
                    }
                } catch (Throwable $e) {}
            }
        }
        SongService::invalidateCache();
    }

    private static function reserveImportFile(array $dir, array $metadata): array {
        for ($attempt = 0; $attempt < self::MAX_NAME_ATTEMPTS; $attempt++) {
            $filename = _generateFilename($metadata['title'], $metadata['ext'], $dir['absDir']);
            $path = $dir['absDir'] . $filename;
            $handle = @fopen($path, 'x');
            if ($handle !== false) return [$filename, $path, $handle];
            if (!file_exists($path)) throw new RuntimeException('Không thể tạo file MusicXML');
        }
        throw new RuntimeException('Không thể tạo tên file MusicXML riêng');
    }

    /** Bài không công khai (theo lựa chọn hoặc theo danh mục): XML vào vùng riêng tư, CSDL lưu URL API có kiểm quyền. */
    private static function storePrivateSong(string $content, array $metadata): array {
        if (($metadata['ext'] ?? 'xml') !== 'xml') {
            throw new Exception('Bài riêng tư chỉ nhận file .xml hoặc .musicxml (không nhận .mxl)');
        }
        $key = _detectKey($content);
        $song = _saveSong(DB::pdo(), $metadata['title'], 'pending', $key, $metadata['source'], $metadata);
        try {
            PrivateSongXmlService::store((string)$song['id'], $content);
            $song['xmlPath'] = PrivateSongXmlService::apiPath((string)$song['id']);
            DB::run('UPDATE songs SET xmlPath = ? WHERE id = ?', [$song['xmlPath'], $song['id']]);
        } catch (Throwable $error) {
            DB::run('DELETE FROM songs WHERE id = ?', [$song['id']]);
            PrivateSongXmlService::remove((string)$song['id']);
            throw $error;
        }
        self::finalizeImportedSong($song);
        return ['success' => true, 'title' => $metadata['title'], 'key' => $key,
            'visibility' => $song['visibility'], 'is_public' => $song['is_public'], 'song' => $song];
    }

    private static function storeImportedSong(string $content, array $metadata): array {
        $categoryId = !empty($metadata['category_id']) ? (int)$metadata['category_id'] : 1;
        $effective = SongService::clampToCategory(SongService::normalizeVisibility($metadata, 'public'), $categoryId);
        if ($effective['visibility'] !== 'public') {
            return self::storePrivateSong($content, $metadata);
        }
        $dir = self::resolveImportDir($categoryId);
        [$filename, $path, $handle] = self::reserveImportFile($dir, $metadata);
        try {
            $written = fwrite($handle, $content);
        } finally {
            fclose($handle);
        }
        if ($written !== strlen($content)) {
            @unlink($path);
            throw new RuntimeException('Không thể ghi đầy đủ MusicXML');
        }
        try {
            $key = _detectKey($content);
            $saveMeta = $metadata + ['category_slug' => $dir['catSlug'] ?? 'thanh-ca'];
            $song = _saveSong(DB::pdo(), $metadata['title'], $dir['relDir'] . $filename, $key, $metadata['source'], $saveMeta);
        } catch (Throwable $error) {
            @unlink($path);
            throw $error;
        }
        self::finalizeImportedSong($song);
        return [
            'success'    => true,
            'title'      => $metadata['title'],
            'key'        => $key,
            'visibility' => $song['visibility'] ?? 'public',
            'is_public'  => $song['is_public'] ?? 1,
            'song'       => $song
        ];
    }

    public static function search(string $pageUrl, string $title = '', array $options = []): array {
        if (!$pageUrl) { throw new Exception('URL không được để trống'); }

        $html = _fetchUrl($pageUrl, 15);
        if ($html === false) { throw new Exception('Không thể tải trang. Kiểm tra URL hoặc kết nối mạng.'); }

        if (!$title && !empty($options['title'])) {
            $title = trim((string)$options['title']);
        }
        if (!$title) {
            $title = _extractTitle($html) ?: basename(parse_url($pageUrl, PHP_URL_PATH));
            $title = preg_replace('/^Sheet\s+Thánh\s+Ca\s+\d+\s+/iu', '', $title);
        }

        $xmlUrl = _extractXmlUrl($html, $pageUrl);
        $embedded = $xmlUrl ? null : _extractXmlFromScript($html, $pageUrl);
        if (!$xmlUrl && !$embedded) $xmlUrl = _guessHttlvnXmlUrl($pageUrl, $html);

        if (!$xmlUrl && !$embedded) {
            throw new Exception('Không tìm thấy file MusicXML. Hãy thử lấy URL trực tiếp file .xml từ Network tab của browser.');
        }

        $xmlContent = $embedded ?: _fetchUrl($xmlUrl, 20);

        if (!$xmlContent || !_isValidMusicXML($xmlContent, 'xml')) {
            throw new Exception('Tải được link nhưng nội dung không phải MusicXML hợp lệ. URL thử: ' . $xmlUrl);
        }

        $ext      = str_ends_with(strtolower($xmlUrl ?? ''), '.mxl') ? 'mxl' : 'xml';
        $meta     = array_merge($options, ['title' => $title, 'ext' => $ext, 'source' => $pageUrl]);
        return ['xmlUrl' => $xmlUrl ?: $pageUrl] + self::storeImportedSong($xmlContent, $meta);
    }

    public static function fetch(string $xmlUrl, string $title = '', array $options = []): array {
        if (!$xmlUrl) { throw new Exception('URL không được để trống'); }

        $content = _fetchUrl($xmlUrl, 20);
        if ($content === false) { throw new Exception('Không thể tải file từ URL đã cho'); }

        $ext = (str_ends_with(strtolower($xmlUrl), '.mxl')) ? 'mxl' : 'xml';
        if (!_isValidMusicXML($content, $ext)) { throw new Exception('File tải về không phải MusicXML hợp lệ'); }

        if (!$title && !empty($options['title'])) {
            $title = trim((string)$options['title']);
        }
        if (!$title) $title = pathinfo(parse_url($xmlUrl, PHP_URL_PATH), PATHINFO_FILENAME) ?: 'Bài hát mới';

        $meta = array_merge($options, ['title' => $title, 'ext' => $ext, 'source' => $xmlUrl]);
        return self::storeImportedSong($content, $meta);
    }

    private static function titleFromMusicXml(string $xml): string {
        $placeholders = ['untitled score', 'untitled', 'title', 'subtitle', 'composer / arranger'];
        foreach (['work-title', 'movement-title'] as $tag) {
            if (preg_match('#<' . $tag . '>\s*([^<]+?)\s*</' . $tag . '>#u', $xml, $m)) {
                $t = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_XML1, 'UTF-8'));
                if ($t !== '' && !in_array(mb_strtolower($t), $placeholders, true)) return mb_substr($t, 0, 200);
            }
        }
        return '';
    }

    public static function upload(array $file, string|array $titleOrOptions = '', array $options = []): array {
        if (is_array($titleOrOptions)) {
            $options = $titleOrOptions;
            $title = trim((string)($options['title'] ?? ''));
        } else {
            $title = trim($titleOrOptions);
        }
        if (!$title && !empty($options['title'])) {
            $title = trim((string)$options['title']);
        }
        if ($file['error'] !== UPLOAD_ERR_OK) { throw new Exception('Lỗi upload: ' . $file['error']); }
        if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > 10485760) {
            throw new Exception('File tải lên phải có dung lượng từ 1 byte đến 10 MB');
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xml','mxl','musicxml'])) {
            throw new Exception('Chỉ chấp nhận file .xml, .mxl, .musicxml');
        }

        $content = file_get_contents($file['tmp_name']);
        if (!_isValidMusicXML($content, $ext)) { throw new Exception('File không hợp lệ — không phải MusicXML'); }

        // Tên bài: ưu tiên tên người nhập, rồi tên trong file (bỏ tên mặc định của phần mềm soạn nhạc), cuối cùng là tên file.
        if (!$title && $ext !== 'mxl') $title = self::titleFromMusicXml($content);
        if (!$title) $title = pathinfo($file['name'], PATHINFO_FILENAME);

        $meta = array_merge($options, [
            'title'  => $title,
            'ext'    => $ext === 'musicxml' ? 'xml' : $ext,
            'source' => ''
        ]);
        return self::storeImportedSong($content, $meta);
    }
}
