<?php
declare(strict_types=1);

/**
 * api/services/ChurchSongService.php
 * Kho bài riêng của Hội Thánh: admin HT liệt kê / sửa thông tin / xóa / chuyển công khai bài nằm trong
 * danh mục riêng (categories.church_id) CỦA HT MÌNH. Không biết HTTP; kiểm quyền quản lý HT làm ở Controller.
 * Chiều ngược lại (công khai → riêng tư) không có ở đây: chỉ admin hệ thống làm qua quản lý bài hát.
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/SongService.php';

final class ChurchSongService {
    /** Thông tin cho phép admin HT sửa; không cho đổi danh mục/quyền/đường dẫn để bài không thoát khỏi kho riêng. */
    private const EDITABLE_FIELDS = ['title', 'composer', 'defaultKey', 'tempo'];

    public static function list(int $churchId): array {
        return DB::run(
            'SELECT s.id, s.title, s.composer, s.defaultKey, s.tempo, s.category_id, c.name AS category_name
             FROM songs s JOIN categories c ON c.id = s.category_id
             WHERE c.church_id = ? ORDER BY c.id, s.title COLLATE NOCASE',
            [$churchId]
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Bài có nằm trong danh mục riêng của HT này không. */
    public static function owns(int $churchId, string $songId): bool {
        return (bool)DB::run(
            'SELECT 1 FROM songs s JOIN categories c ON c.id = s.category_id WHERE s.id = ? AND c.church_id = ?',
            [$songId, $churchId]
        )->fetchColumn();
    }

    public static function update(string $songId, array $data): void {
        $clean = array_intersect_key($data, array_flip(self::EDITABLE_FIELDS));
        if (isset($clean['title']) && trim((string)$clean['title']) === '') {
            throw new InvalidArgumentException('Tên bài không được để trống');
        }
        if (isset($clean['tempo'])) {
            $tempo = (int)$clean['tempo'];
            if ($tempo !== 0 && ($tempo < 20 || $tempo > 300)) throw new InvalidArgumentException('Tempo phải từ 20 đến 300');
            $clean['tempo'] = $tempo ?: null;
        }
        if ($clean === []) throw new InvalidArgumentException('Không có thông tin để cập nhật');
        $res = SongService::update($songId, $clean);
        if (empty($res['success'])) throw new InvalidArgumentException((string)($res['message'] ?? 'Không cập nhật được bài'));
    }

    public static function delete(string $songId): void {
        $res = SongService::delete($songId, true);
        if (empty($res['success'])) throw new InvalidArgumentException((string)($res['message'] ?? 'Không xóa được bài'));
    }

    /** Chuyển bài sang một danh mục CÔNG KHAI chung (không thuộc HT nào); file XML tự chuyển ra thư mục công khai. */
    public static function publish(string $songId, int $targetCategoryId): void {
        $row = DB::run('SELECT id, church_id, visibility FROM categories WHERE id = ?', [$targetCategoryId])->fetch(PDO::FETCH_ASSOC);
        if (!$row || $row['church_id'] !== null || ($row['visibility'] ?? 'public') !== 'public') {
            throw new InvalidArgumentException('Chỉ chuyển được vào danh mục công khai chung');
        }
        $res = SongService::update($songId, ['category_id' => $targetCategoryId, 'visibility' => 'public']);
        if (empty($res['success'])) throw new InvalidArgumentException((string)($res['message'] ?? 'Không chuyển được bài'));
    }
}
