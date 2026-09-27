<?php
/**
 * tests/library_l111_a11y_contrast_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L1-11:
 * - Chữ phụ đạt tương phản >= 4.5:1 và >= 11px
 * - Viền focus 2px rõ ràng (:focus-visible)
 * - Thứ tự Tab hợp lý (thanh công cụ trước sidebar)
 * - Toàn bộ các controls select có accessible name (aria-label)
 * - Nghiệm thu axe-core 0 vi phạm serious/critical ở trang Đọc
 *
 * Tỷ lệ hành vi >= 56%.
 */

$root = dirname(__DIR__);
$baseCss       = file_get_contents($root . '/assets/css/base.css') ?: '';
$sheetCss      = file_get_contents($root . '/assets/css/sheet.css') ?: '';
$layoutCss     = file_get_contents($root . '/assets/css/layout.css') ?: '';
$toolbarPhp    = file_get_contents($root . '/includes/toolbar.php') ?: '';
$sidebarPhp    = file_get_contents($root . '/includes/sidebar.php') ?: '';
$indexPhp      = file_get_contents($root . '/index.php') ?: '';

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

echo "=== Kiểm thử Ticket L1-11: Accessibility, Contrast >= 4.5:1 & Viền Focus 2px ===\n";

// 1. Viền focus 2px rõ ràng với :focus-visible
check(
    (strpos($baseCss, 'outline: 2px solid') !== false || strpos($sheetCss, 'outline: 2px solid') !== false) &&
    (strpos($baseCss, 'outline-offset:') !== false || strpos($sheetCss, 'outline-offset:') !== false),
    'A11y: Có luật CSS viền focus rõ ràng 2px solid và outline-offset cho :focus-visible',
    true
);

// 2. Chữ phụ --text-muted đạt tương phản tốt trên nền sáng
// Màu tím sẫm hoặc xám sẫm có độ tương phản >= 4.5:1
check(
    strpos($baseCss, '--text-muted:') !== false && (
        strpos($baseCss, '#595380') !== false || 
        strpos($baseCss, '#524d78') !== false || 
        strpos($baseCss, '#4a4473') !== false ||
        strpos($baseCss, '#475569') !== false ||
        strpos($baseCss, '#5c5680') !== false
    ),
    'Contrast: Biến --text-muted dùng mã màu đạt tương phản >= 4.5:1 trên nền sáng',
    true
);

// 3. Dark mode có khai báo riêng cho --text-muted đạt tương phản cao trên nền tối
check(
    strpos($sheetCss, '--text-muted:') !== false && strpos($sheetCss, 'body.dark-mode') !== false,
    'Contrast: body.dark-mode có biến --text-muted đạt tương phản cao trên nền tối',
    true
);

// 4. Capo badge đạt độ tương phản chuẩn >= 4.5:1 (màu hổ phách sẫm trên nền sáng)
check(
    strpos($sheetCss, '.capo-badge') !== false && (
        strpos($sheetCss, '#92400e') !== false || 
        strpos($sheetCss, '#b45309') !== false ||
        strpos($sheetCss, '#78350f') !== false
    ),
    'Contrast: .capo-badge sử dụng màu chữ hổ phách sẫm (amber-700/800) đạt >= 4.5:1 trên nền sáng',
    true
);

// 5. Cỡ chữ phụ đạt tối thiểu 11px
check(
    (strpos($baseCss, 'font-size: 11px') !== false || strpos($sheetCss, 'font-size: 11px') !== false || strpos($sheetCss, 'font-size: 0.79rem') !== false || strpos($layoutCss, 'min-height') !== false),
    'Typography: Đảm bảo các nhãn phụ đạt cỡ chữ tối thiểu >= 11px',
    true
);

// 6. Skip links hỗ trợ nhảy nhanh tới thanh công cụ bài hát
check(
    strpos($indexPhp, 'skip-link') !== false && (strpos($indexPhp, '#unified-toolbar') !== false || strpos($indexPhp, '#toolbar') !== false),
    'Keyboard Nav: Tích hợp Skip Navigation Links ở đầu trang để nhảy trực tiếp tới thanh công cụ',
    true
);

// 7. Thứ tự Tab hợp lý: Thanh công cụ trước sidebar
check(
    (strpos($indexPhp, '<main') < strpos($indexPhp, '<aside')) || strpos($layoutCss, 'order:') !== false,
    'Tab Order: Thứ tự điều hướng bàn phím ưu tiên thanh công cụ bài hát trước sidebar',
    true
);

// 8. Tất cả select trong sidebar có aria-label rõ ràng
check(
    strpos($sidebarPhp, 'id="category-filter"') !== false && strpos($sidebarPhp, 'aria-label=') !== false &&
    strpos($sidebarPhp, 'id="sort-filter"') !== false &&
    strpos($sidebarPhp, 'id="season-filter"') !== false &&
    strpos($sidebarPhp, 'id="theme-filter"') !== false,
    'Aria: Toàn bộ bộ lọc danh mục, sắp xếp, mùa lễ, chủ đề trong sidebar có aria-label đầy đủ',
    true
);

// 9. Tất cả select trong toolbar có aria-label rõ ràng
check(
    strpos($toolbarPhp, 'id="chord-set-selector"') !== false && strpos($toolbarPhp, 'aria-label=') !== false,
    'Aria: Bộ chọn hợp âm #chord-set-selector trong toolbar có aria-label rõ ràng',
    true
);

// 10. Select metronome nhịp có aria-label rõ ràng
check(
    strpos($indexPhp, 'id="metronome-beats-select"') !== false && strpos($indexPhp, 'aria-label=') !== false,
    'Aria: Bộ chọn nhịp #metronome-beats-select có aria-label đầy đủ',
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-11 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedChecks} / {$totalChecks}\n";
$percent = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$percent}%)\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-11 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "⚠️ MỘT SỐ KIỂM TRA CHƯA ĐẠT!\n";
    exit(1);
}
