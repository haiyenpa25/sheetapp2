<?php
/**
 * tests/library_l62_tempo_management_and_tap_regression.php
 *
 * Kiểm thử hồi quy Ticket L6-2 (Chất lượng dữ liệu):
 * - Xoá tempo giả 104 (đặt NULL).
 * - Quản lý tempo thật cho 100 bài hay dùng (≥100 bài có tempo thật).
 * - Công cụ manage_tempos.php và cập nhật tempo qua SongService / SongController cho Ca Trưởng.
 * - Thuật toán TAP tempo và tích hợp song-info-bar.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/SongVersionHelper.php';
require_once __DIR__ . '/../tools/manage_tempos.php';

$passed = 0;
$failed = 0;

function it(string $desc, bool $condition): void {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY TICKET L6-2: XÓA TEMPO GIẢ 104 & CÔNG CỤ TEMPO CHO CA TRƯỞNG ===\n";

$pdo = DB::get();

// ── 1. Kiểm tra cấu trúc CSDL và Dữ liệu Cột tempo ──
echo "\n-- 1. Cấu trúc CSDL và Dữ liệu Cột tempo --\n";

// 1.1 Cột tempo tồn tại trong bảng songs
$cols = $pdo->query("PRAGMA table_info(songs)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');
it("Cột 'tempo' tồn tại trong bảng songs", in_array('tempo', $colNames, true));

// 1.2 Không có bài hát nào mang tempo giả 104
$fake104Count = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE tempo = 104")->fetchColumn();
it("Hoàn toàn không có bài hát nào mang tempo giả 104 (count = 0)", $fake104Count === 0);

// 1.3 Có ít nhất 100 bài có tempo thật (tempo > 0 và tempo != 104)
$realCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE tempo IS NOT NULL AND tempo > 0 AND tempo != 104")->fetchColumn();
it("Có ít nhất 100 bài có tempo thật chuẩn xác (thực tế: {$realCount} bài ≥ 100)", $realCount >= 100);

// 1.4 Các bài còn lại mang giá trị NULL (không áp đặt tempo giả)
$nullCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE tempo IS NULL")->fetchColumn();
it("Các bài chưa xác định tempo mang giá trị NULL ({$nullCount} bài)", $nullCount > 0 && ($nullCount + $realCount === 903));

// ── 2. Kiểm tra SongService & SongSearchHelper trả về tempo ──
echo "\n-- 2. SongService & Cache tích hợp tempo --\n";

// 2.1 SongService::getAll() trả về trường tempo
$allSongs = SongService::getAll();
it("SongService::getAll() trả về danh sách 903 bài hát", count($allSongs) === 903);

$song001 = null;
foreach ($allSongs as $s) {
    if ($s['id'] === 'thanh-ca-001') {
        $song001 = $s;
        break;
    }
}
it("Bài thanh-ca-001 có trường tempo và tempo = 92 (BPM thật)", isset($song001['tempo']) && (int)$song001['tempo'] === 92);

// 2.2 SongSearchHelper::search() có trường tempo
$searchResults = SongService::search('Thánh Vương');
$foundInSearch = false;
foreach ($searchResults as $sr) {
    if ($sr['id'] === 'thanh-ca-001' && isset($sr['tempo']) && (int)$sr['tempo'] === 92) {
        $foundInSearch = true;
        break;
    }
}
it("SongService::search() trả về bài hát kèm trường tempo chuẩn xác", $foundInSearch);

// 2.3 Cập nhật tempo qua SongService::update()
$origTempo = (int)$song001['tempo'];
$testTempo = 95;
$updateRes = SongService::update('thanh-ca-001', ['tempo' => $testTempo]);
it("SongService::update() cập nhật tempo thành công", ($updateRes['success'] ?? false) === true);

// Xác minh đã ghi vào DB
$stmtCheck = $pdo->prepare("SELECT tempo FROM songs WHERE id = ?");
$stmtCheck->execute(['thanh-ca-001']);
$curTempoDb = (int)$stmtCheck->fetchColumn();
it("Tempo bài thanh-ca-001 trong DB đã được cập nhật thành {$testTempo}", $curTempoDb === $testTempo);

// Rollback về tempo chuẩn ban đầu
SongService::update('thanh-ca-001', ['tempo' => $origTempo]);
$stmtCheck->execute(['thanh-ca-001']);
$curTempoDb = (int)$stmtCheck->fetchColumn();
it("Rollback tempo bài thanh-ca-001 về lại {$origTempo} thành công", $curTempoDb === $origTempo);

// ── 3. Kiểm tra danh mục tempo chuẩn trong manage_tempos.php ──
echo "\n-- 3. Danh mục tempo thật chuẩn mực trong manage_tempos.php --\n";

$top100Tempos = getTop100StandardTempos();
it("getTop100StandardTempos() cung cấp đủ 100 bài hát", count($top100Tempos) === 100);

$has104InTop100 = in_array(104, $top100Tempos, true);
it("getTop100StandardTempos() tuyệt đối không chứa tempo giả 104", !$has104InTop100);

$allWithinValidRange = true;
foreach ($top100Tempos as $id => $bpm) {
    if ($bpm < 50 || $bpm > 180) {
        $allWithinValidRange = false;
        break;
    }
}
it("Mọi tempo trong Top 100 đều nằm trong khoảng thực tế phụng vụ (50 - 180 BPM)", $allWithinValidRange);

// ── 4. Kiểm tra phân quyền cập nhật SongController cho Ca Trưởng ──
echo "\n-- 4. Phân quyền SongController cho Ca Trưởng --\n";

$controllerSource = file_get_contents(__DIR__ . '/../api/controllers/SongController.php');
it("SongController PUT case dùng Auth::requireLeader() cho phép Ca Trưởng cập nhật tempo", strpos($controllerSource, "Auth::requireLeader();\n                    \$id   = \$_GET['id']") !== false);

// ── 5. Kiểm tra Tích hợp Frontend & Thuật toán TAP Tempo ──
echo "\n-- 5. Tích hợp Frontend & Thuật toán TAP Tempo --\n";

$tempoSheetSource = file_get_contents(__DIR__ . '/../assets/js/modals/TempoPickerSheet.js');
it("TempoPickerSheet.js chứa bộ lắng nghe nút TAP (#tempo-modal-tap)", strpos($tempoSheetSource, "tempo-modal-tap") !== false);
it("TempoPickerSheet.js tính toán khoảng cách gõ: Math.round(60000 / avgInterval)", strpos($tempoSheetSource, "Math.round(60000 / avgInterval)") !== false);
it("TempoPickerSheet.js giới hạn BPM an toàn: calcBpm >= 30 && calcBpm <= 250", strpos($tempoSheetSource, "calcBpm >= 30 && calcBpm <= 250") !== false);

$songInfoBarSource = file_get_contents(__DIR__ . '/../assets/js/song-info-bar.js');
it("song-info-bar.js nhận biết tempo giả 104 và hiển thị '♩ —' (chưa có tempo)", strpos($songInfoBarSource, "if (!safeBpm || safeBpm === 104)") !== false);
it("song-info-bar.js gọi ApiService.songs.update(_songId, { tempo: newBpm }) khi ca trưởng chọn tempo mới", strpos($songInfoBarSource, "window.ApiService.songs.update(_songId, { tempo: newBpm })") !== false);

// ── 6. Thuật toán TAP Tempo độc lập (Behavioral Math Unit Test) ──
echo "\n-- 6. Behavioral Math Test cho TAP Tempo --\n";

function simulateTapBpm(array $tapTimesMs): int {
    if (count($tapTimesMs) < 2) return 0;
    $totalDiff = 0;
    for ($i = 1; $i < count($tapTimesMs); $i++) {
        $totalDiff += ($tapTimesMs[$i] - $tapTimesMs[$i - 1]);
    }
    $avgInterval = $totalDiff / (count($tapTimesMs) - 1);
    return (int)round(60000 / $avgInterval);
}

// 4 cú gõ cách nhau 600ms => 100 BPM
$taps100 = [0, 600, 1200, 1800];
it("Mô phỏng TAP nhịp 600ms tính ra chính xác 100 BPM", simulateTapBpm($taps100) === 100);

// 4 cú gõ cách nhau 750ms => 80 BPM
$taps80 = [0, 750, 1500, 2250];
it("Mô phỏng TAP nhịp 750ms tính ra chính xác 80 BPM", simulateTapBpm($taps80) === 80);

// 4 cú gõ cách nhau 500ms => 120 BPM
$taps120 = [0, 500, 1000, 1500];
it("Mô phỏng TAP nhịp 500ms tính ra chính xác 120 BPM", simulateTapBpm($taps120) === 120);

// 4 cú gõ cách nhau 652ms => ~92 BPM (Hỡi Thánh Vương Kíp Ngự Lai)
$taps92 = [0, 652, 1304, 1956];
it("Mô phỏng TAP nhịp 652ms tính ra ~92 BPM (bài 001)", simulateTapBpm($taps92) === 92);

echo "\n=======================================================\n";
echo "KẾT QUẢ KIỂM THỬ L6-2: {$passed} PASSED, {$failed} FAILED\n";
echo "=======================================================\n";
echo "\nSUITE_COMPLETE total={$passed} passed={$passed} failed={$failed}\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
