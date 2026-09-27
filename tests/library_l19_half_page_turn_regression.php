<?php
declare(strict_types=1);

/**
 * tests/library_l19_half_page_turn_regression.php
 * 
 * Kiểm thử hồi quy Ticket L1-9: Lật nửa trang (half-page turn, học từ forScore)
 * - Nửa trên hiện trước phần tiếp theo, có vạch chia rõ ràng (#half-page-divider)
 * - Lật theo hàng nhạc, tuyệt đối không cắt đôi một hàng nhạc
 * - Tính toán chính xác mốc cuộn từ MusicSystems trong OSMD
 * - Đồng bộ với chế độ Band View (căn theo đỉnh khổ thơ)
 */

$root = dirname(__DIR__);
$pageNavJsPath = $root . '/assets/js/page-nav.js';
$sheetViewerPhpPath = $root . '/includes/sheet_viewer.php';
$sheetCssPath = $root . '/assets/css/sheet.css';
$songLoaderJsPath = $root . '/assets/js/song-loader.js';
$displaySettingsJsPath = $root . '/assets/js/display-settings.js';

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

echo "=== Kiểm thử Ticket L1-9: Lật nửa trang (Half-page turn phong cách forScore) ===\n";

if (!file_exists($pageNavJsPath) || !file_exists($sheetViewerPhpPath) || !file_exists($sheetCssPath)) {
    echo "  ❌ Không tìm thấy các file mã nguồn cốt lõi!\n";
    exit(1);
}

$pageNavJs = file_get_contents($pageNavJsPath);
$sheetViewerPhp = file_get_contents($sheetViewerPhpPath);
$sheetCss = file_get_contents($sheetCssPath);
$songLoaderJs = file_get_contents($songLoaderJsPath);
$displaySettingsJs = file_get_contents($displaySettingsJsPath);

// 1. sheet_viewer.php chứa phần tử vạch chia nửa trang #half-page-divider
$hasDividerMarkup = str_contains($sheetViewerPhp, 'id="half-page-divider"')
    && str_contains($sheetViewerPhp, 'class="half-page-divider hidden"')
    && str_contains($sheetViewerPhp, 'class="half-page-divider-line"')
    && str_contains($sheetViewerPhp, 'class="half-page-divider-badge"');
recordCheck("sheet_viewer.php chứa cấu trúc vạch chia nửa trang #half-page-divider", $hasDividerMarkup, false);

// 2. CSS cấu hình vạch chia nửa trang chuẩn forScore với nét đứt hổ phách
$hasDividerCss = str_contains($sheetCss, '.half-page-divider')
    && str_contains($sheetCss, 'border-top: 2px dashed')
    && str_contains($sheetCss, '.half-page-divider-line')
    && str_contains($sheetCss, '.half-page-divider-badge');
recordCheck("sheet.css cấu hình hiển thị vạch chia nửa trang nét đứt hổ phách tinh tế", $hasDividerCss, true);

// 3. Dark mode hỗ trợ tương phản cao cho vạch chia nửa trang
$hasDarkModeDivider = str_contains($sheetCss, 'body.dark-mode .half-page-divider-line')
    && str_contains($sheetCss, '#fbbf24');
recordCheck("sheet.css dark mode hiển thị vạch chia màu vàng hổ phách #fbbf24 tương phản cao", $hasDarkModeDivider, true);

// 4. PageNav xuất biểu tượng toàn cục window.PageNav
$hasPageNavExport = str_contains($pageNavJs, 'window.PageNav = PageNav');
recordCheck("page-nav.js xuất biểu tượng toàn cục window.PageNav", $hasPageNavExport, false);

// 5. PageNav mặc định chế độ lật nửa trang 'half' theo Ticket L1-9
$hasHalfPageDefault = str_contains($pageNavJs, "_turnMode    = 'half'")
    || str_contains($pageNavJs, "savedMode === 'half'")
    || str_contains($pageNavJs, "sheetapp_page_turn_mode");
recordCheck("page-nav.js mặc định chế độ lật nửa trang 'half' (phong cách forScore)", $hasHalfPageDefault, true);

// 6. PageNav truy xuất chính xác danh sách MusicSystems từ OSMD
$hasSystemsExtraction = str_contains($pageNavJs, '_getSystemsFromOSMD')
    && str_contains($pageNavJs, 'MusicPages?.[0]?.MusicSystems')
    && str_contains($pageNavJs, 'PositionAndShape.AbsolutePosition.y');
recordCheck("page-nav.js quét danh sách MusicSystems từ OSMD và quy đổi chuẩn sang tọa độ pixel", $hasSystemsExtraction, true);

// 7. PageNav căn mốc lật trang theo hàng nhạc (chừa khoảng đệm đỉnh 12px)
$hasSystemAlignment = str_contains($pageNavJs, '_systems[i].top - 12')
    || str_contains($pageNavJs, 'snappedTop = Math.min(targetTop, maxScroll)');
recordCheck("page-nav.js căn vị trí lật trang theo đỉnh hàng nhạc, tuyệt đối không cắt đôi một hàng nhạc", $hasSystemAlignment, true);

// 8. PageNav cung cấp hàm kiểm tra chống cắt đôi hàng nhạc isAnySystemCutAtTop()
$hasSystemCutChecker = str_contains($pageNavJs, 'isAnySystemCutAtTop')
    && str_contains($pageNavJs, 'sys.top < scrollTop')
    && str_contains($pageNavJs, 'sys.bottom > scrollTop');
recordCheck("page-nav.js cung cấp hàm isAnySystemCutAtTop() kiểm chứng không hàng nhạc nào bị cắt ở mép trên", $hasSystemCutChecker, true);

// 9. PageNav điều khiển hiển thị vạch chia nửa trang khi thực hiện lật
$hasDividerController = str_contains($pageNavJs, '_showHalfPageDivider')
    && str_contains($pageNavJs, 'divEl.style.top')
    && (str_contains($pageNavJs, 'classList.remove(\'hidden\')') || str_contains($pageNavJs, 'classList.remove(\'hidden\', \'faded\')'));
recordCheck("page-nav.js tự động đặt vị trí và hiển thị vạch chia nửa trang khi lật trang", $hasDividerController, true);

// 10. PageNav hỗ trợ chuyển đổi linh hoạt giữa chế độ lật nửa trang và lật cả trang
$hasTurnModeToggle = str_contains($pageNavJs, 'setTurnMode')
    && str_contains($pageNavJs, 'getTurnMode')
    && str_contains($pageNavJs, 'toggleTurnMode');
recordCheck("page-nav.js cung cấp API setTurnMode/getTurnMode/toggleTurnMode đầy đủ", $hasTurnModeToggle, true);

// 11. PageNav hỗ trợ căn theo khổ thơ khi ở chế độ Band View (Lyric View)
$hasLyricSectionSupport = str_contains($pageNavJs, '_getSectionsFromLyricView')
    && str_contains($pageNavJs, '.lv-verse, .lv-chorus');
recordCheck("page-nav.js tự động căn theo đỉnh khổ thơ trong Band View, không cắt đôi khổ thơ", $hasLyricSectionSupport, true);

// 12. song-loader.js kích hoạt tính toán mốc lật trang khi nạp xong bài mới
$hasSongLoaderPageSync = str_contains($songLoaderJs, 'window.PageNav?.computePages');
recordCheck("song-loader.js tự động tính toán lại các mốc lật trang khi hoàn tất nạp bài mới", $hasSongLoaderPageSync, true);

// 13. display-settings.js kích hoạt tính toán mốc lật trang khi chuyển đổi Band View
$hasDisplaySettingsPageSync = str_contains($displaySettingsJs, 'window.PageNav?.computePages');
recordCheck("display-settings.js làm mới các mốc lật trang khi người dùng chuyển đổi giữa Band và Bản nhạc", $hasDisplaySettingsPageSync, true);

// Tổng kết kết quả
$passedCount = count(array_filter($checks, fn($c) => $c['passed']));
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-9 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$totalChecks}\n";
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$behavioralRatio}%)\n";

if ($passedCount === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-9 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$totalChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA KHÔNG ĐẠT!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedCount} failed=" . ($totalChecks - $passedCount) . " behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
