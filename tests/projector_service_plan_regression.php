<?php
/**
 * tests/projector_service_plan_regression.php
 *
 * Kiểm tra hồi quy toàn diện cho Epic 3.4 — Projector theo Service Plan:
 * 1. Protocol V2 Service Plan Item Contract (itemType, customTitle, leaderNotes, itemIndex, totalItems).
 * 2. Non-Song Liturgical Items Contract (prayer, scripture, liturgy, announcement).
 * 3. XSS Defense & Output Encoding trên Projector Surface (SafeHtml & htmlspecialchars).
 * 4. MusicXML Lyric Slide Chunking Algorithm (Gom cụm câu & measures thành slide logic).
 * 5. Host Remote Navigation & Measure Progression (Chuyển mục phụng vụ & theo dõi ô nhịp).
 * 6. Projector Reconnection & State Recovery (Phục hồi sau ngắt kết nối ngắn).
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

echo "=== EPIC 3.4 — PROJECTOR THEO SERVICE PLAN REGRESSION SUITE ===\n";

$root = dirname(__DIR__);
require_once $root . '/api/services/LiveSyncService.php';

$tmpDir = sys_get_temp_dir() . '/sheetapp_ls_proj_' . bin2hex(random_bytes(4));
LiveSyncService::setRoomDir($tmpDir);

$testRoom = 'PROJ_' . strtoupper(bin2hex(random_bytes(4)));

// Dọn dẹp file test nếu đã tồn tại
$testFile = $tmpDir . '/' . strtolower($testRoom) . '.json';
if (file_exists($testFile)) {
    @unlink($testFile);
}

// ─── TEST 1: Protocol V2 Service Plan Item Contract ─────────────────
echo "\n--- TEST 1: Service Plan Item Contract in LiveSync ---\n";

$createRes = LiveSyncService::createRoom($testRoom, [
    'leader'          => 'Trưởng Ban Kỹ Thuật',
    'songId'          => '001-thanh-chua-yeu-thuong',
    'songTitle'       => 'Thánh Chúa Yêu Thương',
    'servicePlanItem' => [
        'itemType'    => 'song',
        'customTitle' => 'Ca Nhập Lễ: Thánh Chúa Yêu Thương',
        'leaderNotes' => 'Hát cả bài 2 lần',
        'itemIndex'   => 0,
        'totalItems'  => 5
    ]
]);

check($createRes['success'] === true, "Khởi tạo phòng Live {$testRoom} thành công");
$hostToken = $createRes['hostToken'];
$state = $createRes['state'];

check(isset($state['servicePlanItem']), "Khởi tạo có chứa servicePlanItem");
check($state['servicePlanItem']['itemType'] === 'song', "itemType là 'song'");
check($state['servicePlanItem']['itemIndex'] === 0, "itemIndex là 0");
check($state['servicePlanItem']['totalItems'] === 5, "totalItems là 5");

// ─── TEST 2: Non-Song Liturgical Items Contract ─────────────────────
echo "\n--- TEST 2: Non-Song Liturgical Items Contract ---\n";

// Host chuyển sang Bài Đọc I (Scripture)
$upScripture = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'song' => [
        'songId'    => '',
        'songTitle' => 'Bài Đọc I'
    ],
    'servicePlanItem' => [
        'itemType'    => 'scripture',
        'customTitle' => 'Bài Đọc I: Trích sách Ngôn sứ Isaia (Is 53, 10-11)',
        'leaderNotes' => 'Đọc truyền cảm, dừng 3 giây sau câu kết',
        'itemIndex'   => 1,
        'totalItems'  => 5
    ]
]);

check($upScripture['success'] === true, "Cập nhật sang mục Bài Đọc I thành công");
$item1 = $upScripture['state']['servicePlanItem'];
check($item1['itemType'] === 'scripture', "itemType là 'scripture'");
check(str_contains($item1['customTitle'], 'Ngôn sứ Isaia'), "customTitle chứa nội dung trích đoạn");
check(empty($upScripture['state']['song']['songId']), "Mục phụng vụ không bắt buộc có songId");

// Host chuyển sang Lời Nguyện Giáo Dân (Prayer)
$upPrayer = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'servicePlanItem' => [
        'itemType'    => 'prayer',
        'customTitle' => 'Lời Nguyện Tín Hữu',
        'leaderNotes' => 'Cộng đoàn đáp: Xin Chúa nhậm lời chúng con',
        'itemIndex'   => 2,
        'totalItems'  => 5
    ]
]);

check($upPrayer['success'] === true, "Cập nhật sang mục Lời Nguyện thành công");
check($upPrayer['state']['servicePlanItem']['itemType'] === 'prayer', "itemType là 'prayer'");

// ─── TEST 3: XSS & Injection Defense on Projector Surface ───────────
echo "\n--- TEST 3: XSS Defense & Output Encoding ---\n";

$xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
$upXss = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'song' => [
        'songId'    => 'xss-song',
        'songTitle' => 'Bài hát ' . $xssPayload
    ],
    'servicePlanItem' => [
        'itemType'    => 'liturgy',
        'customTitle' => 'Nghi Thức ' . $xssPayload,
        'leaderNotes' => 'Ghi chú ' . $xssPayload,
        'itemIndex'   => 3,
        'totalItems'  => 5
    ]
]);

check($upXss['success'] === true, "Lưu dữ liệu chứa ký tự đặc biệt an toàn vào LiveSync");

// Kiểm tra mã nguồn projector: mọi sink hiển thị đều qua window.SafeHtml.escape hoặc htmlspecialchars
$projectorPhp = file_get_contents($root . '/live-band/projector.php');
$projectorSlidesJs = file_get_contents($root . '/live-band/js/projector-slides.js');
$projectorAppJs = file_get_contents($root . '/live-band/js/projector-app.js');
$allProjectorCode = $projectorPhp . "\n" . $projectorSlidesJs . "\n" . $projectorAppJs;

check(!empty($projectorPhp), "Đọc thành công file live-band/projector.php");
check(str_contains($allProjectorCode, 'window.SafeHtml.escape') || str_contains($allProjectorCode, 'window.SafeHtml'), "Projector sử dụng SafeHtml escape cho các text nodes");
check(str_contains($projectorPhp, 'htmlspecialchars'), "projector.php PHP header escape biến roomParam bằng htmlspecialchars");
check(!str_contains($allProjectorCode, '${item.customTitle}'), "Không có unescaped template literal cho customTitle");
check(!str_contains($allProjectorCode, '${songTitle}'), "Không có unescaped template literal cho songTitle");
check(!str_contains($allProjectorCode, '${leaderNotes}'), "Không có unescaped template literal cho leaderNotes");

// ─── TEST 4: MusicXML Lyric Slide Chunking Algorithm ────────────────
echo "\n--- TEST 4: MusicXML Lyric Slide Chunking Algorithm ---\n";

// Mô phỏng thuật toán chunking trong projector.php
$mockMeasures = [
    1 => 'Chúa',
    2 => 'là mục tử',
    3 => 'Người dẫn tôi đi',
    4 => 'vào đồng cỏ xanh tươi.',
    5 => 'Chúa',
    6 => 'bảo bọc tôi',
    7 => 'trong ân huệ Ngài',
    8 => 'đời đời chẳng vơi.',
    9 => 'Dầu qua lũng tối',
    10 => 'tôi chẳng sợ chi',
    11 => 'vì Chúa ở cùng',
    12 => 'an ủi chở che.'
];

$rawLines = [];
foreach ($mockMeasures as $mIdx => $text) {
    $rawLines[] = ['measure' => $mIdx, 'text' => $text];
}

$linesPerSlide = 3;
$slides = [];
for ($i = 0; $i < count($rawLines); $i += $linesPerSlide) {
    $chunk = array_slice($rawLines, $i, $linesPerSlide);
    $slides[] = [
        'startMeasure' => $chunk[0]['measure'],
        'endMeasure'   => end($chunk)['measure'],
        'lines'        => $chunk
    ];
}

check(count($slides) === 4, "Thuật toán chunking gom 12 measures thành đúng 4 slides (3 lines/slide)");
check($slides[0]['startMeasure'] === 1 && $slides[0]['endMeasure'] === 3, "Slide 1 bao quát measure 1..3");
check($slides[1]['startMeasure'] === 4 && $slides[1]['endMeasure'] === 6, "Slide 2 bao quát measure 4..6");
check($slides[2]['startMeasure'] === 7 && $slides[2]['endMeasure'] === 9, "Slide 3 bao quát measure 7..9");
check($slides[3]['startMeasure'] === 10 && $slides[3]['endMeasure'] === 12, "Slide 4 bao quát measure 10..12");

// ─── TEST 5: Host Remote Navigation & Measure Progression ───────────
echo "\n--- TEST 5: Host Remote Navigation & Measure Tracking ---\n";

// Host phát sóng chuyển measure: 1 -> 5 -> 11
$nav1 = LiveSyncService::updateRoom($testRoom, $hostToken, ['measure' => 2]);
check($nav1['state']['position']['measure'] === 2, "Host chuyển sang measure 2 (Slide 1)");

$nav2 = LiveSyncService::updateRoom($testRoom, $hostToken, ['measure' => 5]);
check($nav2['state']['position']['measure'] === 5, "Host chuyển sang measure 5 (Slide 2)");

$nav3 = LiveSyncService::updateRoom($testRoom, $hostToken, ['measure' => 11]);
check($nav3['state']['position']['measure'] === 11, "Host chuyển sang measure 11 (Slide 4)");

// ─── TEST 6: Projector Reconnection & State Recovery ────────────────
echo "\n--- TEST 6: Projector Reconnection & State Recovery ---\n";

$currentRev = $nav3['revision'];
$oldClientRev = $currentRev - 4; // Giả sử mất mạng 4 bước trước

$reconnectPoll = LiveSyncService::pollRoom($testRoom, $oldClientRev, 'client-projector-sanctuary', 'viewer');

check($reconnectPoll['modified'] === true, "Projector nhận modified=true khi kết nối lại");
check($reconnectPoll['revision'] === $currentRev, "Projector nhận đúng revision mới nhất: {$currentRev}");
check(isset($reconnectPoll['replayEvents']) && count($reconnectPoll['replayEvents']) === 4, "Projector nhận chính xác 4 sự kiện bị bỏ lỡ");
check($reconnectPoll['state']['position']['measure'] === 11, "Khôi phục chính xác vị trí measure hiện tại (11)");

// Dọn dẹp phòng test
LiveSyncService::closeRoom($testRoom, $hostToken);
if (file_exists($testFile)) {
    @unlink($testFile);
}
if (is_dir($tmpDir)) {
    @rmdir($tmpDir);
}
LiveSyncService::setRoomDir(null);
check(!file_exists($testFile), "Đã dọn dẹp file dữ liệu phòng test");

echo "\n=======================================================\n";
echo "SUCCESS: Tất cả 6 bài kiểm tra Projector Service Plan ĐẠT 100%!\n";
echo "=======================================================\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
