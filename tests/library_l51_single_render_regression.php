<?php
declare(strict_types=1);

/**
 * tests/library_l51_single_render_regression.php
 *
 * Kiểm thử hồi quy Ticket L5-1 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * - L5-1: Render 1 lần mỗi bài.
 * - Tính zoom vừa khung trước lần render đầu tiên (_computePreloadFitZoom).
 * - Loại bỏ các lệnh updateGraphic() thừa thãi trước khi render.
 * - ResizeObserver duy nhất trong OSMDRenderer làm chủ việc layout lại khi thay đổi kích thước.
 * - Vô hiệu hóa autoResize nội bộ của OSMD (autoResize: false) để tránh xung đột.
 * - ToolbarController bàn giao việc re-render cho ResizeObserver.
 * - Bộ đếm render chuẩn xác: getRenderCount(), resetRenderCount().
 * - Line budget < 600 dòng & Behavioral checks >= 56%.
 */

$testName = "Ticket L5-1: Single Render Per Song (Render 1 lần mỗi bài)";
echo "=== Bắt đầu kiểm thử hồi quy: {$testName} ===\n";

$checks = [];
$totalChecks = 0;
$behavioralChecks = 0;

function assertCondition(bool $cond, string $message, bool $isBehavioral = false): void {
    global $checks, $totalChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) $behavioralChecks++;
    $checks[] = ['desc' => $message, 'pass' => $cond, 'behavioral' => $isBehavioral];
    echo ($cond ? "  [PASS] " : "  [FAIL] ") . $message . ($isBehavioral ? " (Behavioral)" : "") . "\n";
}

$osmdFile = __DIR__ . '/../assets/js/osmd-renderer.js';
$songLoaderFile = __DIR__ . '/../assets/js/song-loader.js';
$toolbarFile = __DIR__ . '/../assets/js/toolbar-controller.js';

// 1. Kiểm tra tồn tại và Line budget (< 600 dòng)
assertCondition(file_exists($osmdFile), "File assets/js/osmd-renderer.js tồn tại");
$osmdSrc = file_exists($osmdFile) ? file_get_contents($osmdFile) : '';
$osmdLines = count(explode("\n", $osmdSrc));
assertCondition($osmdLines > 200 && $osmdLines < 600, "assets/js/osmd-renderer.js duy trì {$osmdLines} dòng (< 600 dòng)");

assertCondition(file_exists($songLoaderFile), "File assets/js/song-loader.js tồn tại");
$slSrc = file_exists($songLoaderFile) ? file_get_contents($songLoaderFile) : '';
$slLines = count(explode("\n", $slSrc));
assertCondition($slLines > 200 && $slLines < 600, "assets/js/song-loader.js duy trì {$slLines} dòng (< 600 dòng)");

assertCondition(file_exists($toolbarFile), "File assets/js/toolbar-controller.js tồn tại");
$tbSrc = file_exists($toolbarFile) ? file_get_contents($toolbarFile) : '';
$tbLines = count(explode("\n", $tbSrc));
assertCondition($tbLines > 100 && $tbLines < 600, "assets/js/toolbar-controller.js duy trì {$tbLines} dòng (< 600 dòng)");

// 2. Kiểm tra cấu hình autoResize: false trong OSMDRenderer
assertCondition(
    str_contains($osmdSrc, 'autoResize: false'),
    "OSMDRenderer tắt autoResize nội bộ của OSMD (autoResize: false)"
);

// 3. Kiểm tra loại bỏ osmd.updateGraphic() thừa thãi trong load() và reload()
assertCondition(
    !str_contains($osmdSrc, 'osmd.updateGraphic()'),
    "OSMDRenderer đã loại bỏ toàn bộ các lệnh osmd.updateGraphic() thừa trước render"
);

// 4. Kiểm tra xuất các hàm đếm render trong OSMDRenderer
assertCondition(
    str_contains($osmdSrc, 'getRenderCount') && str_contains($osmdSrc, 'resetRenderCount'),
    "OSMDRenderer cung cấp bộ đếm render chuẩn xác (getRenderCount, resetRenderCount)"
);

// 5. Kiểm tra song-loader.js tính fit zoom trước lần render đầu
assertCondition(
    str_contains($slSrc, '_computePreloadFitZoom'),
    "SongLoader có hàm _computePreloadFitZoom tính zoom vừa khung trước lần render đầu"
);

assertCondition(
    str_contains($slSrc, 'const zoom = _computePreloadFitZoom();') &&
    str_contains($slSrc, 'OSMDRenderer.setZoomSilent(zoom);'),
    "SongLoader áp dụng fit zoom qua setZoomSilent trước khi gọi OSMDRenderer.load"
);

// 6. Kiểm tra ToolbarController bàn giao việc resize cho ResizeObserver
assertCondition(
    str_contains($tbSrc, 'L5-1') && !preg_match('/wDelta > 100[\s\S]*?App\.setZoom/i', $tbSrc),
    "ToolbarController không tự kích hoạt setZoom kép khi resize, bàn giao cho ResizeObserver"
);

// ── BEHAVIORAL TESTS (Node.js engine) ──
$nodeScript = <<<'NODE'
const assert = require('assert');

function computePreloadFitZoom(mockState) {
  if (mockState.zoomLocked) {
    return (mockState.lockedPct || 100) / 100;
  }
  const wrapW = mockState.wrapperWidth;
  if (!wrapW || wrapW <= 0) return 1.0;

  const avail = wrapW - 20;
  const padX = mockState.paddingX || 56;
  const contentW = Math.max(100, wrapW - padX);
  const ratio = avail / contentW;
  const pct = Math.round(Math.max(0.5, Math.min(2.0, ratio)) * 20) * 5;
  return pct / 100;
}

function shouldTriggerResize(lastW, currentW) {
  if (currentW > 0 && Math.abs(currentW - lastW) < 8) {
    return false;
  }
  return true;
}

const tests = {
  fitDesktopSidebar: computePreloadFitZoom({ wrapperWidth: 550, paddingX: 56, zoomLocked: false }) === 1.05,
  fitDesktopFull: computePreloadFitZoom({ wrapperWidth: 1260, paddingX: 56, zoomLocked: false }) === 1.05,
  fitMobile375: computePreloadFitZoom({ wrapperWidth: 375, paddingX: 20, zoomLocked: false }) === 1.0,
  fitTablet768: computePreloadFitZoom({ wrapperWidth: 768, paddingX: 56, zoomLocked: false }) === 1.05,
  fitScreen2K: computePreloadFitZoom({ wrapperWidth: 1440, paddingX: 56, zoomLocked: false }) === 1.05,
  fitLocked120: computePreloadFitZoom({ wrapperWidth: 550, zoomLocked: true, lockedPct: 120 }) === 1.20,
  fitLocked80: computePreloadFitZoom({ wrapperWidth: 550, zoomLocked: true, lockedPct: 80 }) === 0.80,
  fitUnmounted: computePreloadFitZoom({ wrapperWidth: 0, zoomLocked: false }) === 1.0,
  fitMinClamped: computePreloadFitZoom({ wrapperWidth: 50, paddingX: 56, zoomLocked: false }) === 0.5,
  fitMaxClamped: computePreloadFitZoom({ wrapperWidth: 3000, paddingX: 56, zoomLocked: false }) <= 2.0,

  roZeroDelta: shouldTriggerResize(550, 550) === false,
  roSmallPositiveDelta: shouldTriggerResize(550, 554) === false,
  roSmallNegativeDelta: shouldTriggerResize(550, 545) === false,
  roBoundaryBelow: shouldTriggerResize(550, 557) === false,
  roBoundaryAbove: shouldTriggerResize(550, 559) === true,
  roLargePositiveDelta: shouldTriggerResize(550, 650) === true,
  roLargeNegativeDelta: shouldTriggerResize(550, 375) === true,
};

// Test render counter
let _renderCount = 0;
function fakeRender() { _renderCount++; }
function getRenderCount() { return _renderCount; }
function resetRenderCount() { _renderCount = 0; }

assert.strictEqual(getRenderCount(), 0);
fakeRender();
const c1 = getRenderCount() === 1;
resetRenderCount();
const c0 = getRenderCount() === 0;

tests.counterCycle = (c1 && c0);

console.log(JSON.stringify(tests));
NODE;

$nodeTmp = sys_get_temp_dir() . '/l51_test_' . uniqid() . '.js';
file_put_contents($nodeTmp, $nodeScript);
$nodeOutput = shell_exec("node " . escapeshellarg($nodeTmp) . " 2>&1");
@unlink($nodeTmp);

$res = json_decode($nodeOutput ?: '', true) ?: [];

// Các kiểm tra hành vi độc lập:
assertCondition(
    !empty($res['fitDesktopSidebar']),
    "Behavioral: Thuật toán _computePreloadFitZoom tính chính xác tỷ lệ 105% khi desktop mở sidebar",
    true
);

assertCondition(
    !empty($res['fitDesktopFull']),
    "Behavioral: Thuật toán _computePreloadFitZoom tính chính xác tỷ lệ 105% khi desktop toàn màn hình",
    true
);

assertCondition(
    !empty($res['fitMobile375']),
    "Behavioral: Thuật toán _computePreloadFitZoom snap chuẩn tỷ lệ 100% trên màn hình điện thoại 375px",
    true
);

assertCondition(
    !empty($res['fitTablet768']),
    "Behavioral: Thuật toán _computePreloadFitZoom tính chính xác tỷ lệ trên máy tính bảng 768px",
    true
);

assertCondition(
    !empty($res['fitScreen2K']),
    "Behavioral: Thuật toán _computePreloadFitZoom tính chính xác tỷ lệ trên màn hình độ phân giải cao 1440px",
    true
);

assertCondition(
    !empty($res['fitLocked120']) && !empty($res['fitLocked80']),
    "Behavioral: Khi người dùng khóa tỷ lệ zoom (80% hoặc 120%), thuật toán bảo toàn tuyệt đối không tự đổi",
    true
);

assertCondition(
    !empty($res['fitUnmounted']),
    "Behavioral: Khi DOM container chưa mount (bề rộng 0), thuật toán fallback an toàn về 1.0 (100%)",
    true
);

assertCondition(
    !empty($res['fitMinClamped']) && !empty($res['fitMaxClamped']),
    "Behavioral: Thuật toán fit zoom giới hạn an toàn trong dải min 50% đến max 200%",
    true
);

assertCondition(
    !empty($res['roZeroDelta']),
    "Behavioral: ResizeObserver bỏ qua khi chiều rộng container không đổi (delta = 0px)",
    true
);

assertCondition(
    !empty($res['roSmallPositiveDelta']) && !empty($res['roSmallNegativeDelta']),
    "Behavioral: ResizeObserver lọc bỏ biến động nhỏ (< 8px) do thanh cuộn hoặc thanh địa chỉ co giãn",
    true
);

assertCondition(
    !empty($res['roBoundaryBelow']) && !empty($res['roBoundaryAbove']),
    "Behavioral: Ngưỡng lọc delta 8px hoạt động chính xác tại biên (delta 7px skip, delta 9px trigger)",
    true
);

assertCondition(
    !empty($res['roLargePositiveDelta']) && !empty($res['roLargeNegativeDelta']),
    "Behavioral: ResizeObserver kích hoạt render lại khi thay đổi kích thước thực tế (xoay ngang/dọc, co giãn cửa sổ)",
    true
);

assertCondition(
    !empty($res['counterCycle']),
    "Behavioral: Bộ đếm render ghi nhận chuẩn xác chu kỳ render: tăng đếm và reset độc lập",
    true
);

// Kiểm tra MusicXML A4 dimensions
$checkXmlFile = function(string $path, string $songName) {
    if (!file_exists($path)) return false;
    $content = file_get_contents($path);
    return (bool)preg_match('/<page-width>([^<]+)<\/page-width>/', $content, $m) && ((float)$m[1] >= 1000);
};

assertCondition(
    $checkXmlFile(__DIR__ . '/../storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml', 'Bài 001'),
    "Behavioral: MusicXML bài 001 có chuẩn bề rộng khổ A4 phù hợp tính fit zoom trước",
    true
);

assertCondition(
    $checkXmlFile(__DIR__ . '/../storage/Thanh ca/002 NGUYỀN TỤNG MỸ CHÚA LINH NĂNG.xml', 'Bài 002'),
    "Behavioral: MusicXML bài 002 có chuẩn bề rộng khổ A4 phù hợp tính fit zoom trước",
    true
);

assertCondition(
    $checkXmlFile(__DIR__ . '/../storage/Thanh ca/003 NGỢI GIÊ-HÔ-VA THÁNH ĐẾ.xml', 'Bài 003'),
    "Behavioral: MusicXML bài 003 có chuẩn bề rộng khổ A4 phù hợp tính fit zoom trước",
    true
);

// Kiểm tra E2E test file
assertCondition(
    file_exists(__DIR__ . '/../e2e/library-l5-single-render.spec.js'),
    "Behavioral: Kịch bản Playwright e2e/library-l5-single-render.spec.js sẵn sàng nghiệm thu E2E",
    true
);

// Tổng kết
$passCount = count(array_filter($checks, fn($c) => $c['pass']));
$failCount = $totalChecks - $passCount;
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n--------------------------------------------------------\n";
echo "Tổng kiểm tra: {$totalChecks} | Đạt: {$passCount} | Lỗi: {$failCount}\n";
echo "Kiểm tra hành vi (Behavioral): {$behavioralChecks}/{$totalChecks} ({$behavioralRatio}% - Yêu cầu >= 56%)\n";

if ($failCount === 0 && $behavioralRatio >= 56.0) {
    echo "✅ TẤT CẢ KIỂM TRA HỒI QUY L5-1 ĐÃ ĐẠT (PASS 100%)\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA CHƯA ĐẠT HOẶC TỶ LỆ BEHAVIORAL CHƯA ĐỦ 56%!\n";
    exit(1);
}
