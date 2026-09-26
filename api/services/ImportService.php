<?php
/**
 * api/services/ImportService.php
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../import_helpers.php';
require_once __DIR__ . '/../import_scrapers.php';

define('SHEETS_DIR_IMPORT',  realpath(__DIR__ . '/../../storage/sheets') . '/');

class ImportService {

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

        $ext      = str_ends_with(strtolower($xmlUrl), '.mxl') ? 'mxl' : 'xml';
        $filename = _generateFilename($title, $ext);
        file_put_contents(SHEETS_DIR_IMPORT . $filename, $xmlContent);

        $key  = _detectKey($xmlContent);
        $song = _saveSong(DB::pdo(), $title, 'storage/sheets/' . $filename, $key, $pageUrl);

        return ['success' => true, 'title' => $title, 'xmlUrl' => $xmlUrl, 'key' => $key, 'song' => $song];
    }

    public static function fetch(string $xmlUrl, string $title = ''): array {
        if (!$xmlUrl) { throw new Exception('URL không được để trống'); }

        $content = _fetchUrl($xmlUrl, 20);
        if ($content === false) { throw new Exception('Không thể tải file từ URL đã cho'); }

        $ext = (str_ends_with(strtolower($xmlUrl), '.mxl')) ? 'mxl' : 'xml';
        if (!_isValidMusicXML($content, $ext)) { throw new Exception('File tải về không phải MusicXML hợp lệ'); }

        if (!$title) $title = pathinfo(parse_url($xmlUrl, PHP_URL_PATH), PATHINFO_FILENAME) ?: 'Bài hát mới';

        $filename = _generateFilename($title, $ext);
        file_put_contents(SHEETS_DIR_IMPORT . $filename, $content);

        $key  = _detectKey($content);
        $song = _saveSong(DB::pdo(), $title, 'storage/sheets/' . $filename, $key, $xmlUrl);

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

        $filename = _generateFilename($title, $ext);
        $path     = SHEETS_DIR_IMPORT . $filename;
        move_uploaded_file($file['tmp_name'], $path);

        $key  = _detectKey($content);
        $song = _saveSong(DB::pdo(), $title, 'storage/sheets/' . $filename, $key, '');

        return ['success' => true, 'title' => $title, 'song' => $song];
    }
}
