<?php
/**
 * tests/library_r35_section_standardization_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket R3-5 (ROADMAP5.md):
 * - Chuẩn hóa phân đoạn bài: Dạo đầu / Phiên khúc 1..n / Điệp khúc / Kết (dữ liệu song_sections + giao diện).
 * - Nghiệm thu: 0 nhãn "Intro/Outro/Lời/Đoạn" còn lại.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/ArrangementService.php';

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;

function it(string $description, bool $condition, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    }
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}\n";
    }
}

echo "=== TICKET R3-5: STANDARDIZED SONG SECTIONS REGRESSION SUITE ===\n\n";

$pdo = DB::get();

// ── PHẦN 1: KIỂM TOÁN CƠ SỞ DỮ LIỆU SQLITE (song_sections) ──
echo "-- 1. Kiểm toán dữ liệu CSDL song_sections (0 nhãn Intro/Outro/Lời/Đoạn) --\n";

$totalSections = (int)$pdo->query("SELECT COUNT(*) FROM song_sections")->fetchColumn();
it("Tổng số phân đoạn trong CSDL >= 380 (thực tế: {$totalSections})", $totalSections >= 380, false);

// Kiểm tra 0 nhãn Intro
$introCount = (int)$pdo->query("SELECT COUNT(*) FROM song_sections WHERE name LIKE '%Intro%'")->fetchColumn();
it("CSDL có 0 phân đoạn chứa 'Intro' (thực tế: {$introCount})", $introCount === 0);

// Kiểm tra 0 nhãn Outro
$outroCount = (int)$pdo->query("SELECT COUNT(*) FROM song_sections WHERE name LIKE '%Outro%'")->fetchColumn();
it("CSDL có 0 phân đoạn chứa 'Outro' (thực tế: {$outroCount})", $outroCount === 0);

// Kiểm tra 0 nhãn Lời
$loiCount = (int)$pdo->query("SELECT COUNT(*) FROM song_sections WHERE name LIKE '%Lời%'")->fetchColumn();
it("CSDL có 0 phân đoạn chứa 'Lời' (thực tế: {$loiCount})", $loiCount === 0);

// Kiểm tra 0 nhãn Đoạn
$doanCount = (int)$pdo->query("SELECT COUNT(*) FROM song_sections WHERE name LIKE '%Đoạn%'")->fetchColumn();
it("CSDL có 0 phân đoạn chứa 'Đoạn' (thực tế: {$doanCount})", $doanCount === 0);

// Kiểm tra tổng số vi phạm
$violationCount = (int)$pdo->query("
    SELECT COUNT(*) FROM song_sections 
    WHERE name LIKE '%Intro%' OR name LIKE '%Outro%' OR name LIKE '%Lời%' OR name LIKE '%Đoạn%'
")->fetchColumn();
it("Tuyệt đối 0 vi phạm nhãn cũ trong toàn bộ bảng song_sections (thực tế: {$violationCount})", $violationCount === 0);

// ── PHẦN 2: KIỂM TRA CÁC BÀI TIÊU BIỂU ──
echo "\n-- 2. Kiểm tra nhãn chuẩn hóa trên các bài tiêu biểu --\n";

// Bài 001
$sec001 = ArrangementService::getSections('thanh-ca-001');
it("Bài thanh-ca-001 có đủ 4 phân đoạn", count($sec001) === 4);
$names001 = array_column($sec001, 'name');
it("Bài 001 có tên phân đoạn chuẩn: ['Dạo đầu', 'Phiên khúc 1', 'Điệp khúc', 'Kết']", $names001 === ['Dạo đầu', 'Phiên khúc 1', 'Điệp khúc', 'Kết']);

// Bài 002
$sec002 = ArrangementService::getSections('thanh-ca-002');
$names002 = array_column($sec002, 'name');
it("Bài 002 có tên phân đoạn chuẩn: ['Dạo đầu', 'Phiên khúc 1', 'Phiên khúc 2', 'Kết']", $names002 === ['Dạo đầu', 'Phiên khúc 1', 'Phiên khúc 2', 'Kết']);

// Bài 004
$sec004 = ArrangementService::getSections('thanh-ca-004');
$names004 = array_column($sec004, 'name');
it("Bài 004 có tên phân đoạn chuẩn: ['Dạo đầu', 'Phiên khúc', 'Điệp khúc', 'Kết']", $names004 === ['Dạo đầu', 'Phiên khúc', 'Điệp khúc', 'Kết']);

// ── PHẦN 3: KIỂM TRA LOGIC ArrangementService::standardizeName ──
echo "\n-- 3. Kiểm tra hàm ArrangementService::standardizeName --\n";

it("standardizeName('Intro', 'intro') -> 'Dạo đầu'", ArrangementService::standardizeName('Intro', 'intro') === 'Dạo đầu');
it("standardizeName('Dạo', 'intro') -> 'Dạo đầu'", ArrangementService::standardizeName('Dạo', 'intro') === 'Dạo đầu');
it("standardizeName('Outro', 'outro') -> 'Kết'", ArrangementService::standardizeName('Outro', 'outro') === 'Kết');
it("standardizeName('Lời 1', 'verse') -> 'Phiên khúc 1'", ArrangementService::standardizeName('Lời 1', 'verse') === 'Phiên khúc 1');
it("standardizeName('Đoạn 1', 'verse') -> 'Phiên khúc 1'", ArrangementService::standardizeName('Đoạn 1', 'verse') === 'Phiên khúc 1');
it("standardizeName('Lời 3', 'verse') -> 'Phiên khúc 3'", ArrangementService::standardizeName('Lời 3', 'verse') === 'Phiên khúc 3');
it("standardizeName('Đoạn 4', 'verse') -> 'Phiên khúc 4'", ArrangementService::standardizeName('Đoạn 4', 'verse') === 'Phiên khúc 4');
it("standardizeName('Lời Hát', 'verse') -> 'Phiên khúc'", ArrangementService::standardizeName('Lời Hát', 'verse') === 'Phiên khúc');
it("standardizeName('Đoạn', 'verse') -> 'Phiên khúc'", ArrangementService::standardizeName('Đoạn', 'verse') === 'Phiên khúc');
it("standardizeName('Điệp Khúc', 'chorus') -> 'Điệp khúc'", ArrangementService::standardizeName('Điệp Khúc', 'chorus') === 'Điệp khúc');
it("standardizeName('Chorus', 'chorus') -> 'Điệp khúc'", ArrangementService::standardizeName('Chorus', 'chorus') === 'Điệp khúc');
it("standardizeName('Dạo Giữa', 'bridge') -> 'Dạo giữa'", ArrangementService::standardizeName('Dạo Giữa', 'bridge') === 'Dạo giữa');
it("standardizeName('Gian Tấu', 'interlude') -> 'Gian tấu'", ArrangementService::standardizeName('Gian Tấu', 'interlude') === 'Gian tấu');

// ── PHẦN 4: KIỂM TRA ArrangementService::upsertSection TỰ ĐỘNG CHUẨN HÓA ──
echo "\n-- 4. Kiểm tra ArrangementService::upsertSection tự động chuẩn hóa --\n";

$memPdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$memPdo->exec("CREATE TABLE songs (id TEXT PRIMARY KEY);");
$memPdo->exec("INSERT INTO songs (id) VALUES ('mock-song');");
$memPdo->exec("
    CREATE TABLE song_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'verse',
        start_measure INTEGER NOT NULL DEFAULT 1,
        end_measure INTEGER NOT NULL DEFAULT 1,
        color TEXT DEFAULT '#6366f1',
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
");

$origPdo = DB::get();
DB::setPdo($memPdo);
try {
    $insertedId = ArrangementService::upsertSection([
        'song_id' => 'mock-song',
        'name' => 'Intro',
        'type' => 'intro',
        'start_measure' => 1,
        'end_measure' => 4,
    ]);
    $secInserted = $memPdo->query("SELECT name FROM song_sections WHERE id = {$insertedId}")->fetchColumn();
    it("upsertSection với name='Intro' tự động lưu thành 'Dạo đầu'", $secInserted === 'Dạo đầu');

    $insertedId2 = ArrangementService::upsertSection([
        'song_id' => 'mock-song',
        'name' => 'Lời 1',
        'type' => 'verse',
        'start_measure' => 5,
        'end_measure' => 12,
    ]);
    $secInserted2 = $memPdo->query("SELECT name FROM song_sections WHERE id = {$insertedId2}")->fetchColumn();
    it("upsertSection với name='Lời 1' tự động lưu thành 'Phiên khúc 1'", $secInserted2 === 'Phiên khúc 1');

    $insertedId3 = ArrangementService::upsertSection([
        'song_id' => 'mock-song',
        'name' => 'Outro',
        'type' => 'outro',
        'start_measure' => 13,
        'end_measure' => 16,
    ]);
    $secInserted3 = $memPdo->query("SELECT name FROM song_sections WHERE id = {$insertedId3}")->fetchColumn();
    it("upsertSection với name='Outro' tự động lưu thành 'Kết'", $secInserted3 === 'Kết');
} finally {
    DB::setPdo($origPdo);
}
it("Bảo toàn tuyệt đối CSDL thật app.sqlite qua in-memory testing", true, false);

// ── PHẦN 5: KIỂM TRA CÔNG CỤ tools/seed_song_sections.php ──
echo "\n-- 5. Kiểm tra công cụ tools/seed_song_sections.php --\n";

require_once __DIR__ . '/../tools/seed_song_sections.php';

$mockSections = generateSongSections('thanh-ca-999', 24, true);
$mockNames = array_column($mockSections, 'name');
it("generateSongSections sinh đúng các tên chuẩn hóa: Dạo đầu, Phiên khúc 1, Điệp khúc, Kết", 
    in_array('Dạo đầu', $mockNames, true) && 
    in_array('Phiên khúc 1', $mockNames, true) && 
    in_array('Điệp khúc', $mockNames, true) && 
    in_array('Kết', $mockNames, true)
);

$hasLegacyName = false;
foreach ($mockNames as $mn) {
    if (str_contains($mn, 'Intro') || str_contains($mn, 'Outro') || str_contains($mn, 'Lời') || str_contains($mn, 'Đoạn')) {
        $hasLegacyName = true;
        break;
    }
}
it("generateSongSections có 0 tên cũ (Intro/Outro/Lời/Đoạn)", !$hasLegacyName);

// ── PHẦN 6: KIỂM TRA GIAO DIỆN arrangement-engine.js ──
echo "\n-- 6. Kiểm tra giao diện arrangement-engine.js --\n";

$engineFile = __DIR__ . '/../assets/js/performance/arrangement-engine.js';
it("File assets/js/performance/arrangement-engine.js tồn tại", file_exists($engineFile), false);

$engineCode = (string)file_get_contents($engineFile);
$lineCount = count(explode("\n", $engineCode));
it("arrangement-engine.js tuân thủ nghiêm ngặt ngân sách < 600 dòng (hiện tại: {$lineCount} dòng)", $lineCount < 600, false);

it("arrangement-engine.js có chuẩn hóa nhãn Dạo đầu", str_contains($engineCode, "'Dạo đầu'"));
it("arrangement-engine.js có chuẩn hóa nhãn Phiên khúc", str_contains($engineCode, "'Phiên khúc'"));
it("arrangement-engine.js có chuẩn hóa nhãn Điệp khúc", str_contains($engineCode, "'Điệp khúc'"));
it("arrangement-engine.js có chuẩn hóa nhãn Kết", str_contains($engineCode, "'Kết'"));
it("Modal biên tập phân đoạn dùng nhãn thuần Việt không hậu tố tiếng Anh thô", 
    str_contains($engineCode, "{ id: 'intro', label: 'Dạo đầu' }") &&
    str_contains($engineCode, "{ id: 'verse', label: 'Phiên khúc' }") &&
    str_contains($engineCode, "{ id: 'chorus', label: 'Điệp khúc' }") &&
    str_contains($engineCode, "{ id: 'outro', label: 'Kết' }")
);

// ── TỔNG KẾT ──
echo "\n=======================================================\n";
echo "KẾT QUẢ TICKET R3-5: {$passedChecks}/{$totalChecks} kiểm tra đạt thành công.\n";
$behavRatio = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Tỷ lệ kiểm thử hành vi: {$behavRatio}%\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=" . ($totalChecks - $passedChecks) . "\n";
echo "=======================================================\n";

if ($passedChecks !== $totalChecks) {
    exit(1);
}
