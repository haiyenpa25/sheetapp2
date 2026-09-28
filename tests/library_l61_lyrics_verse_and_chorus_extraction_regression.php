<?php
/**
 * tests/library_l61_lyrics_verse_and_chorus_extraction_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L6-1 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Trích lời theo khổ đúng chuẩn: tách theo <lyric number>, ghép âm tiết theo <syllabic>
 * - Tách Điệp khúc (ĐK) thành khối riêng biệt [ĐK], không bị dính vào Khổ 1
 * - Xử lý bản nhạc đa bè / đa part: tự động chọn part có nhiều lyric nhất (như bài 074, 614)
 * - Nghiệm thu: 10 bài mẫu lời từng khổ là câu liền mạch; tìm kiếm FTS5 và snippet chính xác
 *
 * Tỷ lệ hành vi >= 70%.
 */

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SongSearchHelper.php';
require_once $root . '/api/services/SongService.php';

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function check(bool $cond, string $msg, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    if ($cond) {
        $passedChecks++;
        echo "  [PASS] {$msg}\n";
    } else {
        echo "  [FAIL] {$msg}\n";
    }
}

echo "=== Kiểm thử Ticket L6-1: Trích lời theo khổ & Tách Điệp Khúc chuẩn xác ===\n";

// 1. Kiểm tra 10 bài mẫu nghiệm thu từ MusicXML
$sampleIds = [
    'thanh-ca-001' => 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI',
    'thanh-ca-002' => 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
    'thanh-ca-003' => 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ',
    'thanh-ca-004' => 'HA-LÊ-LU-GIA !  VINH DANH NGÀI !',
    'thanh-ca-005' => 'MUÔN DÂN TRÊN HOÀN CẦU NÊN CA XƯỚNG',
    'thanh-ca-006' => 'THÀNH TÂM TÔN VUA THÁNH',
    'thanh-ca-007' => 'CA CẢM TẠ',
    'thanh-ca-008' => 'NGỢI DANH JÊSUS RẤT OAI QUYỀN',
    'thanh-ca-011' => 'NGỢI KHEN CỨU CHÚA !',
    'thanh-ca-016' => 'DANH CHÚA JÊSUS'
];

$validSampleCount = 0;
foreach ($sampleIds as $id => $title) {
    $row = DB::run("SELECT id, title, lyrics_text FROM songs WHERE id = ?", [$id])->fetch(PDO::FETCH_ASSOC);
    if (!empty($row) && !empty($row['lyrics_text'])) {
        // Kiểm tra mỗi khổ bắt đầu bằng số thứ tự hoặc [ĐK]
        $lines = array_filter(explode("\n\n", trim($row['lyrics_text'])));
        $allSectionsValid = true;
        foreach ($lines as $sec) {
            $sec = trim($sec);
            if (!preg_match('/^(?:\d+\.|\[ĐK\])/u', $sec) || mb_strlen($sec) < 15) {
                $allSectionsValid = false;
                break;
            }
        }
        if ($allSectionsValid && count($lines) >= 2) {
            $validSampleCount++;
        }
    }
}
check($validSampleCount === 10, "Nghiệm thu 10 bài mẫu: 10/10 bài có lời từng khổ là câu liền mạch và phân đoạn chuẩn ({$validSampleCount}/10)", true);

// 2. Kiểm tra tách Điệp khúc [ĐK] ở bài 004
$song004 = DB::run("SELECT lyrics_text FROM songs WHERE id = 'thanh-ca-004'")->fetch(PDO::FETCH_ASSOC);
$lyrics004 = $song004['lyrics_text'] ?? '';
check(str_contains($lyrics004, '[ĐK]'), 'Bài 004: Có khối Điệp khúc với nhãn "[ĐK]"', true);
check(str_contains($lyrics004, '[ĐK] Ha-lê-lu-gia! Vinh danh Ngài!'), 'Bài 004: Khối [ĐK] chứa câu bắt đầu chuẩn "Ha-lê-lu-gia! Vinh danh Ngài!"', true);
// Điệp khúc không được nằm trong Khổ 1
preg_match('/^1\..*?(?=\n\n|\z)/s', $lyrics004, $mVerse1_004);
$verse1_004 = $mVerse1_004[0] ?? '';
check(!str_contains($verse1_004, 'Ha-lê-lu-gia! Vinh danh Ngài!'), 'Bài 004: Điệp khúc KHÔNG bị dính vào Khổ 1', true);
check(str_contains($verse1_004, 'Ai có thể ca khen cho được?'), 'Bài 004: Khổ 1 kết thúc đúng câu thơ trước khi sang khổ 2', true);

// 3. Kiểm tra tách Điệp khúc [ĐK] ở bài 011 và 016
$song011 = DB::run("SELECT lyrics_text FROM songs WHERE id = 'thanh-ca-011'")->fetch(PDO::FETCH_ASSOC);
$lyrics011 = $song011['lyrics_text'] ?? '';
check(str_contains($lyrics011, '[ĐK] Ngợi Khen Chúa'), 'Bài 011: Có khối Điệp khúc "[ĐK] Ngợi Khen Chúa"', true);
preg_match('/^1\..*?(?=\n\n|\z)/s', $lyrics011, $mVerse1_011);
$verse1_011 = $mVerse1_011[0] ?? '';
check(!str_contains($verse1_011, 'Hồng huyết lưu ra'), 'Bài 011: Khổ 1 kết thúc ở Gô-gô-tha, không dính Điệp khúc', true);

$song016 = DB::run("SELECT lyrics_text FROM songs WHERE id = 'thanh-ca-016'")->fetch(PDO::FETCH_ASSOC);
$lyrics016 = $song016['lyrics_text'] ?? '';
check(str_contains($lyrics016, '[ĐK] Jê-sus, có phương danh diệu kỳ!'), 'Bài 016: Có khối Điệp khúc "[ĐK] Jê-sus, có phương danh diệu kỳ!"', true);

// 4. Kiểm tra bài không có Điệp khúc (Bài 001, 002)
$song001 = DB::run("SELECT lyrics_text FROM songs WHERE id = 'thanh-ca-001'")->fetch(PDO::FETCH_ASSOC);
$lyrics001 = $song001['lyrics_text'] ?? '';
check(!str_contains($lyrics001, '[ĐK]'), 'Bài 001: Không có điệp khúc thì không sinh thẻ [ĐK]', true);
check(str_contains($lyrics001, '1. Cúi xin Vua Thánh ngự lai') && str_contains($lyrics001, '2. Cúi xin Đạo thể ngự lai'), 'Bài 001: Khổ 1 và Khổ 2 liên tục và chuẩn', true);

// 5. Kiểm tra xử lý XML đa bè / đa part: Bài 074
$song074 = DB::run("SELECT lyrics_text FROM songs WHERE id = 'thanh-ca-074'")->fetch(PDO::FETCH_ASSOC);
$lyrics074 = $song074['lyrics_text'] ?? '';
check(str_contains($lyrics074, '1. Ồ lạ lùng dường nào!'), 'Bài 074 (đa bè): Tự động trích xuất đúng bè chính có lời Khổ 1 ("Ồ lạ lùng dường nào!")', true);
check(str_contains($lyrics074, '2. Rày toàn cầu được bình an') && str_contains($lyrics074, '3. Cùng họp lại thờ Ngài'), 'Bài 074: Đầy đủ cả Khổ 2 và Khổ 3', true);
check(str_contains($lyrics074, '[ĐK] Anh em ta yên lặng mà nghe'), 'Bài 074: Trích xuất chuẩn Điệp khúc [ĐK] từ bè chính', true);

// 6. Kiểm tra ghép âm tiết syllabic (begin, middle, end)
check(str_contains($lyrics004, 'Ha-lê-lu-gia'), 'Syllabic: Âm tiết nối liền mạch có gạch nối ("Ha-lê-lu-gia")', true);
check(str_contains($lyrics016, 'Jê-sus'), 'Syllabic: Âm tiết tên riêng ghép chuẩn ("Jê-sus")', true);

// 7. Kiểm tra tìm kiếm FTS5 và Highlight Snippet trên Điệp khúc
$resChorus004 = SongSearchHelper::search('ha le lu gia vinh danh');
$found004 = false;
$snippet004 = '';
foreach ($resChorus004 as $r) {
    if ((string)$r['id'] === 'thanh-ca-004') {
        $found004 = true;
        $snippet004 = $r['lyric_snippet'] ?? '';
        break;
    }
}
check($found004, 'FTS5: Tìm kiếm cụm từ trong Điệp khúc tìm thấy bài 004', true);
check(!empty($snippet004) && str_contains($snippet004, '<mark>'), 'FTS5: Snippet Điệp khúc có highlight bằng thẻ <mark>', true);

$resChorus011 = SongSearchHelper::search('hong huyet luu ra');
$found011 = false;
$snippet011 = '';
foreach ($resChorus011 as $r) {
    if ((string)$r['id'] === 'thanh-ca-011') {
        $found011 = true;
        $snippet011 = $r['lyric_snippet'] ?? '';
        break;
    }
}
check($found011, 'FTS5: Tìm kiếm cụm từ trong Điệp khúc bài 011 ("hồng huyết lưu ra") thành công', true);
check(!empty($snippet011) && str_contains($snippet011, '[ĐK]'), 'FTS5: Snippet của Điệp khúc giữ nguyên ngữ cảnh tiền tố [ĐK]', true);

// 8. Kiểm tra an toàn XSS: không có mã độc nào trong lyrics_text
$xssCheck = DB::run("SELECT count(*) FROM songs WHERE lyrics_text LIKE '%<script%' OR lyrics_text LIKE '%javascript:%'")->fetchColumn();
check((int)$xssCheck === 0, 'Bảo mật: 100% cột lyrics_text không chứa mã thực thi độc hại (0 XSS detected)', true);

echo "\n--- KẾT QUẢ KIỂM THỬ L6-1 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Thành công: {$passedChecks}/{$totalChecks}\n";
$behavRatio = round(($behavioralChecks / $totalChecks) * 100, 1);
echo "Tỷ lệ kiểm tra hành vi: {$behavRatio}% (yêu cầu >= 70%)\n";

if ($passedChecks === $totalChecks) {
    echo "[SUITE_COMPLETE total={$totalChecks}]\n";
    exit(0);
} else {
    exit(1);
}
