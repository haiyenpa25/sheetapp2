<?php
/**
 * api/migrations/006_fts5_search_and_taxonomy.php
 *
 * Migration nâng cấp hệ thống tìm kiếm toàn văn FTS5 & Phân loại mùa/chủ đề phụng vụ:
 * 1. Mở rộng bảng `songs`: liturgical_season, theme, composer, tags, lyrics_text
 * 2. Tạo bảng ảo SQLite FTS5 `songs_fts` với tokenization unicode61
 * 3. Tạo các chỉ mục tra cứu hiệu năng cao cho taxonomy
 * 4. Tự động backfill dữ liệu bài hát hiện có vào bảng ảo FTS5
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Kiểm tra các cột hiện tại của bảng songs
    $cols = [];
    $stmt = $pdo->query("PRAGMA table_info(songs)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cols[strtolower($row['name'])] = true;
    }

    if (!isset($cols['liturgical_season'])) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN liturgical_season TEXT DEFAULT NULL;");
    }
    if (!isset($cols['theme'])) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN theme TEXT DEFAULT NULL;");
    }
    if (!isset($cols['composer'])) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN composer TEXT DEFAULT NULL;");
    }
    if (!isset($cols['tags'])) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN tags TEXT DEFAULT NULL;");
    }
    if (!isset($cols['lyrics_text'])) {
        $pdo->exec("ALTER TABLE songs ADD COLUMN lyrics_text TEXT DEFAULT NULL;");
    }

    // 2. Tạo các chỉ mục tìm kiếm và lọc phụng vụ
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_songs_season ON songs(liturgical_season);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_songs_theme ON songs(theme);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_songs_composer ON songs(composer);");

    // 3. Kiểm tra hỗ trợ SQLite FTS5 trước khi tạo bảng ảo
    $hasFts5 = false;
    try {
        $pdo->exec("CREATE VIRTUAL TABLE temp.check_fts5 USING fts5(a);");
        $pdo->exec("DROP TABLE temp.check_fts5;");
        $hasFts5 = true;
    } catch (\Throwable $e) {
        error_log('[Migration 006] SQLite không hỗ trợ module FTS5: ' . $e->getMessage() . '. Bỏ qua tạo songs_fts, hệ thống sẽ tự động dùng LIKE search fallback.');
        $hasFts5 = false;
    }

    if ($hasFts5) {
        $pdo->exec("
            CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
                song_id UNINDEXED,
                title,
                title_unaccented,
                lyrics_text,
                lyrics_unaccented,
                theme,
                liturgical_season,
                composer,
                tokenize = 'unicode61 remove_diacritics 2'
            );
        ");
    }

    // 4. Backfill dữ liệu hiện có vào songs_fts nếu FTS5 khả dụng
    if ($hasFts5) {
        $removeAccents = function(string $str): string {
        $from = [
            'à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ',
            'đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ',
            'ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ',
            'ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ',
            'ỳ','ý','ỷ','ỹ','ỵ',
            'À','Á','Ả','Ã','Ạ','Ă','Ắ','Ặ','Ằ','Ẳ','Ẵ','Â','Ấ','Ậ','Ầ','Ẩ','Ẫ',
            'Đ','È','É','Ẻ','Ẽ','Ẹ','Ê','Ế','Ệ','Ề','Ể','Ễ',
            'Ì','Í','Ỉ','Ĩ','Ị','Ò','Ó','Ỏ','Õ','Ọ','Ô','Ố','Ộ','Ồ','Ổ','Ỗ',
            'Ơ','Ớ','Ợ','Ờ','Ở','Ỡ','Ù','Ú','Ủ','Ũ','Ụ','Ư','Ứ','Ự','Ừ','Ử','Ữ',
            'Ỳ','Ý','Ỷ','Ỹ','Ỵ'
        ];
        $to = [
            'a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
            'd','e','e','e','e','e','e','e','e','e','e','e',
            'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
            'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
            'y','y','y','y','y',
            'a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
            'd','e','e','e','e','e','e','e','e','e','e','e',
            'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
            'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
            'y','y','y','y','y'
        ];
        return str_replace($from, $to, $str);
    };

    // Kiểm tra xem songs_fts đã có dữ liệu chưa
    $ftsCount = (int)$pdo->query("SELECT count(*) FROM songs_fts")->fetchColumn();
    if ($ftsCount === 0) {
        $songs = $pdo->query("SELECT id, title, lyrics_text, theme, liturgical_season, composer FROM songs")->fetchAll(PDO::FETCH_ASSOC);
        $insertStmt = $pdo->prepare("
            INSERT INTO songs_fts (song_id, title, title_unaccented, lyrics_text, lyrics_unaccented, theme, liturgical_season, composer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        foreach ($songs as $s) {
            $title = $s['title'] ?? '';
            $titleUnaccented = $removeAccents($title);
            $lyrics = $s['lyrics_text'] ?? '';
            $lyricsUnaccented = $removeAccents($lyrics);
            $theme = $s['theme'] ?? '';
            $season = $s['liturgical_season'] ?? '';
            $composer = $s['composer'] ?? '';

            $insertStmt->execute([
                $s['id'],
                $title,
                $titleUnaccented,
                $lyrics,
                $lyricsUnaccented,
                $theme,
                $season,
                $composer
            ]);
        }
    }
    }
};
