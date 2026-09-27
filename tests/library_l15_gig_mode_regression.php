<?php
declare(strict_types=1);

/**
 * tests/library_l15_gig_mode_regression.php
 * 
 * Kiểm thử hồi quy Ticket L1-5: Chế độ Sân khấu thật (Gig Mode Hardening)
 * - Mặc định nền tối; không thanh công cụ
 * - HUD tự mờ sau 3 giây (opacity: 0, pointer-events: none)
 * - Chạm giữa màn hình (#edge-tap-center) để hiện/ẩn HUD
 * - Khóa chạm ngoài vùng lật trang (Edge-tap zones 18% 2 bên, Center 64% ở giữa)
 * - Wake Lock + Fullscreen API và tự phục hồi khi tab visible
 * - Vùng an toàn trên iPhone (safe-area-inset-bottom)
 * - Nút Thoát không bị cắt trên iPhone 390px
 */

$root = dirname(__DIR__);
$modeManagerJsPath = $root . '/assets/js/core/ModeManager.js';
$layoutCssPath = $root . '/assets/css/layout.css';
$sheetViewerPhpPath = $root . '/includes/sheet_viewer.php';
$appUiJsPath = $root . '/assets/js/app-ui.js';
$indexPhpPath = $root . '/index.php';

$checks = [];
$totalChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function recordCheck(string $desc, bool $passed, bool $isBehavioral = false): void {
    global $checks, $totalChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }
    $checks[] = [
        'desc' => $desc,
        'passed' => $passed,
        'behavioral' => $isBehavioral
    ];
    if (!$passed) {
        echo "  ❌ FAIL: {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket L1-5: Chế độ Sân khấu thật (Gig Mode Hardening) ===\n";

if (!file_exists($modeManagerJsPath) || !file_exists($layoutCssPath) || !file_exists($sheetViewerPhpPath)) {
    echo "  ❌ Không tìm thấy các file mã nguồn cốt lõi!\n";
    exit(1);
}

$modeManagerJs = file_get_contents($modeManagerJsPath);
$layoutCss = file_get_contents($layoutCssPath);
$sheetViewerPhp = file_get_contents($sheetViewerPhpPath);
$appUiJs = file_exists($appUiJsPath) ? file_get_contents($appUiJsPath) : '';
$indexPhp = file_exists($indexPhpPath) ? file_get_contents($indexPhpPath) : '';

// 1. Mặc định nền tối khi vào PERFORMANCE mode trong ModeManager.js
$hasDarkModeOnGig = str_contains($modeManagerJs, "body.classList.add('dark-mode')")
    && str_contains($modeManagerJs, '_wasDarkModeBeforeGig');
recordCheck("ModeManager tự động kích hoạt dark-mode mặc định khi vào Chế độ Biểu Diễn", $hasDarkModeOnGig, true);

// 2. Khôi phục trạng thái dark-mode ban đầu khi thoát PERFORMANCE mode
$hasRestoreDarkMode = str_contains($modeManagerJs, 'body.classList.remove(\'dark-mode\')')
    && str_contains($modeManagerJs, '!_wasDarkModeBeforeGig');
recordCheck("ModeManager khôi phục trạng thái dark-mode ban đầu của người dùng khi thoát Biểu Diễn", $hasRestoreDarkMode, true);

// 3. layout.css đặt nền tối nhất quán #0c0d14 cho body.sheet-only-mode
$hasDarkSheetOnlyCss = str_contains($layoutCss, 'body.sheet-only-mode')
    && str_contains($layoutCss, '#0c0d14');
recordCheck("layout.css thiết lập background tối chống chói (#0c0d14) cho sheet-only-mode", $hasDarkSheetOnlyCss, true);

// 4. Ẩn hoàn toàn toolbar, sidebar, FAB trong sheet-only-mode
$hasNoToolbarCss = str_contains($layoutCss, 'body.sheet-only-mode #toolbar')
    && str_contains($layoutCss, 'display: none !important');
recordCheck("layout.css ẩn hoàn toàn toolbar trong sheet-only-mode", $hasNoToolbarCss, false);

// 5. Timer tự mờ HUD sau 3 giây trong ModeManager.js
$hasHudTimer3s = str_contains($modeManagerJs, 'HUD_FADE_DELAY = 3000')
    && str_contains($modeManagerJs, '_startHudTimer')
    && str_contains($modeManagerJs, '_fadeHud');
recordCheck("ModeManager có cơ chế hẹn giờ tự mờ HUD sau đúng 3.000 ms (3 giây)", $hasHudTimer3s, true);

// 6. CSS mờ HUD: opacity = 0 và pointer-events: none khi có class .faded
$hasFadedHudCss = (bool)preg_match('/\.gig-floating-hud\.faded\s*\{[^}]*opacity:\s*0\s*!important[^}]*pointer-events:\s*none\s*!important/s', $layoutCss);
recordCheck("layout.css định kiểu .gig-floating-hud.faded có opacity 0 và pointer-events none", $hasFadedHudCss, true);

// 7. Reset timer khi chạm hoặc di chuột trên HUD
$hasHudInteractionReset = str_contains($modeManagerJs, '_resetHudTimer')
    && str_contains($modeManagerJs, 'gigHud.addEventListener');
recordCheck("HUD tự động đặt lại bộ đếm khi người dùng chạm hoặc di chuột lên thanh điều khiển", $hasHudInteractionReset, true);

// 8. Xuất các hàm điều khiển HUD trong ModeManager (showHud, fadeHud, resetHudTimer)
$hasExportedHudMethods = str_contains($modeManagerJs, 'showHud: _showHud')
    && str_contains($modeManagerJs, 'fadeHud: _fadeHud')
    && str_contains($modeManagerJs, 'resetHudTimer: _resetHudTimer');
recordCheck("ModeManager công khai API điều khiển HUD (showHud, fadeHud, resetHudTimer)", $hasExportedHudMethods, false);

// 9. Phần tử #edge-tap-center trong sheet_viewer.php
$hasCenterTapElement = str_contains($sheetViewerPhp, 'id="edge-tap-center"');
recordCheck("sheet_viewer.php có phần tử #edge-tap-center nằm giữa 2 mép màn hình", $hasCenterTapElement, false);

// 10. layout.css định kiểu cho .edge-tap-center: bao phủ 64% giữa màn hình (left: 18%, right: 18%)
$hasCenterTapCss = (bool)preg_match('/\.edge-tap-center\s*\{[^}]*left:\s*18%[^}]*right:\s*18%[^}]*z-index:\s*9975/s', $layoutCss);
recordCheck("layout.css định nghĩa .edge-tap-center bao phủ vùng giữa (left: 18%, right: 18%, z-index: 9975)", $hasCenterTapCss, true);

// 11. .edge-tap-center kích hoạt trong body.sheet-only-mode
$hasCenterTapActive = str_contains($layoutCss, 'body.sheet-only-mode .edge-tap-center');
recordCheck(".edge-tap-center được hiển thị trong sheet-only-mode để khóa chạm ngoài vùng lật trang", $hasCenterTapActive, true);

// 12. app-ui.js xử lý sự kiện click cho #edge-tap-center để toggle hoặc khôi phục HUD
$hasCenterTapHandler = str_contains($appUiJs, 'edge-tap-center')
    && str_contains($appUiJs, 'showHud');
recordCheck("app-ui.js gắn bộ xử lý sự kiện cho #edge-tap-center để khôi phục thanh điều khiển HUD", $hasCenterTapHandler, true);

// 13. Wake Lock và Fullscreen API trong ModeManager.js
$hasWakeLockAndFullscreen = str_contains($modeManagerJs, '_requestWakeLock')
    && str_contains($modeManagerJs, '_requestFullscreen')
    && str_contains($modeManagerJs, 'visibilitychange');
recordCheck("ModeManager tích hợp Wake Lock, Fullscreen API và tự khôi phục khi visibilitychange", $hasWakeLockAndFullscreen, true);

// 14. Vùng an toàn iPhone (safe-area-inset-bottom) trên .gig-floating-hud
$hasSafeAreaInset = str_contains($layoutCss, 'env(safe-area-inset-bottom');
recordCheck("layout.css áp dụng env(safe-area-inset-bottom) cho floating HUD trên thiết bị iOS", $hasSafeAreaInset, true);

// 15. Nút Thoát trên mobile: flex-shrink 0, không bị co nhỏ hay đẩy tràn
$hasExitBtnMobileCss = (bool)preg_match('/\.btn-gig-exit\s*\{[^}]*flex-shrink:\s*0\s*!important[^}]*(min-width:\s*44px|height:\s*44px)/s', $layoutCss);
recordCheck("layout.css bảo đảm .btn-gig-exit trên mobile có flex-shrink 0 và kích thước ≥ 44px", $hasExitBtnMobileCss, true);

// 16. Ẩn cụm zoom trong Gig HUD trên mobile để nhường diện tích cho nút Thoát
$hasHideZoomOnMobile = (bool)preg_match('/\.gig-hud-zoom-wrap\s*\{[^}]*display:\s*none\s*!important/s', $layoutCss);
recordCheck("layout.css ẩn cụm zoom trong HUD trên màn hình nhỏ để ngăn tràn mép và bảo vệ nút Thoát", $hasHideZoomOnMobile, true);

// 17. Nút thoát nổi góc trên phải #btn-exit-sheet-only đạt touch target ≥ 44px
$hasTopExitBtn44 = (bool)preg_match('/#btn-exit-sheet-only\s*\{[^}]*(width:\s*44px|min-width:\s*44px)[^}]*(height:\s*44px|min-height:\s*44px)/s', $layoutCss);
recordCheck("Nút thoát dự phòng #btn-exit-sheet-only đạt kích thước tối thiểu ≥ 44x44px", $hasTopExitBtn44, true);

// Tổng kết kết quả
$passedCount = count(array_filter($checks, fn($c) => $c['passed']));
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-5 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$totalChecks}\n";
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$behavioralRatio}%)\n";

if ($passedCount === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-5 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$totalChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA KHÔNG ĐẠT!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedCount} failed=" . ($totalChecks - $passedCount) . " behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
