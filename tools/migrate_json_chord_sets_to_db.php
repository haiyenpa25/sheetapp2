<?php
/**
 * tools/migrate_json_chord_sets_to_db.php
 *
 * Công cụ Migration và Đối soát (Reconciliation) Hợp Nhất Bộ Hợp Âm:
 * Chuyển giao toàn bộ 903+ bộ hợp âm từ file JSON vào CSDL SQLite (bảng user_chord_sets).
 *
 * Cách sử dụng:
 *   php tools/migrate_json_chord_sets_to_db.php --reconcile   (Chỉ đối soát, không ghi)
 *   php tools/migrate_json_chord_sets_to_db.php --dry-run     (Chạy thử nghiệm trong transaction rồi rollback)
 *   php tools/migrate_json_chord_sets_to_db.php --execute     (Thực thi migration chính thức vào DB)
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Lỗi: Script này chỉ được phép chạy từ dòng lệnh (CLI).\n";
    exit(1);
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/MigrationRunner.php';

$mode = 'reconcile';
foreach ($argv as $arg) {
    if ($arg === '--execute') $mode = 'execute';
    if ($arg === '--dry-run') $mode = 'dry-run';
    if ($arg === '--reconcile') $mode = 'reconcile';
}

echo "========================================================\n";
echo "   SheetApp2 — Công Cụ Hợp Nhất Bộ Hợp Âm JSON -> DB    \n";
echo "   Chế độ: " . strtoupper($mode) . "\n";
echo "========================================================\n\n";

$pdo = DB::get();

// Chạy migration 004 nếu bảng chưa có các cột mới
$runner = new MigrationRunner($pdo);
$runner->migrate();

// Lấy danh sách users trong DB để map
$usersStmt = $pdo->query("SELECT id, username, display_name FROM users");
$users = [];
while ($u = $usersStmt->fetch(PDO::FETCH_ASSOC)) {
    $users[strtolower($u['username'])] = $u;
}

$hoaidinhId = $users['hoaidinh']['id'] ?? ($users['admin']['id'] ?? 1);
$adminId    = $users['admin']['id'] ?? 1;
$banhatId   = $users['banhat']['id'] ?? 1;

$chordDir = __DIR__ . '/../storage/data/chord_sets';
if (!is_dir($chordDir)) {
    fwrite(STDERR, "Lỗi: Thư mục {$chordDir} không tồn tại!\n");
    exit(1);
}

$songFolders = glob($chordDir . '/*') ?: [];
$totalFolders = count($songFolders);

echo "Đang quét dữ liệu từ {$totalFolders} thư mục bài hát...\n";

$scannedFiles = 0;
$inserted = 0;
$updated = 0;
$skipped = 0;
$emptyChords = 0;
$hdSetsCount = 0;

if ($mode === 'dry-run') {
    $pdo->beginTransaction();
}

$checkStmt = $pdo->prepare("SELECT id, checksum, chord_count FROM user_chord_sets WHERE song_id = ? AND set_name = ?");
$insertStmt = $pdo->prepare("
    INSERT INTO user_chord_sets 
    (song_id, user_id, username, set_name, instrument_type, capo_fret, custom_tempo, chord_count, notes_guide, chords_json, checksum, attribution, is_public, is_recommended, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'guitar', 0, 80, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
");
$updateStmt = $pdo->prepare("
    UPDATE user_chord_sets 
    SET chords_json = ?, chord_count = ?, checksum = ?, attribution = ?, is_recommended = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
");

foreach ($songFolders as $folder) {
    if (!is_dir($folder)) continue;
    $songId = basename($folder);

    $jsonFiles = glob($folder . '/*.json') ?: [];
    foreach ($jsonFiles as $file) {
        $scannedFiles++;
        $setName = pathinfo($file, PATHINFO_FILENAME);
        $rawContent = file_get_contents($file);
        $chords = json_decode($rawContent, true);

        if (!is_array($chords)) {
            $chords = [];
        }

        $chordCount = count($chords);
        if ($chordCount === 0) {
            $emptyChords++;
        }

        $checksum = md5(json_encode($chords));
        $chordsJson = json_encode($chords, JSON_UNESCAPED_UNICODE);

        // Xác định user & attribution
        $userId = $banhatId;
        $username = 'banhat';
        $attribution = null;
        $isRecommended = 0;
        $notesGuide = 'Bản phối hợp âm';

        if (strcasecmp($setName, 'HD') === 0) {
            $hdSetsCount++;
            $userId = $hoaidinhId;
            $username = 'hoaidinh';
            $attribution = 'Bản phối chuẩn HD của Hoài Dinh';
            $isRecommended = 1;
            $notesGuide = 'Bộ hợp âm chuẩn của Hoài Dinh (mặc định)';
        } elseif (strcasecmp($setName, 'ADMIN') === 0) {
            $userId = $adminId;
            $username = 'admin';
            $attribution = 'Bản phối quản trị của Admin';
            $isRecommended = 0;
        } elseif (str_contains($setName, '__')) {
            // Dạng forked: username__setName
            $parts = explode('__', $setName, 2);
            $parsedUser = strtolower($parts[0]);
            $parsedSet = $parts[1] ?? 'Custom';
            $userId = $users[$parsedUser]['id'] ?? $banhatId;
            $username = $users[$parsedUser]['username'] ?? 'banhat';
            $attribution = "Bản fork tùy chỉnh của @{$username}";
        }

        // Kiểm tra xem đã có trong DB chưa
        $checkStmt->execute([$songId, $setName]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if ($existing['checksum'] !== $checksum || (int)$existing['chord_count'] !== $chordCount) {
                if ($mode === 'execute' || $mode === 'dry-run') {
                    $updateStmt->execute([$chordsJson, $chordCount, $checksum, $attribution, $isRecommended, $existing['id']]);
                }
                $updated++;
            } else {
                $skipped++;
            }
        } else {
            if ($mode === 'execute' || $mode === 'dry-run') {
                $insertStmt->execute([$songId, $userId, $username, $setName, $chordCount, $notesGuide, $chordsJson, $checksum, $attribution, $isRecommended]);
            }
            $inserted++;
        }
    }
}

if ($mode === 'dry-run') {
    $pdo->rollBack();
    echo ">> [DRY-RUN]: Đã rollback toàn bộ thay đổi thử nghiệm thành công.\n\n";
}

echo "--------------------------------------------------------\n";
echo "BÁO CÁO ĐỐI SOÁT VÀ MIGRATION BỘ HỢP ÂM:\n";
echo "  - Tổng số bài hát đã quét:    {$totalFolders} bài\n";
echo "  - Tổng số file JSON đã nạp:   {$scannedFiles} file\n";
echo "  - Số bộ hợp âm chuẩn HD:      {$hdSetsCount} / 903 bài\n";
echo "  - Số bộ có hợp âm thực tế:    " . ($scannedFiles - $emptyChords) . " file\n";
echo "  - Thêm mới vào SQLite:         {$inserted} bản ghi\n";
echo "  - Cập nhật thay đổi:           {$updated} bản ghi\n";
echo "  - Đã khớp không cần đổi:       {$skipped} bản ghi\n";
echo "--------------------------------------------------------\n";

if ($mode === 'execute') {
    $dbTotal = (int)$pdo->query("SELECT COUNT(*) FROM user_chord_sets")->fetchColumn();
    $dbHd = (int)$pdo->query("SELECT COUNT(*) FROM user_chord_sets WHERE set_name = 'HD'")->fetchColumn();
    echo "Trạng thái CSDL sau migration:\n";
    echo "  - Tổng số bản ghi user_chord_sets: {$dbTotal}\n";
    echo "  - Tổng số bản ghi set HD:          {$dbHd}\n";
    if ($dbHd === 903) {
        echo "  - Đối soát Core Rule 1:             ✅ ĐẠT (Đủ 903/903 bản phối HD trong CSDL)\n";
    } else {
        echo "  - Đối soát Core Rule 1:             ⚠️ Chưa đủ 903 bộ HD ({$dbHd}/903)\n";
    }
}

echo "\nHoàn tất.\n";
