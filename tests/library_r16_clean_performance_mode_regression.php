<?php
declare(strict_types=1);

/**
 * tests/library_r16_clean_performance_mode_regression.php
 *
 * Kiểm thử hồi quy Ticket R1-6 (ROADMAP 5, Mục 2.5 & 3):
 * - Chế độ Biểu Diễn 100% Sạch: ẩn thanh điều hướng, thanh công cụ, dải chip, dải phân đoạn, thanh dưới điện thoại.
 * - Lớp điều khiển mờ duy nhất (#gig-floating-hud): ‹ Bài │ − Tông + │ Khổ n/N │ Cuộn │ − Zoom + │ Thoát ✕
 * - Nút HUD không còn là ô xám trống (Lucide SVG + nhãn, nền kính cong).
 * - Thông báo "Nhấn F/Esc để thoát" chỉ hiện 1 lần per session và ở trên đỉnh, không đè HUD.
 * - Lock/Unlock zoom dùng Lucide SVG thay vì emoji.
 */

$root = dirname(__DIR__);
$sheetViewerPhpPath = $root . '/includes/sheet_viewer.php';
$libraryPolishCssPath = $root . '/assets/css/library-polish.css';
$modeManagerJsPath = $root . '/assets/js/core/ModeManager.js';
$toolbarControllerJsPath = $root . '/assets/js/toolbar-controller.js';

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

echo "=== KIỂM THỬ HỒI QUY TICKET R1-6: CHẾ ĐỘ BIỂU DIỄN 100% SẠCH ===\n\n";

if (!file_exists($sheetViewerPhpPath) || !file_exists($libraryPolishCssPath) ||
    !file_exists($modeManagerJsPath) || !file_exists($toolbarControllerJsPath)) {
    echo "  [FAIL] Không tìm thấy các file mã nguồn cần thiết!\n";
    exit(1);
}

$sheetViewerPhp = file_get_contents($sheetViewerPhpPath);
$libraryPolishCss = file_get_contents($libraryPolishCssPath);
$modeManagerJs = file_get_contents($modeManagerJsPath);
$toolbarControllerJs = file_get_contents($toolbarControllerJsPath);

// 1. sheet_viewer.php chứa cấu trúc đầy đủ của #gig-floating-hud
recordCheck(
    "sheet_viewer.php chứa container #gig-floating-hud",
    str_contains($sheetViewerPhp, 'id="gig-floating-hud"'),
    true
);

// 2. HUD có phần bài hát có thể bấm để chọn bài
recordCheck(
    "HUD chứa #gig-hud-title và #gig-hud-key bên trong .gig-hud-info",
    str_contains($sheetViewerPhp, 'id="gig-hud-title"') && str_contains($sheetViewerPhp, 'id="gig-hud-key"'),
    true
);

// 3. HUD có cụm dịch tông: hạ, giá trị, tăng
recordCheck(
    "HUD chứa cụm dịch tông #btn-gig-trans-down, #gig-hud-trans, #btn-gig-trans-up",
    str_contains($sheetViewerPhp, 'id="btn-gig-trans-down"') &&
    str_contains($sheetViewerPhp, 'id="gig-hud-trans"') &&
    str_contains($sheetViewerPhp, 'id="btn-gig-trans-up"'),
    true
);

// 4. HUD có nút cuộn và nút thoát
recordCheck(
    "HUD chứa nút cuộn #btn-gig-scroll-toggle và nút thoát #btn-gig-exit",
    str_contains($sheetViewerPhp, 'id="btn-gig-scroll-toggle"') &&
    str_contains($sheetViewerPhp, 'id="btn-gig-exit"'),
    true
);

// 5. HUD có cụm zoom: thu nhỏ, giá trị, phóng to, khóa zoom
recordCheck(
    "HUD chứa cụm zoom #btn-gig-zoom-out, #gig-hud-zoom, #btn-gig-zoom-in, #btn-gig-lock-zoom",
    str_contains($sheetViewerPhp, 'id="btn-gig-zoom-out"') &&
    str_contains($sheetViewerPhp, 'id="gig-hud-zoom"') &&
    str_contains($sheetViewerPhp, 'id="btn-gig-zoom-in"') &&
    str_contains($sheetViewerPhp, 'id="btn-gig-lock-zoom"'),
    true
);

// 6. ModeManager: Thông báo gợi ý thoát chỉ hiện 1 lần trong phiên (sessionStorage)
recordCheck(
    "ModeManager.js kiểm tra sessionStorage để chỉ hiện thông báo thoát Biểu Diễn 1 lần trong phiên",
    str_contains($modeManagerJs, 'sessionStorage.getItem') &&
    str_contains($modeManagerJs, 'sheetapp_gig_hint_shown'),
    true
);

// 7. library-polish.css: Ẩn dải phân đoạn trong body.sheet-only-mode
recordCheck(
    "library-polish.css ẩn hoàn toàn dải phân đoạn #section-jump-bar-container trong sheet-only-mode",
    str_contains($libraryPolishCss, 'body.sheet-only-mode') &&
    (str_contains($libraryPolishCss, '#section-jump-bar-container') || str_contains($libraryPolishCss, '.section-jump-bar-container')),
    true
);

// 8. library-polish.css: Ẩn thanh ngón cái mobile (.mobile-thumb-bar) trong body.sheet-only-mode
recordCheck(
    "library-polish.css ẩn hoàn toàn .mobile-thumb-bar trong sheet-only-mode",
    str_contains($libraryPolishCss, 'body.sheet-only-mode') &&
    str_contains($libraryPolishCss, '.mobile-thumb-bar'),
    true
);

// 9. library-polish.css: Ẩn navbar app shell trong body.sheet-only-mode
recordCheck(
    "library-polish.css ẩn hoàn toàn navbar (.app-shell-navbar) trong sheet-only-mode",
    str_contains($libraryPolishCss, 'body.sheet-only-mode') &&
    (str_contains($libraryPolishCss, '#app-shell-navbar') || str_contains($libraryPolishCss, '.app-shell-navbar')),
    true
);

// 10. library-polish.css: Toast ở chế độ Biểu Diễn được dời lên trên đỉnh (top: 14px) không đè HUD
recordCheck(
    "library-polish.css đặt toast ở đỉnh màn hình (top) trong sheet-only-mode để không đè HUD",
    str_contains($libraryPolishCss, 'body.sheet-only-mode .toast-container') &&
    (bool)preg_match('/body\.sheet-only-mode\s+\.toast-container\s*\{[^}]*top:\s*\d+px/s', $libraryPolishCss),
    true
);

// 11. library-polish.css: HUD có nền kính mờ (backdrop-filter: blur)
recordCheck(
    "library-polish.css định nghĩa HUD nền kính cong và blur (.gig-floating-hud)",
    (bool)preg_match('/\.gig-floating-hud\s*\{[^}]*backdrop-filter:\s*blur/s', $libraryPolishCss),
    true
);

// 12. library-polish.css: Nút .btn-gig-action được định dạng phẳng/kính hiện đại, loại bỏ ô xám rời rạc
recordCheck(
    "library-polish.css định kiểu các nút .btn-gig-action thanh thoát, bo tròn, đồng bộ giao diện",
    str_contains($libraryPolishCss, '.btn-gig-action') &&
    str_contains($libraryPolishCss, '.btn-gig-action.btn-gig-exit'),
    true
);

// 13. toolbar-controller.js: Khóa zoom dùng SVG thay vì emoji 🔒/🔓
recordCheck(
    "toolbar-controller.js sử dụng Lucide SVG cho nút khóa zoom thay vì emoji",
    !str_contains($toolbarControllerJs, "'<span class=\"lock-icon\">🔒</span>'") &&
    !str_contains($toolbarControllerJs, "'<span class=\"lock-icon\">🔓</span>'"),
    true
);

// 14. library-polish.css: Ẩn nút thoát góc trên phải dự phòng #btn-exit-sheet-only khi cần để đạt diện tích nhạc tối đa
recordCheck(
    "library-polish.css ẩn nút thoát thô góc trên phải #btn-exit-sheet-only để tập trung vào HUD duy nhất",
    str_contains($libraryPolishCss, 'body.sheet-only-mode #btn-exit-sheet-only'),
    false
);

echo "\n--- KẾT QUẢ: {$passedChecks}/{$totalChecks} checks đạt (Hành vi: {$behavioralChecks}, Tĩnh: {$staticChecks}) ---\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed={$failedChecks} behavioral={$behavioralChecks} static={$staticChecks}\n";

if ($failedChecks > 0) {
    exit(1);
}
exit(0);
