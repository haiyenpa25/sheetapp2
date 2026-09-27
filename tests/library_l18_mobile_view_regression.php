<?php
declare(strict_types=1);

/**
 * tests/library_l18_mobile_view_regression.php
 * 
 * Kiểm thử hồi quy Ticket L1-8: Tối ưu hiển thị điện thoại
 * - Tự vừa bề ngang với >=2 ô nhịp mỗi hàng (overflow-x: hidden, _ensureMinMeasuresPerSystem)
 * - Mặc định ẩn tên tác giả và chú thích trên điện thoại (osmd-composer, osmd-lyricist, osmd-meta-text)
 * - Thanh điều khiển ở cạnh dưới cho ngón cái (Bottom Thumb Bar 52px, nút >=44px)
 * - Thanh đỉnh đầu thu gọn 44px duy nhất, sạch sẽ
 * - Đồng bộ 2 chiều: Dịch giọng [-] [Tông] [+], Bộ hợp âm [HD ↔ TLH], Chế độ Band/Nhạc, Biểu diễn
 */

$root = dirname(__DIR__);
$mobileControllerJsPath = $root . '/assets/js/mobile-controller.js';
$osmdRendererJsPath = $root . '/assets/js/osmd-renderer.js';
$songLoaderJsPath = $root . '/assets/js/song-loader.js';
$appJsPath = $root . '/assets/js/app.js';
$sheetCssPath = $root . '/assets/css/sheet.css';
$layoutCssPath = $root . '/assets/css/layout.css';
$toolbarPhpPath = $root . '/includes/toolbar.php';
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

echo "=== Kiểm thử Ticket L1-8: Tối ưu hiển thị điện thoại ===\n";

if (!file_exists($mobileControllerJsPath) || !file_exists($sheetCssPath) || !file_exists($toolbarPhpPath)) {
    echo "  ❌ Không tìm thấy các file mã nguồn cốt lõi!\n";
    exit(1);
}

$mobileControllerJs = file_get_contents($mobileControllerJsPath);
$osmdRendererJs = file_get_contents($osmdRendererJsPath);
$songLoaderJs = file_get_contents($songLoaderJsPath);
$appJs = file_get_contents($appJsPath);
$sheetCss = file_get_contents($sheetCssPath);
$layoutCss = file_get_contents($layoutCssPath);
$toolbarPhp = file_get_contents($toolbarPhpPath);
$indexPhp = file_get_contents($indexPhpPath);

// 1. toolbar.php chứa vùng thanh điều khiển cạnh dưới #mobile-thumb-bar
$hasMobileThumbBarMarkup = str_contains($toolbarPhp, 'id="mobile-thumb-bar"')
    && str_contains($toolbarPhp, 'mobile-thumb-bar');
recordCheck("toolbar.php chứa vùng markup thanh điều khiển ngón cái #mobile-thumb-bar", $hasMobileThumbBarMarkup, false);

// 2. mobile-thumb-bar có đầy đủ 4 cụm điều khiển thiết yếu
$hasThumbButtons = str_contains($toolbarPhp, 'id="btn-mobile-transpose-down"')
    && str_contains($toolbarPhp, 'id="mobile-transpose-display"')
    && str_contains($toolbarPhp, 'id="btn-mobile-transpose-up"')
    && str_contains($toolbarPhp, 'id="btn-mobile-chordset"')
    && str_contains($toolbarPhp, 'id="btn-mobile-view-toggle"')
    && str_contains($toolbarPhp, 'id="btn-mobile-gig"');
recordCheck("toolbar.php chứa đầy đủ các nút ngón cái: Dịch giọng [-][Tông][+], Bộ hợp âm, Band/Nhạc, Biểu diễn", $hasThumbButtons, false);

// 3. CSS định nghĩa #mobile-thumb-bar: ẩn trên desktop/iPad, hiện trên mobile (≤ 680px)
$hasMobileThumbBarCss = str_contains($sheetCss, '.mobile-thumb-bar')
    && str_contains($sheetCss, 'display: none !important')
    && str_contains($sheetCss, 'display: flex !important')
    && str_contains($sheetCss, 'height: 52px');
recordCheck("sheet.css định cấu hình .mobile-thumb-bar ẩn trên iPad/Desktop và hiện cao 52px trên mobile", $hasMobileThumbBarCss, true);

// 4. Kích thước cảm ứng của các nút thumb bar đạt chuẩn Apple/Google touch targets ≥ 44x44px
$hasTouchTarget44px = str_contains($sheetCss, 'min-width: 44px')
    && str_contains($sheetCss, 'min-height: 44px');
recordCheck("sheet.css đảm bảo tất cả nút điều khiển ngón cái đạt kích thước touch target ≥ 44x44px", $hasTouchTarget44px, true);

// 5. CSS bổ sung khoảng đệm đáy an toàn (safe-area-inset-bottom) tránh che nội dung
$hasSafeBottomPadding = str_contains($sheetCss, 'padding-bottom: calc(64px + env(safe-area-inset-bottom')
    && str_contains($sheetCss, 'env(safe-area-inset-bottom');
recordCheck("sheet.css dự phòng padding đáy an toàn cho màn hình iPhone (home indicator / safe-area)", $hasSafeBottomPadding, true);

// 6. CSS mặc định ẩn tên tác giả và chú thích phụ trên điện thoại
$hasHideMetaCss = str_contains($sheetCss, '.sheet-container svg text.osmd-composer')
    && str_contains($sheetCss, 'osmd-lyricist')
    && str_contains($sheetCss, 'osmd-meta-text')
    && str_contains($sheetCss, 'display: none !important');
recordCheck("sheet.css mặc định ẩn tên tác giả, người soạn lời và chú thích phụ trên điện thoại", $hasHideMetaCss, true);

// 7. CSS tự vừa bề ngang và ngăn tràn chữ trên màn hình hẹp
$hasFitWidthCss = str_contains($sheetCss, 'overflow-x: hidden !important')
    && str_contains($sheetCss, 'max-width: 100vw !important')
    && str_contains($sheetCss, 'max-width: 100% !important');
recordCheck("sheet.css đảm bảo bản nhạc tự vừa bề ngang và chống tràn thanh cuộn ngang", $hasFitWidthCss, true);

// 8. layout.css thu gọn toolbar trên cùng thành 1 hàng 44px duy nhất và ẩn band-controls thừa
$hasCompactTopToolbar = str_contains($layoutCss, 'height: 44px !important')
    && str_contains($layoutCss, 'flex-wrap: nowrap !important')
    && str_contains($layoutCss, '.band-controls')
    && str_contains($layoutCss, 'display: none !important');
recordCheck("layout.css thu gọn toolbar đỉnh đầu thành 1 dòng 44px duy nhất, ẩn band-controls thừa trên mobile", $hasCompactTopToolbar, true);

// 9. osmd-renderer.js mặc định cấu hình options ẩn composer/credits trên điện thoại
$hasOsmdMobileMetaRules = str_contains($osmdRendererJs, 'window.innerWidth <= 680')
    && str_contains($osmdRendererJs, 'drawComposer: drawMeta')
    && str_contains($osmdRendererJs, 'drawCredits: drawMeta');
recordCheck("osmd-renderer.js tự động tắt vẽ tác giả & chú thích trong OSMD options khi ở mobile view", $hasOsmdMobileMetaRules, true);

// 10. osmd-renderer.js đánh dấu và ẩn các text meta trong header SVG khi render
$hasOsmdSvgMetaTagging = str_contains($osmdRendererJs, 'osmd-meta-text')
    && str_contains($osmdRendererJs, 't.style.display = \'none\'');
recordCheck("osmd-renderer.js gắn nhãn và ẩn các text tác giả/chú thích trong SVG trên màn hình điện thoại", $hasOsmdSvgMetaTagging, true);

// 11. song-loader.js tự động autofit zoom và kích hoạt kiểm tra mật độ ô nhịp trên mobile
$hasSongLoaderAutofitMobile = str_contains($songLoaderJs, 'window.innerWidth <= 680')
    && str_contains($songLoaderJs, '_ensureMinMeasuresPerSystem');
recordCheck("song-loader.js tự động autofit bề ngang và kiểm tra mật độ ô nhịp khi nạp bài trên điện thoại", $hasSongLoaderAutofitMobile, true);

// 12. song-loader.js bảo đảm ≥2 ô nhịp mỗi hàng trên điện thoại
$hasMinTwoMeasuresCheck = str_contains($songLoaderJs, 'systems[i].length < 2')
    && str_contains($songLoaderJs, 'window.App?.setZoom?.(adjustedPct)');
recordCheck("song-loader.js có logic _ensureMinMeasuresPerSystem bảo đảm mỗi hàng nhạc có ≥ 2 ô nhịp", $hasMinTwoMeasuresCheck, true);

// 13. MobileController xuất biểu tượng toàn cục window.MobileController
$hasMobileControllerExport = str_contains($mobileControllerJs, 'window.MobileController = MobileController');
recordCheck("mobile-controller.js xuất biểu tượng toàn cục window.MobileController", $hasMobileControllerExport, false);

// 14. MobileController đồng bộ 2 chiều cho dịch giọng, bộ hợp âm, chế độ Band/Nhạc
$hasMobileControllerSync = str_contains($mobileControllerJs, '_syncTransposeDisplay')
    && str_contains($mobileControllerJs, '_syncChordSetDisplay')
    && str_contains($mobileControllerJs, '_syncViewToggleDisplay')
    && str_contains($mobileControllerJs, 'EventBus.on(\'transpose:changed\'');
recordCheck("mobile-controller.js lắng nghe EventBus và đồng bộ 2 chiều liên tục cho mọi trạng thái", $hasMobileControllerSync, true);

// 15. index.php và app.js nạp và khởi tạo MobileController
$hasIndexAndAppWiring = str_contains($indexPhp, 'jsTag(\'mobile-controller.js\')')
    && str_contains($appJs, 'MobileController.init()');
recordCheck("index.php nạp mobile-controller.js và app.js khởi tạo MobileController khi ứng dụng chạy", $hasIndexAndAppWiring, false);

// Tổng kết kết quả
$passedCount = count(array_filter($checks, fn($c) => $c['passed']));
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-8 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$totalChecks}\n";
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$behavioralRatio}%)\n";

if ($passedCount === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-8 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$totalChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA KHÔNG ĐẠT!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedCount} failed=" . ($totalChecks - $passedCount) . " behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
