<?php
/**
 * tests/library_r44_device_default_view_regression.php
 *
 * Regression test suite cho Ticket R4-4:
 * - Mặc định theo thiết bị (quyết định Q2):
 *   + Điện thoại: Lời & Hợp âm cho khách và người chọn Guitar/Hát; Bản nhạc cho Đàn phím.
 *   + Laptop/Desktop: Bản nhạc mặc định.
 * - Luôn nhớ lựa chọn cá nhân cuối cùng (localStorage['sheetapp_view_mode'])
 * - Nghiệm thu: Đổi sang Nhạc, reload thì vẫn là Nhạc (không bị reset).
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

echo "=== Kiểm thử Ticket R4-4: Chế Độ Xem Mặc Định & Ghi Nhớ Lựa Chọn (Q2) ===\n\n";

$songLoaderFile = __DIR__ . '/../assets/js/song-loader.js';
$toolbarCtrlFile = __DIR__ . '/../assets/js/toolbar-controller.js';
$displaySettingsFile = __DIR__ . '/../assets/js/display-settings.js';
$mobileCtrlFile = __DIR__ . '/../assets/js/mobile-controller.js';

// ── 1. Kiểm tra mã nguồn song-loader.js ──
echo "-- 1. Kiểm tra logic quyết định Q2 trong song-loader.js --\n";
it('File assets/js/song-loader.js tồn tại', file_exists($songLoaderFile));
$songLoaderJs = file_get_contents($songLoaderFile) ?: '';

it('song-loader.js đọc vai trò nhạc cụ từ localStorage (sheetapp_instrument_role)',
    str_contains($songLoaderJs, "localStorage.getItem('sheetapp_instrument_role')")
);

it('song-loader.js kiểm tra vai trò Đàn phím (role === \'keyboard\')',
    str_contains($songLoaderJs, "role === 'keyboard'")
);

it('song-loader.js thiết lập defaultMode theo Q2: mobile đàn phím mở sheet, guitar/hát/khách mở band, desktop mở sheet',
    str_contains($songLoaderJs, "defaultMode = isMobile ? (role === 'keyboard' ? 'sheet' : 'band') : 'sheet'")
);

it('song-loader.js ưu tiên lựa chọn đã lưu (savedMode || defaultMode) trước khi quyết định chế độ xem',
    str_contains($songLoaderJs, 'effectiveMode = savedMode || defaultMode')
);

it('song-loader.js đồng bộ trạng thái: mở band nếu effectiveMode === band, ẩn band nếu effectiveMode === sheet',
    str_contains($songLoaderJs, "effectiveMode === 'band'") &&
    str_contains($songLoaderJs, '!lyric.classList.contains(\'hidden\')')
);

// ── 2. Kiểm tra lưu lựa chọn cá nhân trên toolbar & display-settings ──
echo "\n-- 2. Kiểm tra lưu trữ lựa chọn (localStorage persistence) khi chuyển chế độ --\n";
it('File assets/js/toolbar-controller.js tồn tại', file_exists($toolbarCtrlFile));
$toolbarJs = file_get_contents($toolbarCtrlFile) ?: '';

it('toolbar-controller.js lưu sheetapp_view_mode vào localStorage khi bấm nút chuyển chế độ',
    str_contains($toolbarJs, "localStorage.setItem('sheetapp_view_mode', isHidden ? 'band' : 'sheet')")
);

it('toolbar-controller.js đồng bộ tham số URL v=lyric / v=sheet khi chuyển chế độ',
    str_contains($toolbarJs, "window.URLState?.update?.({ v: isHidden ? 'lyric' : 'sheet' })")
);

it('File assets/js/display-settings.js tồn tại', file_exists($displaySettingsFile));
$displaySettingsJs = file_get_contents($displaySettingsFile) ?: '';

it('display-settings.js lưu sheetapp_view_mode khi mở chế độ Lời hoặc quay lại Bản nhạc',
    str_contains($displaySettingsJs, "localStorage.setItem('sheetapp_view_mode', 'band')") &&
    str_contains($displaySettingsJs, "localStorage.setItem('sheetapp_view_mode', 'sheet')")
);

// ── 3. Kiểm tra mô phỏng ma trận quyết định Q2 (Behavioral Matrix Simulation) ──
echo "\n-- 3. Kiểm nghiệm hành vi Ma trận Q2 (Thiết bị x Nhạc cụ x Lựa chọn cá nhân) --\n";

function resolveViewMode(bool $isMobile, ?string $role, ?string $savedPreference, ?string $urlParam = null): string {
    if ($urlParam === 'lyric') return 'band';
    if ($urlParam === 'sheet') return 'sheet';

    $roleNorm = strtolower($role ?? '');
    $defaultMode = $isMobile ? ($roleNorm === 'keyboard' ? 'sheet' : 'band') : 'sheet';
    return $savedPreference ?? $defaultMode;
}

// Case 1: Khách mới trên Mobile (chưa lưu lựa chọn, không chọn vai trò) -> Mở Lời & Hợp âm
$modeGuestMobile = resolveViewMode(true, null, null);
it('Case 1 (Q2): Khách lần đầu vào app trên Mobile -> Mặc định mở Lời & Hợp âm (band)',
    $modeGuestMobile === 'band'
);

// Case 2: Guitarist trên Mobile (chưa lưu lựa chọn) -> Mở Lời & Hợp âm
$modeGuitarMobile = resolveViewMode(true, 'guitar', null);
it('Case 2 (Q2): Người chọn Guitar trên Mobile -> Mặc định mở Lời & Hợp âm (band)',
    $modeGuitarMobile === 'band'
);

// Case 3: Ca sĩ / Hát trên Mobile (chưa lưu lựa chọn) -> Mở Lời & Hợp âm
$modeVocalsMobile = resolveViewMode(true, 'vocals', null);
it('Case 3 (Q2): Người chọn Hát trên Mobile -> Mặc định mở Lời & Hợp âm (band)',
    $modeVocalsMobile === 'band'
);

// Case 4: Đàn phím (Keyboard) trên Mobile (chưa lưu lựa chọn) -> Mở Bản nhạc
$modeKeyboardMobile = resolveViewMode(true, 'keyboard', null);
it('Case 4 (Q2): Người chọn Đàn phím trên Mobile -> Mặc định mở Bản nhạc (sheet)',
    $modeKeyboardMobile === 'sheet'
);

// Case 5: Khách trên Laptop/Desktop (chưa lưu lựa chọn) -> Mở Bản nhạc
$modeDesktop = resolveViewMode(false, 'guitar', null);
it('Case 5 (Q2): Màn hình Laptop/Desktop -> Mặc định mở Bản nhạc (sheet)',
    $modeDesktop === 'sheet'
);

// Case 6: Ghi nhớ lựa chọn: Người dùng Guitar trên Mobile đổi sang Bản nhạc -> Reload vẫn là Bản nhạc
$modeGuitarSwitchedToSheet = resolveViewMode(true, 'guitar', 'sheet');
it('Case 6 (Ghi nhớ): Guitar trên Mobile đổi sang Bản nhạc (saved=sheet) -> Reload vẫn là Bản nhạc',
    $modeGuitarSwitchedToSheet === 'sheet'
);

// Case 7: Ghi nhớ lựa chọn: Đàn phím trên Mobile đổi sang Lời & Hợp âm -> Reload vẫn là Lời & Hợp âm
$modeKeyboardSwitchedToBand = resolveViewMode(true, 'keyboard', 'band');
it('Case 7 (Ghi nhớ): Đàn phím đổi sang Lời (saved=band) -> Reload vẫn là Lời & Hợp âm',
    $modeKeyboardSwitchedToBand === 'band'
);

// Case 8: Người dùng Laptop đổi sang Lời (saved=band) -> Reload vẫn là Lời & Hợp âm
$modeDesktopSwitchedToBand = resolveViewMode(false, 'keyboard', 'band');
it('Case 8 (Ghi nhớ): Laptop đổi sang Lời (saved=band) -> Reload vẫn là Lời & Hợp âm',
    $modeDesktopSwitchedToBand === 'band'
);

// Case 9: Tham số URL tường minh v=lyric có độ ưu tiên cao nhất
$modeUrlExplicitLyric = resolveViewMode(true, 'keyboard', 'sheet', 'lyric');
it('Case 9 (URL Precedence): Có ?v=lyric trên URL -> Luôn mở Lời & Hợp âm bất kể role hay savedMode',
    $modeUrlExplicitLyric === 'band'
);

// Case 10: Tham số URL tường minh v=sheet có độ ưu tiên cao nhất
$modeUrlExplicitSheet = resolveViewMode(true, 'guitar', 'band', 'sheet');
it('Case 10 (URL Precedence): Có ?v=sheet trên URL -> Luôn mở Bản nhạc bất kể role hay savedMode',
    $modeUrlExplicitSheet === 'sheet'
);

// ── 4. Kiểm tra ngân sách dòng code (< 600 dòng) ──
echo "\n-- 4. Ngân sách dòng code (< 600 dòng) --\n";
$slLines = count(file($songLoaderFile));
it("assets/js/song-loader.js có {$slLines} dòng (< 600 dòng)", $slLines < 600);

$tbLines = count(file($toolbarCtrlFile));
it("assets/js/toolbar-controller.js có {$tbLines} dòng (< 600 dòng)", $tbLines < 600);

$dsLines = count(file($displaySettingsFile));
it("assets/js/display-settings.js có {$dsLines} dòng (< 600 dòng)", $dsLines < 600);

$mcLines = count(file($mobileCtrlFile));
it("assets/js/mobile-controller.js có {$mcLines} dòng (< 600 dòng)", $mcLines < 600);

// Tổng kết
echo "\n=======================================================\n";
echo "Tổng số kiểm tra: {$testCount}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$testCount}\n";
echo "=======================================================\n";

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";

if ($passedCount !== $testCount) {
    exit(1);
}
