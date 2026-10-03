<?php
declare(strict_types=1);

/**
 * tests/library_r37_search_alias_matching_regression.php
 *
 * Kiểm thử hồi quy Ticket R3-7:
 * Tìm kiếm khớp cả "Jêsus", "Jê-sus" và "Giê-xu" (không sửa dữ liệu bài hát).
 * Nghiệm thu: Test HTTP: tìm "gie xu" ra các bài có "JÊSUS".
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/ManagerRepertoireHelper.php';
require_once __DIR__ . '/../api/services/ManagerService.php';

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

echo "=== Kiểm thử Ticket R3-7: Tìm kiếm khớp bí danh Jêsus / Jê-sus / Giê-xu ===\n\n";

// ── 1. Kiểm tra Contract mở rộng bí danh (Query Variants Expansion) ──
echo "-- 1. Query Variants Expansion (SongSearchHelper::getQueryVariants) --\n";

$vGieXu = SongSearchHelper::getQueryVariants('gie xu');
it("getQueryVariants('gie xu') sinh ra các bí danh chính yếu",
    in_array('jesus', $vGieXu, true) &&
    in_array('je-sus', $vGieXu, true) &&
    in_array('jêsus', $vGieXu, true) &&
    in_array('jê-sus', $vGieXu, true) &&
    in_array('giê-xu', $vGieXu, true) &&
    in_array('gie xu', $vGieXu, true)
);

$vGieXuCap = SongSearchHelper::getQueryVariants('Giê-xu');
it("getQueryVariants('Giê-xu') có dấu hoa sinh ra đúng bí danh",
    in_array('jesus', $vGieXuCap, true) &&
    in_array('jê-sus', $vGieXuCap, true) &&
    in_array('JÊSUS', $vGieXuCap, true)
);

$vJesus = SongSearchHelper::getQueryVariants('jesus');
it("getQueryVariants('jesus') sinh ra biến thể có gạch nối và Giê-xu",
    in_array('je-sus', $vJesus, true) &&
    in_array('giê-xu', $vJesus, true)
);

$vJeSus = SongSearchHelper::getQueryVariants('Jê-sus');
it("getQueryVariants('Jê-sus') sinh ra biến thể không gạch nối 'jesus' và 'jêsus'",
    in_array('jesus', $vJeSus, true) &&
    in_array('jêsus', $vJeSus, true)
);

$vCompound = SongSearchHelper::getQueryVariants('ton vinh gie xu');
it("getQueryVariants('ton vinh gie xu') sinh ra 'ton vinh jesus' và 'ton vinh jêsus'",
    in_array('ton vinh jesus', $vCompound, true) &&
    in_array('ton vinh jêsus', $vCompound, true)
);

$vNormal = SongSearchHelper::getQueryVariants('thanh tam');
it("getQueryVariants('thanh tam') không bị ảnh hưởng bởi bí danh Jêsus",
    count($vNormal) <= 2 &&
    in_array('thanh tam', $vNormal, true) &&
    !in_array('jesus', $vNormal, true)
);

// ── 2. Kiểm tra tìm kiếm FTS & BM25 Relevance Ranking với 'gie xu' ──
echo "\n-- 2. Tìm kiếm FTS & Relevance Ranking với 'gie xu' --\n";

$resGieXu = SongSearchHelper::search('gie xu');
it("Tìm 'gie xu' trả về danh sách bài hát (ít nhất 30 bài)", count($resGieXu) >= 30);

$topGieXu = $resGieXu[0] ?? [];
it("Bài hát đứng đầu khi tìm 'gie xu' có tiêu đề chứa JÊSUS hoặc Jê-sus",
    !empty($topGieXu['title']) &&
    (str_contains(strtoupper($topGieXu['title']), 'JÊSUS') || str_contains(strtoupper($topGieXu['title']), 'JÊ-SUS'))
);

it("Bài hát đứng đầu có match_type = 'title' và relevance_tier <= 2",
    ($topGieXu['match_type'] ?? '') === 'title' && ($topGieXu['relevance_tier'] ?? 9) <= 2
);

// Kiểm tra snippet chứa <mark> quanh Jê-sus / Jêsus
$hasMarkSnippet = false;
foreach ($resGieXu as $s) {
    if (!empty($s['lyric_snippet']) && str_contains($s['lyric_snippet'], '<mark>')) {
        $hasMarkSnippet = true;
        break;
    }
}
it("Kết quả tìm 'gie xu' có lyric_snippet highlight thẻ <mark> quanh tên Chúa", $hasMarkSnippet);
it("Lời bài hát viết 'Jê sus' có highlight khi tìm 'gie xu'",
    str_contains(SongSearchHelper::createLyricSnippet('Con tin Jê sus luôn ở cùng con.', 'gie xu', 'gie xu') ?? '', '<mark>Jê sus</mark>')
);

// ── 3. Kiểm tra tìm kiếm với 'Giê-xu' có dấu ──
echo "\n-- 3. Tìm kiếm với 'Giê-xu' có dấu --\n";

$resGieXuDau = SongSearchHelper::search('Giê-xu');
it("Tìm 'Giê-xu' (có dấu) trả về kết quả tương đương 'gie xu'", count($resGieXuDau) >= 30);

$topGieXuDau = $resGieXuDau[0] ?? [];
it("Bài đứng đầu khi tìm 'Giê-xu' có match_type = 'title'",
    ($topGieXuDau['match_type'] ?? '') === 'title'
);

// ── 4. Kiểm tra tìm kiếm với 'Jê-sus' (có gạch nối) khớp bài không gạch nối ──
echo "\n-- 4. Tìm kiếm 'Jê-sus' khớp bài không gạch nối và ngược lại --\n";

$resJeSus = SongSearchHelper::search('Jê-sus');
it("Tìm 'Jê-sus' trả về danh sách bài hát phong phú", count($resJeSus) >= 30);
$topJeSus = $resJeSus[0] ?? [];
it("Tìm 'Jê-sus' nhận diện đúng match_type = 'title' (không bị giáng xuống lyric)",
    ($topJeSus['match_type'] ?? '') === 'title' && ($topJeSus['relevance_tier'] ?? 9) <= 2
);

// ── 5. Kiểm tra truy vấn kết hợp (Compound Queries) ──
echo "\n-- 5. Truy vấn kết hợp: 'danh gie xu' & 'ton vinh gie xu' --\n";

$resDanh = SongSearchHelper::search('danh gie xu');
it("Tìm 'danh gie xu' trả về bài thanh-ca-014 (DANH JÊSUS) ở vị trí Rank 1",
    !empty($resDanh) && $resDanh[0]['id'] === 'thanh-ca-014' && $resDanh[0]['match_type'] === 'title'
);

$resTonVinh = SongSearchHelper::search('ton vinh gie xu');
it("Tìm 'ton vinh gie xu' trả về bài thanh-ca-115 (TÔN VINH JÊSUS!) ở vị trí Rank 1",
    !empty($resTonVinh) && $resTonVinh[0]['id'] === 'thanh-ca-115' && $resTonVinh[0]['match_type'] === 'title'
);

// ── 6. Kiểm tra Graceful Fallback LIKE Search với bí danh ──
echo "\n-- 6. Fallback LIKE search với bí danh --\n";

$resFallback = SongSearchHelper::fallbackLikeSearch('gie xu');
it("Fallback LIKE search với 'gie xu' trả về danh sách bài hát", count($resFallback) > 0);
$topFallback = $resFallback[0] ?? [];
it("Fallback LIKE search xếp bài có tiêu đề JÊSUS lên đầu với match_type = 'title'",
    ($topFallback['match_type'] ?? '') === 'title' &&
    str_contains(strtoupper($topFallback['title'] ?? ''), 'JÊSUS')
);

// ── 7. Kiểm tra Quản lý bài hát Repertoire Fast Search ──
echo "\n-- 7. ManagerRepertoireHelper::searchSongsFast với bí danh --\n";

$resMgr = ManagerService::searchSongsFast('gie xu');
it("ManagerRepertoireHelper::searchSongsFast('gie xu') trả về các bài JÊSUS",
    count($resMgr) > 0 && str_contains(strtoupper($resMgr[0]['title'] ?? ''), 'JÊSUS')
);

// ── 8. Nghiệm thu HTTP Contract: route=songs&action=search&q=gie+xu ──
echo "\n-- 8. Nghiệm thu HTTP Contract: route=songs&action=search&q=gie+xu --\n";

$baseUrl = getenv('SHEETAPP_TEST_URL') ?: 'http://localhost/sheetapp2';
$searchUrl = rtrim($baseUrl, '/') . '/api/index.php?route=songs&action=search&q=gie+xu';

$httpSuccess = false;
$httpCount = 0;
$httpTopTitle = '';

$ch = curl_init($searchUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
    CURLOPT_CONNECTTIMEOUT => 3,
]);
$rawHttp = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200 && $rawHttp) {
    $json = json_decode($rawHttp, true);
    if (isset($json['data']) && is_array($json['data'])) {
        $httpSuccess = true;
        $httpCount = count($json['data']);
        $httpTopTitle = $json['data'][0]['title'] ?? '';
    }
} else {
    // Nếu môi trường test cô lập không có Apache, kiểm tra qua SongController trực tiếp
    ob_start();
    $_GET = ['route' => 'songs', 'action' => 'search', 'q' => 'gie xu'];
    $_SERVER['REQUEST_METHOD'] = 'GET';
    require __DIR__ . '/../api/controllers/SongController.php';
    $output = ob_get_clean();
    $json = json_decode($output, true);
    if (isset($json['data']) && is_array($json['data'])) {
        $httpSuccess = true;
        $httpCount = count($json['data']);
        $httpTopTitle = $json['data'][0]['title'] ?? '';
    }
}

it("HTTP API search q=gie+xu trả về thành công với danh sách bài hát", $httpSuccess && $httpCount >= 30);
it("HTTP API search q=gie+xu trả về bài hát có 'JÊSUS' trong tiêu đề",
    str_contains(strtoupper($httpTopTitle), 'JÊSUS') || str_contains(strtoupper($httpTopTitle), 'JÊ-SUS')
);

// ── 9. Bảo vệ tính toàn vẹn dữ liệu gốc bài hát (Không sửa dữ liệu CSDL) ──
echo "\n-- 9. Dữ liệu bài hát gốc không bị sửa đổi --\n";

$pdo = DB::pdo();
$countGieXuInDb = (int)$pdo->query("SELECT count(*) FROM songs WHERE title LIKE '%Giê-xu%' OR title LIKE '%giê-xu%'")->fetchColumn();
it("Số bài có chứa 'Giê-xu' trong bảng songs vẫn giữ nguyên = 0 (bảo toàn nguyên văn Thánh Ca)", $countGieXuInDb === 0);

$countJesusInDb = (int)$pdo->query("SELECT count(*) FROM songs WHERE title LIKE '%JÊSUS%' OR title LIKE '%Jêsus%' OR title LIKE '%Jê-sus%' OR title LIKE '%JÊ-SUS%'")->fetchColumn();
it("Số bài chính thức chứa 'JÊSUS' / 'Jê-sus' trong bảng songs được bảo toàn nguyên vẹn (127 bài)", $countJesusInDb === 127);

// ── 10. Kiểm tra tĩnh Frontend JavaScript ──
echo "\n-- 10. Kiểm tra tĩnh Frontend JavaScript (library-ui.js) --\n";

$jsContent = file_get_contents(__DIR__ . '/../assets/js/library-ui.js');
it("library-ui.js có hàm _getQueryVariants hỗ trợ mở rộng bí danh", str_contains($jsContent, '_getQueryVariants'));
it("library-ui.js có regex nhận diện bí danh Chúa trong _highlightText", str_contains($jsContent, 'reJesus'));

echo "\n----------------------------------------\n";
echo "KẾT QUẢ KIỂM THỬ: {$passedCount} / {$testCount} checks đạt.\n";
if ($passedCount === $testCount) {
    echo "🎉 TẤT CẢ KIỂM TRA TICKET R3-7 ĐỀU ĐẠT CHUẨN!\n";
} else {
    echo "❌ CÓ KIỂM TRA THẤT BẠI!\n";
}

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";
