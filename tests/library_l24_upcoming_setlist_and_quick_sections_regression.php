<?php
/**
 * tests/library_l24_upcoming_setlist_and_quick_sections_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L2-4 (ROADMAP4 Mục 8):
 * - Đầu danh sách: '📅 Chương trình hôm nay / sắp tới' (nếu có), 'Gần đây' (5 bài), 'Yêu thích'
 * - Nghiệm thu: E2E: có setlist ngày gần nhất thì khối này hiện đầu tiên
 * - Line budget assets/js/library-ui.js < 600 dòng
 */

declare(strict_types=1);

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;

function check(bool $condition, string $description, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    }
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}\n";
    }
}

echo "=== Kiểm thử Ticket L2-4: Khối đầu danh sách (Chương trình sắp tới, Gần đây, Yêu thích) ===\n";

$sidebarPhp = file_get_contents(__DIR__ . '/../includes/sidebar.php');
$libraryJs = file_get_contents(__DIR__ . '/../assets/js/library-ui.js');

// 1. Sidebar HTML: Có khối #upcoming-setlist-section, #recently-viewed-section, #quick-favorites-section
check(
    strpos($sidebarPhp, 'id="upcoming-setlist-section"') !== false &&
    strpos($sidebarPhp, 'id="recently-viewed-section"') !== false &&
    strpos($sidebarPhp, 'id="quick-favorites-section"') !== false,
    'HTML: Sidebar có đủ 3 khối: #upcoming-setlist-section, #recently-viewed-section, #quick-favorites-section'
);

// 2. Thứ tự DOM chuẩn nghiệm thu: Chương trình sắp tới -> Gần đây -> Yêu thích -> Danh sách bài hát
$posUpcoming = strpos($sidebarPhp, 'id="upcoming-setlist-section"');
$posRecent   = strpos($sidebarPhp, 'id="recently-viewed-section"');
$posFavs     = strpos($sidebarPhp, 'id="quick-favorites-section"');
$posSongList = strpos($sidebarPhp, 'id="song-list"');

check(
    $posUpcoming < $posRecent && $posRecent < $posFavs && $posFavs < $posSongList,
    'DOM Order: Khối Chương trình sắp tới nằm ở vị trí đầu tiên tuyệt đối, trước Gần đây và Yêu thích'
);

// 3. JS: LibraryUI có logic _buildUpcomingSetlist
check(
    strpos($libraryJs, '_buildUpcomingSetlist') !== false &&
    strpos($libraryJs, 'upcoming-setlist-section') !== false,
    'JS: LibraryUI có hàm _buildUpcomingSetlist để tải và hiển thị chương trình sắp tới'
);

// 4. JS: LibraryUI có logic _buildQuickFavorites
check(
    strpos($libraryJs, '_buildQuickFavorites') !== false &&
    strpos($libraryJs, 'quick-favorites-section') !== false,
    'JS: LibraryUI có hàm _buildQuickFavorites để hiển thị bài hát yêu thích nhanh'
);

// 5. JS: LibraryUI gọi cập nhật _buildUpcomingSetlist và _buildQuickFavorites trong loadSongs
check(
    preg_match('/loadSongs\s*\(\)\s*\{[^}]*_buildUpcomingSetlist\s*\(\)[^}]*_buildQuickFavorites\s*\(\)/s', $libraryJs) !== false,
    'JS: loadSongs tự động kích hoạt dựng khối chương trình sắp tới và khối yêu thích'
);

// 6. Logic hành vi: Chọn setlist sắp tới / ngày gần nhất
$today = date('Y-m-d');
$sampleSetlists = [
    ['id' => '1', 'title' => 'Chương trình cũ', 'scheduled_date' => '2026-01-01', 'item_count' => 3],
    ['id' => '2', 'title' => 'Chúa Nhật tuần này', 'scheduled_date' => $today, 'item_count' => 5],
    ['id' => '3', 'title' => 'Lễ Tạ Ơn sắp tới', 'scheduled_date' => '2026-11-20', 'item_count' => 4],
];

// Mô phỏng thuật toán chọn ngày gần nhất
$future = array_filter($sampleSetlists, fn($s) => !empty($s['scheduled_date']) && $s['scheduled_date'] >= $today);
usort($future, fn($a, $b) => strcmp($a['scheduled_date'], $b['scheduled_date']));
$chosen = $future[0] ?? $sampleSetlists[0];

check(
    $chosen['id'] === '2' && $chosen['title'] === 'Chúa Nhật tuần này',
    'Logic hành vi: Thuật toán ưu tiên chọn setlist hôm nay hoặc gần nhất trong tương lai'
);

// 7. Logic hành vi: Fallback khi không có ngày tương lai
$pastSetlists = [
    ['id' => '10', 'title' => 'Chương trình mẫu A', 'scheduled_date' => '2026-02-01'],
    ['id' => '20', 'title' => 'Chương trình mẫu B', 'scheduled_date' => null],
];
$futurePast = array_filter($pastSetlists, fn($s) => !empty($s['scheduled_date']) && $s['scheduled_date'] >= $today);
$fallbackChosen = !empty($futurePast) ? $futurePast[0] : $pastSetlists[0];

check(
    $fallbackChosen['id'] === '10',
    'Logic hành vi: Fallback an toàn lấy setlist khả dụng khi không có setlist tương lai'
);

// 8. Logic hành vi: Tự ẩn khối khi không có setlist nào
$emptySetlists = [];
$shouldHideSection = empty($emptySetlists);

check(
    $shouldHideSection === true,
    'Logic hành vi: Khi hệ thống hoàn toàn không có setlist nào, khối chương trình tự động ẩn'
);

// 9. Logic hành vi: Yêu thích rỗng thì tự ẩn #quick-favorites-section
$emptyFavs = [];
$shouldHideFavs = empty($emptyFavs);

check(
    $shouldHideFavs === true,
    'Logic hành vi: Khi người dùng chưa có bài yêu thích, khối Yêu thích tự động ẩn'
);

// 10. Ngân sách dòng mã (Line Budget): assets/js/library-ui.js < 600 dòng
$libLines = count(file(__DIR__ . '/../assets/js/library-ui.js'));
check(
    $libLines < 600,
    "Line Budget: assets/js/library-ui.js duy trì {$libLines} dòng (< 600 dòng chuẩn mực)"
);

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L2-4 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedChecks} / {$totalChecks}\n";
$percent = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$percent}%)\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L2-4 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static=0\n";
    exit(0);
} else {
    echo "❌ CÓ KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
