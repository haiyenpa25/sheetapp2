<?php
/**
 * tests/library_r32_labels_and_fullscreen_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket R3-2:
 * - Đổi nhãn: "Mùa lễ" → "Dịp lễ"
 * - "Setlists" → "Chương trình" (vẫn cho tìm "setlist")
 * - "Biểu diễn" → theo quyết định Q1 ("Toàn Màn Hình")
 * - "STT HTTLVN" → "Số bài Thánh Ca"
 * - "Nhật ký biểu diễn" → "Nhật ký phục vụ"
 * - Bỏ "(Live Sync)", "(/manager/)", "Nhắc Band" → "Nhắc ban nhạc"
 * - Chuẩn hóa chính tả "Xoá" → "Xóa"
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;

function it(string $desc, bool $cond): void {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

echo "=== R3-2: UI Labels & Fullscreen Mode Regression Suite ===\n\n";

$root = dirname(__DIR__);

// 1. includes/sidebar.php
echo "-- 1. Kiểm tra includes/sidebar.php --\n";
$sidebar = file_get_contents($root . '/includes/sidebar.php');
it("Tab danh sách có nhãn 'Chương trình'", str_contains($sidebar, 'data-tab="setlist">Chương trình</button>'));
it("Không còn nhãn 'Setlists' trên tab sidebar", !str_contains($sidebar, '>Setlists</button>'));
it("Nút tạo trong sidebar dùng 'Tạo Chương Trình Mới'", str_contains($sidebar, 'Tạo Chương Trình Mới'));
it("Empty state tab dùng 'Chưa có chương trình nào'", str_contains($sidebar, 'Chưa có chương trình nào'));
it("Tiêu đề chi tiết sidebar dùng 'Chương trình'", str_contains($sidebar, '<h3 id="setlist-detail-title" class="setlist-detail-title">Chương trình</h3>'));
it("Nút in dùng 'In Tập Chương Trình A4'", str_contains($sidebar, 'title="In Tập Chương Trình A4"'));
it("Nhãn lọc mùa lễ đã đổi thành 'Dịp lễ:'", str_contains($sidebar, 'Dịp lễ:'));
it("Lựa chọn mặc định lọc dùng 'Tất cả Dịp lễ'", str_contains($sidebar, 'Tất cả Dịp lễ'));
it("Lựa chọn sắp xếp dùng 'Số bài Thánh Ca'", str_contains($sidebar, 'Số bài Thánh Ca'));

// 2. includes/toolbar.php
echo "\n-- 2. Kiểm tra includes/toolbar.php --\n";
$toolbar = file_get_contents($root . '/includes/toolbar.php');
it("Nút #btn-fullscreen mang nhãn 'Toàn Màn Hình'", str_contains($toolbar, '<span class="gig-text">Toàn Màn Hình</span>'));
it("Nút #btn-fullscreen title dùng 'Vào chế độ Toàn Màn Hình'", str_contains($toolbar, 'title="Vào chế độ Toàn Màn Hình (Phím F)"'));
it("Nút mobile thumb bar dùng aria-label 'Toàn màn hình'", str_contains($toolbar, 'aria-label="Toàn màn hình"'));
it("Nút Theo người hướng dẫn không còn chứa thô '(Live Sync)'", str_contains($toolbar, '<span>Theo người hướng dẫn</span>') && !str_contains($toolbar, 'Theo người hướng dẫn (Live Sync)'));

// 3. includes/sheet_viewer.php
echo "\n-- 3. Kiểm tra includes/sheet_viewer.php --\n";
$viewer = file_get_contents($root . '/includes/sheet_viewer.php');
it("Floating HUD zoom wrap dùng 'Thu phóng & Khóa tỷ lệ trong Toàn Màn Hình'", str_contains($viewer, 'Thu phóng & Khóa tỷ lệ trong Toàn Màn Hình'));
it("Floating HUD nút thoát dùng 'Thoát Toàn Màn Hình (Esc)'", str_contains($viewer, 'title="Thoát Toàn Màn Hình (Esc)"'));
it("Thanh nhắc dùng 'Nhắc ban nhạc:' thay vì 'Nhắc Band:'", str_contains($viewer, 'Nhắc ban nhạc:'));
it("Không còn 'Nhắc Band:' trong sheet_viewer.php", !str_contains($viewer, 'Nhắc Band:'));

// 4. includes/modals.php
echo "\n-- 4. Kiểm tra includes/modals.php --\n";
$modals = file_get_contents($root . '/includes/modals.php');
it("Tiêu đề modal dùng 'Thêm vào Chương trình'", str_contains($modals, 'Thêm vào Chương trình'));
it("Văn bản chọn dùng 'Chọn một chương trình để lưu bài hát này:'", str_contains($modals, 'Chọn một chương trình để lưu bài hát này:'));
it("Nút tạo inline dùng 'Tạo Chương Trình Mới'", str_contains($modals, 'Tạo Chương Trình Mới'));
it("Tiêu đề modal lịch sử dùng 'Nhật ký phục vụ'", str_contains($modals, 'Nhật ký phục vụ'));

// 5. JavaScript Core Modules
echo "\n-- 5. Kiểm tra JavaScript Core & Setlist Modules --\n";
$modeMgr = file_get_contents($root . '/assets/js/core/ModeManager.js');
it("ModeManager toast dùng 'Chế độ Toàn màn hình'", str_contains($modeMgr, 'Chế độ Toàn màn hình — Nhấn F hoặc Esc để thoát'));
it("ModeManager nút toggle dùng 'Toàn Màn Hình'", str_contains($modeMgr, "isPerformance ? 'Thu Nhỏ' : 'Toàn Màn Hình'"));

$appUi = file_get_contents($root . '/assets/js/app-ui.js');
it("app-ui.js toast dùng 'Chế độ Toàn màn hình'", str_contains($appUi, 'Chế độ Toàn màn hình — Màn hình luôn sáng'));
it("app-ui.js nút toggle dùng 'Toàn Màn Hình'", str_contains($appUi, "isOn ? 'Thu Nhỏ' : 'Toàn Màn Hình'"));

$chordCanvas = file_get_contents($root . '/assets/js/chord-canvas.js');
it("chord-canvas.js không còn chứa đường dẫn thô '(/manager/)'", !str_contains($chordCanvas, '(/manager/)'));
it("chord-canvas.js không còn chứa '(/manager/#tab-users)'", !str_contains($chordCanvas, '(/manager/#tab-users)'));

$setlistList = file_get_contents($root . '/assets/js/setlist-list.js');
it("setlist-list.js empty state dùng 'Chưa có chương trình nào'", str_contains($setlistList, 'Chưa có chương trình nào'));
it("setlist-list.js modal title dùng 'Tạo Chương Trình Mới'", str_contains($setlistList, 'Tạo Chương Trình Mới'));
it("setlist-list.js confirm dùng 'xóa chương trình:'", str_contains($setlistList, 'Bạn chắc muốn xóa chương trình:'));

$setlistDetail = file_get_contents($root . '/assets/js/setlist-detail.js');
it("setlist-detail.js dùng 'Đang tải chương trình...'", str_contains($setlistDetail, 'Đang tải chương trình...'));
it("setlist-detail.js toast dùng 'dữ liệu chương trình ngoại tuyến'", str_contains($setlistDetail, 'dữ liệu chương trình ngoại tuyến'));

$libraryUi = file_get_contents($root . '/assets/js/library-ui.js');
it("library-ui.js nút thêm dùng 'Thêm vào chương trình'", str_contains($libraryUi, 'Thêm vào chương trình'));
it("library-ui.js toast dùng 'Chưa có chương trình nào được tạo'", str_contains($libraryUi, 'Chưa có chương trình nào được tạo'));
it("library-ui.js hỗ trợ gõ tìm 'setlist' để chuyển tab chương trình", str_contains($libraryUi, "qRaw === 'setlist'") || str_contains($libraryUi, "qVal === 'setlist'"));

$perfNotes = file_get_contents($root . '/assets/js/performance-notes.js');
it("performance-notes.js nhãn dùng 'Ghi chú phục vụ / bài tập'", str_contains($perfNotes, 'Ghi chú phục vụ / bài tập'));

$sessTracker = file_get_contents($root . '/assets/js/session-tracker.js');
it("session-tracker.js dùng 'Quản lý nhật ký phục vụ'", str_contains($sessTracker, 'Quản lý nhật ký phục vụ'));

// 6. Spelling Audit: 0 Xoá in modified files
echo "\n-- 6. Kiểm tra chính tả 'Xoá' -> 'Xóa' --\n";
$auditFiles = [
    'assets/js/admin-ui.js',
    'assets/js/importer.js',
    'assets/js/service-plan-ui.js',
    'assets/js/setlist-list.js',
    'assets/js/library-ui.js'
];
foreach ($auditFiles as $rel) {
    $content = file_get_contents($root . '/' . $rel);
    // Kiểm tra không còn từ Xoá/xoá có dấu sắc trên o (NFC hoặc NFD)
    $hasOldXoa = (bool)preg_match('/[Xx]o[\x{0301}]?[aá]/u', $content) && (str_contains($content, 'Xoá') || str_contains($content, 'xoá'));
    it("File {$rel} không còn chứa 'Xoá/xoá'", !$hasOldXoa);
}

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: " . ($passed + $failed) . "\n";
echo "Số kiểm tra đạt: {$passed}\n";
echo "Số kiểm tra lỗi: {$failed}\n";

if ($failed === 0) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA R3-2 ĐỀU ĐẠT (PASS 100%)!\n\n";
    echo "SUITE_COMPLETE total=" . ($passed + $failed) . "\n";
    exit(0);
} else {
    echo "❌ KẾT QUẢ: CÓ {$failed} KIỂM TRA THẤT BẠI!\n\n";
    exit(1);
}
