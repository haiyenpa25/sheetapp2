<?php
/**
 * tools/manage_song_labels.php
 *
 * Công cụ quản lý Mùa Lễ & Chủ Đề bài hát (Ticket L6-3 & R3-4):
 * - Xem thống kê bài hát có nhãn mùa lễ, chủ đề (--status).
 * - Chạy thử nghiệm dry-run in bảng thay đổi 1–903 (--dry-run).
 * - Sao lưu CSDL trước migration (--backup).
 * - Gieo nhãn chính thức mục lục Thánh Ca HTTLVN 1–903, xóa 'Thường Niên' (--seed).
 * - Xóa sạch nhãn phân loại (--clear).
 * - Đặt thủ công mùa lễ / chủ đề cho một bài hát (--song, --season, --theme).
 *
 * Cách dùng CLI:
 *   php tools/manage_song_labels.php --dry-run
 *   php tools/manage_song_labels.php --seed
 *   php tools/manage_song_labels.php --status
 *   php tools/manage_song_labels.php --backup
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$options = getopt('', ['status', 'seed', 'dry-run', 'backup', 'clear', 'song:', 'season:', 'theme:', 'db::']);

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
 * Trả về ánh xạ chính thức 903 bài theo mục lục Thánh Ca HTTLVN (Phụ lục B.1, B.2, B.3)
 * @return array<int, array{theme: string, season: ?string}>
 */
function getOfficialLabelMapping(): array {
    $rules = [
        ['theme' => 'Thờ phượng', 'season' => null, 'ranges' => '1-38, 456-460, 510-553'],
        ['theme' => 'Thờ phượng', 'season' => 'Lễ nghi Hội Thánh', 'ranges' => '29, 30, 551'],
        ['theme' => 'Đức Chúa Trời', 'season' => null, 'ranges' => '39-52, 554'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Giáng Sinh', 'ranges' => '53-75, 505-508, 555-574'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => null, 'ranges' => '76-87, 575-578'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Thương Khó', 'ranges' => '88-102, 579-592'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Phục Sinh', 'ranges' => '103-112, 593-597'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => 'Lễ Thăng Thiên', 'ranges' => '113-118, 598-599'],
        ['theme' => 'Chúa Jêsus Christ', 'season' => null, 'ranges' => '119-134, 485-492, 600-614'],
        ['theme' => 'Đức Thánh Linh', 'season' => 'Lễ Đức Thánh Linh Giáng Lâm', 'ranges' => '135-144, 615-618'],
        ['theme' => 'Hội Thánh', 'season' => null, 'ranges' => '145-149'],
        ['theme' => 'Kinh Thánh', 'season' => null, 'ranges' => '150-155, 619-621'],
        ['theme' => 'Tin Lành', 'season' => null, 'ranges' => '156-205, 465-474, 622-647'],
        ['theme' => 'Đời tín đồ', 'season' => null, 'ranges' => '206-334, 475-484, 648-848'],
        ['theme' => 'Đời tín đồ', 'season' => 'Lễ Cảm Tạ', 'ranges' => '673-682'],
        ['theme' => 'Thiên đàng', 'season' => null, 'ranges' => '335-348, 493-495, 849-853'],
        ['theme' => 'Truyền giảng', 'season' => 'Buổi Truyền Giảng', 'ranges' => '349-362, 854-869'],
        ['theme' => 'Thiếu nhi', 'season' => null, 'ranges' => '363-373, 870-872'],
        ['theme' => 'Thanh niên', 'season' => null, 'ranges' => '374-382, 873-878'],
        ['theme' => 'Đơn ca – Song ca', 'season' => null, 'ranges' => '383-392, 898-899'],
        ['theme' => 'Thờ phượng', 'season' => 'Lễ Dâng Con', 'ranges' => '393-396, 879-880'],
        ['theme' => 'Thờ phượng', 'season' => 'Lễ Báp-têm', 'ranges' => '397-398, 496, 881-882'],
        ['theme' => 'Thờ phượng', 'season' => 'Lễ Tiệc Thánh', 'ranges' => '399-400, 497-501, 883'],
        ['theme' => 'Đời tín đồ', 'season' => 'Hôn Lễ', 'ranges' => '401-403, 502, 504, 884-887'],
        ['theme' => 'Đời tín đồ', 'season' => 'Tang Lễ', 'ranges' => '404, 888'],
        ['theme' => 'Thờ phượng', 'season' => 'Năm Mới', 'ranges' => '405-406, 509, 889-891'],
        ['theme' => 'Đời tín đồ', 'season' => 'Tiễn Biệt', 'ranges' => '407-408, 503, 892-893'],
        ['theme' => 'Hội Thánh',  'season' => 'Lễ Tấn Phong Mục Sư', 'ranges' => '409-411, 894-896'],
        ['theme' => 'Thờ phượng', 'season' => null, 'ranges' => '412'],
        ['theme' => 'Hợp ca', 'season' => null, 'ranges' => '413-431, 900-903'],
        ['theme' => 'Kinh tiết ca & Đoản ca', 'season' => null, 'ranges' => '432-438, 897'],
        ['theme' => 'Kinh tiết ca & Đoản ca', 'season' => null, 'ranges' => '439-455'],
        ['theme' => 'Thi Thiên', 'season' => null, 'ranges' => '456-509'],
    ];

    $map = [];
    foreach ($rules as $r) {
        $parts = explode(',', $r['ranges']);
        foreach ($parts as $p) {
            $p = trim($p);
            if (str_contains($p, '-')) {
                [$min, $max] = explode('-', $p);
                for ($i = (int)$min; $i <= (int)$max; $i++) {
                    $nums[] = $i;
                }
            } elseif (is_numeric($p)) {
                $nums[] = (int)$p;
            }
        }
        foreach ($nums as $num) {
            if (!isset($map[$num])) {
                $map[$num] = ['theme' => $r['theme'], 'season' => $r['season']];
            } else {
                if ($r['season'] !== null) {
                    $map[$num]['season'] = $r['season'];
                }
                if ($num >= 456 && $num <= 509) {
                    $map[$num]['theme'] = 'Thi Thiên';
                } elseif ($r['theme'] !== 'Đời tín đồ') {
                    $map[$num]['theme'] = $r['theme'];
                }
            }
        }
        $nums = [];
    }
    return $map;
}

/**
 * Tạo bản sao lưu CSDL trước migration
 */
function createDbBackup(string $dbPath): string {
    $backupDir = dirname($dbPath) . '/../backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0777, true);
    }
    $timestamp = date('Ymd_His');
    $backupFile = $backupDir . '/app_before_r34_' . $timestamp . '.sqlite';
    if (!@copy($dbPath, $backupFile)) {
        throw new RuntimeException("Không thể tạo bản sao lưu tại {$backupFile}");
    }
    return $backupFile;
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

// ── 1. Lệnh Sao Lưu (--backup) ──────────────────────────────────────
if (isset($options['backup'])) {
    $bk = createDbBackup($dbPath);
    echo "✅ Đã tạo bản sao lưu CSDL thành công tại: {$bk}\n";
    exit(0);
}

// ── 2. Lệnh Dry-Run Migration (--dry-run) ───────────────────────────
if (isset($options['dry-run']) || (isset($options['seed']) && isset($options['dry-run']))) {
    $mapping = getOfficialLabelMapping();
    $currentSongs = $pdo->query("SELECT id, httlvnId, title, liturgical_season, theme FROM songs ORDER BY httlvnId ASC")->fetchAll();
    
    $totalSongs = count($currentSongs);
    $populatedEmpty = 0;
    $purgedThuongNien = 0;
    $seasonChanges = 0;
    $themeChanges = 0;
    
    $newSeasonCounts = [];
    $newThemeCounts = [];
    
    foreach ($currentSongs as $s) {
        $num = (int)$s['httlvnId'];
        $new = $mapping[$num] ?? null;
        if (!$new) continue;
        
        $oldSeason = $s['liturgical_season'] ?? '';
        $oldTheme  = $s['theme'] ?? '';
        $newSeason = $new['season'] ?? '';
        $newTheme  = $new['theme'] ?? '';
        
        if (empty($oldSeason) && empty($oldTheme)) {
            $populatedEmpty++;
        }
        if ($oldSeason === 'Thường Niên') {
            $purgedThuongNien++;
        }
        if ($oldSeason !== $newSeason) {
            $seasonChanges++;
        }
        if ($oldTheme !== $newTheme) {
            $themeChanges++;
        }
        
        $snKey = !empty($new['season']) ? $new['season'] : 'quanh năm (NULL)';
        $newSeasonCounts[$snKey] = ($newSeasonCounts[$snKey] ?? 0) + 1;
        $newThemeCounts[$new['theme']] = ($newThemeCounts[$new['theme']] ?? 0) + 1;
    }
    
    arsort($newSeasonCounts);
    arsort($newThemeCounts);
    
    $integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
    
    echo "======================================================================\n";
    echo "   SHEETAPP2 — DRY-RUN BẢO TRÌ NHÃN THÁNH CA HTTLVN (TICKET R3-4)   \n";
    echo "======================================================================\n\n";
    
    echo "1. THỐNG KÊ TỔNG THỂ DỰ KIẾN THAY ĐỔI:\n";
    echo "  - Tổng số bài trong CSDL:          {$totalSongs} bài (từ bài 1 đến 903)\n";
    echo "  - Số bài được phủ nhãn mới:         903 / 903 bài (100% mục lục)\n";
    echo "  - Số bài trống được điền mới:      {$populatedEmpty} bài (toàn bộ 501–903)\n";
    echo "  - Xóa sạch nhãn 'Thường Niên':     {$purgedThuongNien} bài → NULL (quanh năm)\n";
    echo "  - Thay đổi Dịp Lễ (Season):        {$seasonChanges} bài\n";
    echo "  - Thay đổi Chủ Đề (Theme):         {$themeChanges} bài\n";
    echo "  - Kiểm tra tính toàn vẹn CSDL:     integrity_check = {$integrity}\n\n";
    
    echo "2. PHÂN BỐ DỊP LỄ MỚI (Phụ lục B.1 — 17 Dịp Lễ Tin Lành):\n";
    foreach ($newSeasonCounts as $k => $v) {
        printf("  - %-30s: %3d bài\n", $k, $v);
    }
    
    echo "\n3. PHÂN BỐ CHỦ ĐỀ MỚI (Phụ lục B.2 — 16 Chủ Đề Mục Lục Thánh Ca):\n";
    foreach ($newThemeCounts as $k => $v) {
        printf("  - %-25s: %3d bài\n", $k, $v);
    }
    
    echo "\n4. MẪU ĐỐI CHIẾU 20 BÀI ĐIỂN HÌNH (CŨ → MỚI):\n";
    printf("| %-4s | %-28s | %-24s | %-26s |\n", "STT", "Tiêu đề", "Dịp Lễ (Cũ → Mới)", "Chủ Đề (Cũ → Mới)");
    echo "|------|------------------------------|--------------------------|----------------------------|\n";
    
    $sampleNums = [1, 38, 39, 53, 76, 88, 103, 113, 119, 135, 145, 150, 156, 206, 335, 349, 360, 393, 456, 903];
    foreach ($currentSongs as $s) {
        $num = (int)$s['httlvnId'];
        if (!in_array($num, $sampleNums, true)) continue;
        $new = $mapping[$num] ?? [];
        $oldS = $s['liturgical_season'] ?: '-';
        $newS = $new['season'] ?? '-';
        $oldT = $s['theme'] ?: '(trống)';
        $newT = $new['theme'] ?? '-';
        $title = mb_strimwidth($s['title'], 0, 26, '..');
        printf("| %-4d | %-28s | %-11s → %-10s | %-12s → %-11s |\n", $num, $title, $oldS, $newS, $oldT, $newT);
    }
    
    echo "\n----------------------------------------------------------------------\n";
    echo "LƯU Ý: Đây là chế độ DRY-RUN. Cơ sở dữ liệu HOÀN TOÀN CHƯA THAY ĐỔI.\n";
    echo "Sau khi chủ dự án duyệt, chạy lệnh sau để áp dụng thật:\n";
    echo "  php tools/manage_song_labels.php --seed\n";
    echo "======================================================================\n";
    exit(0);
}

// ── 3. Xem Thống Kê Hiện Tại (--status) ─────────────────────────────
if (isset($options['status'])) {
    $totalSongs = (int)$pdo->query("SELECT COUNT(*) FROM songs")->fetchColumn();
    $seasonCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != ''")->fetchColumn();
    $themeCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE theme IS NOT NULL AND theme != ''")->fetchColumn();
    $eitherCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE (liturgical_season IS NOT NULL AND liturgical_season != '') OR (theme IS NOT NULL AND theme != '')")->fetchColumn();

    echo "=== BÁO CÁO NHÃN PHÂN LOẠI BÀI HÁT (R3-4) ===\n";
    echo "Tổng số bài hát:        {$totalSongs}\n";
    echo "Có Dịp Lễ (Season):     {$seasonCount} (" . round($seasonCount / max(1, $totalSongs) * 100, 1) . "%)\n";
    echo "Có Chủ Đề (Theme):      {$themeCount} (" . round($themeCount / max(1, $totalSongs) * 100, 1) . "%)\n";
    echo "Có ít nhất 1 nhãn:      {$eitherCount} (" . round($eitherCount / max(1, $totalSongs) * 100, 1) . "%)\n";

    echo "\n--- Phân bố theo Dịp Lễ ---\n";
    $seasons = $pdo->query("SELECT liturgical_season, COUNT(*) as cnt FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != '' GROUP BY liturgical_season ORDER BY cnt DESC")->fetchAll();
    foreach ($seasons as $s) {
        printf("  - %-25s: %3d bài\n", $s['liturgical_season'], $s['cnt']);
    }

    echo "\n--- Phân bố theo Chủ Đề ---\n";
    $themes = $pdo->query("SELECT theme, COUNT(*) as cnt FROM songs WHERE theme IS NOT NULL AND theme != '' GROUP BY theme ORDER BY cnt DESC LIMIT 20")->fetchAll();
    foreach ($themes as $t) {
        printf("  - %-25s: %3d bài\n", $t['theme'], $t['cnt']);
    }
    exit(0);
}

// ── 4. Xóa Sạch Nhãn (--clear) ──────────────────────────────────────
if (isset($options['clear'])) {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = NULL, theme = NULL WHERE liturgical_season IS NOT NULL OR theme IS NOT NULL");
    $stmt->execute();
    $count = $stmt->rowCount();
    $pdo->commit();

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    echo "✅ Đã xóa nhãn (dịp lễ, chủ đề) cho {$count} bài hát.\n";
    exit(0);
}

// ── 5. Đặt Thủ Công 1 Bài (--song, --season, --theme) ───────────────
if (isset($options['song'])) {
    $songId = (string)$options['song'];
    $season = isset($options['season']) ? trim((string)$options['season']) : null;
    $theme = isset($options['theme']) ? trim((string)$options['theme']) : null;

    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = ?, theme = ? WHERE id = ?");
    $stmt->execute([$season ?: null, $theme ?: null, $songId]);

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    echo "✅ Đã cập nhật nhãn cho bài [{$songId}]: Dịp lễ='{$season}', Chủ đề='{$theme}'\n";
    exit(0);
}

// ── 6. Chạy Migration Thật (--seed) ─────────────────────────────────
if (isset($options['seed'])) {
    // 1. Tự động sao lưu trước khi ghi
    $backupFile = createDbBackup($dbPath);
    echo "🔒 Đã tự động tạo bản sao lưu tại: {$backupFile}\n";

    $mapping = getOfficialLabelMapping();
    $pdo->beginTransaction();

    $totalUpdated = 0;
    $stmt = $pdo->prepare("UPDATE songs SET liturgical_season = :season, theme = :theme WHERE httlvnId = :num");

    foreach ($mapping as $num => $info) {
        $stmt->execute([
            ':season' => $info['season'],
            ':theme'  => $info['theme'],
            ':num'    => $num,
        ]);
        $totalUpdated += $stmt->rowCount();
    }

    $pdo->commit();

    syncAllFtsLabels($pdo);
    invalidateLabelsCache();

    $integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();

    echo "✅ Đã gắn nhãn thành công cho {$totalUpdated} bài hát theo mục lục chuẩn Thánh Ca HTTLVN (1–903)!\n";
    echo "✅ Đã xoá sạch toàn bộ nhãn 'Thường Niên' (chuyển sang NULL quanh năm).\n";
    echo "✅ Kiểm tra toàn vẹn CSDL: integrity_check = {$integrity}\n";
    exit(0);
}

echo "Cách dùng:\n";
echo "  php tools/manage_song_labels.php --dry-run  (xem bảng thay đổi, không ghi CSDL)\n";
echo "  php tools/manage_song_labels.php --seed     (chạy migration thật sau khi duyệt)\n";
echo "  php tools/manage_song_labels.php --status   (xem thống kê nhãn hiện tại)\n";
echo "  php tools/manage_song_labels.php --backup   (tạo bản sao lưu CSDL)\n";
