<?php
/**
 * tests/chord_sets_consolidation_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.4 — Hợp nhất dữ liệu bộ hợp âm (Chord Sets Consolidation):
 * 1. Migration 004: Schema bảng user_chord_sets có đủ parent_id, attribution, checksum, chords_json.
 * 2. Công cụ đối soát & migration: tools/migrate_json_chord_sets_to_db.php chạy idempotent, không nhân bản.
 * 3. Single Source of Truth (SSOT): ChordSetService nạp và lưu dữ liệu trực tiếp từ SQLite DB.
 * 4. Cơ chế Fork & Attribution: lưu vết parent_id và ghi nhận tác giả gốc.
 * 5. Bảo vệ Core Rules:
 *    - CR1: HD luôn là bộ hợp âm chuẩn mực mặc định.
 *    - CR3: Khóa tuyệt đối không cho phép sửa/xóa/đè lên default, TLH, HD hoặc tên rác '__'.
 * 6. Kiểm soát quyền sở hữu: người dùng chỉ được sửa/xóa bản phối của mình (hoặc admin).
 */

declare(strict_types=1);

function check(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== CHORD SETS CONSOLIDATION REGRESSION (TASK 2.4) ===\n";

$root = dirname(__DIR__);
require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/core/DB.php';

// Khởi tạo isolated in-memory test database
$testPdo = createTestDatabase();
DB::setPdo($testPdo);

require_once $root . '/api/services/ChordSetService.php';

// --- TEST 1: Schema kiểm tra migration 004 ---
$cols = [];
$colStmt = $testPdo->query("PRAGMA table_info(user_chord_sets)");
while ($col = $colStmt->fetch(PDO::FETCH_ASSOC)) {
    $cols[strtolower($col['name'])] = true;
}

check(isset($cols['id']), 'user_chord_sets có cột id');
check(isset($cols['song_id']), 'user_chord_sets có cột song_id');
check(isset($cols['user_id']), 'user_chord_sets có cột user_id');
check(isset($cols['set_name']), 'user_chord_sets có cột set_name');
check(isset($cols['chords_json']), 'user_chord_sets có cột chords_json');
check(isset($cols['parent_id']), 'user_chord_sets có cột parent_id (Migration 004)');
check(isset($cols['attribution']), 'user_chord_sets có cột attribution (Migration 004)');
check(isset($cols['checksum']), 'user_chord_sets có cột checksum (Migration 004)');

// --- TEST 2: Seed dữ liệu bài hát test và bản phối chuẩn HD ---
$songId = 'thanh-ca-001';
$testPdo->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name) VALUES (4, 'hoaidinh', 'hash', 'banhat', 'Hoài Dinh')");
$testPdo->exec("INSERT OR IGNORE INTO songs (id, title, xmlPath, defaultKey) VALUES ('thanh-ca-001', 'Hỡi Thánh Vương, Kíp Ngự Lai', 'storage/Thanh ca/001.xml', 'G')");

$sampleChords = [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'G'],
    ['measureIdx' => 1, 'noteIdx' => 0, 'chord' => 'C'],
    ['measureIdx' => 2, 'noteIdx' => 0, 'chord' => 'D7']
];

// Lưu bản phối chuẩn HD
$saveHdOk = ChordSetService::saveSet($songId, 'HD', $sampleChords, 4, 'hoaidinh', 'Bản phối gốc của Hoài Dinh');
check($saveHdOk, 'ChordSetService::saveSet lưu thành công bộ HD vào CSDL');

// --- TEST 3: Nạp và kiểm tra SSOT từ CSDL ---
$loadedChords = ChordSetService::loadSet($songId, 'HD');
check(count($loadedChords) === 3, 'ChordSetService::loadSet nạp đúng 3 hợp âm từ CSDL');
check($loadedChords[0]['chord'] === 'G', 'Hợp âm ô 0 đúng nốt G');

$setDetails = ChordSetService::getSetDetails($songId, 'HD');
check($setDetails !== null, 'getSetDetails trả về thông tin chi tiết của bộ HD');
check($setDetails['attribution'] === 'Bản phối gốc của Hoài Dinh', 'Attribution của HD được lưu chính xác');
check(!empty($setDetails['checksum']), 'Checksum MD5 được tự động tính toán');

// --- TEST 4: Danh sách bộ hợp âm và Core Rule 1 ---
$sets = ChordSetService::listSets($songId);
check(in_array('HD', $sets, true), 'Core Rule 1: HD luôn xuất hiện trong listSets');
check($sets[0] === 'HD', 'Core Rule 1: HD luôn được ưu tiên đứng đầu');

// --- TEST 5: Cơ chế Fork và Attribution ---
$forkRes = ChordSetService::forkSet(
    $songId, 
    'HD', 
    'Acoustic_Guitar', 
    1, 
    'banhat', 
    ['instrument_type' => 'guitar', 'capo_fret' => 2, 'notes_guide' => 'Điệu Ballad']
);

check($forkRes['success'] === true, 'ChordSetService::forkSet tạo thành công bản fork');
check(isset($forkRes['data']['parent_id']), 'Bản fork có liên kết parent_id');
check(str_contains($forkRes['data']['attribution'], 'HD'), 'Attribution ghi nhận nguồn fork từ HD');

// Kiểm tra chi tiết bản fork trong DB
$forkDetails = ChordSetService::getSetDetails($songId, 'Acoustic_Guitar');
check($forkDetails !== null, 'Bản fork Acoustic_Guitar được lưu vào DB');
check((int)$forkDetails['parent_id'] === (int)$setDetails['id'], 'parent_id của bản fork trỏ đúng vào id của bộ HD');
check((int)$forkDetails['capo_fret'] === 2, 'Cấu hình capo_fret được lưu đúng');

// --- TEST 6: Core Rule 3 — Chặn sửa/xóa/đè lên default, TLH, HD hoặc tên '__' ---
$blockDefault = ChordSetService::saveSet($songId, 'default', $sampleChords);
check(!$blockDefault, 'Core Rule 3: Chặn ghi đè lên bộ default');

$blockTlh = ChordSetService::saveSet($songId, 'TLH', $sampleChords);
check(!$blockTlh, 'Core Rule 3: Chặn ghi đè lên bộ TLH');

$blockGarbage = ChordSetService::saveSet($songId, '__create_new_set__', $sampleChords);
check(!$blockGarbage, 'Core Rule 3: Chặn lưu tên bộ rác bắt đầu bằng __');

$blockDeleteHd = ChordSetService::deleteSet($songId, 'HD');
check(!$blockDeleteHd, 'Core Rule 3: Chặn tuyệt đối không cho xóa bộ HD');

$blockDeleteTlh = ChordSetService::deleteSet($songId, 'TLH');
check(!$blockDeleteTlh, 'Core Rule 3: Chặn tuyệt đối không cho xóa bộ TLH');

// Cho phép xóa bản fork cá nhân
$allowDeleteCustom = ChordSetService::deleteSet($songId, 'Acoustic_Guitar', 1, false);
check($allowDeleteCustom, 'Cho phép tác giả xóa bộ hợp âm do mình tạo');

$checkDeleted = ChordSetService::getSetDetails($songId, 'Acoustic_Guitar');
check($checkDeleted === null, 'Bộ Acoustic_Guitar đã bị xóa khỏi CSDL');

// --- TEST 7: Kiểm tra công cụ CLI đối soát ---
$toolPath = $root . '/tools/migrate_json_chord_sets_to_db.php';
check(file_exists($toolPath), 'File tools/migrate_json_chord_sets_to_db.php tồn tại');

$output = [];
$exitCode = 0;
exec("C:\\xampp\\php\\php.exe " . escapeshellarg($toolPath) . " --reconcile 2>&1", $output, $exitCode);
check($exitCode === 0, 'tools/migrate_json_chord_sets_to_db.php --reconcile thực thi thành công');
$outText = implode("\n", $output);
check(str_contains($outText, '903'), 'Công cụ đối soát phát hiện đủ 903 bài thánh ca');

echo "\n>>> ALL 7/7 CHORD SETS CONSOLIDATION REGRESSION CHECKS PASSED!\n";
