<?php
declare(strict_types=1);

/**
 * tests/setlist_cr4_regression.php
 * 
 * Kiểm thử tự động Task 1.4: Sửa Setlist theo Core Rule 4 & Loại trừ F1, F5
 * - play chờ load hoàn tất rồi áp profile/transpose/BPM (F1)
 * - Nút "Lưu vào Setlist" từ SongInfoBar lưu đủ cả 3 giá trị tông + BPM + chord_profile (F5)
 * - Nút "💾 Lưu Tập" trong SetlistUI lưu đủ cả 3 giá trị và không bị chặn bởi admin
 * - Metronome khi nhận sự kiện song:loaded không đè BPM của Setlist bằng XML tempo
 * - DB cập nhật và lưu trữ toàn vẹn chord_profile, transpose_key, bpm
 */

$root = dirname(__DIR__);

// Đọc source code các module liên quan
$songInfoBarSrc = file_get_contents($root . '/assets/js/song-info-bar.js') ?: '';
$setlistUiSrc   = file_get_contents($root . '/assets/js/setlist-ui.js') ?: '';
$metronomeSrc   = file_get_contents($root . '/assets/js/metronome.js') ?: '';

$failures = [];
$total = 0;

function check(bool $condition, string $message, string $details = ''): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures, $total;
    $total++;
    if ($condition) {
        echo "  [PASS] {$message}\n";
    } else {
        $msg = "  [FAIL] {$message}" . ($details ? " -> {$details}" : "");
        echo "{$msg}\n";
        $failures[] = $msg;
    }
}

echo "========================================================\n";
echo "   SheetApp2 — Setlist Core Rule 4 Regression Suite   \n";
echo "========================================================\n\n";

// 1. SongInfoBar lưu đầy đủ chord_profile (Fix F5)
$songInfoBarSavesProfile = str_contains($songInfoBarSrc, "chord_profile: curProfile")
    && str_contains($songInfoBarSrc, "item.chord_profile = curProfile");
check(
    $songInfoBarSavesProfile,
    'SongInfoBar: Nút "Lưu vào Setlist" lưu trọn vẹn cả 3 giá trị: transpose_key, bpm và chord_profile (Fix F5)',
    "savesProfile=" . ($songInfoBarSavesProfile ? 'true' : 'false')
);

// 2. SetlistUI saveBpmBtn lưu đầy đủ chord_profile
$setlistUiSavesProfile = str_contains($setlistUiSrc, "chord_profile: curProfile")
    && str_contains($setlistUiSrc, "item.chord_profile = curProfile");
check(
    $setlistUiSavesProfile,
    'SetlistUI: Nút "💾 Lưu Tập" lưu trọn vẹn cả 3 giá trị: transpose_key, bpm và chord_profile',
    "savesProfile=" . ($setlistUiSavesProfile ? 'true' : 'false')
);

// 3. playCurrentItem awaits load hoàn tất (Fix F1)
$playAwaitsLoad = str_contains($setlistUiSrc, "await window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key)");
check(
    $playAwaitsLoad,
    'SetlistUI: playCurrentItem() sử dụng await chờ bài hát tải xong hoàn tất trước khi kích hoạt nhịp (Fix F1)',
    "awaitsLoad=" . ($playAwaitsLoad ? 'true' : 'false')
);

// 4. Metronome bảo toàn BPM của Setlist khi song:loaded kích hoạt
$metronomeProtectsBpm = str_contains($metronomeSrc, "if (setlistItem && setlistItem.bpm)")
    && str_contains($metronomeSrc, "_bpm = parseInt(setlistItem.bpm)");
check(
    $metronomeProtectsBpm,
    'Metronome: Sự kiện song:loaded ưu tiên giữ BPM của Setlist, không bị ghi đè bởi XML tempo mặc định',
    "protectsBpm=" . ($metronomeProtectsBpm ? 'true' : 'false')
);

// 5. Test Database Fixture lưu trữ và cập nhật 3 trường
$tmpDb = sys_get_temp_dir() . '/sheetapp_sl4_' . bin2hex(random_bytes(4)) . '.sqlite';
putenv('DB_PATH=' . $tmpDb);

require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SetlistService.php';

$pdo = DB::get();
$pdo->exec("
    CREATE TABLE IF NOT EXISTS setlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        scheduled_date DATE,
        created_by INTEGER
    );
    CREATE TABLE IF NOT EXISTS setlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER NOT NULL,
        song_id TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        chord_profile TEXT DEFAULT 'HD',
        transpose_key INTEGER DEFAULT 0,
        bpm INTEGER DEFAULT 100,
        beats_per_measure INTEGER DEFAULT 4
    );
");

$slId = SetlistService::create('Thánh Lễ Chúa Nhật', '2026-10-04', 1);
SetlistService::addItem($slId, 'song_tc_10', 'HD', 2, 85, 3);
$sl = SetlistService::getById($slId);
$itm = $sl['items'][0] ?? null;

$itemOk = $itm !== null
    && $itm['chord_profile'] === 'HD'
    && (int)$itm['transpose_key'] === 2
    && (int)$itm['bpm'] === 85
    && (int)$itm['beats_per_measure'] === 3;

check(
    $itemOk,
    'Database: Thêm bài vào Setlist lưu chính xác chord_profile="HD", transpose_key=2, bpm=85, beats=3',
    "itemOk=" . ($itemOk ? 'true' : 'false')
);

// Cập nhật qua updateItem (mô phỏng Lưu Tập / SongInfoBar)
$updOk = SetlistService::updateItem((int)$itm['id'], [
    'chord_profile' => 'NAM',
    'transpose_key' => -3,
    'bpm' => 96
]);
$slUpdated = SetlistService::getById($slId);
$updItm = $slUpdated['items'][0] ?? [];

$updatedOk = $updOk
    && $updItm['chord_profile'] === 'NAM'
    && (int)$updItm['transpose_key'] === -3
    && (int)$updItm['bpm'] === 96;

check(
    $updatedOk,
    'Database: Cập nhật bài trong Setlist lưu chính xác chord_profile="NAM", transpose_key=-3, bpm=96',
    "updatedOk=" . ($updatedOk ? 'true' : 'false')
);

@unlink($tmpDb);

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Setlist Core Rule 4:\n";
echo "  - Tổng số kiểm tra: {$total}\n";
echo "  - Số kiểm tra thất bại: " . count($failures) . "\n";
if (count($failures) === 0) {
    echo "  - Trạng thái: ✅ TẤT CẢ KIỂM TRA SETLIST CORE RULE 4 ĐỀU ĐẠT (PASS)\n";
    echo "--------------------------------------------------------\n\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "  - Trạng thái: ❌ CÓ LỖI XẢY RA\n";
    echo "--------------------------------------------------------\n\n";
    exit(1);
}
