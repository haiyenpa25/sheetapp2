<?php
/**
 * api/services/SongSearchHelper.php
 * Trợ thủ tìm kiếm FTS5, BM25 ranking, chuẩn hóa tiếng Việt & trích dẫn lời bài hát (Snippet)
 * Hỗ trợ mở rộng bí danh (alias expansion) cho "Jêsus", "Jê-sus", "Giê-xu" (Ticket R3-7)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/SongSearchPage.php';

class SongSearchHelper {

    public static function removeAccents(string $str): string {
        $from = ['à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ','đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ','ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ','ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ','ỳ','ý','ỷ','ỹ','ỵ','À','Á','Ả','Ã','Ạ','Ă','Ắ','Ặ','Ằ','Ẳ','Ẵ','Â','Ấ','Ậ','Ầ','Ẩ','Ẫ','Đ','È','É','Ẻ','Ẽ','Ẹ','Ê','Ế','Ệ','Ề','Ể','Ễ','Ì','Í','Ỉ','Ĩ','Ị','Ò','Ó','Ỏ','Õ','Ọ','Ô','Ố','Ộ','Ồ','Ổ','Ỗ','Ơ','Ớ','Ợ','Ờ','Ở','Ỡ','Ù','Ú','Ủ','Ũ','Ụ','Ư','Ứ','Ự','Ừ','Ử','Ữ','Ỳ','Ý','Ỷ','Ỹ','Ỵ'];
        $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','d','e','e','e','e','e','e','e','e','e','e','e','i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u','y','y','y','y','y','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','d','e','e','e','e','e','e','e','e','e','e','e','i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u','y','y','y','y','y'];
        return str_replace($from, $to, $str);
    }

    public static function getQueryVariants(string $query): array {
        $clean = trim($query);
        $unacc = self::removeAccents($clean);
        $variants = [mb_strtolower($clean, 'UTF-8'), mb_strtolower($unacc, 'UTF-8'), mb_strtoupper($clean, 'UTF-8'), mb_strtoupper($unacc, 'UTF-8')];
        $re = '/(?:gi[eê][\s\-]+xu|gi[eê]xu|j[eê][\s\-]+sus|j[eê]sus)/ui';
        if (preg_match($re, $clean)) {
            foreach (['jesus', 'je-sus', 'jêsus', 'jê-sus', 'giê-xu', 'gie-xu', 'gie xu'] as $repl) {
                $v = preg_replace($re, $repl, $clean);
                $variants[] = mb_strtolower($v, 'UTF-8');
                $variants[] = mb_strtolower(self::removeAccents($v), 'UTF-8');
                $variants[] = mb_strtoupper($v, 'UTF-8');
                $variants[] = mb_strtoupper(self::removeAccents($v), 'UTF-8');
            }
        }
        return array_values(array_unique(array_filter($variants)));
    }

    public static function getTaxonomy(): array {
        $taxonomy = [
            'seasons' => [
                ['key' => 'christmas',        'name' => 'Lễ Giáng Sinh',               'color' => '#f59e0b'], ['key' => 'new-year',         'name' => 'Năm Mới',                     'color' => '#3b82f6'],
                ['key' => 'palm-sunday',      'name' => 'Chúa Nhật Lễ Lá',             'color' => '#84cc16'], ['key' => 'lent',             'name' => 'Lễ Thương Khó',               'color' => '#ec4899'],
                ['key' => 'easter',           'name' => 'Lễ Phục Sinh',                'color' => '#10b981'], ['key' => 'ascension',        'name' => 'Lễ Thăng Thiên',              'color' => '#06b6d4'],
                ['key' => 'pentecost',        'name' => 'Lễ Đức Thánh Linh Giáng Lâm', 'color' => '#ef4444'], ['key' => 'thanksgiving',     'name' => 'Lễ Cảm Tạ',                   'color' => '#eab308'],
                ['key' => 'baptism',          'name' => 'Lễ Báp-têm',                  'color' => '#0ea5e9'], ['key' => 'communion',        'name' => 'Lễ Tiệc Thánh',               'color' => '#8b5cf6'],
                ['key' => 'wedding',          'name' => 'Hôn Lễ',                      'color' => '#d946ef'], ['key' => 'child-dedication', 'name' => 'Lễ Dâng Con',                 'color' => '#f43f5e'],
                ['key' => 'funeral',          'name' => 'Tang Lễ',                     'color' => '#6b7280'], ['key' => 'dedication',       'name' => 'Lễ Cung Hiến',                'color' => '#14b8a6'],
                ['key' => 'ordination',       'name' => 'Lễ Tấn Phong Mục Sư',         'color' => '#f97316'], ['key' => 'farewell',         'name' => 'Tiễn Biệt',                   'color' => '#64748b'],
                ['key' => 'evangelism',       'name' => 'Buổi Truyền Giảng',           'color' => '#a855f7'], ['key' => 'solemnity',        'name' => 'Lễ nghi Hội Thánh',           'color' => '#eab308']
            ],
            'themes' => [
                ['key' => 'tho-phuong',           'name' => 'Thờ phượng'],                ['key' => 'duc-chua-troi',        'name' => 'Đức Chúa Trời'],
                ['key' => 'chua-jesus-christ',    'name' => 'Chúa Jêsus Christ'],        ['key' => 'duc-thanh-linh',       'name' => 'Đức Thánh Linh'],
                ['key' => 'hoi-thanh',            'name' => 'Hội Thánh'],                 ['key' => 'kinh-thanh',           'name' => 'Kinh Thánh'],
                ['key' => 'tin-lanh',             'name' => 'Tin Lành'],                  ['key' => 'doi-tin-do',           'name' => 'Đời tín đồ'],
                ['key' => 'thien-dang',           'name' => 'Thiên đàng'],                ['key' => 'truyen-giang',         'name' => 'Truyền giảng'],
                ['key' => 'thieu-nhi',            'name' => 'Thiếu nhi'],                 ['key' => 'thanh-nien',           'name' => 'Thanh niên'],
                ['key' => 'don-ca-song-ca',       'name' => 'Đơn ca – Song ca'],          ['key' => 'hop-ca',               'name' => 'Hợp ca'],
                ['key' => 'kinh-tiet-ca-doan-ca', 'name' => 'Kinh tiết ca / Đoản ca'],   ['key' => 'thi-thien',            'name' => 'Thi Thiên'],
                ['key' => 'khai-le',              'name' => 'Khai lễ'],
                ['key' => 'dang-hien',            'name' => 'Dâng hiến'],                 ['key' => 'tiec-thanh',           'name' => 'Tiệc Thánh'],
                ['key' => 'tat-le',               'name' => 'Tất lễ'],                    ['key' => 'huyet-chua',           'name' => 'Huyết Chúa / Thập tự giá'],
                ['key' => 'cau-nguyen',           'name' => 'Cầu Nguyện & Sám Hối'],      ['key' => 'ton-vinh',             'name' => 'Tôn Vinh & Cảm Tạ']
            ]
        ];
        foreach ($taxonomy as &$items) foreach ($items as &$item) $item['label'] = $item['name'];
        return $taxonomy;
    }

    private static function taxonomyValues(string $group, string $value): array {
        if (in_array($value, ['kinh-tiet-ca', 'Kinh tiết ca / Đoản ca', 'Kinh tiết ca & Đoản ca'], true)) $value = 'kinh-tiet-ca-doan-ca';
        foreach (self::getTaxonomy()[$group] as $item) {
            if ($value === $item['key'] || $value === $item['label']) {
                $values = [$item['key'], $item['label']];
                if ($item['key'] === 'kinh-tiet-ca-doan-ca') $values = array_merge($values, ['kinh-tiet-ca', 'Kinh tiết ca & Đoản ca']);
                return $values;
            }
        }
        return [$value];
    }

    private static function appendTaxonomyFilters(string &$sql, array &$params, array $filters): void {
        $named = !array_is_list($params);
        foreach ([['season', 'seasons', 's.liturgical_season'], ['theme', 'themes', 's.theme']] as $index => [$key, $group, $column]) {
            if (($filters[$index] ?? '') === '') continue;
            $placeholders = [];
            foreach (self::taxonomyValues($group, $filters[$index]) as $i => $value) {
                $placeholder = $named ? ':tv_' . $key . '_' . $i : '?';
                $placeholders[] = $placeholder;
                if ($named) $params[$placeholder] = $value; else $params[] = $value;
            }
            $sql .= ' AND ' . $column . ' IN (' . implode(',', $placeholders) . ')';
        }
    }

    public static function extractLyricsByVerse(string $xmlContent): string {
        if ($xmlContent === '' || !str_contains($xmlContent, '<lyric')) return '';
        $xml = @simplexml_load_string($xmlContent);
        if (!$xml) return '';

        $selectedPart = null;
        $maxLyrics = -1;
        foreach ($xml->part as $part) {
            $c = count($part->xpath('.//lyric'));
            if ($c > $maxLyrics) { $maxLyrics = $c; $selectedPart = $part; }
        }
        if (!$selectedPart || $maxLyrics <= 0) {
            $selectedPart = $xml->part[0] ?? null;
            if (!$selectedPart) return '';
        }

        $verseTokens = [];
        $chorusTokens = [];
        $currentMeasureChorus = false;

        foreach ($selectedPart->measure as $measure) {
            foreach ($measure->xpath('direction//words') as $w) {
                if (preg_match('/(Điệp khúc|Đ\.K|ĐK|Chorus|Refrain)/iu', (string)$w)) {
                    $currentMeasureChorus = true;
                    break;
                }
            }
            foreach ($measure->note as $note) {
                if ($note->chord) continue;
                foreach ($note->lyric as $lyric) {
                    $num = (string)($lyric['number'] ?? '1');
                    $name = (string)($lyric['name'] ?? '');
                    $text = trim((string)$lyric->text);
                    $syllabic = (string)($lyric['syllabic'] ?? 'single');
                    if ($text === '') continue;
                    $isChorus = ($name === 'chorus') || (preg_match('/(chorus|refrain|dk|diep)/iu', $name)) || ($name !== 'verse' && $currentMeasureChorus);
                    if ($isChorus) {
                        $chorusTokens[] = ['text' => $text, 'syllabic' => $syllabic];
                    } else {
                        $verseTokens[$num][] = ['text' => $text, 'syllabic' => $syllabic];
                    }
                }
            }
        }

        $assemble = function(array $tokens): string {
            $words = []; $buf = '';
            foreach ($tokens as $t) {
                $txt = $t['text']; $syl = $t['syllabic'];
                if ($syl === 'begin') { $buf = $txt; }
                elseif ($syl === 'middle') { $buf .= (str_ends_with($buf, '-') ? '' : '-') . $txt; }
                elseif ($syl === 'end') { $words[] = $buf . (str_ends_with($buf, '-') ? '' : '-') . $txt; $buf = ''; }
                else { if ($buf !== '') { $words[] = $buf; $buf = ''; } $words[] = $txt; }
            }
            if ($buf !== '') $words[] = $buf;
            if (!empty($words)) { $words[0] = preg_replace('/^(\d+\.)([^\s\d])/u', '$1 $2', $words[0]); }
            return trim(implode(' ', $words));
        };

        $sections = [];
        ksort($verseTokens, SORT_NATURAL);
        foreach ($verseTokens as $num => $tokens) {
            $verseStr = $assemble($tokens);
            if ($verseStr !== '') {
                if (!preg_match('/^\d+\./', $verseStr)) $verseStr = "{$num}. {$verseStr}";
                $sections[] = $verseStr;
            }
        }
        if (!empty($chorusTokens)) {
            $chorusStr = $assemble($chorusTokens);
            if ($chorusStr !== '') {
                $chorusStr = preg_replace('/^(Điệp khúc|Đ\.K|ĐK|Chorus)[:\s]*/iu', '', $chorusStr);
                $sections[] = "[ĐK] " . trim($chorusStr);
            }
        }
        return implode("\n\n", $sections);
    }

    public static function syncSongFts(string $songId, bool $forceReextract = false): void {
        try {
            $pdo = DB::pdo();
            $pdo->exec("DELETE FROM songs_fts WHERE song_id = " . $pdo->quote($songId));

            $song = DB::run("SELECT * FROM songs WHERE id = ?", [$songId])->fetch();
            if (!$song) return;

            $title = $song['title'] ?? '';
            $titleUnaccented = self::removeAccents($title);
            $lyrics = $song['lyrics_text'] ?? '';

            if (($lyrics === '' || $forceReextract) && !empty($song['xmlPath'])) {
                require_once __DIR__ . '/SongService.php';
                $resolvedPath = SongService::resolveManagedXmlPath((string)$song['xmlPath']);
                if ($resolvedPath && file_exists($resolvedPath) && filesize($resolvedPath) < 2000000) {
                    $xmlContent = @file_get_contents($resolvedPath);
                    if ($xmlContent && str_contains($xmlContent, '<lyric')) {
                        $newLyrics = self::extractLyricsByVerse($xmlContent);
                        if ($newLyrics !== '') {
                            $lyrics = $newLyrics;
                            DB::run("UPDATE songs SET lyrics_text = ? WHERE id = ?", [$lyrics, $songId]);
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
            $stmt->execute([$songId, $title, $titleUnaccented, $lyrics, $lyricsUnaccented, $theme, $season, $composer]);
        } catch (\Throwable $e) { error_log('SheetApp FTS sync failed: ' . $e->getMessage()); }
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
        return self::searchPage($query, $filters)['data'];
    }

    public static function searchPage(string $query, array $filters = []): array {
        $cleanQuery = trim($query);
        $season = trim($filters['season'] ?? '');
        $theme = trim($filters['theme'] ?? '');
        $category = trim($filters['category'] ?? '');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int)$filters['category_id'] : null;
        $mode = trim($filters['mode'] ?? 'title');
        $key = trim($filters['key'] ?? '');
        $visWhere = class_exists('SongService') ? SongService::visibilitySqlClause('s') : '1=1';

        if ($cleanQuery === '') {
            $sql = "
                SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags, s.tempo,
                       COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public,
                       c.name as category
                FROM songs s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE {$visWhere}
            ";
            $params = [];
            self::appendTaxonomyFilters($sql, $params, [$season, $theme]);
            if ($category !== '') { $sql .= " AND c.name = ?"; $params[] = $category; }
            if ($categoryId !== null) { $sql .= " AND s.category_id = ?"; $params[] = $categoryId; }
            if ($key !== '') { $sql .= " AND s.defaultKey = ?"; $params[] = $key; }
            $sort = $filters['sort'] ?? 'num';
            $order = $sort === 'title' ? 's.title COLLATE NOCASE ASC' : ($sort === 'key' ? "COALESCE(s.defaultKey, '') ASC, s.title ASC" : 'COALESCE(s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC, s.title ASC');
            $sql .= " ORDER BY {$order}, s.id ASC";
            return SongSearchPage::fetch($sql, $params, $filters);
        }

        $exactSongByNum = null;
        if ($mode !== 'lyric' && preg_match('/^(?:#|bài\s+|bai\s+|stt\s+)?(\d+)$/ui', $cleanQuery, $m)) {
            $songNum = (int)$m[1];
            $numSql = "
                SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags, s.tempo,
                       COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public,
                       c.name as category, 0 as relevance_tier, 0 as fts_rank, 'title' as match_type
                FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE s.httlvnId = ? AND {$visWhere}
            ";
            $numParams = [$songNum];
            self::appendTaxonomyFilters($numSql, $numParams, [$season, $theme]);
            if ($category !== '') { $numSql .= " AND c.name = ?"; $numParams[] = $category; }
            if ($categoryId !== null) { $numSql .= " AND s.category_id = ?"; $numParams[] = $categoryId; }
            if ($key !== '') { $numSql .= " AND s.defaultKey = ?"; $numParams[] = $key; }
            $numSql .= " ORDER BY COALESCE(s.category_id, 1) ASC LIMIT 1";
            $numRow = DB::run($numSql, $numParams)->fetch(PDO::FETCH_ASSOC);
            if ($numRow) $exactSongByNum = $numRow;
        }

        $variants = self::getQueryVariants($cleanQuery);
        $reJesus = '/(?:gi[eê][\s\-]+xu|gi[eê]xu|j[eê][\s\-]+sus|j[eê]sus)/ui';
        $normalized = preg_replace($reJesus, '__ALIAS_JESUS__', $cleanQuery);
        $unaccentedNormalized = self::removeAccents($normalized);
        $rawTerms = preg_split('/\s+/u', $unaccentedNormalized, -1, PREG_SPLIT_NO_EMPTY);
        $safeTerms = [];
        foreach ($rawTerms as $t) {
            if ($t === '__ALIAS_JESUS__') {
                $safeTerms[] = '("jesus"* OR "je sus"* OR "gie xu"* OR "giexu"*)';
            } else {
                $cleaned = preg_replace('/[^\p{L}\p{N}]/u', '', $t);
                if ($cleaned !== '') $safeTerms[] = '"' . $cleaned . '"*';
            }
        }

        if (empty($safeTerms)) {
            return ['data' => $exactSongByNum && (int)($filters['offset'] ?? 0) <= 0 ? [$exactSongByNum] : [],
                'total' => $exactSongByNum ? 1 : 0, 'limit' => min(200, max(1, (int)($filters['limit'] ?? 200))),
                'offset' => max(0, (int)($filters['offset'] ?? 0))];
        }

        $ftsMatchExpr = implode(' AND ', $safeTerms);
        if ($mode === 'lyric') $ftsMatchExpr = '{lyrics_text lyrics_unaccented}: (' . $ftsMatchExpr . ')';

        try {
            $exactClauses = []; $prefixClauses = []; $containsClauses = [];
            $params = [':matchExpr' => $ftsMatchExpr];
            $params[':lyricPhrase'] = mb_strtolower(self::removeAccents($cleanQuery), 'UTF-8');
            foreach ($variants as $idx => $v) {
                $pEx = ":ex_{$idx}"; $pPre = ":pre_{$idx}"; $pCont = ":cont_{$idx}";
                $exactClauses[] = "lower(s.title) = {$pEx} OR lower(f.title_unaccented) = {$pEx}";
                $prefixClauses[] = "lower(s.title) LIKE {$pPre} OR lower(f.title_unaccented) LIKE {$pPre}";
                $containsClauses[] = "lower(s.title) LIKE {$pCont} OR lower(f.title_unaccented) LIKE {$pCont}";
                $params[$pEx] = $v;
                $params[$pPre] = $v . '%';
                $params[$pCont] = '%' . $v . '%';
            }

            $sql = "
                SELECT f.song_id as id,
                       s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                       s.liturgical_season, s.theme, s.composer, s.tags, s.lyrics_text, s.tempo,
                       COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public,
                       c.name as category,
                       CASE WHEN instr(lower(replace(f.lyrics_unaccented, '-', ' ')), :lyricPhrase) > 0 THEN instr(lower(replace(f.lyrics_unaccented, '-', ' ')), :lyricPhrase) ELSE 999999 END as lyric_phrase,
                       bm25(songs_fts) as fts_rank,
                       CASE
                           WHEN (" . implode(' OR ', $exactClauses) . ") THEN 1
                           WHEN (" . implode(' OR ', $prefixClauses) . ") THEN 2
                           WHEN (" . implode(' OR ', $containsClauses) . ") THEN 3
                           ELSE 4
                       END as relevance_tier,
                       CASE
                           WHEN (" . implode(' OR ', $containsClauses) . ") THEN 'title'
                           ELSE 'lyric'
                       END as match_type
                FROM songs_fts f
                JOIN songs s ON f.song_id = s.id
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE songs_fts MATCH :matchExpr AND {$visWhere}
            ";

            self::appendTaxonomyFilters($sql, $params, [$season, $theme]);
            if ($category !== '') { $sql .= " AND c.name = :catName"; $params[':catName'] = $category; }
            if ($categoryId !== null) { $sql .= " AND s.category_id = :catId"; $params[':catId'] = $categoryId; }
            if ($key !== '') { $sql .= " AND s.defaultKey = :key"; $params[':key'] = $key; }
            if ($exactSongByNum !== null) { $sql .= " AND s.id != :exactId"; $params[':exactId'] = $exactSongByNum['id']; }

            $orderBy = ($mode === 'lyric')
                ? " ORDER BY lyric_phrase ASC, fts_rank ASC, COALESCE(s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC"
                : " ORDER BY relevance_tier ASC, (CASE WHEN relevance_tier < 4 THEN COALESCE(s.category_id, 1) ELSE 0 END) ASC, (CASE WHEN relevance_tier < 4 THEN COALESCE(s.httlvnId, 999999) ELSE 0 END) ASC, fts_rank ASC, COALESCE(s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC";
            $sql .= $orderBy . ', s.title ASC, s.id ASC';
            $page = SongSearchPage::fetch($sql, $params, $filters, $exactSongByNum);
            $rows = $page['data'];

            foreach ($rows as &$song) {
                if ($mode === 'lyric') $song['match_type'] = 'lyric';
                $lyrics = $song['lyrics_text'] ?? '';
                $snippet = self::createLyricSnippet($lyrics, $cleanQuery, self::removeAccents($cleanQuery));
                if ($snippet !== null) $song['lyric_snippet'] = $snippet;
                unset($song['lyrics_text']);
            }

            $page['data'] = $rows;
            return $page;
        } catch (\Throwable $e) {
            return self::fallbackLikePage($cleanQuery, $filters, $exactSongByNum);
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
        $phrase = self::highlightPattern($cleanQuery, true);
        $pattern = self::highlightPattern($cleanQuery);
        if ($pattern === null) return null;
        if (!preg_match($phrase, $lyrics, $match, PREG_OFFSET_CAPTURE)
            && !preg_match($pattern, $lyrics, $match, PREG_OFFSET_CAPTURE)) return null;
        $pos = mb_strlen(substr($lyrics, 0, $match[0][1]));
        $matchLen = mb_strlen($match[0][0]);

        $lyricsLen = mb_strlen($lyrics);
        $preSub = mb_substr($lyrics, 0, $pos);
        $sentenceStartPos = 0;
        $lastNewline = mb_strrpos($preSub, "\n");
        if ($lastNewline !== false) $sentenceStartPos = $lastNewline + 1;

        $between = mb_substr($lyrics, $sentenceStartPos, $pos - $sentenceStartPos);
        if (preg_match_all('/([.!?;]+)(?:\s+|$)/u', $between, $m, PREG_OFFSET_CAPTURE)) {
            $lastPunctMatch = end($m[0]);
            $offsetInBetween = $lastPunctMatch[1] + strlen($lastPunctMatch[0]);
            $charOffset = mb_strlen(substr($between, 0, $offsetInBetween));
            $subBeforePunct = trim(substr($between, 0, $charOffset));
            if (!preg_match('/^\d+\.$/u', $subBeforePunct)) {
                $sentenceStartPos += $charOffset;
            }
        }

        if ($pos - $sentenceStartPos > 60) {
            $longPre = mb_substr($lyrics, $sentenceStartPos, $pos - $sentenceStartPos);
            $lastComma = mb_strrpos($longPre, ',');
            if ($lastComma !== false && ($pos - ($sentenceStartPos + $lastComma)) <= 50) {
                $sentenceStartPos += $lastComma + 1;
            }
        }

        $searchAfterPos = $pos + $matchLen;
        $postSub = mb_substr($lyrics, $searchAfterPos);
        $firstNewline = mb_strpos($postSub, "\n");
        if ($firstNewline !== false) $postSub = mb_substr($postSub, 0, $firstNewline);

        $sentenceEndPos = $searchAfterPos + mb_strlen($postSub);
        if (preg_match('/([.!?;]+)(?:\s+|$)/u', $postSub, $pm, PREG_OFFSET_CAPTURE)) {
            $punctEnd = $pm[0][1] + strlen($pm[0][0]);
            $punctCharLen = mb_strlen(substr($postSub, 0, $punctEnd));
            $curLen = ($searchAfterPos + $punctCharLen) - $sentenceStartPos;
            if ($curLen < 35) {
                $remainingPost = mb_substr($postSub, $punctCharLen);
                if (preg_match('/([.!?;]+)(?:\s+|$)/u', $remainingPost, $pm2, PREG_OFFSET_CAPTURE)) {
                    $punctEnd2 = $pm2[0][1] + strlen($pm2[0][0]);
                    $punctCharLen += mb_strlen(substr($remainingPost, 0, $punctEnd2));
                }
            }
            $sentenceEndPos = $searchAfterPos + $punctCharLen;
        }

        $slice = trim(mb_substr($lyrics, $sentenceStartPos, $sentenceEndPos - $sentenceStartPos));
        $lineStart = ($lastNewline !== false) ? $lastNewline + 1 : 0;
        $lineHead = mb_substr($lyrics, $lineStart, 10);
        if (str_starts_with(trim($lineHead), '[ĐK]') && !str_starts_with($slice, '[ĐK]')) {
            $slice = '[ĐK] ' . $slice;
        }

        $prefix = ($sentenceStartPos > 0 && !preg_match('/^(?:\d+\.|\[ĐK\])/u', $slice)) ? '... ' : '';
        $suffix = ($sentenceEndPos < $lyricsLen && !preg_match('/[.!?]$/u', $slice)) ? ' ...' : '';

        $rawSnippet = $prefix . $slice . $suffix;
        return self::highlightRawText($rawSnippet, $cleanQuery);
    }

    private static function highlightPattern(string $query, bool $phraseOnly = false): ?string {
        $alias = '/(?:gi[eê][\s\-]+xu|gi[eê]xu|j[eê][\s\-]+sus|j[eê]sus)/ui';
        $query = preg_replace($alias, ' JESUSALIAS ', $query);
        $words = preg_split('/\s+/u', trim($query), -1, PREG_SPLIT_NO_EMPTY);
        $parts = array_map(static fn($word) => $word === 'JESUSALIAS'
            ? '(?:j[êe][\s-]?sus|gi[êe][\s-]?xu)'
            : self::vietnameseAccentRegex(self::removeAccents($word)), $words);
        if (!$parts) return null;
        $alternatives = array_values(array_unique(array_merge([implode('[\s-]+', $parts)], $phraseOnly ? [] : $parts)));
        return '/(?<![\p{L}\p{N}\p{M}_])(?:' . implode('|', $alternatives) . ')(?![\p{L}\p{N}\p{M}_])/iu';
    }

    /** Match raw text once, then escape each span; never search inside HTML entities. */
    private static function highlightRawText(string $text, string $query): string {
        $escape = static fn($value) => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $pattern = self::highlightPattern($query);
        if ($pattern === null) return $escape($text);
        if (!preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) return $escape($text);
        $html = ''; $cursor = 0;
        foreach ($matches[0] as [$match, $offset]) {
            $html .= $escape(substr($text, $cursor, $offset - $cursor)) . '<mark>' . $escape($match) . '</mark>';
            $cursor = $offset + strlen($match);
        }
        return $html . $escape(substr($text, $cursor));
    }

    public static function fallbackLikeSearch(string $query, array $filters = []): array {
        return self::fallbackLikePage($query, $filters)['data'];
    }

    private static function fallbackLikePage(string $query, array $filters, ?array $exactSongByNum = null): array {
        $cleanQuery = trim($query);
        $season = trim($filters['season'] ?? '');
        $theme = trim($filters['theme'] ?? '');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int)$filters['category_id'] : null;
        $category = trim($filters['category'] ?? '');
        $key = trim($filters['key'] ?? '');
        $mode = $filters['mode'] ?? 'title';
        $variants = self::getQueryVariants($cleanQuery);
        $visWhere = class_exists('SongService') ? SongService::visibilitySqlClause('s') : '1=1';

        $exactClauses = []; $prefixClauses = []; $containsClauses = [];
        $whereClauses = []; $params = [];
        foreach ($variants as $v) {
            $exactClauses[] = "lower(s.title) = ?";
            $prefixClauses[] = "lower(s.title) LIKE ?";
            $containsClauses[] = "lower(s.title) LIKE ?";
            $whereClauses[] = $mode === 'lyric' ? '(s.lyrics_text LIKE ?)' : "(s.title LIKE ? OR s.lyrics_text LIKE ? OR s.theme LIKE ? OR s.composer LIKE ?)";
        }

        $sql = "
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   s.liturgical_season, s.theme, s.composer, s.tags, s.lyrics_text, s.tempo,
                   COALESCE(s.visibility, 'public') as visibility, COALESCE(s.is_public, 1) as is_public,
                   c.name as category,
                   CASE
                       WHEN (" . implode(' OR ', $exactClauses) . ") THEN 1
                       WHEN (" . implode(' OR ', $prefixClauses) . ") THEN 2
                       WHEN (" . implode(' OR ', $containsClauses) . ") THEN 3
                       ELSE 4
                   END as relevance_tier,
                   CASE
                       WHEN (" . implode(' OR ', $containsClauses) . ") THEN 'title'
                       ELSE 'lyric'
                   END as match_type
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE (" . implode(' OR ', $whereClauses) . ") AND {$visWhere}
        ";

        foreach ($variants as $v) { $params[] = $v; }
        foreach ($variants as $v) { $params[] = $v . '%'; }
        foreach ($variants as $v) { $params[] = '%' . $v . '%'; }
        foreach ($variants as $v) { $params[] = '%' . $v . '%'; }
        foreach ($variants as $v) {
            $kw = '%' . $v . '%';
            $params[] = $kw;
            if ($mode !== 'lyric') { $params[] = $kw; $params[] = $kw; $params[] = $kw; }
        }

        self::appendTaxonomyFilters($sql, $params, [$season, $theme]);
        if ($categoryId !== null) { $sql .= " AND s.category_id = ?"; $params[] = $categoryId; }
        if ($category !== '') { $sql .= " AND c.name = ?"; $params[] = $category; }
        if ($key !== '') { $sql .= " AND s.defaultKey = ?"; $params[] = $key; }
        if ($exactSongByNum !== null) { $sql .= " AND s.id != ?"; $params[] = $exactSongByNum['id']; }
        $sql .= " ORDER BY relevance_tier ASC, COALESCE(s.category_id, 1) ASC, COALESCE(s.httlvnId, 999999) ASC, s.title ASC, s.id ASC";
        $page = SongSearchPage::fetch($sql, $params, $filters, $exactSongByNum);
        $rows = $page['data'];
        foreach ($rows as &$song) {
            if ($mode === 'lyric') $song['match_type'] = 'lyric';
            $lyrics = $song['lyrics_text'] ?? '';
            $snippet = self::createLyricSnippet($lyrics, $cleanQuery, self::removeAccents($cleanQuery));
            if ($snippet !== null) $song['lyric_snippet'] = $snippet;
            unset($song['lyrics_text']);
        }
        $page['data'] = $rows;
        return $page;
    }

    public static function searchByLyric(string $q): array {
        return self::search($q);
    }
}
