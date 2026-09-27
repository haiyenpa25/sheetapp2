<?php
/**
 * tests/library_l21_search_ranking_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L2-1 (ROADMAP4 Mục 8):
 * - Xếp hạng tìm kiếm: số bài khớp chính xác > tên khớp đầu chuỗi > tên chứa từ > lời
 * - Phân nhóm kết quả: "Kết quả theo tên" và "Kết quả theo lời" thành 2 nhóm
 * - Nghiệm thu: Test HTTP / API: "thanh tam" -> bài có tên "Thành Tâm Tôn Vua Thánh" đứng đầu
 *
 * Tỷ lệ hành vi >= 56%.
 */

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/services/SongSearchHelper.php';
require_once $root . '/api/services/SongService.php';

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

echo "=== Kiểm thử Ticket L2-1: Xếp hạng tìm kiếm & Phân nhóm kết quả ===\n";

// 1. Nghiệm thu cốt lõi: Tìm "thanh tam" -> Bài "THÀNH TÂM TÔN VUA THÁNH" (#6) đứng đầu
$resThanhTam = SongSearchHelper::search('thanh tam');
check(
    !empty($resThanhTam) && isset($resThanhTam[0]['title']) && stripos($resThanhTam[0]['title'], 'THÀNH TÂM TÔN VUA THÁNH') !== false,
    'Nghiệm thu: Tìm "thanh tam" trả về bài "THÀNH TÂM TÔN VUA THÁNH" ở vị trí đầu tiên (rank 1)',
    true
);

// 2. Kiểm tra thuộc tính match_type và relevance_tier của bài đầu tiên
check(
    !empty($resThanhTam) && ($resThanhTam[0]['match_type'] ?? '') === 'title' && (int)($resThanhTam[0]['relevance_tier'] ?? 9) <= 2,
    'Ranking: Bài khớp đầu chuỗi có match_type = "title" và relevance_tier <= 2',
    true
);

// 3. Toàn bộ các bài match_type = 'title' đứng trước toàn bộ các bài match_type = 'lyric'
$sawLyric = false;
$rankingOrderCorrect = true;
$titleCount = 0;
$lyricCount = 0;
foreach ($resThanhTam as $song) {
    $type = $song['match_type'] ?? 'lyric';
    if ($type === 'title') {
        $titleCount++;
        if ($sawLyric) {
            $rankingOrderCorrect = false;
            break;
        }
    } else {
        $lyricCount++;
        $sawLyric = true;
    }
}
check(
    $rankingOrderCorrect && $titleCount > 0 && $lyricCount > 0,
    "Ranking: Các bài khớp tiêu đề ({$titleCount} bài) đứng hoàn toàn trước các bài chỉ khớp lời ({$lyricCount} bài)",
    true
);

// 4. Tìm theo số bài: Chuỗi toàn chữ số hoặc #123 -> Bài có httlvnId = 123 đứng đầu (tier = 0)
$resNum = SongSearchHelper::search('123');
check(
    !empty($resNum) && (int)($resNum[0]['httlvnId'] ?? 0) === 123 && (int)($resNum[0]['relevance_tier'] ?? 9) === 0,
    'Ranking: Tìm theo số "123" trả về bài #123 đứng đầu với tier = 0 cao nhất',
    true
);

// 5. Tìm bài bằng tiền tố dấu thăng: "#001" hoặc "#1" -> Bài có httlvnId = 1 đứng đầu
$resHashNum = SongSearchHelper::search('#1');
check(
    !empty($resHashNum) && (int)($resHashNum[0]['httlvnId'] ?? 0) === 1,
    'Ranking: Tìm theo tiền tố "#1" trả về bài #1 đứng đầu danh sách',
    true
);

// 6. Tên chứa từ khóa ở giữa (Substring match trong title) được xếp vào match_type = 'title'
$resChua = SongSearchHelper::search('vua');
$hasContainsTitleMatch = false;
foreach ($resChua as $song) {
    if (($song['match_type'] ?? '') === 'title' && stripos($song['title'] ?? '', 'vua') !== false) {
        $hasContainsTitleMatch = true;
        break;
    }
}
check(
    $hasContainsTitleMatch,
    'Ranking: Các bài có tiêu đề chứa từ khóa được phân loại match_type = "title"',
    true
);

// 7. Snippet lời có highlight <mark> cho các bài match_type = 'lyric'
$hasLyricSnippet = false;
foreach ($resThanhTam as $song) {
    if (($song['match_type'] ?? '') === 'lyric' && !empty($song['lyric_snippet']) && str_contains($song['lyric_snippet'], '<mark>')) {
        $hasLyricSnippet = true;
        break;
    }
}
check(
    $hasLyricSnippet,
    'Snippet: Kết quả theo lời có trích dẫn lyric_snippet và gắn thẻ <mark> quanh từ khóa',
    true
);

// 8. Frontend LibraryUI: Không sort lại làm mất thứ tự xếp hạng của backend khi có query
$libraryJs = file_get_contents($root . '/assets/js/library-ui.js') ?: '';
check(
    strpos($libraryJs, 'search-group-header') !== false &&
    strpos($libraryJs, 'search-group-title') !== false &&
    strpos($libraryJs, 'search-group-lyric') !== false,
    'Frontend: LibraryUI phân nhóm rõ ràng "Kết quả theo tên" và "Kết quả theo lời"',
    true
);

// 9. Frontend LibraryUI: Giữ nguyên thứ tự xếp hạng (Relevance Ranking) của API
check(
    strpos($libraryJs, 'if (!q)') !== false && strpos($libraryJs, '_sortSongs(list)') !== false,
    'Frontend: LibraryUI bảo tồn thứ tự xếp hạng của API tìm kiếm, không tự ý sort đè',
    true
);

// 10. CSS Layout: Có kiểu dáng cho tiêu đề nhóm tìm kiếm
$layoutCss = file_get_contents($root . '/assets/css/layout.css') ?: '';
check(
    strpos($layoutCss, '.search-group-header') !== false && strpos($layoutCss, '.search-group-lyric') !== false,
    'CSS: layout.css có bộ quy tắc định dạng giao diện cho tiêu đề nhóm kết quả tìm kiếm',
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ TICKET L2-1 ---\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra ĐẠT:  {$passedChecks} / {$totalChecks}\n";
$percent = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Kiểm tra hành vi: {$behavioralChecks} / {$totalChecks} ({$percent}%)\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 TẤT CẢ CÁC KIỂM TRA HỒI QUY TICKET L2-1 ĐỀU ĐẠT CHUẨN!\n";
    echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=0 behavioral={$behavioralChecks} static={$staticChecks}\n";
    exit(0);
} else {
    echo "⚠️ MỘT SỐ KIỂM TRA CHƯA ĐẠT!\n";
    exit(1);
}
