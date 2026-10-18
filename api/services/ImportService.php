<?php
/**
 * api/services/ImportService.php
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/../import_helpers.php';
require_once __DIR__ . '/../import_scrapers.php';

class ImportService {
    private const MAX_NAME_ATTEMPTS = 10;

    /**
     * Trả về thư mục lưu trữ MusicXML hợp lệ thuộc vùng quản lý storage/users/<user>/imported
     * @return array{absDir: string, relDir: string}
     */
    private static function resolveImportDir(): array {
        $username = Auth::username() ?: 'admin';
        $safeUser = preg_replace('/[^a-zA-Z0-9_\-]/', '_', strtolower($username)) ?: 'admin';
        $relDir   = 'storage/users/' . $safeUser . '/imported/';
        $absDir   = dirname(__DIR__, 2) . '/' . $relDir;
        if (!is_dir($absDir) && !@mkdir($absDir, 0775, true) && !is_dir($absDir)) {
            throw new Exception('Không thể khởi tạo thư mục lưu trữ bản nhạc trên máy chủ');
        }
        $usersRoot = realpath(dirname(__DIR__, 2) . '/storage/users');
        $resolvedDir = realpath($absDir);
        if ($usersRoot === false || $resolvedDir === false ||
            !str_starts_with($resolvedDir, $usersRoot . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Thư mục nhập nhạc nằm ngoài vùng được quản lý');
        }
        return ['absDir' => $resolvedDir . DIRECTORY_SEPARATOR, 'relDir' => $relDir];
    }

    private static function finalizeImportedSong(array $song): void {
        if (!empty($song['id'])) {
            SongService::syncSongFts((string)$song['id']);
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

    private static function storeImportedSong(string $content, array $metadata): array {
        $dir = self::resolveImportDir();
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
            $song = _saveSong(DB::pdo(), $metadata['title'], $dir['relDir'] . $filename, $key, $metadata['source'], $metadata);
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
        if (!$title) {
            $title = pathinfo($file['name'], PATHINFO_FILENAME);
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

        $meta = array_merge($options, [
            'title'  => $title,
            'ext'    => $ext === 'musicxml' ? 'xml' : $ext,
            'source' => ''
        ]);
        return self::storeImportedSong($content, $meta);
    }
}
