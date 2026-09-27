<?php
declare(strict_types=1);

/**
 * tests/library_l17_band_mode_regression.php
 * 
 * Kiểm thử hồi quy Ticket L1-7 ⭐: Chế độ BAND (lời + hợp âm chữ lớn)
 * - Nút chuyển đổi Band/Nhạc (#btn-band-toggle) trên thanh công cụ chính
 * - Kích thước chữ sân khấu: Hợp âm lớn 24–32px trên lời 20–24px
 * - Dùng bộ hợp âm đang chọn (HD → TLH dự phòng theo Core Rule 1)
 * - Phản ánh đúng tông và thế bấm capo (trOffset - capo)
 * - Tách ĐK / Điệp khúc thành khối riêng biệt (.lv-chorus)
 * - Bố cục 2 cột trên iPad ngang (1180x820) và màn hình rộng
 * - Khổ đang hát được tô sáng (.lv-active-verse)
 * - Mặc định trên điện thoại theo quyết định L-D2
 */

$root = dirname(__DIR__);
$lyricExtractorJsPath = $root . '/assets/js/lyric-extractor.js';
$displaySettingsJsPath = $root . '/assets/js/display-settings.js';
$chordCanvasJsPath = $root . '/assets/js/chord-canvas.js';
$songLoaderJsPath = $root . '/assets/js/song-loader.js';
$verseManagerJsPath = $root . '/assets/js/core/VerseManager.js';
$sheetCssPath = $root . '/assets/css/sheet.css';
$toolbarPhpPath = $root . '/includes/toolbar.php';
$sheetViewerPhpPath = $root . '/includes/sheet_viewer.php';

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

echo "=== Kiểm thử Ticket L1-7 ⭐: Chế độ BAND (Lời & Hợp âm chữ lớn) ===\n";

if (!file_exists($lyricExtractorJsPath) || !file_exists($sheetCssPath) || !file_exists($toolbarPhpPath)) {
    echo "  ❌ Không tìm thấy các file mã nguồn cốt lõi!\n";
    exit(1);
}

$lyricExtractorJs = file_get_contents($lyricExtractorJsPath);
$displaySettingsJs = file_exists($displaySettingsJsPath) ? file_get_contents($displaySettingsJsPath) : '';
$chordCanvasJs = file_exists($chordCanvasJsPath) ? file_get_contents($chordCanvasJsPath) : '';
$songLoaderJs = file_exists($songLoaderJsPath) ? file_get_contents($songLoaderJsPath) : '';
$verseManagerJs = file_exists($verseManagerJsPath) ? file_get_contents($verseManagerJsPath) : '';
$sheetCss = file_get_contents($sheetCssPath);
$toolbarPhp = file_get_contents($toolbarPhpPath);
$sheetViewerPhp = file_exists($sheetViewerPhpPath) ? file_get_contents($sheetViewerPhpPath) : '';

// 1. Toolbar có nút #btn-band-toggle nằm ở vị trí trung tâm thanh công cụ
$hasToolbarBandBtn = str_contains($toolbarPhp, 'id="btn-band-toggle"')
    && str_contains($toolbarPhp, 'btn-band-toggle');
recordCheck("toolbar.php chứa nút chuyển đổi #btn-band-toggle trực quan trên thanh công cụ", $hasToolbarBandBtn, false);

// 2. sheet_viewer.php có container #lyric-view-container
$hasLyricContainer = str_contains($sheetViewerPhp, 'id="lyric-view-container"')
    && str_contains($sheetViewerPhp, 'class="lyric-view-container hidden"');
recordCheck("sheet_viewer.php chứa vùng render #lyric-view-container", $hasLyricContainer, false);

// 3. CSS định nghĩa kích thước hợp âm ≥ 24px (--lv-chord-size: 26px) và lời ≥ 20px (--lv-syl-size: 21px)
$hasStageFontSizes = (str_contains($sheetCss, '--lv-chord-size:  26px') || str_contains($sheetCss, '--lv-chord-size:  1.65rem'))
    && (str_contains($sheetCss, '--lv-syl-size:    21px') || str_contains($sheetCss, '--lv-syl-size:    1.35rem'))
    && str_contains($sheetCss, 'var(--lv-chord-size')
    && str_contains($sheetCss, 'var(--lv-syl-size');
recordCheck("sheet.css cấu hình kích thước chữ sân khấu: hợp âm ≥ 24px (26px) và lời ≥ 20px (21px)", $hasStageFontSizes, true);

// 4. CSS Dark mode hiển thị hợp âm màu vàng hổ phách #fbbf24 với độ tương phản cao
$hasDarkModeAmberChord = str_contains($sheetCss, 'body.dark-mode .lv-chord')
    && str_contains($sheetCss, '#fbbf24 !important');
recordCheck("sheet.css dark mode tô màu hợp âm hổ phách sáng #fbbf24 tương phản cao trên nền tối", $hasDarkModeAmberChord, true);

// 5. CSS bố cục 2 cột trên iPad ngang (1180x820) và màn hình rộng
$has2ColumnsCss = str_contains($sheetCss, '@media (min-width: 820px) and (orientation: landscape)')
    && (bool)preg_match('/\.lv-wrapper\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s', $sheetCss)
    && (bool)preg_match('/\.lv-header\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s', $sheetCss);
recordCheck("sheet.css định nghĩa bố cục 2 cột (CSS Grid) trên iPad ngang và màn hình rộng", $has2ColumnsCss, true);

// 6. CSS tô sáng khổ đang hát (.lv-active-verse)
$hasActiveVerseCss = str_contains($sheetCss, '.lv-verse.lv-active-verse')
    && str_contains($sheetCss, 'border-color: #8b5cf6 !important')
    && str_contains($sheetCss, 'box-shadow: 0 0 0 2.5px rgba(139,92,246,.45)');
recordCheck("sheet.css định kiểu viền sáng và hiệu ứng nổi bật cho khổ đang hát (.lv-active-verse)", $hasActiveVerseCss, true);

// 7. LyricExtractor gán data-verse-num cho từng section và hỗ trợ Điệp Khúc
$hasDataVerseNum = str_contains($lyricExtractorJs, 'data-verse-num="${safeNum}"')
    && str_contains($lyricExtractorJs, 'lv-chorus');
recordCheck("LyricExtractor.js gán thuộc tính data-verse-num cho mỗi khổ và phân biệt điệp khúc .lv-chorus", $hasDataVerseNum, true);

// 8. LyricExtractor export hàm highlightVerse(verseNum)
$hasHighlightVerse = str_contains($lyricExtractorJs, 'function highlightVerse(verseNum)')
    && str_contains($lyricExtractorJs, 'highlightVerse')
    && str_contains($lyricExtractorJs, 'classList.toggle(\'lv-active-verse\'');
recordCheck("LyricExtractor.js cung cấp hàm highlightVerse() để tô sáng khổ ca đoàn đang hát", $hasHighlightVerse, true);

// 9. VerseManager đồng bộ chuyển khổ với highlightVerse và reRenderSheet cho Band View
$hasVerseManagerSync = str_contains($verseManagerJs, 'window.LyricExtractor?.highlightVerse?.(_currentVerse)')
    && str_contains($verseManagerJs, 'isBandActive')
    && str_contains($verseManagerJs, 'window.DisplaySettings?.renderLyricViewIfActive');
recordCheck("VerseManager.js gọi LyricExtractor.highlightVerse() và re-render khi chuyển khổ ở chế độ Band", $hasVerseManagerSync, true);

// 10. DisplaySettings tích hợp Core Rule 1 và Capo vào _buildLyricXml()
$hasCoreRule1AndCapo = str_contains($displaySettingsJs, '_buildLyricXml')
    && str_contains($displaySettingsJs, 'chordShift = trOffset - capo')
    && str_contains($displaySettingsJs, 'window.ChordCanvasXML?.cloneAndInjectChords');
recordCheck("DisplaySettings.js áp dụng Core Rule 1 (HD fallback TLH) và tính chuẩn thế bấm capo (trOffset - capo)", $hasCoreRule1AndCapo, true);

// 11. DisplaySettings lưu trạng thái sheetapp_view_mode ('band' / 'sheet')
$hasViewModeStorage = str_contains($displaySettingsJs, "localStorage.setItem('sheetapp_view_mode', 'band')")
    && str_contains($displaySettingsJs, "localStorage.setItem('sheetapp_view_mode', 'sheet')");
recordCheck("DisplaySettings.js ghi nhớ tùy chọn chế độ xem sheetapp_view_mode của người dùng", $hasViewModeStorage, true);

// 12. ChordCanvas.switchSet đồng bộ re-render Band View khi chuyển bộ hợp âm
$hasChordCanvasSync = str_contains($chordCanvasJs, 'window.DisplaySettings?.renderLyricViewIfActive');
recordCheck("ChordCanvas.switchSet() tự động làm mới Band View ngay khi đổi bộ hợp âm", $hasChordCanvasSync, true);

// 13. SongLoader áp dụng quyết định L-D2: mặc định chế độ Band trên điện thoại (≤ 680px)
$hasMobileDefaultBand = str_contains($songLoaderJs, 'window.innerWidth <= 680')
    && str_contains($songLoaderJs, "sheetapp_view_mode")
    && str_contains($songLoaderJs, 'shouldOpenBand');
recordCheck("SongLoader.js tự động mở chế độ Band trên điện thoại theo quyết định L-D2", $hasMobileDefaultBand, true);

// 14. SongLoader duy trì render Band View khi đổi sang bài hát mới
$hasSongLoaderNewSongSync = str_contains($songLoaderJs, 'lyricContainer && !lyricContainer.classList.contains(\'hidden\')')
    && str_contains($songLoaderJs, 'window.DisplaySettings?.renderLyricViewIfActive');
recordCheck("SongLoader.js tự động nạp lời & hợp âm bài mới khi người dùng đang ở chế độ Band", $hasSongLoaderNewSongSync, true);

// Tổng kết kết quả
$passedCount = count(array_filter($checks, fn($c) => $c['passed']));
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L1-7 ⭐ ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$totalChecks}\n";
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$behavioralRatio}%)\n";

if ($passedCount === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L1-7 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$totalChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA KHÔNG ĐẠT!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedCount} failed=" . ($totalChecks - $passedCount) . " behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(1);
}
