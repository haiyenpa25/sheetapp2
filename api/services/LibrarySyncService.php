<?php
/**
 * api/services/LibrarySyncService.php
 *
 * Đồng bộ Kho bài hát Thư viện (theo thư mục danh mục storage/Thanh ca/<slug>/)
 * giữa SQLite vận hành (app.sqlite), gói seed phát hành (storage/seed/library.sqlite)
 * và kho mã nguồn GitHub (Web <-> Local).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/../import_helpers.php';

class LibrarySyncService {

    public static function rootDir(): string {
        return dirname(__DIR__, 2);
    }

    /**
     * Chuẩn hóa toàn bộ bài hát công khai trong app.sqlite:
     * - Đảm bảo file XML nằm đúng thư mục danh mục: storage/Thanh ca/<category-slug>/<file>.xml
     * - Đảm bảo mỗi bài công khai có bản ghi HD trong user_chord_sets và file storage/data/chord_sets/<id>/HD.json
     */
    public static function normalizePublicSongs(?PDO $pdo = null): array {
        $pdo = $pdo ?? DB::get();
        $root = self::rootDir();
        $movedFiles = 0;
        $createdHd = 0;

        $visGuard = DB::hasColumn('categories', 'visibility')
            ? "AND COALESCE(c.visibility, 'public') = 'public'"
            : '';
        $sql = "
            SELECT s.id, s.title, s.xmlPath, s.category_id,
                   c.slug AS cat_slug, c.name AS cat_name
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE COALESCE(s.is_public, 1) = 1
              AND COALESCE(s.visibility, 'public') = 'public'
              AND s.id NOT LIKE 'pv-%'
              {$visGuard}
        ";
        $songs = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        foreach ($songs as $song) {
            $songId = (string)$song['id'];
            $catId = (int)($song['category_id'] ?? 1);
            $rawSlug = trim((string)($song['cat_slug'] ?? ''));
            $catSlug = preg_replace('/[^a-z0-9\-]/', '', strtolower($rawSlug))
                ?: (_slugify((string)($song['cat_name'] ?? '')) ?: 'thanh-ca');

            $expectedRelDir = ($catId <= 1 || $catSlug === 'thanh-ca')
                ? 'storage/Thanh ca/'
                : ('storage/Thanh ca/' . $catSlug . '/');

            $xmlPath = ltrim((string)($song['xmlPath'] ?? ''), '/\\');
            $absCurrent = $root . '/' . $xmlPath;

            // Nếu bài công khai đang nằm ở storage/users/ hoặc storage/uploads/, di chuyển vào storage/Thanh ca/<cat-slug>/
            $needsMove = (str_starts_with($xmlPath, 'storage/users/') || str_starts_with($xmlPath, 'storage/uploads/'));
            if ($needsMove && is_file($absCurrent)) {
                $absTargetDir = $root . '/' . $expectedRelDir;
                if (!is_dir($absTargetDir)) {
                    @mkdir($absTargetDir, 0775, true);
                }
                $baseName = basename($xmlPath);
                $newRelPath = $expectedRelDir . $baseName;
                $absTarget = $root . '/' . $newRelPath;
                if ($absCurrent !== $absTarget) {
                    if (@copy($absCurrent, $absTarget)) {
                        @unlink($absCurrent);
                        $pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([$newRelPath, $songId]);
                        $xmlPath = $newRelPath;
                        $movedFiles++;
                    }
                }
            }

            // Đảm bảo có bộ hợp âm HD chuẩn trên DB (và trên đĩa nếu có hợp âm > 0)
            $hdStmt = $pdo->prepare("SELECT chord_count, chords_json FROM user_chord_sets WHERE song_id = ? AND set_name = 'HD' LIMIT 1");
            $hdStmt->execute([$songId]);
            $hdRow = $hdStmt->fetch(PDO::FETCH_ASSOC);
            $safeId = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
            $hdDiskFile = $root . '/storage/data/chord_sets/' . $safeId . '/HD.json';
            if (!$hdRow) {
                $pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, chord_count, chords_json, checksum, attribution, is_public, is_recommended) VALUES (?, 1, 'system', 'HD', 0, '[]', ?, 'Khởi tạo thư viện', 1, 1)")
                    ->execute([$songId, md5('[]')]);
                $createdHd++;
            } elseif ((int)($hdRow['chord_count'] ?? 0) > 0 && !is_file($hdDiskFile)) {
                $chords = json_decode((string)$hdRow['chords_json'], true) ?: [];
                ChordSetService::saveSet($songId, 'HD', $chords, 1, 'system', 'Khởi tạo thư viện', true);
                $createdHd++;
            }
        }

        if ($movedFiles > 0) {
            SongService::invalidateCache();
        }

        return [
            'moved_files' => $movedFiles,
            'created_hd'  => $createdHd,
            'total_public_songs' => count($songs)
        ];
    }

    /**
     * Xuất CSDL công khai từ app.sqlite ra storage/seed/library.sqlite + library.manifest.json
     * (Tự động lọc bỏ mọi bài/danh mục riêng tư pv-* và ẩn danh thông tin tài khoản).
     */
    public static function exportSeed(?string $sourcePath = null, ?string $outputPath = null): array {
        $root = self::rootDir();
        $sourcePath = $sourcePath ?? ($root . '/storage/data/app.sqlite');
        $outputPath = $outputPath ?? ($root . '/storage/seed/library.sqlite');
        $manifestPath = preg_replace('/\.sqlite$/', '.manifest.json', $outputPath);

        if (!is_file($sourcePath)) {
            throw new RuntimeException('Không tìm thấy CSDL nguồn: ' . $sourcePath);
        }

        $tmpDir = sys_get_temp_dir() . '/sheetapp-seed-sync-' . bin2hex(random_bytes(4));
        if (!@mkdir($tmpDir, 0700, true) && !is_dir($tmpDir)) {
            throw new RuntimeException('Không thể tạo thư mục tạm để xuất seed');
        }
        $stagedPath = $tmpDir . '/library.sqlite';

        try {
            $srcPdo = new PDO('sqlite:' . $sourcePath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            $srcPdo->prepare('VACUUM INTO ?')->execute([$stagedPath]);
            $users = $srcPdo->query('SELECT * FROM users')->fetchAll(PDO::FETCH_ASSOC);
            $srcPdo = null;

            $db = new PDO('sqlite:' . $stagedPath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            $db->exec('PRAGMA foreign_keys = OFF');
            $db->exec('PRAGMA secure_delete = ON');

            // 1. Loại bỏ danh mục và bài hát không công khai hoặc thiếu file XML trên đĩa
            $hasCatVis = (bool)$db->query("SELECT 1 FROM pragma_table_info('categories') WHERE name='visibility'")->fetchColumn();
            if ($hasCatVis) {
                $db->exec("DELETE FROM categories WHERE COALESCE(visibility, 'public') != 'public'");
            }
            $db->exec("DELETE FROM songs WHERE COALESCE(is_public, 1) != 1 OR COALESCE(visibility, 'public') != 'public' OR id LIKE 'pv-%'");
            if ($hasCatVis) {
                $db->exec("DELETE FROM songs WHERE category_id NOT IN (SELECT id FROM categories)");
            }
            foreach ($db->query('SELECT id, xmlPath FROM songs')->fetchAll() as $sRow) {
                $relXml = ltrim((string)($sRow['xmlPath'] ?? ''), '/\\');
                if ($relXml === '' || !is_file($root . '/' . $relXml)) {
                    $db->prepare('DELETE FROM songs WHERE id = ?')->execute([$sRow['id']]);
                }
            }

            // 2. Chỉ giữ lại hợp âm, phiên bản, phân đoạn của các bài hát công khai
            $db->exec("DELETE FROM user_chord_sets WHERE COALESCE(is_public, 1) != 1 OR song_id NOT IN (SELECT id FROM songs)");
            $db->exec("DELETE FROM song_versions WHERE COALESCE(is_public, 1) != 1 OR song_id NOT IN (SELECT id FROM songs)");
            $db->exec("DELETE FROM song_sections WHERE song_id NOT IN (SELECT id FROM songs)");
            $db->exec("DELETE FROM arrangements WHERE song_id NOT IN (SELECT id FROM songs)");
            $db->exec("DELETE FROM arrangement_steps WHERE arrangement_id NOT IN (SELECT id FROM arrangements) OR section_id NOT IN (SELECT id FROM song_sections)");

            // 3. Xóa dữ liệu cá nhân / hoạt động khỏi các bảng khác
            $keep = [
                'users', 'songs', 'categories', 'song_sections', 'arrangements',
                'arrangement_steps', 'song_versions', 'user_chord_sets', 'schema_migrations'
            ];
            $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($tables as $tName) {
                if (!in_array($tName, $keep, true) && !str_starts_with($tName, 'sqlite_') && !str_starts_with($tName, 'songs_fts')) {
                    $db->exec('DELETE FROM "' . str_replace('"', '""', $tName) . '"');
                }
            }

            // 4. Đồng bộ lại FTS5 trong bản seed
            if (in_array('songs_fts', $tables, true)) {
                $db->exec("DELETE FROM songs_fts WHERE song_id NOT IN (SELECT id FROM songs)");
            }

            // 5. Ẩn danh tài khoản người dùng giống hệt tools/export_library_seed.py
            $db->exec('DELETE FROM users');
            $insUser = $db->prepare('INSERT INTO users (id, username, password_hash, role, display_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $replacements = [];
            foreach ($users as $u) {
                $uid = (int)$u['id'];
                $insUser->execute([$uid, 'contributor-' . $uid, '!', 'viewer', 'Library contributor', 'inactive', '2000-01-01 00:00:00']);
                foreach (['username', 'display_name', 'email', 'bio', 'avatar_url'] as $k) {
                    if (!empty($u[$k]) && is_string($u[$k])) {
                        $replacements[$u[$k]] = 'Library contributor';
                    }
                }
            }
            $db->exec('UPDATE songs SET created_by = NULL');

            uksort($replacements, static fn(string $a, string $b): int => strlen($b) <=> strlen($a));
            foreach ([
                'user_chord_sets' => ['username', 'attribution', 'notes_guide'],
                'song_versions'   => ['username', 'version_name', 'description']
            ] as $tbl => $cols) {
                $rows = $db->query('SELECT id, ' . implode(',', $cols) . ' FROM ' . $tbl)->fetchAll();
                foreach ($rows as $r) {
                    foreach ($cols as $c) {
                        $val = $r[$c] ?? null;
                        if (!is_string($val) || $val === '') continue;
                        if ($c === 'username') {
                            $val = 'library';
                        } else {
                            foreach ($replacements as $old => $rep) {
                                $val = preg_replace('/' . preg_quote($old, '/') . '/iu', $rep, $val) ?? $val;
                            }
                        }
                        $db->prepare("UPDATE {$tbl} SET {$c} = ? WHERE id = ?")->execute([$val, $r['id']]);
                    }
                }
                $db->exec("UPDATE {$tbl} SET approved_by = NULL");
            }

            $db->exec('PRAGMA journal_mode = DELETE');
            $db->exec('VACUUM');

            if ($db->query('PRAGMA integrity_check')->fetchColumn() !== 'ok' || $db->query('PRAGMA foreign_key_check')->fetch()) {
                throw new RuntimeException('Kiểm tra toàn vẹn seed thất bại (integrity / foreign_key_check)');
            }

            $counts = [];
            foreach (['songs', 'categories', 'user_chord_sets', 'song_versions', 'song_sections'] as $t) {
                $counts[$t] = (int)$db->query('SELECT COUNT(*) FROM ' . $t)->fetchColumn();
            }
            $catSummary = [];
            foreach ($db->query('SELECT categories.slug, COUNT(songs.id) AS cnt FROM categories LEFT JOIN songs ON songs.category_id = categories.id GROUP BY categories.id') as $cRow) {
                $catSummary[] = ['slug' => $cRow['slug'], 'songs' => (int)$cRow['cnt']];
            }
            $db = null;

            $seedBytes = (string)file_get_contents($stagedPath);
            $seedSha = hash('sha256', $seedBytes);

            // Quét toàn bộ file JSON hợp âm trong storage/data/chord_sets
            $chordFiles = [];
            $chordBaseDir = $root . '/storage/data/chord_sets';
            if (is_dir($chordBaseDir)) {
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($chordBaseDir, FilesystemIterator::SKIP_DOTS));
                $paths = [];
                foreach ($it as $fileInfo) {
                    if ($fileInfo->isFile() && strtolower($fileInfo->getExtension()) === 'json') {
                        $paths[] = $fileInfo->getPathname();
                    }
                }
                sort($paths);
                foreach ($paths as $absJson) {
                    $relJson = str_replace('\\', '/', substr($absJson, strlen($root) + 1));
                    $normContent = str_replace("\r\n", "\n", (string)file_get_contents($absJson));
                    $chordFiles[$relJson] = hash('sha256', $normContent);
                }
            }

            $manifestData = [
                'format'          => 1,
                'database_sha256' => $seedSha,
                'counts'          => $counts,
                'categories'      => $catSummary,
                'privacy'         => 'Anonymous disabled contributors; no source passwords, emails or activity. Create a new admin on installation.',
                'chord_files'     => $chordFiles
            ];

            if (!is_dir(dirname($outputPath))) {
                @mkdir(dirname($outputPath), 0775, true);
            }
            if (!@copy($stagedPath, $outputPath)) {
                throw new RuntimeException('Không thể ghi file storage/seed/library.sqlite');
            }
            file_put_contents($manifestPath, json_encode($manifestData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

            return [
                'database_sha256' => $seedSha,
                'counts'          => $counts,
                'categories'      => $catSummary,
                'chord_files_count' => count($chordFiles)
            ];
        } finally {
            if (is_file($stagedPath)) @unlink($stagedPath);
            @rmdir($tmpDir);
        }
    }

    /**
     * Đồng bộ hai chiều:
     * 1) Chuẩn hóa thư mục bài hát công khai storage/Thanh ca/<category-slug>/ + HD.json
     * 2) Xuất gói seed (storage/seed/library.sqlite & library.manifest.json)
     * 3) Tùy chọn commit & push lên GitHub để Web và Local dùng chung 1 kho dữ liệu
     */
    public static function syncAll(bool $pushGit = false): array {
        $norm = self::normalizePublicSongs();
        $seed = self::exportSeed();

        $gitInfo = [
            'pushed'  => false,
            'changed' => 0,
            'summary' => 'Đã cập nhật gói dữ liệu thư viện (storage/seed/library.sqlite & storage/Thanh ca/).'
        ];

        $root = self::rootDir();
        $cmdRoot = escapeshellarg($root);
        $statusOut = [];
        @exec("git -C {$cmdRoot} status --porcelain -- \"storage/Thanh ca\" storage/data/chord_sets storage/seed 2>&1", $statusOut, $statusCode);
        $gitInfo['changed'] = count(array_filter($statusOut, static fn($l) => trim($l) !== ''));

        if ($pushGit && $gitInfo['changed'] > 0) {
            $gitCmd = "git -C {$cmdRoot} add -- \"storage/Thanh ca\" storage/data/chord_sets storage/seed/library.sqlite storage/seed/library.manifest.json 2>&1"
                . " && git -C {$cmdRoot} commit -m " . escapeshellarg('chore(library): sync categories, songs XML & library seed') . " 2>&1"
                . " && git -C {$cmdRoot} push origin main 2>&1";
            $pushOut = [];
            $pushCode = 0;
            @exec($gitCmd, $pushOut, $pushCode);
            $gitInfo['pushed'] = ($pushCode === 0);
            $gitInfo['output'] = implode("\n", array_slice($pushOut, -8));
            $gitInfo['summary'] = $pushCode === 0
                ? 'Đã đồng bộ và đẩy dữ liệu kho bài hát lên GitHub (origin/main) thành công!'
                : 'Đã cập nhật gói seed cục bộ. Lưu ý khi push Git: ' . ($gitInfo['output'] ?: 'kiểm tra quyền Git remote.');
        } elseif ($pushGit && $gitInfo['changed'] === 0) {
            $gitInfo['pushed'] = true;
            $gitInfo['summary'] = 'Kho dữ liệu trên Web và GitHub (origin/main) đã đồng bộ 100%, không có thay đổi mới cần đẩy.';
        }

        return [
            'success'    => true,
            'message'    => $gitInfo['summary'],
            'normalized' => $norm,
            'seed'       => $seed,
            'git'        => $gitInfo
        ];
    }
}
