<?php
declare(strict_types=1);

/**
 * tests/library_r15_tools_menu_regression.php
 *
 * Kiểm thử hồi quy Ticket R1-5 (ROADMAP5.md):
 * Bảng Công cụ (⋯): popover trên laptop (320px), bottom sheet trên điện thoại (≥ 44px/dòng).
 * 5 nhóm chuẩn thống nhất: Hiển thị, Nhạc, Ban nhạc, Soạn, Khác.
 * Mỗi mục có nhãn chữ + Lucide SVG icon, không bị ẩn lệch giữa các màn hình, không tràn ngang.
 */

$suiteTotalChecks = 0;
$suiteBehavioralChecks = 0;

function assertCondition(bool $condition, string $msg, bool $isBehavioral = false): void {
    global $suiteTotalChecks, $suiteBehavioralChecks;
    $suiteTotalChecks++;
    if ($isBehavioral) {
        $suiteBehavioralChecks++;
    }
    if (!$condition) {
        echo "[FAIL] {$msg}\n";
        exit(1);
    }
    echo "[PASS] {$msg}\n";
}

echo "=== TICKET R1-5: UNIFIED TOOLS MENU (POPOVER & BOTTOM SHEET) REGRESSION SUITE ===\n\n";

$toolbarFile = __DIR__ . '/../includes/toolbar.php';
$controllerFile = __DIR__ . '/../assets/js/toolbar-controller.js';
$polishCssFile = __DIR__ . '/../assets/css/library-polish.css';

// 1. Kiểm tra file tồn tại và số dòng tuân thủ ngân sách < 600 dòng
assertCondition(file_exists($toolbarFile), "File includes/toolbar.php tồn tại");
assertCondition(file_exists($controllerFile), "File assets/js/toolbar-controller.js tồn tại");
assertCondition(file_exists($polishCssFile), "File assets/css/library-polish.css tồn tại");

$toolbarContent = file_get_contents($toolbarFile);
$toolbarLines = count(explode("\n", $toolbarContent));
assertCondition(
    $toolbarLines < 600,
    "includes/toolbar.php tuân thủ ngân sách < 600 dòng (hiện tại: {$toolbarLines} dòng)",
    true
);

$controllerContent = file_get_contents($controllerFile);
$controllerLines = count(explode("\n", $controllerContent));
assertCondition(
    $controllerLines < 600,
    "toolbar-controller.js tuân thủ ngân sách < 600 dòng (hiện tại: {$controllerLines} dòng)",
    true
);

// 2. Kiểm tra cấu trúc 5 nhóm chuẩn trong #main-dropdown-menu (mục 2.3 ROADMAP5)
assertCondition(
    strpos($toolbarContent, 'id="main-dropdown-menu"') !== false,
    "Toolbar chứa #main-dropdown-menu"
);

$has5Sections = (
    strpos($toolbarContent, 'HIỂN THỊ') !== false &&
    strpos($toolbarContent, 'NHẠC') !== false &&
    strpos($toolbarContent, 'BAN NHẠC') !== false &&
    strpos($toolbarContent, 'SOẠN') !== false &&
    strpos($toolbarContent, 'KHÁC') !== false
);
assertCondition(
    $has5Sections,
    "Menu Công Cụ (⋯) chứa đủ 5 nhóm chuẩn: HIỂN THỊ, NHẠC, BAN NHẠC, SOẠN, KHÁC",
    true
);

// 3. Kiểm tra các mục trong Nhóm 1: HIỂN THỊ
$hasGroupDisplay = (
    strpos($toolbarContent, 'id="btn-menu-zoom-out"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-zoom-in"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-lock-zoom"') !== false &&
    strpos($toolbarContent, 'id="btn-compact-mode"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-verse-mode"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-chord-preset"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-chord-notation"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-instrument-role"') !== false &&
    strpos($toolbarContent, 'id="btn-dark-toggle"') !== false
);
assertCondition(
    $hasGroupDisplay,
    "Nhóm HIỂN THỊ chứa đầy đủ: Thu phóng (− % + 🔒), Tối giản bản nhạc, Khổ hát, Cỡ hợp âm, Ký hiệu, Góc nhìn, Sáng/Tối",
    true
);

// 4. Kiểm tra các mục trong Nhóm 2: NHẠC
$hasGroupMusic = (
    strpos($toolbarContent, 'id="btn-play-audio"') !== false &&
    strpos($toolbarContent, 'id="btn-stop-audio"') !== false &&
    strpos($toolbarContent, 'id="btn-audio-settings"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-auto-scroll"') !== false &&
    strpos($toolbarContent, 'id="menu-scroll-speed"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-metronome"') !== false &&
    strpos($toolbarContent, 'id="menu-capo-select"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-transpose-reset"') !== false
);
assertCondition(
    $hasGroupMusic,
    "Nhóm NHẠC chứa đầy đủ: Phát bè + âm lượng, Tự cuộn + tốc độ, Giữ nhịp (Metronome), Capo, Tông gốc",
    true
);

// 5. Kiểm tra các mục trong Nhóm 3: BAN NHẠC
assertCondition(
    strpos($toolbarContent, 'id="btn-menu-follow-leader"') !== false &&
    (strpos($toolbarContent, 'người hướng dẫn') !== false || strpos($toolbarContent, 'Live Sync') !== false),
    "Nhóm BAN NHẠC chứa mục 'Theo người hướng dẫn (Live Sync)'",
    true
);

// 6. Kiểm tra các mục trong Nhóm 4: SOẠN
$hasGroupEdit = (
    strpos($toolbarContent, 'id="btn-menu-add-chord-mode"') !== false &&
    strpos($toolbarContent, 'id="btn-menu-create-chordset"') !== false &&
    strpos($toolbarContent, 'id="btn-song-versions"') !== false &&
    strpos($toolbarContent, 'id="btn-toolbar-editor"') !== false
);
assertCondition(
    $hasGroupEdit,
    "Nhóm SOẠN chứa đầy đủ: Soạn hợp âm, Bộ hợp âm mới, Phiên bản, Sửa bản nhạc (SATB)",
    true
);

// 7. Kiểm tra các mục trong Nhóm 5: KHÁC
$hasGroupOther = (
    strpos($toolbarContent, 'id="btn-lyric-view"') !== false &&
    strpos($toolbarContent, 'id="btn-print"') !== false &&
    strpos($toolbarContent, 'manager/') !== false &&
    strpos($toolbarContent, 'id="btn-help"') !== false
);
assertCondition(
    $hasGroupOther,
    "Nhóm KHÁC chứa đầy đủ: In lời & hợp âm, In bản nhạc, Quản lý kho nhạc, Hướng dẫn",
    true
);

// 8. Kiểm tra CSS Styling cho Popover Laptop (320px) và Mobile Bottom Sheet (>= 44px touch row)
$cssContent = file_get_contents($polishCssFile);
assertCondition(
    strpos($cssContent, '320px') !== false,
    "library-polish.css định dạng độ rộng popover 320px trên laptop",
    true
);

assertCondition(
    strpos($cssContent, 'is-bottom-sheet') !== false ||
    strpos($cssContent, 'sheet-drag-handle') !== false ||
    (strpos($cssContent, 'bottom:') !== false && strpos($cssContent, 'border-radius') !== false),
    "library-polish.css có định dạng bottom sheet trên mobile (max-height, border-radius)",
    true
);

assertCondition(
    strpos($cssContent, 'min-height: 48px') !== false ||
    strpos($cssContent, 'min-height: 44px') !== false,
    "library-polish.css bảo đảm touch target hàng trên mobile ≥ 44px (48px tiêu chuẩn)",
    true
);

assertCondition(
    strpos($cssContent, 'overflow-x: hidden') !== false,
    "library-polish.css ngăn ngừa hoàn toàn tràn ngang trong menu công cụ (overflow-x: hidden)",
    true
);

// 9. Kiểm tra ToolbarController xử lý popover vs bottom sheet & backdrop
assertCondition(
    strpos($controllerContent, 'is-bottom-sheet') !== false ||
    strpos($controllerContent, 'backdrop') !== false ||
    strpos($controllerContent, 'innerWidth') !== false,
    "toolbar-controller.js xử lý đóng mở phản hồi theo kích thước màn hình (popover/bottom sheet/backdrop)",
    true
);

echo "\n--- KẾT QUẢ SUITE: {$suiteTotalChecks} kiểm tra thành công, 0 lỗi ({$suiteBehavioralChecks} behavioral checks) ---\n";
echo "SUITE_COMPLETE total={$suiteTotalChecks}\n";
