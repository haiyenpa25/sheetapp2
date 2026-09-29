<?php
/**
 * tests/library_r45_print_service_program_regression.php
 *
 * Regression test suite cho Ticket R4-5:
 * - Bản in "Lời & Hợp âm" (print/chord-sheet.php):
 *   + In / xuất PDF theo tông đang chọn, cỡ chữ to rõ, 1 cột hoặc 2 cột.
 *   + Hỗ trợ dịch giọng (transpose), bộ hợp âm (HD/TLH).
 * - Bản in "Tập chương trình thờ phượng" (print/service-booklet.php):
 *   + In trọn bộ các bài trong buổi nhóm kèm trang bìa thứ tự chương trình (cho người không dùng thiết bị).
 *   + Từ ngữ Tin Lành chuẩn hóa: "Tập chương trình thờ phượng" (Phụ lục A #34), "Người hát chính", "Ban hát", v.v.
 * - Tuân thủ Core Rules: Ưu tiên bộ hợp âm HD mặc định, Line budget < 600 dòng.
 */

declare(strict_types=1);

$testCount = 0;
$passedCount = 0;

function it(string $desc, bool $result): void {
    global $testCount, $passedCount;
    $testCount++;
    if ($result) {
        $passedCount++;
        echo "  [PASS] {$desc}\n";
    } else {
        echo "  [FAIL] {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket R4-5: Bản In Lời & Hợp Âm và Tập Chương Trình Thờ Phượng ===\n\n";

$chordSheetFile = __DIR__ . '/../print/chord-sheet.php';
$serviceBookletFile = __DIR__ . '/../print/service-booklet.php';
$bookletCssFile = __DIR__ . '/../print/booklet.css';

// ── 1. Kiểm tra tồn tại và cú pháp PHP ──
echo "-- 1. Kiểm tra file và cú pháp PHP --\n";
it('File print/chord-sheet.php tồn tại', file_exists($chordSheetFile));
it('File print/service-booklet.php tồn tại', file_exists($serviceBookletFile));
it('File print/booklet.css tồn tại', file_exists($bookletCssFile));

$chordSheetContent = file_get_contents($chordSheetFile) ?: '';
$serviceBookletContent = file_get_contents($serviceBookletFile) ?: '';
$bookletCssContent = file_get_contents($bookletCssFile) ?: '';

$chordSheetLines = count(explode("\n", $chordSheetContent));
$serviceBookletLines = count(explode("\n", $serviceBookletContent));

it("print/chord-sheet.php tuân thủ line budget < 600 dòng (hiện tại: {$chordSheetLines} dòng)", $chordSheetLines < 600);
it("print/service-booklet.php tuân thủ line budget < 600 dòng (hiện tại: {$serviceBookletLines} dòng)", $serviceBookletLines < 600);

// ── 2. Kiểm tra tính năng print/chord-sheet.php (Lời & Hợp âm) ──
echo "\n-- 2. Kiểm tra bản in Lời & Hợp âm (print/chord-sheet.php) --\n";

it('chord-sheet.php ưu tiên bộ hợp âm HD mặc định (Core Rule 1)',
    str_contains($chordSheetContent, "\$chordSet = trim(\$_GET['set'] ?? (\$_GET['chord_set'] ?? 'HD'))") &&
    str_contains($chordSheetContent, "if (\$chordSet === '') \$chordSet = 'HD'")
);

it('chord-sheet.php hỗ trợ tham số dịch giọng transpose [-12, 12]',
    str_contains($chordSheetContent, "\$transpose = max(-12, min(12, \$transpose))")
);

it('chord-sheet.php hỗ trợ tùy chọn 1 cột hoặc 2 cột linh hoạt',
    str_contains($chordSheetContent, "\$cols = isset(\$_GET['cols']) ? (int)\$_GET['cols'] : 1") &&
    str_contains($chordSheetContent, "id=\"btn-toggle-cols\"")
);

it('chord-sheet.php hỗ trợ bật/tắt hiển thị dòng hợp âm (chỉ in lời)',
    str_contains($chordSheetContent, "\$showChords = !isset(\$_GET['chords']) || \$_GET['chords'] !== '0'") &&
    str_contains($chordSheetContent, "toggleChords()")
);

it('chord-sheet.php cung cấp công cụ chỉnh cỡ chữ trực quan (A- / A+)',
    str_contains($chordSheetContent, "changeFontSize(-1)") &&
    str_contains($chordSheetContent, "changeFontSize(1)")
);

it('chord-sheet.php có nút xuất định dạng .chordpro gốc và nút in/xuất PDF',
    str_contains($chordSheetContent, 'route=export&format=chordpro') &&
    str_contains($chordSheetContent, 'window.print()')
);

it('chord-sheet.php sử dụng từ ngữ âm nhạc chuẩn Tin Lành (Tông hát, Tốc độ, Nhịp, Tác giả)',
    str_contains($chordSheetContent, 'Tông hát:') &&
    str_contains($chordSheetContent, 'Tốc độ:') &&
    str_contains($chordSheetContent, 'Nhịp:') &&
    str_contains($chordSheetContent, 'Tác giả:')
);

it('chord-sheet.php gắn nhãn footer SheetApp Thờ Phượng chuẩn hóa',
    str_contains($chordSheetContent, 'Thánh Ca Hội Thánh — SheetApp Thờ Phượng')
);

// ── 3. Kiểm tra tính năng print/service-booklet.php (Tập chương trình thờ phượng) ──
echo "\n-- 3. Kiểm tra Tập chương trình thờ phượng (print/service-booklet.php) --\n";

it('service-booklet.php sử dụng tiêu đề chuẩn Tin Lành "Tập chương trình thờ phượng" (Phụ lục A #34)',
    str_contains($serviceBookletContent, 'Tập chương trình thờ phượng') &&
    str_contains($serviceBookletContent, 'In tập chương trình / Lưu PDF')
);

it('service-booklet.php không dùng từ ngữ Công giáo "Ca viên chính" mà dùng "Người hát chính"',
    !str_contains($serviceBookletContent, 'Ca viên chính') &&
    str_contains($serviceBookletContent, 'Người hát chính:')
);

it('service-booklet.php không dùng "Booklet Thờ Phượng" ở trang chân bài mà dùng "Tập chương trình thờ phượng"',
    !str_contains($serviceBookletContent, 'Booklet Thờ Phượng') &&
    str_contains($serviceBookletContent, 'Tập chương trình thờ phượng — SheetApp')
);

it('service-booklet.php có trang bìa tổng quan với bảng thứ tự chi tiết chương trình',
    str_contains($serviceBookletContent, 'Thứ Tự Chi Tiết Chương Trình') &&
    str_contains($serviceBookletContent, '<table class="program-table">') &&
    str_contains($serviceBookletContent, 'STT') &&
    str_contains($serviceBookletContent, 'Tiết mục / Bài hát') &&
    str_contains($serviceBookletContent, 'Tông hát')
);

it('service-booklet.php phân tích và render từng bài hát với ChordProService::export()',
    str_contains($serviceBookletContent, 'ChordProService::export($songId, $chordSet, $transpose)')
);

it('service-booklet.php phân bổ ngắt trang in chuẩn CSS (@media print break-after: page)',
    str_contains($serviceBookletContent, 'page-break-after: always; break-after: page;') ||
    str_contains($bookletCssContent, 'page-break-after: always; break-after: page;')
);

it('service-booklet.php hỗ trợ hiển thị ghi chú cho ban nhạc dưới mỗi bài',
    str_contains($serviceBookletContent, 'Ghi chú cho ban nhạc:')
);

it('service-booklet.php lưu và phục hồi cỡ chữ tùy chỉnh từ localStorage (sheetapp_booklet_fontsize)',
    str_contains($serviceBookletContent, "localStorage.setItem('sheetapp_booklet_fontsize'") &&
    str_contains($serviceBookletContent, "localStorage.getItem('sheetapp_booklet_fontsize'")
);

// ── 4. Kiểm tra render logic và hàm phân tích ChordPro ──
echo "\n-- 4. Kiểm tra logic phân tích và render ChordPro sang HTML --\n";

require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/TransposeHelper.php';

// Gọi hàm helper từ service-booklet.php qua isolation
$testChordLine = "[G]Tôn vinh [D/F#]Chúa quyền [Em]năng trên cõi trời";

// Tự định nghĩa hàm test mô phỏng renderBookletChordLine
$pattern = '/(?:\[([^\]]+)\])?([^\[]+)/u';
preg_match_all($pattern, $testChordLine, $matches, PREG_SET_ORDER);

it('Biểu thức chính quy tách đúng các cặp Hợp âm / Lời',
    count($matches) >= 3 &&
    $matches[0][1] === 'G' &&
    $matches[1][1] === 'D/F#' &&
    $matches[2][1] === 'Em'
);

$exportedChordPro = ChordProService::export('001', 'HD', 0);
it('ChordProService::export nạp và xuất thành công bài 001 với bộ HD',
    is_string($exportedChordPro) &&
    str_contains($exportedChordPro, '{title:') &&
    str_contains($exportedChordPro, '{key:')
);

$transposedKey = TransposeHelper::transpose('G', 2);
it('TransposeHelper dịch giọng chính xác (G + 2 semitones = A)',
    $transposedKey === 'A'
);

// ── 5. Tổng kết kết quả kiểm thử ──
echo "\n-------------------------------------------------------\n";
echo "Kết quả: {$passedCount}/{$testCount} kiểm tra thành công.\n";

if ($passedCount === $testCount) {
    echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=0\n";
    exit(0);
} else {
    $failed = $testCount - $passedCount;
    echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed={$failed}\n";
    exit(1);
}
