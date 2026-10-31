<?php
declare(strict_types=1);

/**
 * api/services/SongXmlRelocator.php
 *
 * Đưa file MusicXML của một bài về đúng chỗ theo danh mục và quyền xem hiện tại:
 *  - Bài công khai: storage/Thanh ca/<slug-danh-mục>/ (danh mục gốc "thanh-ca" → storage/Thanh ca/)
 *  - Bài không công khai: kho riêng storage/private/xml (Apache chặn, Git bỏ qua), xmlPath là URL API kiểm quyền
 * Gọi sau khi đổi danh mục của bài, đổi quyền danh mục, hoặc khi đồng bộ kho.
 * Lưu ý: bài mang id "pv-…" sau khi chuyển công khai vẫn giữ id đó (hợp âm/ghi chú pv-* bị .gitignore) nên chưa
 * được xuất sang gói seed GitHub cho tới khi đổi id.
 */
final class SongXmlRelocator {
    private const PUBLIC_ROOT = 'storage/Thanh ca/';

    public static function expectedDir(int $categoryId, string $slug, string $name): string {
        $clean = preg_replace('/[^a-z0-9\-]/', '', strtolower(trim($slug)));
        if ($clean === '' || $clean === null) {
            $clean = trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: '')), '-') ?: 'thanh-ca';
        }
        return ($categoryId <= 1 || $clean === 'thanh-ca') ? self::PUBLIC_ROOT : self::PUBLIC_ROOT . $clean . '/';
    }

    /** @return array{moved:bool,to:?string,reason?:string} */
    public static function relocate(string $songId, ?PDO $pdo = null): array {
        require_once __DIR__ . '/SongService.php';
        require_once __DIR__ . '/PrivateSongXmlService.php';
        $pdo = $pdo ?? DB::get();
        $hasCatVis = DB::hasColumn('categories', 'visibility');
        $sql = 'SELECT s.id, s.xmlPath, s.category_id, COALESCE(s.visibility, \'public\') AS vis, COALESCE(s.is_public, 1) AS is_public, '
            . 'c.slug AS cat_slug, c.name AS cat_name' . ($hasCatVis ? ', COALESCE(c.visibility, \'public\') AS cat_vis' : ", 'public' AS cat_vis")
            . ' FROM songs s LEFT JOIN categories c ON c.id = s.category_id WHERE s.id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$songId]);
        $song = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$song) return ['moved' => false, 'to' => null, 'reason' => 'not_found'];

        $current = (string)$song['xmlPath'];
        $isPublic = $song['vis'] === 'public' && (int)$song['is_public'] === 1 && $song['cat_vis'] === 'public';
        $onPrivateStore = PrivateSongXmlService::songIdFromApiPath($current) !== null;
        $root = dirname(__DIR__, 2);

        if (!$isPublic) {
            if ($onPrivateStore) return ['moved' => false, 'to' => null];
            $abs = SongService::resolveManagedXmlPath($current);
            if ($abs === null || !is_file($abs)) return ['moved' => false, 'to' => null, 'reason' => 'no_file'];
            $xml = file_get_contents($abs);
            if ($xml === false || $xml === '') return ['moved' => false, 'to' => null, 'reason' => 'unreadable'];
            PrivateSongXmlService::store($songId, $xml);
            $api = PrivateSongXmlService::apiPath($songId);
            $pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([$api, $songId]);
            @unlink($abs);
            return ['moved' => true, 'to' => $api];
        }

        $dir = self::expectedDir((int)$song['category_id'], (string)($song['cat_slug'] ?? ''), (string)($song['cat_name'] ?? ''));
        if ($onPrivateStore) {
            $abs = PrivateSongXmlService::filePath($songId);
            if ($abs === null) return ['moved' => false, 'to' => null, 'reason' => 'no_file'];
            $target = self::freeTarget($root, $dir, $songId . '.xml');
            if (!self::ensureDir($root . '/' . $dir) || !@copy($abs, $root . '/' . $target)) return ['moved' => false, 'to' => null, 'reason' => 'copy_failed'];
            $pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([$target, $songId]);
            PrivateSongXmlService::remove($songId);
            return ['moved' => true, 'to' => $target];
        }

        $rel = ltrim(str_replace('\\', '/', $current), '/');
        if (!str_starts_with($rel, self::PUBLIC_ROOT) || dirname($rel) . '/' === $dir) return ['moved' => false, 'to' => null];
        $abs = $root . '/' . $rel;
        if (!is_file($abs)) return ['moved' => false, 'to' => null, 'reason' => 'no_file'];
        $target = self::freeTarget($root, $dir, basename($rel));
        if (!self::ensureDir($root . '/' . $dir) || !@rename($abs, $root . '/' . $target)) return ['moved' => false, 'to' => null, 'reason' => 'rename_failed'];
        $pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([$target, $songId]);
        return ['moved' => true, 'to' => $target];
    }

    /** Chuyển file của mọi bài trong danh mục (sau khi đổi quyền danh mục). */
    public static function relocateCategory(int $categoryId, ?PDO $pdo = null): int {
        $pdo = $pdo ?? DB::get();
        $ids = $pdo->prepare('SELECT id FROM songs WHERE category_id = ?');
        $ids->execute([$categoryId]);
        $moved = 0;
        foreach ($ids->fetchAll(PDO::FETCH_COLUMN) as $id) {
            try { if (self::relocate((string)$id, $pdo)['moved']) $moved++; }
            catch (Throwable $e) { error_log('SongXmlRelocator ' . $id . ': ' . $e->getMessage()); }
        }
        return $moved;
    }

    private static function ensureDir(string $abs): bool {
        return is_dir($abs) || @mkdir($abs, 0775, true) || is_dir($abs);
    }

    /** Không ghi đè file khác cùng tên trong thư mục đích. */
    private static function freeTarget(string $root, string $dir, string $name): string {
        $target = $dir . $name;
        for ($i = 2; is_file($root . '/' . $target); $i++) {
            $target = $dir . pathinfo($name, PATHINFO_FILENAME) . '-' . $i . '.xml';
        }
        return $target;
    }
}
