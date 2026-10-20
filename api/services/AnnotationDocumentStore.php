<?php
declare(strict_types=1);
require_once __DIR__ . '/../core/HttpException.php';

/** Revision comparison and atomic replacement share a separate, stable lock. */
final class AnnotationDocumentStore {
    public function __construct(private string $directory) {}

    public function read(string $key, array $fallback = []): array {
        return $this->locked($key, LOCK_SH, fn(string $path) => $this->decode($path, $fallback));
    }

    public function write(string $key, string $revision, callable $update, array $fallback = []): array {
        return $this->locked($key, LOCK_EX, function (string $path) use ($revision, $update, $fallback): array {
            $current = $this->decode($path, $fallback);
            if ($revision === '' || !hash_equals(self::revision($current), $revision)) {
                throw new HttpException(409, 'Ghi chú đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.');
            }
            $next = $update($current);
            $json = json_encode($next, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
            $temporary = tempnam($this->directory, '.annotation-');
            if ($temporary === false) throw new HttpException(500, 'Không tạo được file ghi chú.');
            try {
                if (file_put_contents($temporary, $json) !== strlen($json) || !rename($temporary, $path)) {
                    throw new HttpException(500, 'Không lưu được ghi chú.');
                }
            } finally {
                if (is_file($temporary)) unlink($temporary);
            }
            return $next;
        });
    }

    public static function revision(array $document): string {
        return hash('sha256', json_encode($document, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }

    private function decode(string $path, array $fallback): array {
        if (!is_file($path)) return $fallback;
        try {
            $raw = file_get_contents($path);
            $data = json_decode($raw === false ? '' : $raw, true, 64, JSON_THROW_ON_ERROR);
            if (!is_array($data)) throw new RuntimeException('Not a document');
            return $data;
        } catch (Throwable $error) {
            throw new HttpException(500, 'Dữ liệu ghi chú không đọc được. Chưa có thay đổi nào được lưu.', $error);
        }
    }

    private function locked(string $key, int $mode, callable $action): array {
        if (!is_dir($this->directory) && !mkdir($this->directory, 0755, true) && !is_dir($this->directory)) {
            throw new HttpException(500, 'Không mở được kho ghi chú.');
        }
        $path = $this->directory . '/' . $key . '.json';
        $lock = fopen($path . '.lock', 'c');
        if ($lock === false) throw new HttpException(500, 'Không khóa được ghi chú.');
        try {
            if (!flock($lock, $mode)) throw new HttpException(500, 'Ghi chú đang bận.');
            return $action($path);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
