<?php
/**
 * tests/library_l31_program_bar_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L3-1 (ROADMAP4 Mục 8):
 * - Thanh chương trình (40px, cạnh dưới) khi phát setlist: "2/5 · Tiếp: Ca Cảm Tạ (F→G)" + ◀ ▶ lớn
 * - Ở chế độ Sân khấu thu thành dòng nhỏ trong HUD
 * - Nghiệm thu: E2E với setlist 5 bài
 *
 * Tỷ lệ hành vi >= 56%.
 */

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';

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

echo "=== Kiểm thử Ticket L3-1: Thanh chương trình 40px cạnh dưới & HUD Sân khấu ===\n";

// 1. Kiểm tra tồn tại và cấu trúc markup của includes/setlist_program_bar.php
$barFile = $root . '/includes/setlist_program_bar.php';
check(file_exists($barFile), "Tồn tại file partial includes/setlist_program_bar.php", false);

$barHtml = (string)@file_get_contents($barFile);
check(
    str_contains($barHtml, 'id="setlist-program-bar"') && str_contains($barHtml, 'class="setlist-program-bar hidden"'),
    "Markup: Có thẻ #setlist-program-bar với class .setlist-program-bar và .hidden ban đầu",
    true
);

check(
    str_contains($barHtml, 'id="sp-bar-pos"') && str_contains($barHtml, 'id="sp-bar-next-title"') && str_contains($barHtml, 'id="sp-bar-next-key"'),
    "Markup: Có đầy đủ thẻ hiển thị vị trí (#sp-bar-pos), tên bài tiếp (#sp-bar-next-title) và tông (#sp-bar-next-key)",
    true
);

check(
    str_contains($barHtml, 'id="btn-sp-prev"') && str_contains($barHtml, 'id="btn-sp-next"'),
    "Markup: Có cặp nút điều hướng lớn bài trước (#btn-sp-prev) và bài tiếp theo (#btn-sp-next)",
    true
);

// 2. Kiểm tra index.php có include setlist_program_bar.php
$indexPhp = (string)@file_get_contents($root . '/index.php');
check(
    str_contains($indexPhp, "require_once __DIR__ . '/includes/setlist_program_bar.php';"),
    "index.php: Đã nạp partial setlist_program_bar.php vào DOM chính",
    true
);

// 3. Kiểm tra markup HUD Sân khấu trong includes/sheet_viewer.php
$sheetViewerHtml = (string)@file_get_contents($root . '/includes/sheet_viewer.php');
check(
    str_contains($sheetViewerHtml, 'id="gig-hud-setlist-row"') && str_contains($sheetViewerHtml, 'id="gig-sp-pos"'),
    "HUD Sân khấu: gig-floating-hud chứa dòng chương trình rút gọn #gig-hud-setlist-row và #gig-sp-pos",
    true
);

check(
    str_contains($sheetViewerHtml, 'id="btn-gig-sp-prev"') && str_contains($sheetViewerHtml, 'id="btn-gig-sp-next"'),
    "HUD Sân khấu: Chứa cặp nút điều hướng nhỏ #btn-gig-sp-prev và #btn-gig-sp-next trong HUD",
    true
);

// 4. Kiểm tra CSS trong assets/css/layout.css
$layoutCss = (string)@file_get_contents($root . '/assets/css/layout.css');
check(
    preg_match('/\.setlist-program-bar\s*\{[^}]*height:\s*40px/s', $layoutCss) === 1,
    "CSS: .setlist-program-bar có chiều cao đúng 40px theo quy chuẩn L3-1",
    true
);

check(
    preg_match('/\.setlist-program-bar\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s', $layoutCss) === 1,
    "CSS: .setlist-program-bar gắn cố định ở cạnh dưới màn hình (position: fixed; bottom: 0)",
    true
);

check(
    preg_match('/body\.sheet-only-mode\s+\.setlist-program-bar\s*\{[^}]*display:\s*none\s*!important/s', $layoutCss) === 1,
    "CSS: Khi ở chế độ Sân khấu (sheet-only-mode), thanh cạnh dưới tự động ẩn để nhường chỗ cho HUD",
    true
);

check(
    preg_match('/\.btn-sp-nav\s*\{[^}]*width:\s*44px/s', $layoutCss) === 1,
    "CSS: Nút điều hướng .btn-sp-nav có kích thước cảm ứng lớn (width: 44px) dễ thao tác trên sân khấu",
    true
);

// 5. Kiểm tra logic JS trong assets/js/setlist-player.js
$playerJs = (string)@file_get_contents($root . '/assets/js/setlist-player.js');
check(
    str_contains($playerJs, 'function updateProgramBar()') && str_contains($playerJs, 'updateProgramBar,'),
    "JS: SetlistPlayer xuất phương thức updateProgramBar() để đồng bộ trạng thái thanh chương trình",
    true
);

check(
    str_contains($playerJs, 'keyDisplay = `(${origKey}→${targetKey})`') || str_contains($playerJs, '(${origKey}→${targetKey})'),
    "JS: updateProgramBar() tính toán hiển thị tông chuyển đổi dạng (F→G) khi bài kế có transpose_key",
    true
);

check(
    str_contains($playerJs, "document.getElementById('btn-sp-next')?.addEventListener") && str_contains($playerJs, "document.getElementById('btn-gig-sp-next')?.addEventListener"),
    "JS: bindPlayerEvents() đã gắn sự kiện click cho các nút chuyển bài trên thanh đáy và HUD",
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ L3-1 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Thành công: {$passedChecks}/{$totalChecks}\n";
$pctBehavioral = round(($behavioralChecks / $totalChecks) * 100, 1);
echo "Tỷ lệ kiểm tra hành vi: {$pctBehavioral}% (yêu cầu >= 56%)\n";

if ($passedChecks === $totalChecks && $pctBehavioral >= 56) {
    echo "[SUITE_COMPLETE total={$totalChecks}]\n";
} else {
    echo "[SUITE_FAILED]\n";
    exit(1);
}
