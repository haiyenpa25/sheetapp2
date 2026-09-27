<?php
/**
 * tools/index_lyrics.php
 * Trích xuất lời bài hát theo từng khổ đúng chuẩn (L6-1, L2-6)
 * Ghép âm tiết syllabic, tách khổ, lưu vào cột lyrics_text và đồng bộ FTS5
 * Chạy CLI: php tools/index_lyrics.php
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';

$pdo = DB::get();

// Thêm cột lyrics_text nếu chưa có
try {
    $pdo->exec("ALTER TABLE songs ADD COLUMN lyrics_text TEXT DEFAULT ''");
    echo "Added lyrics_text column\n";
} catch (Exception $e) {
    // Cột đã tồn tại
}

$songs = $pdo->query("SELECT id, xmlPath FROM songs WHERE xmlPath != ''")->fetchAll(PDO::FETCH_ASSOC);
$total = count($songs);
$done = 0;
$failed = 0;

$updateStmt = $pdo->prepare("UPDATE songs SET lyrics_text = ? WHERE id = ?");

echo "Bắt đầu trích xuất lời chuẩn theo khổ cho {$total} bài hát...\n";
$startTime = microtime(true);

foreach ($songs as $song) {
    $path = __DIR__ . '/../' . $song['xmlPath'];
    if (!file_exists($path)) {
        $failed++;
        continue;
    }

    try {
        $xmlContent = @file_get_contents($path);
        if (!$xmlContent) {
            $failed++;
            continue;
        }

        $lyricsText = SongSearchHelper::extractLyricsByVerse($xmlContent);
        $updateStmt->execute([$lyricsText, $song['id']]);
        SongSearchHelper::syncSongFts($song['id']);
        $done++;

        if ($done % 100 === 0 || $done === $total) {
            $elapsed = round(microtime(true) - $startTime, 1);
            echo "Tiến độ: {$done}/{$total} bài ({$elapsed}s)\n";
            flush();
        }
    } catch (Exception $e) {
        $failed++;
    }
}

// Xóa file cache nếu có để làm mới dữ liệu
$cacheFile = __DIR__ . '/../storage/data/songs_cache.json';
if (file_exists($cacheFile)) {
    @unlink($cacheFile);
    echo "Đã làm mới cache songs_cache.json\n";
}

$totalElapsed = round(microtime(true) - $startTime, 2);
echo "\n✅ Hoàn tất! Đã trích xuất và index: {$done}, Thất bại: {$failed}, Tổng cộng: {$total} trong {$totalElapsed}s\n";
