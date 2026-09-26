<?php
/**
 * tools/index_lyrics.php
 * Đọc tất cả file XML, extract lời bài hát → lưu vào cột lyrics_text trong DB
 * Chạy 1 lần: php tools/index_lyrics.php
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../api/core/DB.php';
$pdo = DB::get();

// Thêm cột lyrics_text nếu chưa có
try {
    $pdo->exec("ALTER TABLE songs ADD COLUMN lyrics_text TEXT DEFAULT ''");
    echo "Added lyrics_text column\n";
} catch (Exception $e) {
    echo "Column already exists or error: " . $e->getMessage() . "\n";
}

$songs = $pdo->query("SELECT id, xmlPath FROM songs WHERE xmlPath != ''")->fetchAll(PDO::FETCH_ASSOC);
$total = count($songs);
$done = 0;
$failed = 0;

$updateStmt = $pdo->prepare("UPDATE songs SET lyrics_text = ? WHERE id = ?");

foreach ($songs as $song) {
    $path = __DIR__ . '/../' . $song['xmlPath'];
    if (!file_exists($path)) {
        $failed++;
        continue;
    }

    try {
        $xml = @simplexml_load_file($path);
        if (!$xml) { $failed++; continue; }

        $lyrics = [];
        // Extract tất cả <text> trong <lyric>
        foreach ($xml->xpath('//lyric/text') as $textNode) {
            $text = trim((string)$textNode);
            if ($text !== '') $lyrics[] = $text;
        }

        $lyricsText = implode(' ', array_unique($lyrics));
        $updateStmt->execute([$lyricsText, $song['id']]);
        $done++;

        if ($done % 100 === 0) {
            echo "Progress: $done/$total\n";
            flush();
        }
    } catch (Exception $e) {
        $failed++;
    }
}

echo "\n✅ Done! Indexed: $done, Failed: $failed, Total: $total\n";
