<?php
/**
 * api/services/SongSearchHelper.php
 * Trợ thủ tìm kiếm FTS5, BM25 ranking, chuẩn hóa tiếng Việt & trích dẫn lời bài hát (Snippet)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';

class SongSearchHelper {

    public static function removeAccents(string $str): string {
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
    }

    public static function getTaxonomy(): array {
        return [
            'seasons' => [
                ['key' => 'advent',      'name' => 'Mùa Vọng',        'color' => '#8b5cf6'],
                ['key' => 'christmas',   'name' => 'Mùa Giáng Sinh',   'color' => '#f59e0b'],
                ['key' => 'lent',        'name' => 'Mùa Chay',        'color' => '#ec4899'],
                ['key' => 'easter',      'name' => 'Mùa Phục Sinh',   'color' => '#10b981'],
                ['key' => 'ordinary',    'name' => 'Mùa Thường Niên', 'color' => '#06b6d4'],
                ['key' => 'solemnity',   'name' => 'Lễ Trọng & Kính', 'color' => '#eab308']
            ],
            'themes' => [
                ['key' => 'nhap-le',     'name' => 'Ca Nhập Lễ'],
                ['key' => 'dap-ca',      'name' => 'Đáp Ca / Tung Hô'],
                ['key' => 'dang-le',     'name' => 'Dâng Lễ / Tiến Lễ'],
                ['key' => 'hiep-le',     'name' => 'Hiệp Lễ / Thánh Thể'],
                ['key' => 'ta-le',       'name' => 'Tạ Lễ / Kết Lễ'],
                ['key' => 'duc-me',      'name' => 'Đức Mẹ Maria'],
                ['key' => 'thanh-tam',   'name' => 'Thánh Tâm Chúa'],
                ['key' => 'cau-nguyen',  'name' => 'Cầu Nguyện & Sám Hối'],
                ['key' => 'ton-vinh',    'name' => 'Tôn Vinh & Cảm Tạ']
            ]
        ];
    }

    public static function syncSongFts(string $songId): void {
        try {
            $pdo = DB::pdo();
            $pdo->exec("DELETE FROM songs_fts WHERE song_id = " . $pdo->quote($songId));

            $song = DB::run("SELECT * FROM songs WHERE id = ?", [$songId])->fetch();
            if (!$song) return;

            $title = $song['title'] ?? '';
            $titleUnaccented = self::removeAccents($title);
            $lyrics = $song['lyrics_text'] ?? '';

            // Nếu lyrics_text chưa có trong DB, thử đọc nhanh từ MusicXML file
            if (empty($lyrics) && !empty($song['xmlPath'])) {
                require_once __DIR__ . '/SongService.php';
                $resolvedPath = SongService::resolveManagedXmlPath($song['xmlPath']);
                if ($resolvedPath && file_exists($resolvedPath) && filesize($resolvedPath) < 2000000) {
                    $xmlContent = @file_get_contents($resolvedPath);
                    if ($xmlContent && str_contains($xmlContent, '<lyric>')) {
                        @preg_match_all('/<text[^>]*>(.*?)<\/text>/si', $xmlContent, $matches);
                        if (!empty($matches[1])) {
                            $extractedWords = array_map('trim', $matches[1]);
                            $lyrics = implode(' ', array_filter($extractedWords));
                            if ($lyrics !== '') {
                                DB::run("UPDATE songs SET lyrics_text = ? WHERE id = ?", [$lyrics, $songId]);
                            }
                        }
                    }
                }
            }

            $lyricsUnaccented = self::removeAccents($lyrics);
            $theme = $song['theme'] ?? '';
            $season = $song['liturgical_season'] ?? '';
            $composer = $song['composer'] ?? '';

            $stmt = $pdo->prepare("
                INSERT INTO songs_fts (song_id, title, title_unaccented, lyrics_text, lyrics_unaccented, theme, liturgical_season, composer)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $songId,
                $title,
                $titleUnaccented,
                $lyrics,
                $lyricsUnaccented,
                $theme,
                $season,
                $composer
            ]);
        } catch (\Throwable $e) {
            // Không làm gián đoạn nếu bảng FTS5 chưa khởi tạo
        }
    }

    public static function rebuildFtsIndex(): int {
        $pdo = DB::pdo();
        $pdo->exec("DELETE FROM songs_fts;");
        $songs = DB::run("SELECT id FROM songs")->fetchAll();
        $count = 0;
        foreach ($songs as $s) {
            self::syncSongFts($s['id']);
            $count++;
        }
        return $count;
    }

    public static function search(string $query, array $filters = []): array {
        $cleanQuery = trim($query);
        $season = trim($filters['season'] ?? '');
        $theme = trim($filters['theme'] ?? '');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int)$filters['category_id'] : null;
        $limit = isset($filters['limit']) ? min(100, max(1, (int)$filters['limit'])) : 50;

        // Trường hợp 1: Không có từ khóa tìm kiếm -> Lọc theo thuộc tính / phân loại
        if ($cleanQuery === '') {
            $sql = "
                SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags,
                       c.name as category
                FROM songs s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE 1=1
            ";
            $params = [];
            if ($season !== '') {
                $sql .= " AND s.liturgical_season = ?";
                $params[] = $season;
            }
            if ($theme !== '') {
                $sql .= " AND s.theme = ?";
                $params[] = $theme;
            }
            if ($categoryId !== null) {
                $sql .= " AND s.category_id = ?";
                $params[] = $categoryId;
            }
            $sql .= " ORDER BY s.httlvnId ASC, s.title ASC LIMIT ?";
            $params[] = $limit;

            return DB::run($sql, $params)->fetchAll() ?: [];
        }

        // Ticket L0-7 & L2-1: Tìm theo số bài (chuỗi toàn chữ số hoặc #123 / bài 123)
        $exactSongByNum = null;
        if (preg_match('/^(?:#|bài\s+|bai\s+|stt\s+)?(\d+)$/ui', $cleanQuery, $m)) {
            $songNum = (int)$m[1];
            $numSql = "
                SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags,
                       c.name as category,
                       0 as relevance_tier, 0 as fts_rank,
                       'title' as match_type
                FROM songs s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE s.httlvnId = ?
            ";
            $numParams = [$songNum];
            if ($season !== '') {
                $numSql .= " AND s.liturgical_season = ?";
                $numParams[] = $season;
            }
            if ($theme !== '') {
                $numSql .= " AND s.theme = ?";
                $numParams[] = $theme;
            }
            if ($categoryId !== null) {
                $numSql .= " AND s.category_id = ?";
                $numParams[] = $categoryId;
            }
            $numRow = DB::run($numSql, $numParams)->fetch(PDO::FETCH_ASSOC);
            if ($numRow) {
                $exactSongByNum = $numRow;
            }
        }

        // Trường hợp 2: Có từ khóa tìm kiếm -> Sử dụng FTS5 và BM25 Relevance Ranking (Ticket L2-1)
        $unaccentedQuery = self::removeAccents($cleanQuery);
        $rawTerms = preg_split('/\s+/u', $unaccentedQuery, -1, PREG_SPLIT_NO_EMPTY);
        $safeTerms = [];
        foreach ($rawTerms as $t) {
            $cleaned = preg_replace('/[^\p{L}\p{N}]/u', '', $t);
            if ($cleaned !== '') {
                $safeTerms[] = '"' . $cleaned . '"*';
            }
        }

        if (empty($safeTerms)) {
            return $exactSongByNum ? [$exactSongByNum] : [];
        }

        $ftsMatchExpr = implode(' AND ', $safeTerms);

        try {
            $sql = "
                SELECT f.song_id as id,
                       s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags, s.lyrics_text,
                       c.name as category,
                       bm25(songs_fts) as fts_rank,
                       CASE
                           WHEN lower(s.title) = lower(:exactQuery) THEN 1
                           WHEN lower(f.title_unaccented) = lower(:exactUnaccented) THEN 1
                           WHEN lower(s.title) LIKE :prefixLike THEN 2
                           WHEN lower(f.title_unaccented) LIKE :prefixUnaccentedLike THEN 2
                           WHEN lower(s.title) LIKE :containsLike THEN 3
                           WHEN lower(f.title_unaccented) LIKE :containsUnaccentedLike THEN 3
                           ELSE 4
                       END as relevance_tier,
                       CASE
                           WHEN lower(s.title) LIKE :containsLike OR lower(f.title_unaccented) LIKE :containsUnaccentedLike THEN 'title'
                           ELSE 'lyric'
                       END as match_type
                FROM songs_fts f
                JOIN songs s ON f.song_id = s.id
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE songs_fts MATCH :matchExpr
            ";

            $params = [
                ':matchExpr'             => $ftsMatchExpr,
                ':exactQuery'            => $cleanQuery,
                ':exactUnaccented'       => $unaccentedQuery,
                ':prefixLike'            => $cleanQuery . '%',
                ':prefixUnaccentedLike'  => $unaccentedQuery . '%',
                ':containsLike'          => '%' . $cleanQuery . '%',
                ':containsUnaccentedLike'=> '%' . $unaccentedQuery . '%'
            ];

            if ($season !== '') {
                $sql .= " AND s.liturgical_season = :season";
                $params[':season'] = $season;
            }
            if ($theme !== '') {
                $sql .= " AND s.theme = :theme";
                $params[':theme'] = $theme;
            }
            if ($categoryId !== null) {
                $sql .= " AND s.category_id = :catId";
                $params[':catId'] = $categoryId;
            }

            $sql .= " ORDER BY relevance_tier ASC, fts_rank ASC, s.httlvnId ASC LIMIT " . (int)$limit;

            $stmt = DB::pdo()->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Bổ sung lyric snippet nếu có
            foreach ($rows as &$song) {
                $lyrics = $song['lyrics_text'] ?? '';
                $snippet = self::createLyricSnippet($lyrics, $cleanQuery, $unaccentedQuery);
                if ($snippet !== null) {
                    $song['lyric_snippet'] = $snippet;
                }
                unset($song['lyrics_text']);
            }

            if ($exactSongByNum !== null) {
                $rows = array_values(array_filter($rows, fn($r) => (string)$r['id'] !== (string)$exactSongByNum['id']));
                array_unshift($rows, $exactSongByNum);
            }
            return $rows;
        } catch (\Throwable $e) {
            // Graceful fallback: Nếu câu query FTS5 bị lỗi, fallback sang tìm kiếm LIKE
            $rows = self::fallbackLikeSearch($cleanQuery, $filters);
            if ($exactSongByNum !== null) {
                $rows = array_values(array_filter($rows, fn($r) => $r['id'] !== $exactSongByNum['id']));
                array_unshift($rows, $exactSongByNum);
            }
            return $rows;
        }
    }

    public static function vietnameseAccentRegex(string $str): string {
        $map = [
            'a' => '[aáàảãạăắằẳẵặâấầẩẫậ]',
            'e' => '[eéèẻẽẹêếềểễệ]',
            'i' => '[iíìỉĩị]',
            'o' => '[oóòỏõọôốồổỗộơớờởỡợ]',
            'u' => '[uúùủũụưứừửữự]',
            'y' => '[yýỳỷỹỵ]',
            'd' => '[dđ]'
        ];
        $chars = mb_str_split(mb_strtolower($str, 'UTF-8'));
        $pattern = '';
        foreach ($chars as $c) {
            $pattern .= $map[$c] ?? preg_quote($c, '/');
        }
        return $pattern;
    }

    public static function createLyricSnippet(string $lyrics, string $cleanQuery, string $unaccentedQuery): ?string {
        if ($lyrics === '' || $cleanQuery === '') return null;

        $pos = mb_stripos($lyrics, $cleanQuery);
        if ($pos === false) {
            $unaccLyrics = self::removeAccents($lyrics);
            $pos = mb_stripos($unaccLyrics, $unaccentedQuery);
        }
        if ($pos === false) {
            $words = preg_split('/\s+/u', $cleanQuery, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($words as $w) {
                if (mb_strlen($w) >= 2) {
                    $pos = mb_stripos($lyrics, $w);
                    if ($pos === false) {
                        $pos = mb_stripos(self::removeAccents($lyrics), self::removeAccents($w));
                    }
                    if ($pos !== false) {
                        break;
                    }
                }
            }
        }

        if ($pos === false) {
            return null;
        }

        $start = max(0, $pos - 25);
        $length = 80;
        $slice = mb_substr($lyrics, $start, $length);
        $prefix = ($start > 0) ? '...' : '';
        $suffix = (mb_strlen($lyrics) > $start + $length) ? '...' : '';

        // BƯỚC 1: Escape toàn bộ trước (không bao giờ chèn HTML thô từ DB)
        $rawSnippet = $prefix . trim($slice) . $suffix;
        $escaped = htmlspecialchars($rawSnippet, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        // BƯỚC 2: Chèn <mark> quanh từ khớp đã được escape (hỗ trợ cả tiếng Việt không dấu khớp từ có dấu)
        $cleanTrimmed = trim($cleanQuery);
        $wordsToHighlight = preg_split('/\s+/u', $cleanTrimmed, -1, PREG_SPLIT_NO_EMPTY);
        if (empty($wordsToHighlight)) {
            return $escaped;
        }

        // Nếu là cụm từ (≥ 2 từ), ưu tiên highlight nguyên cụm từ liền nhau
        if (count($wordsToHighlight) > 1) {
            $phrasePatternParts = array_map(fn($w) => self::vietnameseAccentRegex(htmlspecialchars($w, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')), $wordsToHighlight);
            $fullPattern = '/(' . implode('\s+', $phrasePatternParts) . ')/iu';
            $highlighted = preg_replace($fullPattern, '<mark>$1</mark>', $escaped);
            if ($highlighted && $highlighted !== $escaped) {
                return $highlighted;
            }
        }

        // Fallback: highlight từng từ riêng rẽ
        $patternParts = [];
        foreach ($wordsToHighlight as $w) {
            $safeW = htmlspecialchars($w, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $patternParts[] = self::vietnameseAccentRegex($safeW);
        }

        $pattern = '/(' . implode('|', $patternParts) . ')/iu';
        $highlighted = preg_replace($pattern, '<mark>$1</mark>', $escaped);
        return $highlighted ?: $escaped;
    }

    public static function fallbackLikeSearch(string $query, array $filters = []): array {
        $cleanQuery = trim($query);
        $unaccentedQuery = self::removeAccents($cleanQuery);
        $prefix = $cleanQuery . '%';
        $keyword = '%' . $cleanQuery . '%';
        $season = trim($filters['season'] ?? '');
        $theme = trim($filters['theme'] ?? '');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int)$filters['category_id'] : null;
        $limit = isset($filters['limit']) ? min(100, max(1, (int)$filters['limit'])) : 50;

        $sql = "
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   s.liturgical_season, s.theme, s.composer, s.tags, s.lyrics_text,
                   c.name as category,
                   CASE
                       WHEN lower(s.title) = lower(?) THEN 1
                       WHEN lower(s.title) LIKE ? THEN 2
                       WHEN lower(s.title) LIKE ? THEN 3
                       ELSE 4
                   END as relevance_tier,
                   CASE
                       WHEN lower(s.title) LIKE ? THEN 'title'
                       ELSE 'lyric'
                   END as match_type
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE (s.title LIKE ? OR s.lyrics_text LIKE ? OR s.theme LIKE ? OR s.composer LIKE ?)
        ";
        $params = [$cleanQuery, $prefix, $keyword, $keyword, $keyword, $keyword, $keyword, $keyword];

        if ($season !== '') {
            $sql .= " AND s.liturgical_season = ?";
            $params[] = $season;
        }
        if ($theme !== '') {
            $sql .= " AND s.theme = ?";
            $params[] = $theme;
        }
        if ($categoryId !== null) {
            $sql .= " AND s.category_id = ?";
            $params[] = $categoryId;
        }
        $sql .= " ORDER BY relevance_tier ASC, s.httlvnId ASC LIMIT ?";
        $params[] = $limit;

        $rows = DB::run($sql, $params)->fetchAll() ?: [];
        foreach ($rows as &$song) {
            $lyrics = $song['lyrics_text'] ?? '';
            $snippet = self::createLyricSnippet($lyrics, $cleanQuery, $unaccentedQuery);
            if ($snippet !== null) {
                $song['lyric_snippet'] = $snippet;
            }
            unset($song['lyrics_text']);
        }
        return $rows;
    }

    public static function searchByLyric(string $q): array {
        return self::search($q);
    }
}
