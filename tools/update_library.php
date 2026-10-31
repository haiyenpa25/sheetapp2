<?php
declare(strict_types=1);

// Explicit, additive deployment step for servers that already have an app.sqlite.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/services/SongService.php';
$options = getopt('', ['db:', 'apply', 'sync', 'prune']);
$doSync = array_key_exists('sync', $options);   // cập nhật tên/số/đường dẫn XML/tông gốc/HD của bài đã có theo seed
$doPrune = array_key_exists('prune', $options); // xóa bài công khai đã bị xóa khỏi seed (cần kèm --sync)
$root = dirname(__DIR__);
$target = $options['db'] ?? $root . '/storage/data/app.sqlite';
$pdo = null;
function libraryInsert(PDO $pdo, string $table, array $row): int {
    unset($row['id']);
    $columns = array_keys($row);
    $stmt = $pdo->prepare('INSERT INTO ' . $table . ' ("' . implode('","', $columns) . '") VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')');
    $stmt->execute(array_values($row));
    return (int)$pdo->lastInsertId();
}
function libraryFind(PDO $pdo, string $sql, array $params): mixed {
    $stmt = $pdo->prepare($sql); $stmt->execute($params);
    return $stmt->fetchColumn();
}
try {
    if (!array_key_exists('apply', $options)) throw new RuntimeException('Usage: php tools/update_library.php --apply [--sync [--prune]] [--db=<existing.sqlite>]. Creates a backup and adds missing library data; --sync also refreshes title/number/xmlPath/defaultKey/HD of existing songs from the seed; --prune also removes public songs no longer in the seed.');
    if ($doPrune && !$doSync) throw new RuntimeException('--prune chỉ dùng kèm --sync.');
    if (!is_file($target)) throw new RuntimeException('No existing database; use tools/install_library.php for a new installation.');
    $seedPath = $root . '/storage/seed/library.sqlite';
    $manifest = json_decode((string)file_get_contents($root . '/storage/seed/library.manifest.json'), true, 512, JSON_THROW_ON_ERROR);
    if (!hash_equals($manifest['database_sha256'], hash_file('sha256', $seedPath))) throw new RuntimeException('Seed checksum mismatch.');
    if (realpath($target) === realpath($seedPath)) throw new RuntimeException('Cannot update the release seed.');
    $seed = new PDO('sqlite:' . $seedPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo = DB::createConnection($target);
    if ($pdo->query('PRAGMA integrity_check')->fetchColumn() !== 'ok' || $pdo->query('PRAGMA foreign_key_check')->fetch()) throw new RuntimeException('Existing DB fails integrity checks.');
    $backup = $target . '.before-library-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.sqlite';
    $pdo->prepare('VACUUM INTO ?')->execute([$backup]);
    $pdo->beginTransaction();
    $categoryMap = [];
    foreach ($seed->query('SELECT * FROM categories') as $row) {
        $id = libraryFind($pdo, 'SELECT id FROM categories WHERE slug=? OR name=? ORDER BY CASE WHEN slug=? THEN 0 ELSE 1 END LIMIT 1', [$row['slug'], $row['name'], $row['slug']]);
        $categoryMap[$row['id']] = $id === false ? libraryInsert($pdo, 'categories', $row) : (int)$id;
    }
    DB::setPdo($pdo);
    $addedSongs = 0;
    $updatedSongs = 0;
    $removedSongs = 0;
    $updatedHd = 0;
    foreach ($seed->query('SELECT * FROM songs') as $row) {
        $row['category_id'] = $categoryMap[$row['category_id']] ?? null;
        if (libraryFind($pdo, 'SELECT id FROM songs WHERE id=?', [$row['id']]) !== false) {
            $pdo->prepare('UPDATE songs SET category_id=? WHERE id=?')->execute([$row['category_id'], $row['id']]);
            if ($doSync) {
                $pdo->prepare('UPDATE songs SET title=?, httlvnId=?, xmlPath=?, defaultKey=? WHERE id=?')
                    ->execute([$row['title'], $row['httlvnId'] ?? null, $row['xmlPath'], $row['defaultKey'] ?? null, $row['id']]);
                SongService::syncSongFts($row['id']);
                ++$updatedSongs;
            }
            continue;
        }
        $stmt = $pdo->prepare('INSERT INTO songs ("' . implode('","', array_keys($row)) . '") VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')');
        $stmt->execute(array_values($row));
        SongService::syncSongFts($row['id']);
        if ((int)libraryFind($pdo, 'SELECT COUNT(*) FROM songs_fts WHERE song_id=?', [$row['id']]) !== 1) throw new RuntimeException('Cannot index imported song.');
        ++$addedSongs;
    }
    if ($doPrune) {
        $seedIds = $seed->query('SELECT id FROM songs')->fetchAll(PDO::FETCH_COLUMN);
        $keep = array_flip($seedIds);
        $local = $pdo->query("SELECT id FROM songs WHERE COALESCE(is_public,1)=1 AND COALESCE(visibility,'public')='public' AND id NOT LIKE 'pv-%'")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($local as $id) {
            if (isset($keep[$id])) continue;
            // Không xóa bài đang nằm trong chương trình để không làm hỏng các chương trình đã soạn.
            if ((int)libraryFind($pdo, 'SELECT COUNT(*) FROM setlist_items WHERE song_id=?', [$id]) > 0) { fwrite(STDERR, "Giữ lại {$id}: đang có trong chương trình.\n"); continue; }
            SongService::delete((string)$id, false);
            ++$removedSongs;
        }
    }
    // Anonymous owner for imported arrangements; never repurpose a live account.
    $owner = libraryFind($pdo, "SELECT id FROM users WHERE username GLOB 'library-bundle-*' AND status='inactive' AND password_hash='!' ORDER BY id LIMIT 1", []);
    if ($owner === false) {
        $owner = libraryInsert($pdo, 'users', ['username' => 'library-bundle-' . bin2hex(random_bytes(8)), 'password_hash' => '!', 'role' => 'viewer', 'display_name' => 'Library contributor', 'status' => 'inactive']);
        // Stable lookup does not depend on a username that might already be taken.
    }
    $addedChords = 0;
    foreach ($seed->query('SELECT * FROM user_chord_sets') as $row) {
        if (libraryFind($pdo, 'SELECT id FROM user_chord_sets WHERE song_id=? AND set_name=? LIMIT 1', [$row['song_id'], $row['set_name']]) !== false) {
            // --sync: bộ HD chuẩn lấy theo seed (bộ cá nhân của người dùng không bao giờ bị đụng tới).
            if ($doSync && $row['set_name'] === 'HD') {
                $upd = $pdo->prepare('UPDATE user_chord_sets SET chords_json=?, chord_count=?, checksum=? WHERE song_id=? AND set_name=? AND checksum IS NOT ?');
                $upd->execute([$row['chords_json'], $row['chord_count'] ?? 0, $row['checksum'] ?? null, $row['song_id'], 'HD', $row['checksum'] ?? null]);
                $updatedHd += $upd->rowCount();
            }
            continue;
        }
        $row['user_id'] = $owner; $row['username'] = 'library'; $row['approved_by'] = null;
        libraryInsert($pdo, 'user_chord_sets', $row); ++$addedChords;
    }
    foreach ($seed->query('SELECT * FROM song_versions') as $row) {
        if (libraryFind($pdo, 'SELECT id FROM song_versions WHERE song_id=? AND version_slug=? LIMIT 1', [$row['song_id'], $row['version_slug']]) !== false) continue;
        $row['user_id'] = $owner; $row['username'] = 'library'; $row['approved_by'] = null;
        libraryInsert($pdo, 'song_versions', $row);
    }
    $sectionMap = [];
    foreach ($seed->query('SELECT * FROM song_sections') as $row) {
        $id = libraryFind($pdo, 'SELECT id FROM song_sections WHERE song_id=? AND name=? AND start_measure=? AND end_measure=? LIMIT 1', [$row['song_id'], $row['name'], $row['start_measure'], $row['end_measure']]);
        $sectionMap[$row['id']] = $id === false ? libraryInsert($pdo, 'song_sections', $row) : (int)$id;
    }
    foreach ($seed->query('SELECT * FROM arrangements') as $row) {
        if (libraryFind($pdo, 'SELECT id FROM arrangements WHERE song_id=? AND name=? LIMIT 1', [$row['song_id'], $row['name']]) !== false) continue;
        $id = libraryInsert($pdo, 'arrangements', $row);
        $stmt = $seed->prepare('SELECT * FROM arrangement_steps WHERE arrangement_id=?'); $stmt->execute([$row['id']]);
        foreach ($stmt as $step) {
            $step['arrangement_id'] = $id; $step['section_id'] = $sectionMap[$step['section_id']];
            libraryInsert($pdo, 'arrangement_steps', $step);
        }
    }
    if ($pdo->query('PRAGMA foreign_key_check')->fetch()) throw new RuntimeException('Updated library fails foreign key validation.');
    $pdo->commit();
    SongService::invalidateCache();
    echo "Library updated: {$addedSongs} songs, {$addedChords} chord sets added" . ($doSync ? ", {$updatedSongs} songs refreshed, {$updatedHd} HD sets refreshed, {$removedSongs} removed" : "") . ". Accounts and personal chord sets preserved.\nBackup: {$backup}\n";
} catch (Throwable $error) {
    if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
