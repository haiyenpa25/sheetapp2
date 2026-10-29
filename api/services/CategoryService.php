<?php
/**
 * api/services/CategoryService.php
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/SongService.php';

class CategoryService {
    public const VISIBILITIES = ['public', 'private', 'admin_only'];
    private const NAME_MAX = 100;

    private static function hasVisibility(): bool {
        return DB::hasColumn('categories', 'visibility');
    }

    /** Danh mục người xem hiện tại được thấy: admin tất cả; ban nhạc trở lên thấy public + private; còn lại chỉ public. */
    public static function getAll(): array {
        if (!self::hasVisibility()) {
            return DB::query("SELECT c.*, 'public' AS visibility, (SELECT COUNT(*) FROM songs s WHERE s.category_id = c.id) AS song_count FROM categories c ORDER BY COALESCE(c.display_order, c.id) ASC, c.id ASC");
        }
        $allowed = Auth::isAdmin() ? "('public','private','admin_only')" : (Auth::isBanhat() ? "('public','private')" : "('public')");
        $songClause = SongService::visibilitySqlClause('s');
        return DB::query("SELECT c.*, (SELECT COUNT(*) FROM songs s WHERE s.category_id = c.id AND {$songClause}) AS song_count
            FROM categories c WHERE c.visibility IN {$allowed} ORDER BY COALESCE(c.display_order, c.id) ASC, c.id ASC");
    }

    private static function cleanName(string $name): string {
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
        if ($name === '' || mb_strlen($name) > self::NAME_MAX) {
            throw new InvalidArgumentException('Tên danh mục phải có từ 1 đến ' . self::NAME_MAX . ' ký tự.');
        }
        return $name;
    }

    private static function cleanVisibility(string $visibility): string {
        $visibility = strtolower(trim($visibility));
        if (!in_array($visibility, self::VISIBILITIES, true)) {
            throw new InvalidArgumentException('Quyền xem phải là public, private hoặc admin_only.');
        }
        if ($visibility !== 'public' && !self::hasVisibility()) {
            throw new InvalidArgumentException('Cơ sở dữ liệu chưa có cột quyền xem danh mục — chạy "php tools/migrate.php" (migration 017) trước.');
        }
        return $visibility;
    }

    private static function assertNameFree(string $name, int $exceptId = 0): void {
        // So sánh trong PHP: LOWER() của SQLite chỉ hạ chữ ASCII nên "QUYỀN" và "quyền" bị coi là khác nhau.
        $needle = mb_strtolower($name);
        foreach (DB::query('SELECT id, name FROM categories') as $row) {
            if ((int)$row['id'] !== $exceptId && mb_strtolower((string)$row['name']) === $needle) {
                throw new InvalidArgumentException('Đã có danh mục tên "' . $name . '".');
            }
        }
    }

    public static function create(string $name, string $visibility = 'public'): array {
        $name = self::cleanName($name);
        $visibility = self::cleanVisibility($visibility);
        self::assertNameFree($name);
        $slug = self::slugify($name);
        if (self::hasVisibility()) {
            DB::run("INSERT INTO categories (name, slug, visibility) VALUES (?, ?, ?)", [$name, $slug, $visibility]);
        } else {
            DB::run("INSERT INTO categories (name, slug) VALUES (?, ?)", [$name, $slug]);
        }
        SongService::invalidateCache();
        return ['id' => (int)DB::lastId(), 'name' => $name, 'slug' => $slug, 'visibility' => $visibility];
    }

    /**
     * Đổi tên và/hoặc quyền xem. Đổi quyền áp dụng ĐỒNG LOẠT cho mọi bài trong danh mục (công khai / chuyển riêng).
     * @return array{id:int,name:string,slug:string,visibility:string,songs_changed:int}
     */
    public static function update(int|string $id, ?string $name = null, ?string $visibility = null): array {
        $id = (int)$id;
        $row = DB::run('SELECT * FROM categories WHERE id = ?', [$id])->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new InvalidArgumentException('Không tìm thấy danh mục.');
        $newName = $name !== null ? self::cleanName($name) : (string)$row['name'];
        if ($name !== null) self::assertNameFree($newName, $id);
        $slug = $name !== null ? self::slugify($newName) : (string)$row['slug'];
        $currentVis = $row['visibility'] ?? 'public';
        $newVis = $visibility !== null ? self::cleanVisibility($visibility) : $currentVis;

        $pdo = DB::get();
        $pdo->beginTransaction();
        $changed = 0;
        try {
            DB::run('UPDATE categories SET name = ?, slug = ? WHERE id = ?', [$newName, $slug, $id]);
            if (self::hasVisibility() && $newVis !== $currentVis) {
                DB::run('UPDATE categories SET visibility = ? WHERE id = ?', [$newVis, $id]);
                $stmt = DB::run('UPDATE songs SET visibility = ?, is_public = ? WHERE category_id = ?',
                    [$newVis, $newVis === 'public' ? 1 : 0, $id]);
                $changed = $stmt->rowCount();
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        SongService::invalidateCache();
        return ['id' => $id, 'name' => $newName, 'slug' => $slug, 'visibility' => $newVis, 'songs_changed' => $changed];
    }

    public static function delete(int|string $id): array {
        if ((int)$id === 1) throw new InvalidArgumentException('Không thể xóa danh mục mặc định.');
        $pdo = DB::get();
        $pdo->beginTransaction();
        try {
            DB::run('UPDATE songs SET category_id=1 WHERE category_id=?', [(int)$id]);
            DB::run('DELETE FROM categories WHERE id=?', [(int)$id]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        SongService::invalidateCache();
        return ['deleted' => true, 'id' => (int)$id];
    }

    private static function slugify(string $text): string {
        $text = mb_strtolower($text, 'UTF-8');
        $replacements = [
            'à','á','â','ã','ä','å','æ','ç','è','é','ê','ë',
            'ì','í','î','ï','ð','ñ','ò','ó','ô','õ','ö','ø',
            'ù','ú','û','ü','ý','þ','ÿ',
            'à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ',
            'đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ',
            'ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ',
            'ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ',
            'ỳ','ý','ỷ','ỹ','ỵ',
        ];
        $latin = [
            'a','a','a','a','a','a','ae','c','e','e','e','e',
            'i','i','i','i','d','n','o','o','o','o','o','o',
            'u','u','u','u','y','th','y',
            'a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
            'd','e','e','e','e','e','e','e','e','e','e','e',
            'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
            'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
            'y','y','y','y','y',
        ];
        $text = str_replace($replacements, $latin, $text);
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        $text = preg_replace('/[\s-]+/', '-', trim($text));
        return substr($text, 0, 80);
    }
}
