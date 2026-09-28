<?php
/**
 * tools/manage_song_labels.php
 *
 * Công cụ quản lý Mùa Lễ & Chủ Đề bài hát (Ticket L6-3):
 * - Xem thống kê bài hát có nhãn mùa lễ, chủ đề (--status).
 * - Gieo dữ liệu phân loại chuẩn mục lục Thánh Ca HTTLVN cho 500 bài đầu (--seed).
 * - Xóa sạch nhãn phân loại (--clear).
 * - Đặt thủ công mùa lễ / chủ đề cho một bài hát (--song, --season, --theme).
 *
 * Cách dùng CLI:
 *   php tools/manage_song_labels.php --status
 *   php tools/manage_song_labels.php --seed
 *   php tools/manage_song_labels.php --clear
 *   php tools/manage_song_labels.php --song=thanh-ca-001 --season="Thường Niên" --theme="Tôn Vinh & Ngợi Khen"
 *   php tools/manage_song_labels.php --db=storage/data/app.sqlite
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$options = getopt('', ['status', 'seed', 'clear', 'song:', 'season:', 'theme:', 'db::']);

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
 * Mục lục phân loại chuẩn mực Thánh Ca HTTLVN:
 * Ánh xạ dải số bài (httlvnId từ min đến max) sang Mùa Lễ và Chủ Đề.
 */
function getStandardLabelRanges(): array {
    return [
        ['min' => 1,   'max' => 40,  'season' => 'Thường Niên', 'theme' => 'Tôn Vinh & Ngợi Khen'],
        ['min' => 41,  'max' => 52,  'season' => 'Thường Niên', 'theme' => 'Đức Chúa Trời Dắt Chăn'],
        ['min' => 53,  'max' => 75,  'season' => 'Giáng Sinh',  'theme' => 'Chúa Giáng Sinh'],
        ['min' => 76,  'max' => 87,  'season' => 'Đầu Năm',    'theme' => 'Đầu Năm & Năm Mới'],
        ['min' => 88,  'max' => 101, 'season' => 'Thương Khó',  'theme' => 'Sự Thương Khó & Thập Tự Giá'],
        ['min' => 102, 'max' => 113, 'season' => 'Phục Sinh',   'theme' => 'Chúa Phục Sinh'],
        ['min' => 114, 'max' => 118, 'season' => 'Thăng Thiên', 'theme' => 'Chúa Thăng Thiên'],
        ['min' => 119, 'max' => 134, 'season' => 'Tái Lâm',     'theme' => 'Chúa Tái Lâm'],
        ['min' => 135, 'max' => 144, 'season' => 'Lễ Ngũ Tuần', 'theme' => 'Đức Thánh Linh'],
        ['min' => 145, 'max' => 155, 'season' => 'Thường Niên', 'theme' => 'Lời Chúa & Kinh Thánh'],
        ['min' => 156, 'max' => 220, 'season' => 'Truyền Giảng','theme' => 'Sự Cứu Rỗi & Mời Gọi'],
        ['min' => 221, 'max' => 280, 'season' => 'Thường Niên', 'theme' => 'Đức Tin & Trông Cậy'],
        ['min' => 281, 'max' => 340, 'season' => 'Thường Niên', 'theme' => 'Cầu Nguyện & Tận Hiến'],
        ['min' => 341, 'max' => 400, 'season' => 'Thường Niên', 'theme' => 'Bình An & Yên Ủi'],
        ['min' => 401, 'max' => 450, 'season' => 'Lễ Cảm Tạ',  'theme' => 'Cảm Tạ & Phước Lành'],
        ['min' => 451, 'max' => 500, 'season' => 'Truyền Giảng','theme' => 'Truyền Giảng & Chứng Nhân'],
    ];
}

/**
 * Xóa cache JSON / ETag
 */
function invalidateLabelsCache(): void {
    $cacheDir = __DIR__ . '/../storage/cache';
    $files = ['songs_v2.json', 'songs_compact.json', 'etag_songs.txt', 'etag_compact.txt'];
    foreach ($files as $f) {
        $p = $cacheDir . '/' . $f;
        if (file_exists($p)) {
            @unlink($p);
        }
    }
}

/**
 * Đồng bộ toàn bộ bảng FTS5 nếu có
 */
function syncAllFtsLabels(PDO $pdo): void {
    try {
        $hasFts = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='songs_fts'")->fetchColumn();
        if ($hasFts) {
            $ftsCols = $pdo->query("PRAGMA table_info(songs_fts)")->fetchAll(PDO::FETCH_COLUMN, 1);
            $hasSeason = in_array('liturgical_season', $ftsCols, true);
            $hasTheme = in_array('theme', $ftsCols, true);
            if ($hasSeason && $hasTheme) {
                $pdo->exec("UPDATE songs_fts SET 
                    liturgical_season = (SELECT liturgical_season FROM songs WHERE songs.rowid = songs_fts.rowid),
                    theme = (SELECT theme FROM songs WHERE songs.rowid = songs_fts.rowid)");
            }
        }
    } catch (Throwable $e) {
        // non-fatal
    }
}

// In thống kê
if (isset($options['status'])) {
    $totalSongs = (int)$pdo->query("SELECT COUNT(*) FROM songs")->fetchColumn();
    $seasonCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != ''")->fetchColumn();
    $themeCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE theme IS NOT NULL AND theme != ''")->fetchColumn();
    $eitherCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE (liturgical_season IS NOT NULL AND liturgical_season != '') OR (theme IS NOT NULL AND theme != '')")->fetchColumn();

    echo "=== BÁO CÁO NHÃN PHÂN LOẠI BÀI HÁT (L6-3) ===\n";
    echo "Tổng số bài hát:        {$totalSongs}\n";
    echo "Có Mùa Lễ (Season):     {$seasonCount} (" . round($seasonCount / max(1, $totalSongs) * 100, 1) . "%)\n";
    echo "Có Chủ Đề (Theme):      {$themeCount} (" . round($themeCount / max(1, $totalSongs) * 100, 1) . "%)\n";
    echo "Có ít nhất 1 nhãn:      {$eitherCount} (" . round($eitherCount / max(1, $totalSongs) * 100, 1) . "%)\n";

    echo "\n--- Phân bố theo Mùa Lễ ---\n";
    $seasons = $pdo->query("SELECT liturgical_season, COUNT(*) as cnt FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != '' GROUP BY liturgical_season ORDER BY cnt DESC")->fetchAll();
    foreach ($seasons as $s) {
        printf("  - %-20s: %3d bài\n", $s['liturgical_season'], $s['cnt']);
    }

    echo "\n--- Phân bố theo Chủ Đề ---\n";
    $themes = $pdo->query("SELECT theme, COUNT(*) as cnt FROM songs WHERE theme IS NOT NULL AND theme != '' GROUP BY theme ORDER BY cnt DESC LIMIT 15")->fetchAll();
    foreach ($themes as $t) {
        printf("  - %-30s: %3d bài\n", $t['theme'], $t['cnt']);
    }
    exit(0);
}

// Xóa nhãn
if (isset($options['clear'])) {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = NULL, theme = NULL WHERE liturgical_season IS NOT NULL OR theme IS NOT NULL");
    $stmt->execute();
    $count = $stmt->rowCount();
    $pdo->commit();

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    echo "✅ Đã xóa nhãn (mùa lễ, chủ đề) cho {$count} bài hát.\n";
    exit(0);
}

// Đặt nhãn cho 1 bài
if (isset($options['song'])) {
    $songId = (string)$options['song'];
    $season = isset($options['season']) ? trim((string)$options['season']) : null;
    $theme = isset($options['theme']) ? trim((string)$options['theme']) : null;

    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = ?, theme = ? WHERE id = ?");
    $stmt->execute([$season ?: null, $theme ?: null, $songId]);

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    echo "✅ Đã cập nhật nhãn cho bài [{$songId}]: Mùa lễ='{$season}', Chủ đề='{$theme}'\n";
    exit(0);
}

// Gieo nhãn chuẩn theo mục lục Thánh Ca HTTLVN (500 bài)
if (isset($options['seed'])) {
    $ranges = getStandardLabelRanges();
    $pdo->beginTransaction();

    $totalUpdated = 0;
    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = :season, theme = :theme WHERE httlvnId >= :min AND httlvnId <= :max");

    foreach ($ranges as $range) {
        $stmt->execute([
            ':season' => $range['season'],
            ':theme'  => $range['theme'],
            ':min'    => $range['min'],
            ':max'    => $range['max'],
        ]);
        $totalUpdated += $stmt->rowCount();
    }

    $pdo->commit();

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    echo "✅ Đã gắn nhãn thành công cho {$totalUpdated} bài hát theo mục lục chuẩn Thánh Ca HTTLVN (500 bài)!\n";
    exit(0);
}

echo "Cách dùng:\n";
echo "  php tools/manage_song_labels.php --status\n";
echo "  php tools/manage_song_labels.php --seed\n";
echo "  php tools/manage_song_labels.php --clear\n";
echo "  php tools/manage_song_labels.php --song=thanh-ca-001 --season=\"Thường Niên\" --theme=\"Tôn Vinh & Ngợi Khen\"\n";
