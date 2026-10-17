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
        return ['absDir' => $absDir, 'relDir' => $relDir];
    }

    private static function finalizeImportedSong(array $song): void {
        if (!empty($song['id'])) {
            SongService::syncSongFts((string)$song['id']);
        }
        SongService::invalidateCache();
    }

    public static function search(string $pageUrl, string $title = ''): array {
        if (!$pageUrl) { throw new Exception('URL không được để trống'); }

        $html = _fetchUrl($pageUrl, 15);
        if ($html === false) { throw new Exception('Không thể tải trang. Kiểm tra URL hoặc kết nối mạng.'); }

        if (!$title) {
            $title = _extractTitle($html) ?: basename(parse_url($pageUrl, PHP_URL_PATH));
            $title = preg_replace('/^Sheet\s+Thánh\s+Ca\s+\d+\s+/iu', '', $title);
        }

        $xmlUrl = _extractXmlUrl($html, $pageUrl) ?: _guessHttlvnXmlUrl($pageUrl, $html) ?: _extractXmlFromScript($html, $pageUrl);

        if (!$xmlUrl) {
            throw new Exception('Không tìm thấy file MusicXML. Hãy thử lấy URL trực tiếp file .xml từ Network tab của browser.');
        }

        $xmlContent = _fetchUrl($xmlUrl, 20);
        if (!$xmlContent) {
            $base       = parse_url($pageUrl, PHP_URL_SCHEME) . '://' . parse_url($pageUrl, PHP_URL_HOST);
            $xmlUrl2    = $base . (str_starts_with($xmlUrl, '/') ? $xmlUrl : '/' . $xmlUrl);
            $xmlContent = _fetchUrl($xmlUrl2, 20);
        }

        if (!$xmlContent || !_isValidMusicXML($xmlContent, 'xml')) {
            throw new Exception('Tải được link nhưng nội dung không phải MusicXML hợp lệ. URL thử: ' . $xmlUrl);
        }

        $dir      = self::resolveImportDir();
        $ext      = str_ends_with(strtolower($xmlUrl), '.mxl') ? 'mxl' : 'xml';
        $filename = _generateFilename($title, $ext);
        if (file_put_contents($dir['absDir'] . $filename, $xmlContent) === false) {
            throw new Exception('Không thể ghi file MusicXML vào vùng lưu trữ');
        }

        $key  = _detectKey($xmlContent);
        $song = _saveSong(DB::pdo(), $title, $dir['relDir'] . $filename, $key, $pageUrl);
        self::finalizeImportedSong($song);

        return ['success' => true, 'title' => $title, 'xmlUrl' => $xmlUrl, 'key' => $key, 'song' => $song];
    }

    public static function fetch(string $xmlUrl, string $title = ''): array {
        if (!$xmlUrl) { throw new Exception('URL không được để trống'); }

        $content = _fetchUrl($xmlUrl, 20);
        if ($content === false) { throw new Exception('Không thể tải file từ URL đã cho'); }

        $ext = (str_ends_with(strtolower($xmlUrl), '.mxl')) ? 'mxl' : 'xml';
        if (!_isValidMusicXML($content, $ext)) { throw new Exception('File tải về không phải MusicXML hợp lệ'); }

        if (!$title) $title = pathinfo(parse_url($xmlUrl, PHP_URL_PATH), PATHINFO_FILENAME) ?: 'Bài hát mới';

        $dir      = self::resolveImportDir();
        $filename = _generateFilename($title, $ext);
        if (file_put_contents($dir['absDir'] . $filename, $content) === false) {
            throw new Exception('Không thể ghi file MusicXML vào vùng lưu trữ');
        }

        $key  = _detectKey($content);
        $song = _saveSong(DB::pdo(), $title, $dir['relDir'] . $filename, $key, $xmlUrl);
        self::finalizeImportedSong($song);

        return ['success' => true, 'title' => $title, 'song' => $song];
    }

    public static function upload(array $file, string $title = ''): array {
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

        $dir      = self::resolveImportDir();
        $filename = _generateFilename($title, $ext === 'musicxml' ? 'xml' : $ext);
        $path     = $dir['absDir'] . $filename;
        if (!move_uploaded_file($file['tmp_name'], $path) && file_put_contents($path, $content) === false) {
            throw new Exception('Không thể lưu file MusicXML tải lên');
        }

        $key  = _detectKey($content);
        $song = _saveSong(DB::pdo(), $title, $dir['relDir'] . $filename, $key, '');
        self::finalizeImportedSong($song);

        return ['success' => true, 'title' => $title, 'song' => $song];
    }
}
