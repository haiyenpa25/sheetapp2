<?php
/**
 * tests/fts5_taxonomy_search_regression.php
 *
 * Kiểm tra hồi quy toàn diện cho Epic 3.5 — Tìm kiếm FTS5 và taxonomy mùa/chủ đề:
 * 1. FTS5 Schema, Index & Columns Integrity (liturgical_season, theme, composer, tags, songs_fts virtual table).
 * 2. Accent-Insensitive Search (Tiếng Việt không dấu & có dấu).
 * 3. Ranking & Relevance Tier (BM25 + Exact Title > Prefix > Lyrics Snippet).
 * 4. Liturgical Season & Theme Taxonomy Filtering (Lọc đa chiều theo mùa và chủ đề phụng vụ).
 * 5. Automatic FTS Sync on Add, Update, and Delete (Đồng bộ tức thời bảng ảo FTS5).
 * 6. Search SLA Benchmark & API Controller Contract (Tốc độ < 2ms/query & API response contract).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit('CLI only');
}

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== EPIC 3.5 — FTS5 SEARCH & TAXONOMY REGRESSION SUITE ===\n";

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/core/Response.php';
require_once $root . '/api/services/SongService.php';
require_once $root . '/tests/fixtures/test_db_fixture.php';

$pdo = createTestDatabase();
DB::setPdo($pdo);

// Áp dụng migration 006
$mig006 = require $root . '/api/migrations/006_fts5_search_and_taxonomy.php';
$mig006($pdo);

// Làm sạch dữ liệu bài hát cũ để kiểm thử độc lập
$pdo->exec("DELETE FROM songs; DELETE FROM songs_fts;");

// ─── TEST 1: FTS5 Schema, Index & Columns Integrity ────────────────
echo "\n--- TEST 1: Schema, Index & Taxonomy Definition ---\n";

$cols = [];
$stmt = $pdo->query("PRAGMA table_info(songs)");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $cols[strtolower($r['name'])] = true;
}

check(isset($cols['liturgical_season']), "Cột liturgical_season tồn tại trong bảng songs");
check(isset($cols['theme']), "Cột theme tồn tại trong bảng songs");
check(isset($cols['composer']), "Cột composer tồn tại trong bảng songs");
check(isset($cols['tags']), "Cột tags tồn tại trong bảng songs");
check(isset($cols['lyrics_text']), "Cột lyrics_text tồn tại trong bảng songs");

// Kiểm tra bảng ảo songs_fts
$ftsExists = (int)$pdo->query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='songs_fts'")->fetchColumn();
check($ftsExists === 1, "Bảng ảo SQLite FTS5 songs_fts đã được khởi tạo thành công");

// Kiểm tra taxonomy chuẩn
$tax = SongService::getTaxonomy();
check(!empty($tax['seasons']) && count($tax['seasons']) === 6, "Taxonomy có đúng 6 mùa phụng vụ chuẩn");
check(!empty($tax['themes']) && count($tax['themes']) >= 8, "Taxonomy có đầy đủ danh sách chủ đề phụng vụ");

$seasonKeys = array_column($tax['seasons'], 'key');
check(in_array('advent', $seasonKeys, true) && in_array('christmas', $seasonKeys, true) && in_array('lent', $seasonKeys, true), "Danh sách mùa có Mùa Vọng, Giáng Sinh, Mùa Chay");

// ─── TEST 2: Accent-Insensitive Search ──────────────────────────────
echo "\n--- TEST 2: Accent-Insensitive Search ---\n";

// Nạp dữ liệu test
$s1 = SongService::add([
    'title'             => 'Thánh Chúa Yêu Thương',
    'defaultKey'        => 'G',
    'httlvnId'          => 1,
    'liturgical_season' => 'ordinary',
    'theme'             => 'ton-vinh',
    'composer'          => 'Nguyễn Văn Nam',
    'lyrics_text'       => 'Chúa là mục tử nhân lành dẫn lối con đi qua lũng tối tâm hồn an vui.'
]);

$s2 = SongService::add([
    'title'             => 'Nguyện Tụng Ngợi Chúa',
    'defaultKey'        => 'D',
    'httlvnId'          => 2,
    'liturgical_season' => 'advent',
    'theme'             => 'nhap-le',
    'composer'          => 'Trần Hoàng',
    'lyrics_text'       => 'Muôn muôn ngàn câu ca hòa vang dâng lên Thiên Chúa Đấng Cứu Độ trần gian.'
]);

// 1. Tìm không dấu hoàn toàn
$res1 = SongService::search('thanh chua yeu thuong');
check(count($res1) >= 1 && $res1[0]['id'] === $s1['id'], "Tìm 'thanh chua yeu thuong' (không dấu) khớp chính xác Bài 1");

// 2. Tìm một từ trong lời bài hát không dấu
$resLyric = SongService::search('muc tu');
check(count($resLyric) >= 1 && $resLyric[0]['id'] === $s1['id'], "Tìm 'muc tu' từ lời bài hát không dấu khớp Bài 1");
check(isset($resLyric[0]['lyric_snippet']) && str_contains($resLyric[0]['lyric_snippet'], 'mục tử'), "Trả về lyric_snippet có ngữ cảnh");

// 3. Tìm hoa thường hỗn hợp
$resCase = SongService::search('tHieN cHuA');
check(count($resCase) >= 1 && $resCase[0]['id'] === $s2['id'], "Tìm 'tHieN cHuA' (case-insensitive) khớp Bài 2");

// ─── TEST 3: Ranking & Relevance Tier ───────────────────────────────
echo "\n--- TEST 3: Ranking & Relevance Tier (Exact > Prefix > Lyric) ---\n";

$sA = SongService::add(['title' => 'Maria Mẹ Nhân Ái', 'httlvnId' => 10]);
$sB = SongService::add(['title' => 'Maria', 'httlvnId' => 11]);
$sC = SongService::add(['title' => 'Dâng Lời Cầu', 'lyrics_text' => 'Xin Mẹ Maria chở che phù trì', 'httlvnId' => 12]);

$mariaSearch = SongService::search('Maria');
check(count($mariaSearch) === 3, "Tìm 'Maria' tìm thấy đúng 3 bài");
check($mariaSearch[0]['id'] === $sB['id'], "Hạng 1: Bài 'Maria' khớp chính xác 100% tiêu đề");
check($mariaSearch[1]['id'] === $sA['id'], "Hạng 2: Bài 'Maria Mẹ Nhân Ái' khớp tiếp đầu ngữ tiêu đề");
check($mariaSearch[2]['id'] === $sC['id'], "Hạng 3: Bài 'Dâng Lời Cầu' khớp lời bài hát");

// ─── TEST 4: Liturgical Season & Theme Taxonomy Filtering ───────────
echo "\n--- TEST 4: Taxonomy Filtering ---\n";

$sAdventNhap = SongService::add([
    'title'             => 'Trời Gieo Sương Xuống',
    'liturgical_season' => 'advent',
    'theme'             => 'nhap-le'
]);

$sChristmasNhap = SongService::add([
    'title'             => 'Đêm Thánh Vô Cùng',
    'liturgical_season' => 'christmas',
    'theme'             => 'nhap-le'
]);

$sLentCauNguyen = SongService::add([
    'title'             => 'Xin Chúa Thứ Tha',
    'liturgical_season' => 'lent',
    'theme'             => 'cau-nguyen'
]);

// Lọc theo mùa
$adventOnly = SongService::search('', ['season' => 'advent']);
$adventIds = array_column($adventOnly, 'id');
check(in_array($sAdventNhap['id'], $adventIds, true) && !in_array($sChristmasNhap['id'], $adventIds, true), "Lọc season=advent chỉ lấy bài Mùa Vọng");

// Lọc theo chủ đề
$nhapLeOnly = SongService::search('', ['theme' => 'nhap-le']);
$nhapLeIds = array_column($nhapLeOnly, 'id');
check(in_array($sAdventNhap['id'], $nhapLeIds, true) && in_array($sChristmasNhap['id'], $nhapLeIds, true) && !in_array($sLentCauNguyen['id'], $nhapLeIds, true), "Lọc theme=nhap-le lấy đúng các bài Nhập Lễ");

// Lọc kết hợp Mùa + Chủ Đề
$lentCauNguyen = SongService::search('', ['season' => 'lent', 'theme' => 'cau-nguyen']);
check(count($lentCauNguyen) === 1 && $lentCauNguyen[0]['id'] === $sLentCauNguyen['id'], "Lọc kết hợp season=lent & theme=cau-nguyen chính xác tuyệt đối");

// ─── TEST 5: Automatic FTS Sync on Add, Update, and Delete ──────────
echo "\n--- TEST 5: Automatic FTS Sync on Add, Update, Delete ---\n";

// 1. Add
$newSong = SongService::add([
    'title' => 'Bình An Cho Muôn Dân',
    'theme' => 'ton-vinh'
]);
$findNew = SongService::search('Bình An');
check(count($findNew) >= 1 && $findNew[0]['id'] === $newSong['id'], "Thêm bài hát: Tự động sync vào FTS5 ngay lập tức");

// 2. Update
SongService::update($newSong['id'], [
    'title'             => 'Hoan Ca Giáng Sinh Rạng Ngời',
    'liturgical_season' => 'christmas'
]);
$findOld = SongService::search('Bình An');
check(empty(array_filter($findOld, fn($x) => $x['id'] === $newSong['id'])), "Sau update: Tiêu đề cũ không còn trong FTS5");

$findUpdated = SongService::search('Hoan Ca');
check(!empty(array_filter($findUpdated, fn($x) => $x['id'] === $newSong['id'])), "Sau update: Tiêu đề mới được cập nhật vào FTS5");

// 3. Delete
SongService::delete($newSong['id']);
$findDeleted = SongService::search('Hoan Ca');
check(empty(array_filter($findDeleted, fn($x) => $x['id'] === $newSong['id'])), "Sau delete: Bài hát bị xóa hoàn toàn khỏi FTS5");

// ─── TEST 6: Search SLA Benchmark & API Controller Contract ─────────
echo "\n--- TEST 6: Search SLA Benchmark & Controller Contract ---\n";

// Benchmark 100 truy vấn FTS5
$t0 = microtime(true);
for ($i = 0; $i < 100; $i++) {
    SongService::search('chua', ['season' => 'advent', 'limit' => 20]);
}
$tDeltaMs = (microtime(true) - $t0) * 1000;
check($tDeltaMs < 200, "Benchmark 100 queries FTS5 hoàn tất trong " . round($tDeltaMs, 2) . "ms (< 2ms/query, SLA < 50ms)");

// Kiểm tra Contract trả về
$apiResult = SongService::search('Maria');
check(is_array($apiResult), "API Search trả về mảng kết quả");
if (!empty($apiResult)) {
    $first = $apiResult[0];
    check(isset($first['id']) && isset($first['title']), "Mỗi kết quả có đầy đủ trường id và title");
}

echo "\n=======================================================\n";
echo "SUCCESS: Tất cả 6 bài kiểm tra FTS5 Search & Taxonomy ĐẠT 100%!\n";
echo "=======================================================\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
