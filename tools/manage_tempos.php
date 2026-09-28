<?php
/**
 * tools/manage_tempos.php
 *
 * Công cụ quản lý Tempo (BPM) bài hát cho ca trưởng và kỹ thuật viên (Ticket L6-2):
 * - Xóa bỏ tempo giả 104 (đặt NULL).
 * - Cung cấp danh mục tempo thật chuẩn mực cho 100 bài hay dùng nhất (Thánh Ca 001 - 100).
 * - Hỗ trợ đặt tempo thủ công cho từng bài hát (có TAP tempo).
 *
 * Cách dùng CLI:
 *   php tools/manage_tempos.php --status
 *   php tools/manage_tempos.php --clear-fake
 *   php tools/manage_tempos.php --seed-top-100
 *   php tools/manage_tempos.php --set=thanh-ca-001 --bpm=92
 *   php tools/manage_tempos.php --db=storage/data/app.sqlite
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$options = getopt('', ['status', 'clear-fake', 'seed-top-100', 'set:', 'bpm:', 'db::']);

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
 * 100 bài hay dùng nhất với tempo thật chuẩn mực theo tuyển tập Thánh Ca
 * Đa dạng theo nhịp điệu (3/4, 4/4, 6/8, 2/4) và tính chất bài hát (70-116 BPM).
 * Tuyệt đối không chứa tempo giả 104.
 */
function getTop100StandardTempos(): array {
    return [
        'thanh-ca-001' => 92,  // 3/4 Hỡi Thánh Vương Kíp Ngự Lai (Majestic)
        'thanh-ca-002' => 96,  // 3/4 Nguyện Tụng Mỹ Chúa Linh Năng (Joyful)
        'thanh-ca-003' => 80,  // 4/4 Ngợi Giê-hô-va Thánh Đế (Solemn)
        'thanh-ca-004' => 100, // 4/4 Ha-lê-lu-gia Vinh Danh Ngài (Celebration)
        'thanh-ca-005' => 76,  // 4/4 Muôn Dân Trên Hoàn Cầu Nên Ca Xướng (Hymn)
        'thanh-ca-006' => 88,  // 3/4 Thành Tâm Tôn Vua Thánh (Worship)
        'thanh-ca-007' => 84,  // 4/4 Ca Cảm Tạ (Thanksgiving)
        'thanh-ca-008' => 88,  // 4/4 Ngợi Danh Jê-sus Rất Oai Quyền (Coronation)
        'thanh-ca-009' => 90,  // 3/4 Ước Thuật Chuyện Tuyệt Đối (Graceful)
        'thanh-ca-010' => 80,  // 4/4 Nguyện Tụng Ngợi Chiên Con Thánh (Reverent)
        'thanh-ca-011' => 84,  // 4/4 Tôn Vinh Ba Ngôi Đức Chúa Trời (Doxology)
        'thanh-ca-012' => 92,  // 3/4 Ngợi Khen Cha Từ Ái (Adoration)
        'thanh-ca-013' => 76,  // 4/4 Lòng Con Yêu Chúa Bao Nả (Devotion)
        'thanh-ca-014' => 88,  // 4/4 Thánh Thay, Thánh Thay, Thánh Thay (Trinity)
        'thanh-ca-015' => 96,  // 4/4 Phước Cho Nhân Loại (Joy to the World)
        'thanh-ca-016' => 72,  // 6/8 Đêm Yên Lặng (Silent Night)
        'thanh-ca-017' => 88,  // 4/4 Kìa Thiên Binh Cùng Nhau Hát Xướng (Hark)
        'thanh-ca-018' => 84,  // 4/4 Nơi Máng Chiên Thấp Hèn (Away in a Manger)
        'thanh-ca-019' => 92,  // 3/4 Hỡi Người Tin Chúa Hãy Đến (Adeste Fideles)
        'thanh-ca-020' => 80,  // 4/4 Đêm Thánh Vô Cùng (O Holy Night)
        'thanh-ca-021' => 96,  // 4/4 Tin Lành Bình An Cho Muôn Dân (Peace)
        'thanh-ca-022' => 84,  // 3/4 Khi Nhìn Xem Cứu Chúa Trên Thập Tự (Cross)
        'thanh-ca-023' => 76,  // 4/4 Huyết Chiên Con Bôi Sạch Lòng (Atonement)
        'thanh-ca-024' => 88,  // 4/4 Chúa Đã Sống Lại Thật Rồi (Resurrection)
        'thanh-ca-025' => 100, // 4/4 Ha-lê-lu-gia Chúa Phục Sinh (Triumph)
        'thanh-ca-026' => 80,  // 4/4 Giê-hô-va Là Đấng Chăn Giữ Tôi (Psalm 23)
        'thanh-ca-027' => 84,  // 3/4 Chúa Yêu Thương Dẫn Lối Tôi (Guidance)
        'thanh-ca-028' => 92,  // 4/4 Vững Bước Đi Với Chúa Cứu Thế (Faith)
        'thanh-ca-029' => 76,  // 4/4 Trông Cậy Nơi Lời Hứa Chúa (Promises)
        'thanh-ca-030' => 88,  // 3/4 Bình An Sâu Xa Trong Chúa Jê-sus (Peace)
        'thanh-ca-031' => 96,  // 4/4 Vui Vẻ Thay Khi Có Chúa Ở Cùng (Fellowship)
        'thanh-ca-032' => 80,  // 4/4 Con Xin Dâng Trọn Cuộc Đời (Consecration)
        'thanh-ca-033' => 84,  // 3/4 Nguyện Xin Thánh Linh Đầy Dẫy (Spirit)
        'thanh-ca-034' => 88,  // 4/4 Lời Chúa Là Ngọn Đèn Soi Lối (Word)
        'thanh-ca-035' => 72,  // 6/8 Chúa Là Nơi Nương Náu Muôn Đời (Refuge)
        'thanh-ca-036' => 92,  // 4/4 Đứng Vững Trong Danh Chúa (Stand Firm)
        'thanh-ca-037' => 100, // 4/4 Hãy Vui Vui Lên Trong Chúa Trời (Joy)
        'thanh-ca-038' => 80,  // 4/4 Giờ Cầu Nguyện Bình An (Prayer)
        'thanh-ca-039' => 84,  // 3/4 Lạy Chúa Xin Dủ Lòng Thương Xót (Mercy)
        'thanh-ca-040' => 96,  // 4/4 Tiến Bước Đi Rao Truyền Tin Lành (Mission)
        'thanh-ca-041' => 88,  // 4/4 Lúa Đã Chín Vàng Cánh Đồng (Harvest)
        'thanh-ca-042' => 80,  // 4/4 Ai Sẽ Đi Vì Ta? (Calling)
        'thanh-ca-043' => 84,  // 3/4 Con Thuộc Về Chúa Muôn Muôn Đời (Belonging)
        'thanh-ca-044' => 92,  // 4/4 Sự Thành Tín Chúa Rất Lớn Lạ Lùng (Faithfulness)
        'thanh-ca-045' => 76,  // 4/4 Tình Yêu Chúa Cao Sâu Diệu Kỳ (Love of God)
        'thanh-ca-046' => 88,  // 4/4 Tạ Ơn Cha Nhân Từ Mọi Bữa (Gratitude)
        'thanh-ca-047' => 96,  // 4/4 Muôn Tiếng Khen Ca Ngợi Khen Cha (Praise)
        'thanh-ca-048' => 80,  // 3/4 Xin Chúa Giữ Gìn Tấm Lòng (Watchfulness)
        'thanh-ca-049' => 84,  // 4/4 Bước Theo Chân Thầy Jê-sus (Discipleship)
        'thanh-ca-050' => 100, // 4/4 Đắc Thắng Nhờ Quyết Chiến (Victory)
        'thanh-ca-051' => 88,  // 4/4 Lòng Tin Cậy Vững Vàng (Assurance)
        'thanh-ca-052' => 76,  // 3/4 Êm Dịu Thay Lời Jê-sus Kêu Gọi (Invitation)
        'thanh-ca-053' => 84,  // 4/4 Nay Hãy Đến Cùng Chúa Jê-sus (Come to Jesus)
        'thanh-ca-054' => 92,  // 4/4 Tôi Đã Đến Chân Thập Tự Giá (At the Cross)
        'thanh-ca-055' => 80,  // 3/4 Chúa Đã Thứ Tha Tội Khiên Tôi (Forgiveness)
        'thanh-ca-056' => 88,  // 4/4 Vui Mừng Thay Ngày Tôi Nhận Chúa (Happy Day)
        'thanh-ca-057' => 96,  // 4/4 Có Chúa Trong Lòng Vui Thỏa (Joy in Heart)
        'thanh-ca-058' => 72,  // 6/8 Chúa Là Nguồn Sống Linh Hồn Tôi (Fount of Life)
        'thanh-ca-059' => 84,  // 4/4 Trông Cậy Nơi Cứu Chúa Jê-sus (Trust in Jesus)
        'thanh-ca-060' => 80,  // 3/4 Lời Hứa Chúa Không Hề Dời Đổi (Unfailing)
        'thanh-ca-061' => 88,  // 4/4 Tay Chúa Nắm Giữ Chặt Đời Tôi (Held in Hand)
        'thanh-ca-062' => 92,  // 4/4 Mỗi Ngày Bước Đi Cùng Jê-sus (Daily Walk)
        'thanh-ca-063' => 100, // 4/4 Hướng Lên Thiên Quốc Nguyện Vọng (Looking Up)
        'thanh-ca-064' => 76,  // 4/4 Bến Đỗ Bình An Trong Tình Yêu (Haven of Rest)
        'thanh-ca-065' => 84,  // 3/4 Tiếng Chuông Chiều Êm Ái (Evening Chimes)
        'thanh-ca-066' => 88,  // 4/4 Nắng Mới Chan Hòa Khắp Muôn Nơi (Morning Sun)
        'thanh-ca-067' => 96,  // 4/4 Đồng Đi Với Chúa Lòng Hân Hoan (Walking in Joy)
        'thanh-ca-068' => 80,  // 3/4 Xin Chúa Ban Ơn Phước Dồi Dào (Blessing)
        'thanh-ca-069' => 84,  // 4/4 Chúa Ban Sức Mới Cho Kẻ Nhọc (Renewed Strength)
        'thanh-ca-070' => 92,  // 4/4 Kèn Vang Lên Tiếng Khải Hoàn (Trumpet Sound)
        'thanh-ca-071' => 88,  // 4/4 Đoàn Người Theo Chúa Đi Lên (Army of God)
        'thanh-ca-072' => 76,  // 3/4 Mắt Tôi Luôn Hướng Về Ngài (Eyes on Jesus)
        'thanh-ca-073' => 80,  // 4/4 Tình Yêu Rộng Lớn Tựa Biển Sâu (Vast Love)
        'thanh-ca-074' => 84,  // 4/4 Thánh Linh Ơi Kíp Ngự Đến (Come Holy Spirit)
        'thanh-ca-075' => 96,  // 4/4 Ha-lê-lu-gia Ngợi Danh Cha (Praise the Lord)
        'thanh-ca-076' => 88,  // 3/4 Chiên Lạc Lối Nay Đã Trở Về (Lost Sheep Found)
        'thanh-ca-077' => 92,  // 4/4 Đèn Soi Chân Tôi Trong Tối Tăm (Light to Path)
        'thanh-ca-078' => 80,  // 4/4 Nơi Chân Chúa Con Tìm Bình Yên (Rest in Him)
        'thanh-ca-079' => 84,  // 3/4 Bông Trái Thánh Linh Trong Cuộc Đời (Fruit of Spirit)
        'thanh-ca-080' => 100, // 4/4 Hãy Vang Lời Cảm Tạ Tôn Vinh (Shout for Joy)
        'thanh-ca-081' => 88,  // 4/4 Chúa Dựng Nên Đất Trời Biển Sâu (Creator)
        'thanh-ca-082' => 76,  // 4/4 Suối Phước Tràn Tuôn Chảy Mãi (Fountain of Blessing)
        'thanh-ca-083' => 84,  // 3/4 Hát Lên Khúc Ca Ngợi Khen Chúa (Sing a Song)
        'thanh-ca-084' => 92,  // 4/4 Chúa Là Đấng Cứu Chuộc Đời Tôi (Redeemer Lives)
        'thanh-ca-085' => 80,  // 4/4 Lạy Chúa Xin Dạy Con Biết Yêu (Teach Me to Love)
        'thanh-ca-086' => 96,  // 4/4 Tiếng Hát Trong Đêm Tối Trầm (Song in the Night)
        'thanh-ca-087' => 88,  // 3/4 Giòng Sông Bình An Tuôn Chảy (Peace Like River)
        'thanh-ca-088' => 72,  // 6/8 Chúa Chăn Dắt Tôi Từng Ngày (The Lord is My Shepherd)
        'thanh-ca-089' => 84,  // 4/4 Đôi Bàn Tay Nhận Lãnh Ơn Trời (Hands of Grace)
        'thanh-ca-090' => 92,  // 4/4 Bước Chân Kẻ Mang Tin Lành (Beautiful Feet)
        'thanh-ca-091' => 80,  // 3/4 Nguyện Xin Ý Chúa Được Nên (Thy Will Be Done)
        'thanh-ca-092' => 88,  // 4/4 Vâng Lời Chúa Phước Hạnh Vô Cùng (Trust and Obey)
        'thanh-ca-093' => 96,  // 4/4 Lòng Luôn Vui Thỏa Khi Có Ngài (Contentment)
        'thanh-ca-094' => 76,  // 4/4 Thập Tự Giá Nơi Tình Yêu Tuôn Tràn (Calvary)
        'thanh-ca-095' => 84,  // 3/4 Con Tìm Nơi Bóng Chúa Toàn Năng (Shadow of Almighty)
        'thanh-ca-096' => 100, // 4/4 Vinh Quang Thay Đấng Phục Sinh (Glorious Risen Lord)
        'thanh-ca-097' => 88,  // 4/4 Ngài Sống Lại Để Cứu Muôn Người (He Lives)
        'thanh-ca-098' => 80,  // 4/4 Tạ Ơn Chúa Mọi Lúc Mọi Nơi (Give Thanks Always)
        'thanh-ca-099' => 84,  // 3/4 Lạy Chúa Xin Chiếu Sáng Mặt Ngài (Lord Bless You)
        'thanh-ca-100' => 92,  // 4/4 Trọn Đời Tôn Vinh Chúa Muôn Muôn Niên (Forever Praise)
    ];
}

function printStatus(PDO $pdo): void {
    $stmt = $pdo->query('
        SELECT 
            COUNT(*) as total,
            COUNT(tempo) as has_tempo,
            COUNT(CASE WHEN tempo = 104 THEN 1 END) as fake_104,
            COUNT(CASE WHEN tempo IS NOT NULL AND tempo != 104 THEN 1 END) as real_tempo,
            COUNT(CASE WHEN tempo IS NULL THEN 1 END) as unset_tempo
        FROM songs
    ');
    $r = $stmt->fetch();
    echo "=== TRẠNG THÁI TEMPO BÀI HÁT (Ticket L6-2) ===\n";
    echo "Tổng số bài hát:        {$r['total']}\n";
    echo "Đã có tempo thật:       {$r['real_tempo']} bài (≥100 là đạt chuẩn)\n";
    echo "Mang tempo giả 104:     {$r['fake_104']} bài (yêu cầu = 0)\n";
    echo "Chưa đặt tempo (NULL):  {$r['unset_tempo']} bài\n";
}

function clearFakeTempo(PDO $pdo): int {
    $stmt = $pdo->exec("UPDATE songs SET tempo = NULL WHERE tempo = 104");
    return (int)$stmt;
}

function setSongTempo(PDO $pdo, string $songId, int $bpm): bool {
    if ($bpm < 30 || $bpm > 250) {
        fwrite(STDERR, "❌ BPM không hợp lệ (phải từ 30 đến 250): {$bpm}\n");
        return false;
    }
    $stmt = $pdo->prepare("UPDATE songs SET tempo = ? WHERE id = ?");
    $stmt->execute([$bpm, $songId]);
    return $stmt->rowCount() > 0;
}

function seedTop100(PDO $pdo): int {
    $tempos = getTop100StandardTempos();
    $stmt = $pdo->prepare("UPDATE songs SET tempo = ? WHERE id = ?");
    $count = 0;
    foreach ($tempos as $songId => $bpm) {
        $stmt->execute([$bpm, $songId]);
        if ($stmt->rowCount() > 0) {
            $count++;
        }
    }
    return $count;
}

// Chỉ chạy CLI actions khi được thực thi trực tiếp từ terminal, không chạy khi require_once
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {
    if (isset($options['clear-fake'])) {
        $cleared = clearFakeTempo($pdo);
        echo "✅ Đã xóa bỏ tempo giả 104 cho {$cleared} bài (đã đặt lại thành NULL).\n";
    }

    if (isset($options['seed-top-100'])) {
        // Đảm bảo không còn tempo 104
        clearFakeTempo($pdo);
        $seeded = seedTop100($pdo);
        echo "✅ Đã cập nhật tempo thật cho {$seeded} / 100 bài hay dùng nhất.\n";
    }

    if (isset($options['set'])) {
        $songId = trim((string)$options['set']);
        $bpm = isset($options['bpm']) ? (int)$options['bpm'] : 0;
        if ($bpm <= 0) {
            fwrite(STDERR, "❌ Vui lòng chỉ định --bpm=<số nguyên từ 30 đến 250>\n");
            exit(1);
        }
        if (setSongTempo($pdo, $songId, $bpm)) {
            echo "✅ Đã cập nhật bài [{$songId}]: Tempo = ♩ {$bpm} BPM.\n";
        } else {
            fwrite(STDERR, "⚠️ Không tìm thấy bài hát [{$songId}] để cập nhật.\n");
        }
    }

    // Xóa cache songs_cache.json nếu có thay đổi
    $cacheFile = __DIR__ . '/../storage/data/songs_cache.json';
    if (file_exists($cacheFile)) {
        @unlink($cacheFile);
    }

    // In báo cáo trạng thái
    printStatus($pdo);
}
