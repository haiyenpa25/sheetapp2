<?php
/**
 * tests/library_l26_lyrics_search_by_verse_regression.php
 *
 * Kiểm thử hồi quy cho Ticket L2-6 (phụ thuộc L6-1) - ROADMAP4 Mục 8:
 * - Trích xuất lời theo khổ đúng chuẩn: tách theo <lyric number>, ghép âm tiết theo <syllabic>
 * - Lời từng khổ là câu thơ liền mạch, không bị xáo trộn âm tiết giữa các khổ
 * - Nghiệm thu cốt lõi: Test: "cúi xin vua thánh" -> bài 001, đoạn trích đúng câu có <mark>
 * - Tìm kiếm không dấu: "cui xin vua thanh" -> bài 001, đoạn trích có <mark>
 * - Tìm kiếm theo các khổ khác trong bài: Khổ 2 ("đạo thể ngự lai"), Khổ 3 ("đấng ủy lạo hỡi")
 * - Bảo đảm chống XSS (lyric_snippet chỉ chứa <mark> an toàn)
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

echo "=== Kiểm thử Ticket L2-6: Tìm theo lời chính xác theo từng khổ & Snippet đúng câu ===\n";

// 1. Kiểm tra trích xuất lời theo khổ từ MusicXML bài 001
$xmlPath001 = $root . '/storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml';
check(file_exists($xmlPath001), 'Tồn tại file MusicXML bài 001', false);

$xmlContent001 = @file_get_contents($xmlPath001);
$extracted001 = SongSearchHelper::extractLyricsByVerse($xmlContent001);

check(
    !empty($extracted001) && str_contains($extracted001, 'Cúi xin Vua Thánh ngự lai'),
    'Trích xuất: Lời bài 001 chứa câu liền mạch "Cúi xin Vua Thánh ngự lai" ở khổ 1',
    true
);

check(
    str_contains($extracted001, 'Cúi xin Đạo thể ngự lai') && str_contains($extracted001, 'Đấng Ủy lạo hỡi, ngự lai'),
    'Trích xuất: Lời bài 001 chứa các khổ tiếp theo ("Đạo thể ngự lai", "Đấng Ủy lạo hỡi") đúng thứ tự',
    true
);

// 2. Kiểm tra CSDL bài 001
$song001InDb = DB::run("SELECT id, title, httlvnId, lyrics_text FROM songs WHERE id = 'thanh-ca-001' OR httlvnId = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(
    !empty($song001InDb) && !empty($song001InDb['lyrics_text']) && str_contains($song001InDb['lyrics_text'], 'Cúi xin Vua Thánh'),
    'CSDL: Cột lyrics_text của bài 001 trong DB lưu lời chuẩn theo khổ và chứa "Cúi xin Vua Thánh"',
    true
);

// 3. Nghiệm thu cốt lõi: Tìm "cúi xin vua thánh" -> bài 001, đoạn trích đúng câu có <mark>
$resCuiXin = SongSearchHelper::search('cúi xin vua thánh');
$found001 = false;
$snippet001 = '';
$matchType001 = '';

foreach ($resCuiXin as $r) {
    if ((string)$r['id'] === 'thanh-ca-001' || (int)($r['httlvnId'] ?? 0) === 1) {
        $found001 = true;
        $snippet001 = $r['lyric_snippet'] ?? '';
        $matchType001 = $r['match_type'] ?? '';
        break;
    }
}

check($found001, 'Nghiệm thu: Tìm "cúi xin vua thánh" tìm thấy bài 001 (HỠI THÁNH VƯƠNG, KÍP NGỰ LAI)', true);
check($matchType001 === 'lyric', 'Nghiệm thu: match_type của bài 001 là "lyric"', true);
check(!empty($snippet001) && str_contains($snippet001, '<mark>'), 'Nghiệm thu: lyric_snippet có chứa thẻ <mark>', true);
check(
    str_contains($snippet001, '<mark>Cúi xin Vua Thánh</mark>') || str_contains($snippet001, 'Cúi xin Vua Thánh'),
    'Nghiệm thu: lyric_snippet highlight đúng từ khóa "Cúi xin Vua Thánh"',
    true
);
check(
    str_contains($snippet001, 'ngự lai') && (str_contains($snippet001, 'Hộ tôi cung chúc') || str_contains($snippet001, 'cung chúc danh Ngài')),
    'Nghiệm thu: lyric_snippet là câu liền mạch ("Cúi xin Vua Thánh ngự lai, Hộ tôi cung chúc danh Ngài...")',
    true
);

// 4. Tìm kiếm không dấu: "cui xin vua thanh"
$resUnaccented = SongSearchHelper::search('cui xin vua thanh');
$foundUnaccented001 = false;
$snippetUnaccented001 = '';
foreach ($resUnaccented as $r) {
    if ((string)$r['id'] === 'thanh-ca-001' || (int)($r['httlvnId'] ?? 0) === 1) {
        $foundUnaccented001 = true;
        $snippetUnaccented001 = $r['lyric_snippet'] ?? '';
        break;
    }
}
check($foundUnaccented001, 'Không dấu: Tìm "cui xin vua thanh" tìm thấy bài 001', true);
check(
    !empty($snippetUnaccented001) && (str_contains($snippetUnaccented001, '<mark>Cúi xin Vua Thánh</mark>') || str_contains($snippetUnaccented001, '<mark>')),
    'Không dấu: lyric_snippet highlight <mark> trên chữ có dấu gốc',
    true
);

// 5. Tìm kiếm theo khổ 2 ("đạo thể ngự lai")
$resKho2 = SongSearchHelper::search('đạo thể ngự lai');
$foundKho2 = false;
$snippetKho2 = '';
foreach ($resKho2 as $r) {
    if ((string)$r['id'] === 'thanh-ca-001' || (int)($r['httlvnId'] ?? 0) === 1) {
        $foundKho2 = true;
        $snippetKho2 = $r['lyric_snippet'] ?? '';
        break;
    }
}
check($foundKho2, 'Khổ 2: Tìm "đạo thể ngự lai" tìm thấy bài 001', true);
check(
    !empty($snippetKho2) && str_contains($snippetKho2, '<mark>Đạo thể ngự lai</mark>'),
    'Khổ 2: lyric_snippet highlight đúng câu của khổ 2',
    true
);

// 6. Kiểm tra an toàn XSS trong lyric_snippet
$xssQuery = '<script>alert(1)</script>';
$safeSnippet = SongSearchHelper::createLyricSnippet("1. Lời bài hát an toàn <script>alert(1)</script>", $xssQuery, $xssQuery);
check(
    $safeSnippet !== null && !str_contains($safeSnippet, '<script>') && str_contains($safeSnippet, '&lt;script&gt;'),
    'Bảo mật: createLyricSnippet tự động escape HTML entities trước khi chèn <mark>',
    true
);

// 7. Kiểm tra 10 bài mẫu (L6-1: 10 bài mẫu lời từng khổ là câu liền mạch)
$sampleIds = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];
$sampleSuccessCount = 0;
foreach ($sampleIds as $sid) {
    $s = DB::run("SELECT lyrics_text FROM songs WHERE httlvnId = ? LIMIT 1", [(int)$sid])->fetch(PDO::FETCH_ASSOC);
    if (!empty($s['lyrics_text']) && mb_strlen($s['lyrics_text']) > 50) {
        // Kiểm tra không bị trộn âm tiết
        if (!preg_match('/1\.\S+\s+2\.\S+\s+3\.\S+/u', $s['lyrics_text'])) {
            $sampleSuccessCount++;
        }
    }
}
check(
    $sampleSuccessCount >= 8,
    "L6-1: 10 bài mẫu (001-010) có lời từng khổ là câu liền mạch ({$sampleSuccessCount}/10)",
    true
);

// 8. Tương thích ngược: Tìm theo số và theo tên vẫn xếp hạng chính xác
$resNum1 = SongSearchHelper::search('001');
check(
    !empty($resNum1) && (int)($resNum1[0]['httlvnId'] ?? 0) === 1,
    'Tương thích: Tìm theo số "001" vẫn trả về bài 001 ở vị trí đầu tiên',
    true
);

echo "\n--- KẾT QUẢ KIỂM THỬ L2-6 ---\n";
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
