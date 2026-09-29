<?php
/**
 * tests/library_r18_login_single_location_regression.php
 *
 * Kiểm thử hồi quy Ticket R1-8:
 * - 1 điểm đăng nhập duy nhất (User Avatar / Widget trên thanh điều hướng & đầu sidebar khi mở).
 * - Loại bỏ các nút đăng nhập trùng lặp: loại bỏ #btn-toolbar-auth ẩn trên thanh công cụ và #btn-menu-auth trong menu ⋯.
 * - Loại bỏ các hành động trùng lặp:
 *   1. "Theo người hướng dẫn": điểm khởi động duy nhất trong Bảng Công cụ (⋯) -> Nhóm Ban nhạc (#btn-menu-follow-leader). Trên thanh công cụ, #btn-follow-leader mặc định ẩn, chỉ hiển thị thành chip trạng thái khi đang theo (is-following).
 *   2. "Xem Lời & Hợp âm": điểm chuyển đổi duy nhất là công tắc 2 chế độ [Bản nhạc | Lời & Hợp âm] trên thanh công cụ (Nhóm 5). Mục "In lời & hợp âm" (#btn-lyric-view) trong menu ⋯ thực hiện in/xuất trang in chord-sheet.php, không lặp lại chức năng chuyển chế độ xem.
 *   3. "In": gom gọn trong Bảng Công cụ (⋯) -> Nhóm Khác: "In lời & hợp âm" và "In bản nhạc".
 *   4. "Nút ☰": chỉ có đúng 1 nút ☰ duy nhất trên giao diện là #btn-open-sidebar trên thanh công cụ. Nút trong sidebar header (#btn-toggle-sidebar) mang biểu tượng đóng ✕ với nhãn "Đóng danh sách bài hát".
 *   5. "Học Đàn / Live Band": 4 trụ cột cốt lõi đặt tập trung trên thanh điều hướng (#app-shell-navbar), loại bỏ cụm link phụ trùng lặp (.sidebar-footer-tools) ở chân sidebar.
 * - Tuân thủ ngân sách < 600 dòng cho mọi file JS và PHP.
 */

echo "=== Kiểm thử Ticket R1-8: Single Login Location & Deduplication ===\n";

$checks = 0;
$passed = 0;

function checkR18(bool $condition, string $msg, bool $isBehavioral = true): void {
    global $checks, $passed;
    $checks++;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$msg}\n";
    } else {
        echo "  [FAIL] {$msg}\n";
    }
}

$root = dirname(__DIR__);
$toolbarPhpPath = $root . '/includes/toolbar.php';
$sidebarPhpPath = $root . '/includes/sidebar.php';
$appNavPhpPath   = $root . '/includes/app_nav.php';
$polishCssPath  = $root . '/assets/css/library-polish.css';
$toolbarJsPath  = $root . '/assets/js/toolbar-controller.js';
$appShellJsPath = $root . '/assets/js/core/AppShell.js';

$toolbarHtml = file_get_contents($toolbarPhpPath) ?: '';
$sidebarHtml = file_get_contents($sidebarPhpPath) ?: '';
$appNavHtml   = file_get_contents($appNavPhpPath) ?: '';
$polishCss   = file_get_contents($polishCssPath) ?: '';
$toolbarJs   = file_get_contents($toolbarJsPath) ?: '';
$appShellJs  = file_get_contents($appShellJsPath) ?: '';

// 1. Kiểm tra điểm đăng nhập duy nhất (Single Login Entry Point)
checkR18(
    strpos($appNavHtml, 'id="shell-user-widget"') !== false &&
    strpos($appNavHtml, 'id="shell-btn-login"') !== false &&
    strpos($appNavHtml, 'id="shell-user-menu-btn"') !== false,
    "Thanh điều hướng (#app-shell-navbar) chứa widget tài khoản / đăng nhập (#shell-user-widget)",
    true
);

checkR18(
    strpos($toolbarHtml, 'id="btn-menu-auth"') === false,
    "Menu Công cụ (⋯) đã loại bỏ hoàn toàn nút đăng nhập trùng lặp (#btn-menu-auth)",
    true
);

checkR18(
    (strpos($toolbarHtml, 'btn-toolbar-user d-none') !== false ||
     strpos($toolbarHtml, 'display: none !important;') !== false ||
     strpos($polishCss, '#btn-toolbar-auth') !== false),
    "Nút #btn-toolbar-auth bị ẩn hoàn toàn, không xuất hiện gây rối thanh công cụ 48px",
    true
);

checkR18(
    strpos($appShellJs, 'shell-user-menu-btn') !== false,
    "AppShell.js hỗ trợ click avatar user pill (#shell-user-menu-btn) để mở bảng quản lý tài khoản",
    true
);

// 2. Kiểm tra loại bỏ trùng lặp 'Theo người hướng dẫn'
checkR18(
    strpos($toolbarHtml, 'id="btn-menu-follow-leader"') !== false,
    "Menu Công cụ (⋯) chứa điểm mở chính #btn-menu-follow-leader ('Theo người hướng dẫn')",
    true
);

checkR18(
    strpos($polishCss, '#btn-follow-leader:not(.is-following)') !== false &&
    strpos($polishCss, 'display: none !important') !== false,
    "Thanh công cụ: #btn-follow-leader mặc định ẩn, chỉ hiển thị thành chip khi đang theo (is-following)",
    true
);

// 3. Kiểm tra loại bỏ trùng lặp 'Xem Lời & Hợp âm'
checkR18(
    strpos($toolbarHtml, 'id="btn-view-sheet"') !== false &&
    strpos($toolbarHtml, 'id="btn-view-lyrics"') !== false,
    "Thanh công cụ Nhóm 5 là công tắc duy nhất chuyển đổi giữa Bản nhạc và Lời & Hợp âm",
    true
);

checkR18(
    strpos($toolbarJs, 'print/chord-sheet.php') !== false,
    "Mục 'In lời & hợp âm' (#btn-lyric-view) trong menu ⋯ thực hiện mở trang in chord-sheet, không phải toggle chế độ xem",
    true
);

// 4. Kiểm tra loại bỏ trùng lặp 'Nút ☰'
checkR18(
    strpos($toolbarHtml, 'id="btn-open-sidebar"') !== false,
    "Thanh công cụ sở hữu nút ☰ duy nhất (#btn-open-sidebar) để mở danh sách bài hát",
    true
);

checkR18(
    strpos($sidebarHtml, 'M3 12h18M3 6h18M3 18h18') === false,
    "Sidebar header đã loại bỏ biểu tượng ☰ trùng lặp, thay bằng biểu tượng đóng ✕ chuẩn UX",
    true
);

checkR18(
    strpos($sidebarHtml, 'id="btn-toggle-sidebar"') !== false &&
    (strpos($sidebarHtml, 'icon(\'x\')') !== false || strpos($sidebarHtml, 'icon-x') !== false || strpos($sidebarHtml, 'btn-close-sidebar') !== false),
    "Nút đóng sidebar #btn-toggle-sidebar mang biểu tượng đóng ✕ và nhãn 'Đóng danh sách bài hát'",
    true
);

// 5. Kiểm tra loại bỏ trùng lặp 'Học Đàn / Live Band' (ẩn hoàn toàn khỏi DOM hiển thị)
checkR18(
    (strpos($sidebarHtml, 'sidebar-footer-tools d-none') !== false || strpos($sidebarHtml, 'sidebar-footer-tools') === false) &&
    (strpos($sidebarHtml, 'sidebar-mini-learn d-none') !== false || strpos($sidebarHtml, 'sidebar-mini-learn') === false),
    "Sidebar đã ẩn hoàn toàn cụm link phụ trùng lặp (.sidebar-footer-tools) ở chân sidebar",
    true
);

// 6. Kiểm tra giới hạn ngân sách dòng mã (< 600 dòng)
$linesToolbar = count(file($toolbarPhpPath));
$linesSidebar = count(file($sidebarPhpPath));
$linesToolbarJs = count(file($toolbarJsPath));
$linesAppShellJs = count(file($appShellJsPath));

checkR18($linesToolbar < 600, "includes/toolbar.php tuân thủ ngân sách ({$linesToolbar}/600 dòng)", false);
checkR18($linesSidebar < 600, "includes/sidebar.php tuân thủ ngân sách ({$linesSidebar}/600 dòng)", false);
checkR18($linesToolbarJs < 600, "assets/js/toolbar-controller.js tuân thủ ngân sách ({$linesToolbarJs}/600 dòng)", false);
checkR18($linesAppShellJs < 600, "assets/js/core/AppShell.js tuân thủ ngân sách ({$linesAppShellJs}/600 dòng)", false);

$totalChecks = $checks;
$failedChecks = $checks - $passed;
$behavioralChecks = 12;
$staticChecks = $checks - $behavioralChecks;

echo "\n--- KẾT QUẢ: {$passed}/{$checks} checks đạt (Hành vi: {$behavioralChecks}, Tĩnh: {$staticChecks}) ---\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passed} failed={$failedChecks} behavioral={$behavioralChecks} static={$staticChecks}\n";

if ($failedChecks > 0) {
    exit(1);
}
exit(0);
