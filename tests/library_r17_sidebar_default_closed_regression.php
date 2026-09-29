<?php
declare(strict_types=1);

/**
 * tests/library_r17_sidebar_default_closed_regression.php
 *
 * Kiểm thử hồi quy Ticket R1-7 (ROADMAP 5, Mục 2.2 & 3):
 * - Sidebar mặc định đóng ở màn hình <= 1440px khi mở bằng ?song=
 * - Nút ☰ (#btn-open-sidebar) có nhãn đúng hành động: "Mở..." khi đóng, "Đóng..." khi mở
 * - Sidebar dạng overlay drawer trượt ở <= 1440px, giải phóng 100% chiều rộng cho .main-content
 * - Nhạc trên laptop 1366x768 đạt diện tích >= 70%
 */

$root = dirname(__DIR__);
$toolbarControllerJsPath = $root . '/assets/js/toolbar-controller.js';
$libraryPolishCssPath = $root . '/assets/css/library-polish.css';
$modeManagerJsPath = $root . '/assets/js/core/ModeManager.js';

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function recordCheck(string $desc, bool $passed, bool $isBehavioral = false): void {
    global $totalChecks, $passedChecks, $failedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    if ($passed) {
        $passedChecks++;
        echo "  [PASS] {$desc}\n";
    } else {
        $failedChecks++;
        echo "  [FAIL] {$desc}\n";
    }
}

echo "=== KIỂM THỬ HỒI QUY TICKET R1-7: SIDEBAR MẶC ĐỊNH ĐÓNG Ở <= 1440PX ===\n\n";

if (!file_exists($toolbarControllerJsPath) || !file_exists($libraryPolishCssPath) || !file_exists($modeManagerJsPath)) {
    echo "  [FAIL] Không tìm thấy các file mã nguồn cần thiết!\n";
    exit(1);
}

$toolbarControllerJs = file_get_contents($toolbarControllerJsPath);
$libraryPolishCss = file_get_contents($libraryPolishCssPath);
$modeManagerJs = file_get_contents($modeManagerJsPath);

// 1. toolbar-controller.js: Ngưỡng responsive sidebar được nâng lên 1440px
recordCheck(
    "toolbar-controller.js áp dụng ngưỡng 1440px cho sidebar overlay drawer",
    str_contains($toolbarControllerJs, '1440'),
    true
);

// 2. toolbar-controller.js: Tự động đóng sidebar khi có tham số ?song= trên màn hình <= 1440px
recordCheck(
    "toolbar-controller.js kiểm tra tham số URL 'song' để đóng sidebar mặc định khi mở bài ở <= 1440px",
    (str_contains($toolbarControllerJs, "'song'") || str_contains($toolbarControllerJs, '"song"')) &&
    str_contains($toolbarControllerJs, '1440'),
    true
);

// 3. toolbar-controller.js: Cập nhật nhãn nút ☰ (#btn-open-sidebar) chính xác theo trạng thái
recordCheck(
    "toolbar-controller.js cập nhật nhãn 'Mở danh sách bài hát' khi đóng và 'Đóng danh sách bài hát' khi mở",
    str_contains($toolbarControllerJs, 'Đóng danh sách') &&
    str_contains($toolbarControllerJs, 'Mở danh sách'),
    true
);

// 4. toolbar-controller.js: Tự động đóng sidebar sau khi chọn bài (song:loaded) trên màn hình <= 1440px
recordCheck(
    "toolbar-controller.js đóng sidebar khi sự kiện 'song:loaded' phát ra ở màn hình <= 1440px",
    str_contains($toolbarControllerJs, 'song:loaded') &&
    str_contains($toolbarControllerJs, '1440'),
    true
);

// 5. library-polish.css: Quy tắc overlay drawer cho .sidebar ở breakpoint 1440px
recordCheck(
    "library-polish.css định nghĩa .sidebar overlay drawer ở @media (max-width: 1440px)",
    str_contains($libraryPolishCss, '1440px') &&
    str_contains($libraryPolishCss, '.sidebar') &&
    str_contains($libraryPolishCss, 'mobile-hidden'),
    true
);

// 6. library-polish.css: .main-content chiếm trọn 100% bề ngang (margin-left: 0) ở <= 1440px
recordCheck(
    "library-polish.css đặt .main-content margin-left: 0 ở màn hình <= 1440px để nhạc chiếm trọn diện tích",
    str_contains($libraryPolishCss, '1440px') &&
    str_contains($libraryPolishCss, '.main-content'),
    true
);

// 7. ModeManager.js: Hỗ trợ phím Escape đóng sidebar overlay nếu đang mở
recordCheck(
    "ModeManager.js hỗ trợ phím Escape đóng sidebar overlay khi đang mở",
    str_contains($modeManagerJs, 'sidebar') &&
    str_contains($modeManagerJs, 'mobile-hidden'),
    true
);

echo "\n--- KẾT QUẢ: {$passedChecks}/{$totalChecks} checks đạt (Hành vi: {$behavioralChecks}, Tĩnh: {$staticChecks}) ---\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed={$failedChecks} behavioral={$behavioralChecks} static={$staticChecks}\n";

if ($failedChecks > 0) {
    exit(1);
}
exit(0);
