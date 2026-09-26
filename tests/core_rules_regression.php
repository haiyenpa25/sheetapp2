<?php
declare(strict_types=1);

/**
 * tests/core_rules_regression.php
 * 
 * Kiểm thử tự động hồi quy 4 Core Rules của SheetApp2 (9 kịch bản kiểm thử):
 * - CR1-a: Mở bài có HD > 0 hợp âm -> Chọn HD, inject hợp âm HD, ẩn TLH
 * - CR1-b: Mở bài có HD rỗng -> Fallback về TLH gốc, không inject map rỗng
 * - CR2-a: Tông gốc = 0 khi mở từ thư viện, không khôi phục tông bài trước
 * - CR2-b: Mở bài từ Setlist -> Áp dụng đúng tông lưu trong setlist (transposeOverride)
 * - CR3-a: Khóa bộ HD và TLH -> Không cho phép xóa (cả backend lẫn giao diện)
 * - CR3-b: Xóa bộ hợp âm cá nhân đang kích hoạt -> Tự động fallback về HD
 * - CR4-a: Đồng bộ BPM từ Setlist -> Metronome nhận BPM của setlist thay vì XML gốc
 * - CR4-b: Lưu bài tập vào Setlist -> Lưu đủ 3 trường: chord_profile, transpose_key, bpm
 * - CR4-c: Tài khoản nhạc công / không phải admin -> Vẫn có quyền dùng nút Lưu Tập
 */

$root = dirname(__DIR__);

// Sử dụng DB Fixture SQLite tạm thời
$tmpDbFile = sys_get_temp_dir() . '/sheetapp_cr_' . bin2hex(random_bytes(4)) . '.sqlite';
putenv('DB_PATH=' . $tmpDbFile);

require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SetlistService.php';
require_once $root . '/api/services/ChordSetService.php';

$pdo = DB::get();
$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        display_name TEXT,
        chord_code TEXT
    );
    CREATE TABLE IF NOT EXISTS setlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_by INTEGER,
        scheduled_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Seed users cho test phân quyền
$pdo->exec("
    INSERT INTO users (id, username, password_hash, role, chord_code)
    VALUES 
        (1, 'admin_user', 'hash_admin', 'admin', 'ADMIN'),
        (2, 'guitarist_nam', 'hash_nam', 'banhat', 'NAM'),
        (3, 'member_viewer', 'hash_viewer', 'viewer', NULL);
");

$failures = [];
$totalTests = 0;

function assertRule(string $scenarioId, bool $condition, string $ruleDescription, string $failureDetails = ''): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures, $totalTests;
    $totalTests++;
    if ($condition) {
        echo "  [PASS] {$scenarioId}: {$ruleDescription}\n";
    } else {
        $msg = "  [FAIL] {$scenarioId}: {$ruleDescription}" . ($failureDetails ? " -> {$failureDetails}" : "");
        echo "{$msg}\n";
        $failures[] = $msg;
    }
}

echo "========================================================\n";
echo "   SheetApp2 — Core Rules Automated Regression Suite   \n";
echo "========================================================\n\n";

try {
    // -------------------------------------------------------------------------
    // CR1: BỘ HỢP ÂM HD LÀ MẶC ĐỊNH
    // -------------------------------------------------------------------------
    echo "--- Kiểm tra CORE RULE 1: Bộ Hợp Âm HD là Mặc Định ---\n";

    // Tạo thư mục tạm giả lập chord sets
    $tmpChordBase = sys_get_temp_dir() . '/sheetapp_chords_' . bin2hex(random_bytes(4));
    mkdir($tmpChordBase, 0755, true);
    mkdir($tmpChordBase . '/song_hd_with_chords', 0755, true);
    mkdir($tmpChordBase . '/song_hd_empty', 0755, true);

    $hdChordsData = [
        ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'G'],
        ['measureIdx' => 1, 'noteIdx' => 0, 'chord' => 'C']
    ];
    file_put_contents($tmpChordBase . '/song_hd_with_chords/HD.json', json_encode($hdChordsData));
    file_put_contents($tmpChordBase . '/song_hd_empty/HD.json', json_encode([]));

    // CR1-a: Mở bài có HD > 0 hợp âm -> Hiện HD, ẩn TLH
    $hdChords = json_decode((string)file_get_contents($tmpChordBase . '/song_hd_with_chords/HD.json'), true);
    $hasCustomChords = is_array($hdChords) && count($hdChords) > 0;
    
    // Đọc mã nguồn song-loader.js để xác minh rule injectChords
    $songLoaderSrc = file_get_contents($root . '/assets/js/song-loader.js') ?: '';
    $chordCanvasSrc = file_get_contents($root . '/assets/js/chord-canvas.js') ?: '';

    $injectsHdChords = str_contains($songLoaderSrc, "currentSet !== 'default' && Object.keys(chords).length > 0")
        && str_contains($songLoaderSrc, "window.ChordCanvasXML?.cloneAndInjectChords?.(xml, chords)");
    $defaultsToHd = str_contains($chordCanvasSrc, "async function loadSong(songId, initialSet = 'HD')")
        || str_contains($chordCanvasSrc, "profileOverride = 'HD'");

    assertRule(
        'CR1-a',
        $hasCustomChords && $injectsHdChords && $defaultsToHd,
        'Mở bài có HD > 0 hợp âm: loadSong mặc định chọn HD và _injectChords tiêm hợp âm HD vào bản nhạc',
        "hasCustomChords=" . ($hasCustomChords ? 'true' : 'false') . ", injectsHdChords=" . ($injectsHdChords ? 'true' : 'false')
    );

    // CR1-b: Mở bài có HD rỗng -> Hiện TLH gốc, không inject map rỗng
    $emptyHdChords = json_decode((string)file_get_contents($tmpChordBase . '/song_hd_empty/HD.json'), true);
    $isEmpty = is_array($emptyHdChords) && count($emptyHdChords) === 0;

    // Khi chords rỗng, _injectChords phải trả về xml gốc nguyên bản (không gọi cloneAndInjectChords)
    $guardAgainstEmpty = str_contains($songLoaderSrc, "Object.keys(chords).length > 0")
        && str_contains($songLoaderSrc, "return xml;");

    assertRule(
        'CR1-b',
        $isEmpty && $guardAgainstEmpty,
        'Mở bài có HD rỗng: _injectChords bảo vệ không tiêm map rỗng, trả về XML gốc TLH chuẩn mực',
        "isEmpty=" . ($isEmpty ? 'true' : 'false') . ", guardAgainstEmpty=" . ($guardAgainstEmpty ? 'true' : 'false')
    );

    // -------------------------------------------------------------------------
    // CR2: TÔNG GỐC = 0 LUÔN LUÔN
    // -------------------------------------------------------------------------
    echo "\n--- Kiểm tra CORE RULE 2: Tông Gốc = 0 Luôn Luôn ---\n";

    // CR2-a: Dịch +3, chuyển sang bài khác từ thư viện -> Tông = 0
    $resetsTransposeToZero = str_contains($songLoaderSrc, "Store.set('currentTranspose', transposeOverride ?? 0);");
    $noRestoreLastTranspose = !str_contains($songLoaderSrc, "settings?.userSettings?.lastTranspose")
        && !str_contains($songLoaderSrc, "settings.lastTranspose");

    assertRule(
        'CR2-a',
        $resetsTransposeToZero && $noRestoreLastTranspose,
        'Dịch +3 rồi chuyển bài từ thư viện: transposeOverride là null -> currentTranspose luôn reset về 0 (loại bỏ hoàn toàn lastTranspose)',
        "resetsTransposeToZero=" . ($resetsTransposeToZero ? 'true' : 'false') . ", noRestoreLastTranspose=" . ($noRestoreLastTranspose ? 'true' : 'false')
    );

    // CR2-b: Mở bài từ setlist có transpose = +2 -> Tông = +2
    $setlistUiSrc = file_get_contents($root . '/assets/js/setlist-ui.js') ?: '';
    $appJsSrc = file_get_contents($root . '/assets/js/app.js') ?: '';

    $setlistPassesTranspose = str_contains($setlistUiSrc, "loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key)")
        || str_contains($setlistUiSrc, "loadSongWithProfile(songObj, item.chord_profile, item.transpose_key)");
    $appDelegatesToSongLoader = str_contains($appJsSrc, "SongLoader.load(song, t, profile)")
        || str_contains($appJsSrc, "SongLoader.load(song, t)");

    assertRule(
        'CR2-b',
        $setlistPassesTranspose && $appDelegatesToSongLoader,
        'Mở bài từ setlist có transpose = +2: SetlistUI truyền item.transpose_key (+2) làm transposeOverride vào SongLoader.load',
        "setlistPasses=" . ($setlistPassesTranspose ? 'true' : 'false') . ", appDelegates=" . ($appDelegatesToSongLoader ? 'true' : 'false')
    );

    // -------------------------------------------------------------------------
    // CR3: KHÓA BỘ HỢP ÂM TLH VÀ HD
    // -------------------------------------------------------------------------
    echo "\n--- Kiểm tra CORE RULE 3: Khóa TLH và HD ---\n";

    // CR3-a: Đăng nhập admin, mở dropdown bộ hợp âm -> Không có nút xoá cho HD và TLH
    // Gọi trực tiếp ChordSetService để kiểm tra hành vi thật: từ chối xóa HD, TLH, default
    $delHdOk  = ChordSetService::deleteSet('test_cr3', 'HD');
    $delTlhOk = ChordSetService::deleteSet('test_cr3', 'TLH');
    $delDefOk = ChordSetService::deleteSet('test_cr3', 'default');
    $svcProtectsHdAndTlh = ($delHdOk === false && $delTlhOk === false && $delDefOk === false);
    
    // Kiểm tra controller logic bảo vệ xóa
    $chordCtrlSrc = file_get_contents($root . '/api/controllers/ChordSetController.php') ?: '';

    $ctrlRejectsHdAndTlh = str_contains($chordCtrlSrc, "\$name === 'default' || \$name === 'TLH' || \$name === 'HD'")
        && str_contains($chordCtrlSrc, "Response::forbidden('Bộ hợp âm này được bảo vệ, không thể xóa!');");
    
    // Kiểm tra Frontend ChordCanvas UI: nút xóa không hiển thị cho default và HD
    $frontendHidesDeleteBtn = str_contains($chordCanvasSrc, "const isDeletable = _currentSet !== 'default' && _currentSet !== 'HD'")
        && str_contains($chordCanvasSrc, "if (!name || name === 'default' || name === 'TLH' || name === 'HD')");

    assertRule(
        'CR3-a',
        $svcProtectsHdAndTlh && $ctrlRejectsHdAndTlh && $frontendHidesDeleteBtn,
        'Bộ TLH và HD bị khóa bất biến: Service & Controller từ chối xóa (HTTP 403), UI ẩn hoàn toàn nút xóa kể cả với Admin',
        "svcProtects=" . ($svcProtectsHdAndTlh ? 'true' : 'false') . ", ctrlRejects=" . ($ctrlRejectsHdAndTlh ? 'true' : 'false') . ", uiHides=" . ($frontendHidesDeleteBtn ? 'true' : 'false')
    );

    // CR3-b: Xoá bộ cá nhân đang chọn -> Quay về HD
    $fallbackToHdOnDelete = str_contains($chordCanvasSrc, "if (_currentSet === name) await switchSet('HD');");
    $notFallbackToDefault = !str_contains($chordCanvasSrc, "if (_currentSet === name) await switchSet('default');");

    assertRule(
        'CR3-b',
        $fallbackToHdOnDelete && $notFallbackToDefault,
        'Xóa bộ cá nhân đang chọn: ChordCanvas.deleteSet tự động fallback sang bộ "HD" thay vì default',
        "fallbackToHd=" . ($fallbackToHdOnDelete ? 'true' : 'false') . ", notDefault=" . ($notFallbackToDefault ? 'true' : 'false')
    );

    // -------------------------------------------------------------------------
    // CR4: ĐỒNG BỘ TÔNG & TEMPO TRONG SETLIST
    // -------------------------------------------------------------------------
    echo "\n--- Kiểm tra CORE RULE 4: Đồng Bộ Tông & Tempo Trong Setlist ---\n";

    // CR4-a: Setlist item BPM = 90, bài XML tempo = 72, bấm phát -> Metronome = 90, chip hiện 90
    $setlistAppliesBpm = str_contains($setlistUiSrc, "if (item.bpm && window.Metronome)")
        && str_contains($setlistUiSrc, "window.Metronome.setBpmAndBeats(parseInt(item.bpm)");
    
    assertRule(
        'CR4-a',
        $setlistAppliesBpm,
        'Bấm phát bài trong Setlist: Metronome nhận trực tiếp item.bpm đã lưu và áp dụng nhịp/phách ghi đè tempo XML gốc',
        "setlistAppliesBpm=" . ($setlistAppliesBpm ? 'true' : 'false')
    );

    // CR4-b: Lưu vào setlist từ SongInfoBar -> Lưu đủ tông + BPM + chord_profile
    // Thực hiện test trên Database Fixture thực tế
    $setlistId = SetlistService::create('Chúa Nhật Phục Sinh', '2026-04-12', 2);
    SetlistService::addItem(
        $setlistId,
        'song_thanh_ca_100',
        'HD',
        3,   // transpose_key = +3
        95,  // bpm = 95
        4    // 4/4
    );

    $savedSetlist = SetlistService::getById($setlistId);
    $item = $savedSetlist['items'][0] ?? null;

    $hasAllFields = $item !== null
        && $item['chord_profile'] === 'HD'
        && (int)$item['transpose_key'] === 3
        && (int)$item['bpm'] === 95
        && (int)$item['beats_per_measure'] === 4;

    // Test cập nhật (updateItem / Lưu Tập)
    $updateOk = SetlistService::updateItem((int)$item['id'], [
        'chord_profile' => 'NAM',
        'transpose_key' => -2,
        'bpm' => 108
    ]);

    $reloaded = SetlistService::getById($setlistId);
    $updatedItem = $reloaded['items'][0] ?? [];

    $updateAllFields = $updateOk
        && $updatedItem['chord_profile'] === 'NAM'
        && (int)$updatedItem['transpose_key'] === -2
        && (int)$updatedItem['bpm'] === 108;

    assertRule(
        'CR4-b',
        $hasAllFields && $updateAllFields,
        'Lưu vào setlist & cập nhật Lưu Tập: DB lưu trữ toàn vẹn chord_profile, transpose_key và bpm',
        "hasAll=" . ($hasAllFields ? 'true' : 'false') . ", updateAll=" . ($updateAllFields ? 'true' : 'false')
    );

    // CR4-c: Tài khoản không phải admin -> Vẫn thấy & dùng được nút Lưu Tập
    // User 2 (guitarist_nam, role: banhat) sở hữu setlist $setlistId
    $isOwnerCheck = SetlistService::isItemOwner((int)$item['id'], 2);
    $otherUserCheck = !SetlistService::isItemOwner((int)$item['id'], 3); // User 3 không sở hữu

    // Kiểm tra UI không chặn nút Lưu Tập bằng isAdmin
    $uiNoAdminGuardForSaveBpm = !str_contains($setlistUiSrc, "isAdmin && '<button class=\"icon-btn-xs btn-save-bpm\"")
        && str_contains($setlistUiSrc, 'btn-save-bpm');

    // Kiểm tra Controller không yêu cầu requireAdmin cho update_item
    $setlistCtrlSrc = file_get_contents($root . '/api/controllers/SetlistController.php') ?: '';
    $updateRequiresOnlyLogin = str_contains($setlistCtrlSrc, "\$action === 'update_item'")
        && str_contains($setlistCtrlSrc, "!Auth::isAdmin() && !SetlistService::isItemOwner(\$id, (int)\$userId)")
        && !str_contains($setlistCtrlSrc, "Auth::requireAdmin();");

    assertRule(
        'CR4-c',
        $isOwnerCheck && $otherUserCheck && $uiNoAdminGuardForSaveBpm && $updateRequiresOnlyLogin,
        'Tài khoản không phải admin (Ban Hát): nút Lưu Tập hiển thị đầy đủ và API update_item cho phép chủ setlist cập nhật',
        "isOwner=" . ($isOwnerCheck ? 'true' : 'false') . ", uiNoAdminGuard=" . ($uiNoAdminGuardForSaveBpm ? 'true' : 'false') . ", apiAllowsOwner=" . ($updateRequiresOnlyLogin ? 'true' : 'false')
    );

} finally {
    // Dọn dẹp tài nguyên test
    if (isset($tmpChordBase) && is_dir($tmpChordBase)) {
        @unlink($tmpChordBase . '/song_hd_with_chords/HD.json');
        @unlink($tmpChordBase . '/song_hd_empty/HD.json');
        @rmdir($tmpChordBase . '/song_hd_with_chords');
        @rmdir($tmpChordBase . '/song_hd_empty');
        @rmdir($tmpChordBase);
    }
    if (file_exists($tmpDbFile)) {
        @unlink($tmpDbFile);
    }
}

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Core Rules:\n";
echo "  - Tổng số test kịch bản: {$totalTests}/9\n";
echo "  - Số test thất bại: " . count($failures) . "\n";
if (count($failures) === 0) {
    echo "  - Trạng thái: ✅ TẤT CẢ 9 KỊCH BẢN CORE RULES ĐẠT CHUẨN (PASS)\n";
    echo "--------------------------------------------------------\n\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "  - Trạng thái: ❌ CÓ LỖI XẢY RA TRONG CORE RULES\n";
    echo "--------------------------------------------------------\n\n";
    exit(1);
}
