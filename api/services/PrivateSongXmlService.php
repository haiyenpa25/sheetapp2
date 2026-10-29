<?php
declare(strict_types=1);

/**
 * api/services/PrivateSongXmlService.php
 *
 * MusicXML của bài KHÔNG công khai (có bản quyền): lưu ngoài vùng tải trực tiếp
 * (storage/private/xml — bị .htaccess chặn, Git bỏ qua) và chỉ phát qua API
 * `songs&action=xml&id=<id>` sau khi kiểm quyền xem bài.
 * Bài trong storage/Thanh ca và storage/users/<user>/imported giữ nguyên cách cũ.
 */
final class PrivateSongXmlService {
    /** Tiền tố id của bài tạo ở trạng thái không công khai (để .gitignore loại JSON hợp âm/ghi chú của chúng). */
    public const ID_PREFIX = 'pv-';
    private const API_PREFIX = 'api/index.php?route=songs&action=xml&id=';
    private const ID_PATTERN = '/^[a-z0-9][a-z0-9_-]{0,120}$/';

    /** Thư mục lưu; test đổi qua biến môi trường SHEETAPP_PRIVATE_XML_DIR để không ghi vào storage thật. */
    public static function dir(): string {
        $override = getenv('SHEETAPP_PRIVATE_XML_DIR');
        $dir = ($override !== false && $override !== '') ? $override : dirname(__DIR__, 2) . '/storage/private/xml';
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Không thể khởi tạo thư mục lưu bản nhạc riêng tư');
        }
        $guard = dirname($dir) . '/.htaccess';
        if (!is_file($guard)) @file_put_contents($guard, "Require all denied\n");
        return (string)realpath($dir);
    }

    public static function apiPath(string $songId): string {
        return self::API_PREFIX . rawurlencode($songId);
    }

    /** Trả về id nếu $path là đường dẫn API của bài riêng tư, ngược lại null. */
    public static function songIdFromApiPath(string $path): ?string {
        if (!str_starts_with($path, self::API_PREFIX)) return null;
        $id = rawurldecode(substr($path, strlen(self::API_PREFIX)));
        return preg_match(self::ID_PATTERN, $id) === 1 ? $id : null;
    }

    public static function isValidId(string $songId): bool {
        return preg_match(self::ID_PATTERN, $songId) === 1;
    }

    /** Đường dẫn tuyệt đối tới file XML của bài (nếu có), luôn nằm dưới thư mục riêng tư. */
    public static function filePath(string $songId): ?string {
        if (!self::isValidId($songId)) return null;
        $dir = self::dir();
        $file = realpath($dir . DIRECTORY_SEPARATOR . $songId . '.xml');
        if ($file === false || !str_starts_with($file, $dir . DIRECTORY_SEPARATOR)) return null;
        return $file;
    }

    /** Ghi nguyên tử file XML của bài; trả về đường dẫn tuyệt đối. */
    public static function store(string $songId, string $xml): string {
        if (!self::isValidId($songId)) throw new InvalidArgumentException('Mã bài hát không hợp lệ');
        $dir = self::dir();
        $target = $dir . DIRECTORY_SEPARATOR . $songId . '.xml';
        $tmp = $target . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(3));
        if (file_put_contents($tmp, $xml, LOCK_EX) !== strlen($xml) || !@rename($tmp, $target)) {
            @unlink($tmp);
            throw new RuntimeException('Không thể ghi đầy đủ MusicXML riêng tư');
        }
        return $target;
    }

    public static function remove(string $songId): void {
        $file = self::filePath($songId);
        if ($file !== null) @unlink($file);
    }
}
