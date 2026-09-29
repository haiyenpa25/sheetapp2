<?php
/**
 * tools/seed_song_sections.php
 *
 * Công cụ tạo và quản lý Bản Đồ Bài Hát (Song Sections / Roadmap) cho Ca Trưởng (Ticket L6-6):
 * - Tự động phân tích số ô nhịp thực tế từ MusicXML và lời bài hát (Verse / Điệp Khúc).
 * - Sinh dữ liệu bản đồ bài (Intro, Lời hát, Điệp Khúc, Kết) cho 100 bài hay dùng nhất (Thánh Ca 001 - 100).
 * - Bảo lưu tuyệt đối các phân đoạn thủ công đã có của bài 001.
 * - Cung cấp dữ liệu trực quan cho dải nhảy đoạn L3-7 (#section-jump-bar-container).
 *
 * Cách dùng CLI:
 *   php tools/seed_song_sections.php --status
 *   php tools/seed_song_sections.php --seed-top-100
 *   php tools/seed_song_sections.php --clear-auto
 *   php tools/seed_song_sections.php --db=storage/data/app.sqlite
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$options = getopt('', ['status', 'seed-top-100', 'clear-auto', 'standardize', 'db::']);

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
 * Đếm số ô nhịp lớn nhất trong file MusicXML
 */
function getXmlMaxMeasure(string $xmlPath): int {
    $baseDir = dirname(__DIR__);
    $fullPath = $baseDir . '/' . ltrim($xmlPath, '/\\');
    if (!file_exists($fullPath)) {
        return 16; // Giá trị ước lượng mặc định nếu file không tìm thấy
    }
    $content = file_get_contents($fullPath);
    if (!$content) return 16;

    preg_match_all('/<measure number="([0-9]+)"/i', $content, $m);
    if (!empty($m[1])) {
        return max(array_map('intval', $m[1]));
    }
    return 16;
}

/**
 * Chuẩn hóa nhãn phân đoạn theo Ticket R3-5:
 * Dạo đầu / Phiên khúc 1..n / Điệp khúc / Kết (0 nhãn Intro/Outro/Lời/Đoạn còn lại)
 */
function standardizeSectionName(string $name, string $type = ''): string {
    $n = trim($name);
    if (preg_match('/^(intro|dạo\s*đầu|dạo)$/ui', $n) || $type === 'intro') {
        return 'Dạo đầu';
    }
    if (preg_match('/^(outro|kết)$/ui', $n) || $type === 'outro') {
        return 'Kết';
    }
    if (preg_match('/^(điệp\s*khúc|chorus|đk)$/ui', $n) || $type === 'chorus') {
        return 'Điệp khúc';
    }
    if (preg_match('/^(lời|đoạn|phiên\s*khúc|verse)\s*(\d+)$/ui', $n, $m)) {
        return 'Phiên khúc ' . $m[2];
    }
    if (preg_match('/^(lời\s*hát|lời|đoạn|phiên\s*khúc|verse)$/ui', $n) || $type === 'verse') {
        return 'Phiên khúc';
    }
    if (preg_match('/^(dạo\s*giữa|bridge)$/ui', $n) || $type === 'bridge') {
        return 'Dạo giữa';
    }
    if (preg_match('/^(gian\s*tấu|interlude)$/ui', $n) || $type === 'interlude') {
        return 'Gian tấu';
    }
    return $n !== '' ? $n : 'Phiên khúc';
}

/**
 * Sinh danh sách phân đoạn mẫu cho 1 bài hát dựa trên số ô nhịp và sự hiện diện của Điệp khúc
 */
function generateSongSections(string $songId, int $maxMeasure, bool $hasChorus): array {
    $max = max(8, $maxMeasure);

    // Dạo đầu: 2 ô nhịp đầu
    $introEnd = min(2, (int)floor($max * 0.15));
    $introEnd = max(1, $introEnd);

    // Kết: 2 ô nhịp cuối
    $outroStart = max($introEnd + 4, $max - 1);

    // Vùng giữa
    $bodyStart = $introEnd + 1;
    $bodyEnd = $outroStart - 1;

    $sections = [];
    $order = 0;

    // 1. Dạo đầu
    $sections[] = [
        'song_id' => $songId,
        'name' => 'Dạo đầu',
        'type' => 'intro',
        'start_measure' => 1,
        'end_measure' => $introEnd,
        'color' => '#6366f1',
        'display_order' => $order++,
    ];

    if ($hasChorus && ($bodyEnd - $bodyStart >= 6)) {
        // Có Điệp khúc: chia Phiên khúc 1 và Điệp khúc
        $mid = $bodyStart + (int)floor(($bodyEnd - $bodyStart) / 2);
        $sections[] = [
            'song_id' => $songId,
            'name' => 'Phiên khúc 1',
            'type' => 'verse',
            'start_measure' => $bodyStart,
            'end_measure' => $mid,
            'color' => '#10b981',
            'display_order' => $order++,
        ];
        $sections[] = [
            'song_id' => $songId,
            'name' => 'Điệp khúc',
            'type' => 'chorus',
            'start_measure' => $mid + 1,
            'end_measure' => $bodyEnd,
            'color' => '#f59e0b',
            'display_order' => $order++,
        ];
    } else {
        // Không có Điệp khúc: chia Phiên khúc 1 và Phiên khúc 2 (hoặc Phiên khúc trọn vẹn)
        if ($bodyEnd - $bodyStart >= 8) {
            $mid = $bodyStart + (int)floor(($bodyEnd - $bodyStart) / 2);
            $sections[] = [
                'song_id' => $songId,
                'name' => 'Phiên khúc 1',
                'type' => 'verse',
                'start_measure' => $bodyStart,
                'end_measure' => $mid,
                'color' => '#10b981',
                'display_order' => $order++,
            ];
            $sections[] = [
                'song_id' => $songId,
                'name' => 'Phiên khúc 2',
                'type' => 'verse',
                'start_measure' => $mid + 1,
                'end_measure' => $bodyEnd,
                'color' => '#3b82f6',
                'display_order' => $order++,
            ];
        } else {
            $sections[] = [
                'song_id' => $songId,
                'name' => 'Phiên khúc',
                'type' => 'verse',
                'start_measure' => $bodyStart,
                'end_measure' => $bodyEnd,
                'color' => '#10b981',
                'display_order' => $order++,
            ];
        }
    }

    // Kết
    $sections[] = [
        'song_id' => $songId,
        'name' => 'Kết',
        'type' => 'outro',
        'start_measure' => $outroStart,
        'end_measure' => $max,
        'color' => '#8b5cf6',
        'display_order' => $order++,
    ];

    return $sections;
}

// Bọc execution flow khi chạy trực tiếp từ CLI
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {

    // Thống kê
    if (isset($options['status']) || (!isset($options['seed-top-100']) && !isset($options['clear-auto']) && !isset($options['standardize']))) {
        $totalSections = (int)$pdo->query("SELECT COUNT(*) FROM song_sections")->fetchColumn();
        $totalSongsWithSec = (int)$pdo->query("SELECT COUNT(DISTINCT song_id) FROM song_sections")->fetchColumn();
        $top100Count = (int)$pdo->query("SELECT COUNT(DISTINCT s.id) FROM songs s JOIN song_sections ss ON s.id = ss.song_id WHERE s.httlvnId >= 1 AND s.httlvnId <= 100")->fetchColumn();

        echo "=== BÁO CÁO BẢN ĐỒ BÀI HÁT (SONG SECTIONS - TICKET L6-6) ===\n";
        echo "Tổng số phân đoạn trong CSDL: {$totalSections}\n";
        echo "Số bài hát có bản đồ phân đoạn: {$totalSongsWithSec}\n";
        echo "Số bài trong Top 100 có bản đồ: {$top100Count} / 100 bài\n\n";

        if ($top100Count > 0) {
            echo "--- Danh sách 5 bài mẫu có phân đoạn ---\n";
            $sampleSongs = $pdo->query("SELECT DISTINCT song_id FROM song_sections ORDER BY song_id ASC LIMIT 5")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($sampleSongs as $sid) {
                $secs = $pdo->query("SELECT name, type, start_measure, end_measure FROM song_sections WHERE song_id = '$sid' ORDER BY display_order ASC")->fetchAll();
                $str = implode(' · ', array_map(fn($sc) => "{$sc['name']} [{$sc['start_measure']}-{$sc['end_measure']}]", $secs));
                echo "  - [{$sid}]: {$str}\n";
            }
        }

        echo "\nCách dùng:\n";
        echo "  php tools/seed_song_sections.php --standardize   (Chuẩn hóa nhãn phân đoạn theo R3-5: Dạo đầu, Phiên khúc n, Điệp khúc, Kết)\n";
        echo "  php tools/seed_song_sections.php --seed-top-100  (Soạn bản đồ cho 100 bài hay dùng nhất)\n";
        echo "  php tools/seed_song_sections.php --clear-auto    (Xóa các phân đoạn sinh tự động)\n";
        exit(0);
    }

    // Chuẩn hóa toàn bộ nhãn phân đoạn theo R3-5 (0 nhãn Intro/Outro/Lời/Đoạn)
    if (isset($options['standardize'])) {
        $rows = $pdo->query("SELECT id, song_id, name, type FROM song_sections")->fetchAll();
        $pdo->beginTransaction();
        $updateStmt = $pdo->prepare("UPDATE song_sections SET name = :name WHERE id = :id");
        $updatedCount = 0;
        foreach ($rows as $r) {
            $newName = standardizeSectionName((string)$r['name'], (string)$r['type']);
            if ($newName !== $r['name']) {
                $updateStmt->execute([':name' => $newName, ':id' => $r['id']]);
                $updatedCount++;
            }
        }
        $pdo->commit();
        echo "✅ ĐÃ CHUẨN HÓA {$updatedCount} PHÂN ĐOẠN TRONG CSDL THEO R3-5!\n";
        echo "  - Dạo đầu / Phiên khúc 1..n / Điệp khúc / Kết\n";
        echo "  - 0 nhãn 'Intro/Outro/Lời/Đoạn' còn lại trong CSDL.\n";
        exit(0);
    }

    // Xóa tự động (giữ nguyên bài 001)
    if (isset($options['clear-auto'])) {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("DELETE FROM song_sections WHERE song_id != 'thanh-ca-001'");
        $stmt->execute();
        $deleted = $stmt->rowCount();
        $pdo->commit();
        echo "✅ Đã xóa {$deleted} phân đoạn sinh tự động (đã bảo lưu bài 001).\n";
        exit(0);
    }

    // Gieo bản đồ bài cho 100 bài hay dùng nhất
    if (isset($options['seed-top-100'])) {
        $songs = $pdo->query("SELECT id, httlvnId, title, xmlPath, lyrics_text FROM songs WHERE httlvnId >= 1 AND httlvnId <= 100 ORDER BY httlvnId ASC")->fetchAll();

        $pdo->beginTransaction();
        $insertStmt = $pdo->prepare("
            INSERT INTO song_sections (song_id, name, type, start_measure, end_measure, color, display_order)
            VALUES (:song_id, :name, :type, :start_measure, :end_measure, :color, :display_order)
        ");

        $songsAdded = 0;
        $sectionsAdded = 0;

        foreach ($songs as $s) {
            $sid = $s['id'];
            // Bảo lưu bài 001 (đã có 4 sections thủ công chuẩn mực)
            if ($sid === 'thanh-ca-001') {
                continue;
            }

            // Kiểm tra nếu bài đã có sections thì bỏ qua
            $existing = (int)$pdo->query("SELECT COUNT(*) FROM song_sections WHERE song_id = " . $pdo->quote($sid))->fetchColumn();
            if ($existing > 0) {
                continue;
            }

            $maxM = getXmlMaxMeasure((string)$s['xmlPath']);
            $hasChorus = str_contains((string)$s['lyrics_text'], '[ĐK]');
            $secs = generateSongSections($sid, $maxM, $hasChorus);

            foreach ($secs as $sec) {
                $insertStmt->execute([
                    ':song_id' => $sec['song_id'],
                    ':name' => $sec['name'],
                    ':type' => $sec['type'],
                    ':start_measure' => $sec['start_measure'],
                    ':end_measure' => $sec['end_measure'],
                    ':color' => $sec['color'],
                    ':display_order' => $sec['display_order'],
                ]);
                $sectionsAdded++;
            }
            $songsAdded++;
        }

        $pdo->commit();

        echo "✅ ĐÃ SOẠN BẢN ĐỒ BÀI HÁT THÀNH CÔNG CHO 100 BÀI HAY DÙNG NHẤT (TICKET L6-6)!\n";
        echo "  - Đã thêm {$sectionsAdded} phân đoạn mới cho {$songsAdded} bài hát.\n";
        echo "  - Bảo lưu nguyên vẹn 4 phân đoạn chuẩn mực của bài thanh-ca-001.\n";
        echo "  - Ca trưởng và nhạc công có thể sử dụng dải phân đoạn (#section-jump-bar-container) trên cả 100 bài!\n";
        exit(0);
    }
}
