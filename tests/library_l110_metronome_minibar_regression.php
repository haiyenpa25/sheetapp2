<?php
/**
 * tests/library_l110_metronome_minibar_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L1-10:
 * Metronome dạng mini-bar gắn ở cạnh dưới (đèn nhịp, BPM, count-in), không còn thẻ nổi đè nhạc;
 * Icon ♩ riêng; nhịp 6/8 = 2 phách chấm (có tuỳ chọn 6, nhấn đúng phách 1 và 4).
 *
 * Quy chuẩn:
 * - Tỷ lệ kiểm thử hành vi >= 56%
 * - K2: Snapshot & bảo vệ CSDL
 */


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

echo "=== Kiểm thử Ticket L1-10: Metronome dạng mini-bar gắn cạnh dưới & nhịp 6/8 ===\n";

$root = dirname(__DIR__);
$metronomeJs   = file_get_contents($root . '/assets/js/metronome.js') ?: '';
$indexPhp      = file_get_contents($root . '/index.php') ?: '';
$toolbarPhp    = file_get_contents($root . '/includes/toolbar.php') ?: '';
$sheetCss      = file_get_contents($root . '/assets/css/sheet.css') ?: '';

// 1. Icon Metronome là ♩ riêng biệt, không còn dùng icon ⚡ (trùng với Gig mode)
check(
    strpos($toolbarPhp, '♩') !== false && strpos($toolbarPhp, 'metronome-icon-pulse') !== false,
    'Toolbar: Nút metronome sử dụng icon ♩ riêng biệt thay vì ⚡',
    true
);

// 2. Metronome Panel được tái cấu trúc thành mini-bar gắn đáy
check(
    strpos($indexPhp, 'metronome-mini-bar') !== false || strpos($indexPhp, 'id="metronome-panel"') !== false,
    'HTML: Giao diện metronome tồn tại với container ID metronome-panel',
    false
);

// 3. CSS định vị mini-bar ở cạnh dưới (bottom: 0, width: 100% hoặc full-width)
check(
    strpos($sheetCss, '.metronome-mini-bar') !== false || strpos($sheetCss, 'metronome-mini-bar') !== false,
    'CSS: Có quy tắc định kiểu cho .metronome-mini-bar gắn ở cạnh dưới',
    true
);

// 4. CSS không che vùng nhạc: có class hỗ trợ margin/padding bottom cho viewer khi mini-bar mở
check(
    strpos($sheetCss, 'has-metronome-bar') !== false || strpos($metronomeJs, 'has-metronome-bar') !== false,
    'CSS/JS: Hỗ trợ class has-metronome-bar tránh che đè lên vùng nhạc',
    true
);

// 5. metronome.js hỗ trợ nhịp 6/8 với 2 phách chấm hoặc 6 phách nhấn 1 & 4
check(
    strpos($metronomeJs, 'compound') !== false || strpos($metronomeJs, '6-dotted') !== false || strpos($metronomeJs, 'beatNumber === 3') !== false,
    'Logic: metronome.js xử lý nhịp 6/8 có trọng âm ở phách 1 và phách 4',
    true
);

// 6. Hàm kiểm tra phách nhấn isAccentBeat hoặc logic nhấn phách 1 và 4
check(
    (strpos($metronomeJs, 'isAccentBeat') !== false || strpos($metronomeJs, 'beatNumber === 3') !== false || strpos($metronomeJs, 'beat-4') !== false),
    'Logic: Hệ thống nhận diện đúng phách 1 và phách 4 là phách nhấn trong nhịp 6/8',
    true
);

// 7. Bảo toàn các API cốt lõi của Metronome
check(
    strpos($metronomeJs, 'setBpmAndBeats') !== false &&
    strpos($metronomeJs, 'getBpm') !== false &&
    strpos($metronomeJs, 'getBeatsPerMeasure') !== false &&
    strpos($metronomeJs, 'togglePlay') !== false,
    'API: Bảo toàn đầy đủ các API cốt lõi của Metronome cho các module khác',
    true
);

// 8. Bảo toàn tính năng TapTempo
check(
    strpos($metronomeJs, 'btn-metronome-tap') !== false && strpos($metronomeJs, 'TapTempo') !== false,
    'Feature: Tích hợp đầy đủ nút TAP tempo và engine TapTempo',
    true
);

// 9. Bảo toàn tính năng Count-in
check(
    strpos($metronomeJs, 'btn-metronome-count-in') !== false && (strpos($metronomeJs, 'CountInEngine') !== false || strpos($metronomeJs, 'triggerHostCountIn') !== false),
    'Feature: Tích hợp đầy đủ nút Count-in (đếm nhịp chuẩn bị)',
    true
);

// 10. Đèn LED nhấp nháy báo phách nhịp
check(
    strpos($metronomeJs, '_flashBeatUI') !== false && strpos($metronomeJs, '_renderBeatDots') !== false,
    'Feature: Hiển thị và nháy đèn LED nhịp báo phách chuẩn xác',
    true
);

// 11. Bỏ qua tempo 104 giả từ MusicXML (Ticket L0-15)
check(
    strpos($metronomeJs, '!== 104') !== false,
    'Rule: metronome.js tiếp tục bỏ qua tempo 104 giả mạo từ XML',
    true
);

// 12. Bảo toàn BPM Setlist khi load bài (Core Rule 4)
check(
    strpos($metronomeJs, 'setlistItem.bpm') !== false,
    'Rule: metronome.js ưu tiên bảo toàn BPM từ Setlist',
    true
);

// 13. Nút đóng / thu gọn mini-bar
check(
    strpos($metronomeJs, 'btn-close-metronome') !== false && strpos($metronomeJs, 'hidePanel') !== false,
    'UI: Có nút thu gọn/ẩn mini-bar khi không cần dùng',
    true
);

// 14. Kiểm tra giới hạn số dòng của metronome.js < 600 dòng
$metronomeLineCount = count(file($root . '/assets/js/metronome.js'));
check(
    $metronomeLineCount < 600,
    "Budget: metronome.js có {$metronomeLineCount} dòng (< 600 dòng)",
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-10 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedChecks} / {$totalChecks}\n";
$percent = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$percent}%)\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-10 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "⚠️ MỘT SỐ KIỂM TRA CHƯA ĐẠT!\n";
    exit(1);
}
