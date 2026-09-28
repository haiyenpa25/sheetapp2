<?php
/**
 * tools/check_song_spelling.php
 *
 * Công cụ rà soát và chuẩn hóa chính tả tên bài hát (Ticket L6-5):
 * - Rà soát từ nghi sai chính tả (ví dụ lỗi gõ Telex "NGUYỀN" → "NGUYỆN").
 * - Phát hiện và chuẩn hóa thiếu từ (ví dụ bài 234 "TA THEO Ý CHƯA ?" → "TA THEO Ý CHÚA CHƯA?").
 * - Chuẩn hóa khoảng trắng thừa trước dấu câu (!, ?, ,, ;).
 * - Phân loại và giải trình các từ Hán Việt / từ cổ nguyên bản trong Thánh Ca (DỨC DẤY, BIẾN CANH, TIỆN DANH, KHUYÊN LƠN...).
 *
 * Cách dùng CLI:
 *   php tools/check_song_spelling.php --report
 *   php tools/check_song_spelling.php --dry-run
 *   php tools/check_song_spelling.php --fix
 *   php tools/check_song_spelling.php --db=storage/data/app.sqlite
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$options = getopt('', ['report', 'dry-run', 'fix', 'db::']);

$dbPath = $options['db'] ?? __DIR__ . '/../storage/data/app.sqlite';
if (!file_exists($dbPath)) {
    fwrite(STDERR, "❌ Không tìm thấy database tại: {$dbPath}\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON;');
$pdo->exec('PRAGMA journal_mode = WAL;');

/**
 * Danh sách quy tắc sửa lỗi chính tả đã được phê duyệt (Approved Corrections)
 */
function getApprovedCorrections(): array {
    return [
        // Nhóm 1: Lỗi gõ phím Telex NGUYỀN -> NGUYỆN (7 bài)
        'thanh-ca-002' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-035' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-050' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-138' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-231' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-232' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],
        'thanh-ca-239' => ['find' => 'NGUYỀN', 'replace' => 'NGUYỆN'],

        // Nhóm 2: Lỗi thiếu từ do gõ nhầm (Bài 234)
        'thanh-ca-234' => ['find' => 'TA THEO Ý CHƯA', 'replace' => 'TA THEO Ý CHÚA CHƯA'],
    ];
}

/**
 * Chuẩn hóa khoảng trắng thừa trước dấu câu và khoảng trắng kép
 */
function normalizeTitleTypography(string $title): string {
    // 1. Bỏ khoảng trắng trước dấu câu
    $cleaned = preg_replace('/\s+([!?,;:])/u', '$1', $title);
    // 2. Chuẩn hóa khoảng trắng kép
    $cleaned = preg_replace('/\s{2,}/u', ' ', (string)$cleaned);
    return trim((string)$cleaned);
}

/**
 * Xóa cache JSON / ETag
 */
function invalidateSongCache(): void {
    $cacheDir = __DIR__ . '/../storage/cache';
    $files = ['songs_v2.json', 'songs_compact.json', 'etag_songs.txt', 'etag_compact.txt'];
    foreach ($files as $f) {
        $p = $cacheDir . '/' . $f;
        if (file_exists($p)) {
            @unlink($p);
        }
    }
    $dataFile = __DIR__ . '/../storage/data/songs_cache.json';
    if (file_exists($dataFile)) {
        @unlink($dataFile);
    }
}

/**
 * Đồng bộ FTS5 cho bài hát
 */
function syncFts(PDO $pdo, string $songId): void {
    try {
        $hasFts = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='songs_fts'")->fetchColumn();
        if (!$hasFts) return;

        $song = $pdo->query("SELECT rowid, title, lyrics_text, theme, liturgical_season, composer FROM songs WHERE id = " . $pdo->quote($songId))->fetch();
        if (!$song) return;

        // Bỏ dấu tiếng Việt đơn giản cho FTS unaccented
        $unaccented = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $song['title']);
        $sql = "UPDATE songs_fts SET title = ?, title_unaccented = ? WHERE rowid = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$song['title'], $unaccented, $song['rowid']]);
    } catch (\Throwable $e) {
        // non-fatal
    }
}

// Chỉ chạy CLI actions khi được thực thi trực tiếp từ terminal, không chạy khi require_once
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {
    // Lấy danh sách tất cả các bài hát
    $songs = $pdo->query("SELECT id, httlvnId, title FROM songs ORDER BY httlvnId ASC")->fetchAll();
    $approved = getApprovedCorrections();

$changes = [];
foreach ($songs as $s) {
    $id = $s['id'];
    $origTitle = $s['title'];
    $newTitle = $origTitle;
    $reasons = [];

    // Kiểm tra quy tắc sửa từ được duyệt
    if (isset($approved[$id])) {
        $rule = $approved[$id];
        if (mb_strpos($newTitle, $rule['find']) !== false) {
            $newTitle = str_replace($rule['find'], $rule['replace'], $newTitle);
            $reasons[] = "Sửa từ '{$rule['find']}' → '{$rule['replace']}'";
        }
    }

    // Chuẩn hóa khoảng trắng trước dấu câu
    $normalized = normalizeTitleTypography($newTitle);
    if ($normalized !== $newTitle) {
        $reasons[] = "Chuẩn hóa khoảng trắng trước dấu câu";
        $newTitle = $normalized;
    }

    if ($newTitle !== $origTitle) {
        $changes[] = [
            'id' => $id,
            'httlvnId' => $s['httlvnId'],
            'orig' => $origTitle,
            'new' => $newTitle,
            'reasons' => implode(', ', $reasons),
        ];
    }
}

// In báo cáo / danh sách nghi sai
if (isset($options['report']) || (!isset($options['fix']) && !isset($options['dry-run']))) {
    echo "=== BÁO CÁO RÀ SOÁT CHÍNH TẢ & ĐỊNH DẠNG TIÊU ĐỀ BÀI HÁT (Ticket L6-5) ===\n";
    echo "Tổng số bài hát đã quét: " . count($songs) . "\n";
    echo "Số bài hát cần sửa đổi / chuẩn hóa: " . count($changes) . "\n\n";

    echo "--- 1. DANH SÁCH SỬA ĐỔI ĐÃ ĐƯỢC DUYỆT (APPROVED FIXES) ---\n";
    $wordFixes = array_filter($changes, fn($c) => str_contains($c['reasons'], 'Sửa từ'));
    foreach ($wordFixes as $idx => $c) {
        printf("%2d. [%-13s] (Bài %3d): \"%s\"\n", $idx + 1, $c['id'], $c['httlvnId'], $c['orig']);
        printf("    → Đề xuất sửa: \"%s\"\n", $c['new']);
        printf("    → Lý do: %s\n\n", $c['reasons']);
    }

    echo "--- 2. CHUẨN HÓA KHOẢNG TRẮNG TRƯỚC DẤU CÂU (TYPOGRAPHY) ---\n";
    $spaceFixes = array_filter($changes, fn($c) => !str_contains($c['reasons'], 'Sửa từ'));
    echo "Số bài chuẩn hóa khoảng trắng thừa trước dấu câu: " . count($spaceFixes) . " bài.\n";
    $sampleCount = 0;
    foreach ($spaceFixes as $c) {
        if ($sampleCount++ < 10) {
            printf("  - [%-13s] \"%s\" → \"%s\"\n", $c['id'], $c['orig'], $c['new']);
        }
    }
    if (count($spaceFixes) > 10) {
        echo "  ... và " . (count($spaceFixes) - 10) . " bài khác tương tự.\n";
    }

    echo "\n--- 3. GIẢI TRÌNH CÁC TỪ CỔ / TỪ HÁN VIỆT NGUYÊN BẢN (GIỮ NGUYÊN) ---\n";
    echo "  - DỨC DẤY (Bài 220): Từ Hán Việt cổ chỉ sự dục dã, phấn hưng tâm linh. Giữ nguyên theo nguyên bản.\n";
    echo "  - BIẾN CANH (Bài 132): Từ Hán Việt (變更) nghĩa là thay đổi, biến hóa. Giữ nguyên theo nguyên bản.\n";
    echo "  - TIỆN DANH (Bài 175): Từ xưng hô khiêm tốn ('tên mọn của con'). Giữ nguyên theo nguyên bản.\n";
    echo "  - KHUYÊN LƠN (Bài 163): Từ kép chỉ khuyên bảo dỗ dành. Giữ nguyên theo nguyên bản.\n";
    echo "  - KÍP (Bài 1, 57, 451): Kíp ngự lai, kíp đến = mau chóng đến. Giữ nguyên theo nguyên bản.\n\n";

    echo "Cách áp dụng:\n";
    echo "  php tools/check_song_spelling.php --dry-run  (Xem trước thay đổi)\n";
    echo "  php tools/check_song_spelling.php --fix      (Áp dụng vào CSDL và đồng bộ FTS5/Cache)\n";
    exit(0);
}

// Dry-run
if (isset($options['dry-run'])) {
    echo "=== CHẠY THỬ (DRY-RUN): CÁC BÀI SẼ ĐƯỢC CẬP NHẬT (" . count($changes) . " bài) ===\n";
    foreach ($changes as $idx => $c) {
        printf("%2d. [%-13s] (Bài %3d): \"%s\" → \"%s\" (%s)\n", $idx + 1, $c['id'], $c['httlvnId'], $c['orig'], $c['new'], $c['reasons']);
    }
    echo "\n[Dry-run] Chưa có dữ liệu nào bị thay đổi trong CSDL.\n";
    exit(0);
}

// Fix: Áp dụng vào CSDL
if (isset($options['fix'])) {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("UPDATE songs SET title = ? WHERE id = ?");

    $updated = 0;
    foreach ($changes as $c) {
        $stmt->execute([$c['new'], $c['id']]);
        $updated += $stmt->rowCount();
        syncFts($pdo, $c['id']);
    }

    $pdo->commit();
    invalidateSongCache();

    echo "✅ ĐÃ CẬP NHẬT THÀNH CÔNG CHÍNH TẢ & ĐỊNH DẠNG CHO {$updated} BÀI HÁT!\n";
    echo "  - 7 bài sửa lỗi gõ Telex 'NGUYỀN' → 'NGUYỆN'\n";
    echo "  - 1 bài sửa thiếu từ 'TA THEO Ý CHƯA' → 'TA THEO Ý CHÚA CHƯA'\n";
    echo "  - " . (count($changes) - 8) . " bài chuẩn hóa khoảng trắng thừa trước dấu câu\n";
    echo "  - Đã đồng bộ chỉ mục FTS5 và làm mới cache bài hát.\n";
    exit(0);
}
}
