<?php
/**
 * api/services/CategoryService.php
 */
require_once __DIR__ . '/../core/DB.php';

class CategoryService {
    public static function getAll(): array {
        return DB::query("SELECT * FROM categories ORDER BY id ASC");
    }

    public static function create(string $name): array {
        $slug = self::slugify($name);
        DB::run("INSERT INTO categories (name, slug) VALUES (?, ?)", [$name, $slug]);
        return ['id' => (int)DB::lastId(), 'name' => $name, 'slug' => $slug];
    }

    public static function update(int|string $id, string $name): array {
        $slug = self::slugify($name);
        DB::run("UPDATE categories SET name = ?, slug = ? WHERE id = ?", [$name, $slug, (int)$id]);
        return ['id' => (int)$id, 'name' => $name, 'slug' => $slug];
    }

    public static function delete(int|string $id): array {
        DB::run("DELETE FROM categories WHERE id = ?", [(int)$id]);
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
