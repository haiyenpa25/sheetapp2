<?php
/**
 * tests/library_l66_song_sections_top100_regression.php
 *
 * Kiểm thử hồi quy Ticket L6-6 (ROADMAP4.md Mục 8):
 * - Soạn bản đồ bài (song_sections) cho 50–100 bài hay dùng nhất.
 * - Cung cấp dữ liệu trực quan cho dải nhảy đoạn L3-7 (#section-jump-bar-container).
 * - Bảo lưu toàn vẹn 4 phân đoạn mẫu của bài thanh-ca-001.
 * - Đảm bảo tính hợp lệ của chỉ số ô nhịp start_measure <= end_measure.
 * - Tích hợp trơn tru với ArrangementService::getSections().
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/ArrangementService.php';

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

echo "=== KIỂM THỬ HỒI QUY TICKET L6-6: BẢN ĐỒ BÀI HÁT (SONG SECTIONS) CHO 100 BÀI HAY DÙNG ===\n";

$pdo = DB::get();

// ── 1. Kiểm tra Số Lượng Bài Hát Có Bản Đồ ──
echo "\n-- 1. Số lượng bài có bản đồ (song_sections) trong CSDL --\n";

$top100Count = (int)$pdo->query("
    SELECT COUNT(DISTINCT s.id) 
    FROM songs s 
    JOIN song_sections ss ON s.id = ss.song_id 
    WHERE s.httlvnId >= 1 AND s.httlvnId <= 100
")->fetchColumn();

it("Số bài có bản đồ trong Top 100 bài hay dùng đạt ≥ 50 bài (thực tế: {$top100Count} bài)", $top100Count >= 50);
it("Đạt trọn vẹn 100/100 bài hay dùng nhất có bản đồ bài hát", $top100Count === 100);

$totalSections = (int)$pdo->query("SELECT COUNT(*) FROM song_sections")->fetchColumn();
it("Tổng số phân đoạn trong CSDL ≥ 200 (thực tế: {$totalSections} phân đoạn)", $totalSections >= 200);

// ── 2. Bảo Lưu Tuyệt Đối 4 Phân Đoạn Gốc Bài 001 ──
echo "\n-- 2. Bảo lưu 4 phân đoạn mẫu của bài thanh-ca-001 --\n";

$sec001 = ArrangementService::getSections('thanh-ca-001');
it("Bài thanh-ca-001 có đúng 4 phân đoạn", count($sec001) === 4);

$types001 = array_column($sec001, 'type');
it("Thứ tự phân đoạn bài 001 là intro -> verse -> chorus -> outro", $types001 === ['intro', 'verse', 'chorus', 'outro']);

it("Phân đoạn Intro bài 001: [1-2]", (int)$sec001[0]['start_measure'] === 1 && (int)$sec001[0]['end_measure'] === 2);
it("Phân đoạn Lời 1 bài 001: [3-10]", (int)$sec001[1]['start_measure'] === 3 && (int)$sec001[1]['end_measure'] === 10);
it("Phân đoạn Điệp Khúc bài 001: [11-18]", (int)$sec001[2]['start_measure'] === 11 && (int)$sec001[2]['end_measure'] === 18);
it("Phân đoạn Outro bài 001: [19-20]", (int)$sec001[3]['start_measure'] === 19 && (int)$sec001[3]['end_measure'] === 20);

// ── 3. Tính Toàn Vẹn Của Các Ô Nhịp (start_measure <= end_measure) ──
echo "\n-- 3. Tính hợp lệ của cấu trúc ô nhịp --\n";

$invalidSections = $pdo->query("
    SELECT id, song_id, start_measure, end_measure 
    FROM song_sections 
    WHERE start_measure < 1 OR end_measure < start_measure
")->fetchAll();

it("Tất cả các phân đoạn đều thỏa mãn start_measure >= 1 và end_measure >= start_measure (0 vi phạm)", empty($invalidSections));

// ── 4. Kiểm tra Tích Hợp ArrangementService Trên Các Bài Mẫu ──
echo "\n-- 4. Tích hợp ArrangementService::getSections() --\n";

$sampleIds = ['thanh-ca-002', 'thanh-ca-004', 'thanh-ca-050', 'thanh-ca-100'];
foreach ($sampleIds as $sid) {
    $secs = ArrangementService::getSections($sid);
    it("ArrangementService::getSections('{$sid}') trả về ≥ 3 phân đoạn (" . count($secs) . " đoạn)", count($secs) >= 3);
}

// Bài 004 có Điệp khúc
$sec004 = ArrangementService::getSections('thanh-ca-004');
$hasChorus004 = in_array('chorus', array_column($sec004, 'type'), true);
it("Bài thanh-ca-004 (có [ĐK]) chứa phân đoạn type='chorus'", $hasChorus004);

// ── 5. Kiểm tra Công Cụ CLI ──
echo "\n-- 5. Công cụ CLI tools/seed_song_sections.php --\n";

it("File tools/seed_song_sections.php tồn tại", file_exists(__DIR__ . '/../tools/seed_song_sections.php'));
$toolContent = (string)file_get_contents(__DIR__ . '/../tools/seed_song_sections.php');
it("tools/seed_song_sections.php có bảo vệ CLI only", str_contains($toolContent, "php_sapi_name() !== 'cli'"));

// ── Tổng kết ──
$total = $passed + $failed;
echo "\n=======================================================\n";
echo "KẾT QUẢ: {$passed}/{$total} kiểm tra đạt thành công.\n";
if ($failed === 0) {
    echo "SUITE_COMPLETE total={$total} passed={$passed} failed=0\n";
    exit(0);
} else {
    echo "❌ CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
