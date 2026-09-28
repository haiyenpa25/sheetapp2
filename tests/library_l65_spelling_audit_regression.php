<?php
/**
 * tests/library_l65_spelling_audit_regression.php
 *
 * Kiểm thử hồi quy Ticket L6-5 (Chất lượng dữ liệu):
 * - Rà chính tả tên bài (ví dụ "NGUYỀN" → "NGUYỆN").
 * - Script liệt kê từ nghi sai và danh sách sửa được duyệt (docs/SPELLING_AUDIT_REPORT.md).
 * - Chuẩn hóa khoảng trắng thừa trước dấu câu (!, ?, ,, ;).
 * - Bảo tồn từ Hán Việt cổ nguyên bản trong Thánh Ca.
 * - Tích hợp tìm kiếm FTS5 và SongService cho các tiêu đề đã chuẩn hóa.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/SongVersionHelper.php';
require_once __DIR__ . '/../tools/check_song_spelling.php';

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

echo "=== KIỂM THỬ HỒI QUY TICKET L6-5: RÀ SOÁT CHÍNH TẢ & CHUẨN HÓA TIÊU ĐỀ BÀI HÁT ===\n";

$pdo = DB::get();

// ── 1. Kiểm tra Lỗi Chính Tả Telex NGUYỀN -> NGUYỆN ──
echo "\n-- 1. Sửa lỗi chính tả gõ Telex NGUYỀN -> NGUYỆN --\n";

// 1.1 Không còn bài hát nào trong CSDL chứa từ 'NGUYỀN'
$nguyenCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE title LIKE '%NGUYỀN%' OR title LIKE '%Nguyền%'")->fetchColumn();
it("Hoàn toàn không còn bài hát nào chứa từ nghi sai 'NGUYỀN' (count = 0)", $nguyenCount === 0);

// 1.2 Kiểm tra 7 bài được sửa sang 'NGUYỆN'
$expectedNguyen = [
    'thanh-ca-002' => 'NGUYỆN TỤNG MỸ CHÚA LINH NĂNG',
    'thanh-ca-035' => 'NGUYỆN ĐÊM NAY CHRIST HÀ PHƯỚC',
    'thanh-ca-050' => 'NGUYỆN ĐƯA TÔI ĐI, HỠI ĐỨC CHÚA CHA',
    'thanh-ca-138' => 'NGUYỆN THÁNH LINH CHIẾU ÁNH CHÂN QUANG',
    'thanh-ca-231' => 'NGUYỆN CUNG HIẾN CHÚA CẢ ĐỜI TÔI',
    'thanh-ca-232' => 'TÔI NGUYỆN THUỘC VỀ JÊSUS HOÀI',
    'thanh-ca-239' => 'NGUYỆN DÌU LÊN GÔ-GÔ-THA',
];

foreach ($expectedNguyen as $songId => $expectedTitle) {
    $actualTitle = (string)$pdo->query("SELECT title FROM songs WHERE id = " . $pdo->quote($songId))->fetchColumn();
    it("Bài [{$songId}] mang tiêu đề chuẩn: '{$expectedTitle}'", $actualTitle === $expectedTitle);
}

// ── 2. Kiểm tra Sửa Thiếu Từ & Chuẩn Hóa Typography ──
echo "\n-- 2. Sửa thiếu từ bài 234 & Chuẩn hóa khoảng trắng typography --\n";

// 2.1 Bài 234 được bổ sung từ 'CHÚA'
$title234 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-234'")->fetchColumn();
it("Bài thanh-ca-234 có tiêu đề chuẩn 'TA THEO Ý CHÚA CHƯA?'", $title234 === 'TA THEO Ý CHÚA CHƯA?');

// 2.2 Không còn bài hát nào có khoảng trắng thừa trước dấu chấm than hoặc dấu hỏi
$trailingSpaceCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE title LIKE '% !%' OR title LIKE '% ?%'")->fetchColumn();
it("Không còn bài hát nào có khoảng trắng thừa trước dấu ! hoặc ? (count = 0)", $trailingSpaceCount === 0);

// 2.3 Bài 004, 011, 075 được chuẩn hóa dấu câu đẹp mắt
$title004 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-004'")->fetchColumn();
it("Bài thanh-ca-004 không có khoảng trắng trước ! ('{$title004}')", !str_contains($title004, ' !'));

$title075 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-075'")->fetchColumn();
it("Bài thanh-ca-075 kết thúc bằng dấu ! liền kề ('{$title075}')", str_ends_with($title075, 'THỎA!'));

// ── 3. Bảo Tồn Từ Cổ / Từ Hán Việt Nguyên Bản ──
echo "\n-- 3. Bảo tồn từ cổ / Hán Việt nguyên bản --\n";

// 3.1 Bài 220 giữ nguyên 'DỨC DẤY'
$title220 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-220'")->fetchColumn();
it("Bài thanh-ca-220 bảo lưu từ cổ 'DỨC DẤY' ('{$title220}')", str_contains($title220, 'DỨC DẤY'));

// 3.2 Bài 132 giữ nguyên 'BIẾN CANH'
$title132 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-132'")->fetchColumn();
it("Bài thanh-ca-132 bảo lưu từ Hán Việt 'BIẾN CANH' ('{$title132}')", str_contains($title132, 'BIẾN CANH'));

// 3.3 Bài 175 giữ nguyên 'TIỆN DANH'
$title175 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-175'")->fetchColumn();
it("Bài thanh-ca-175 bảo lưu từ khiêm xưng 'TIỆN DANH' ('{$title175}')", str_contains($title175, 'TIỆN DANH'));

// 3.4 Bài 163 giữ nguyên 'KHUYÊN LƠN'
$title163 = (string)$pdo->query("SELECT title FROM songs WHERE id = 'thanh-ca-163'")->fetchColumn();
it("Bài thanh-ca-163 bảo lưu từ kép 'KHUYÊN LƠN' ('{$title163}')", str_contains($title163, 'KHUYÊN LƠN'));

// ── 4. Kiểm tra Tìm Kiếm & Tích Hợp SongService ──
echo "\n-- 4. Tìm kiếm SongService theo tiêu đề đã chuẩn hóa --\n";

// 4.1 Tìm 'Nguyện tụng mỹ' trả về bài 002
$res002 = SongService::search('Nguyện tụng mỹ');
$found002 = array_filter($res002, fn($s) => $s['id'] === 'thanh-ca-002');
it("SongService::search('Nguyện tụng mỹ') tìm thấy bài thanh-ca-002", !empty($found002));

// 4.2 Tìm 'Thánh linh chiếu ánh' trả về bài 138
$res138 = SongService::search('Thánh linh chiếu ánh');
$found138 = array_filter($res138, fn($s) => $s['id'] === 'thanh-ca-138');
it("SongService::search('Thánh linh chiếu ánh') tìm thấy bài thanh-ca-138", !empty($found138));

// 4.3 Tìm 'Theo ý Chúa' trả về bài 234
$res234 = SongService::search('Theo ý Chúa');
$found234 = array_filter($res234, fn($s) => $s['id'] === 'thanh-ca-234');
it("SongService::search('Theo ý Chúa') tìm thấy bài thanh-ca-234", !empty($found234));

// ── 5. Kiểm tra Công cụ & Tài liệu Thẩm Định ──
echo "\n-- 5. Công cụ CLI & Tài liệu Thẩm định --\n";

it("File tools/check_song_spelling.php tồn tại", file_exists(__DIR__ . '/../tools/check_song_spelling.php'));
it("File docs/SPELLING_AUDIT_REPORT.md tồn tại", file_exists(__DIR__ . '/../docs/SPELLING_AUDIT_REPORT.md'));

// Kiểm tra hàm normalizeTitleTypography
$testTypo = normalizeTitleTypography("TÔN VINH !   MỸ DANH ? ");
it("Hàm normalizeTitleTypography xóa khoảng trắng trước dấu câu", $testTypo === "TÔN VINH! MỸ DANH?");

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
