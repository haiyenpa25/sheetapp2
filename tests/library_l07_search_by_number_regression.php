<?php
/**
 * tests/library_l07_search_by_number_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-7 (ROADMAP 4):
 *  1. Tìm theo số bài: chuỗi toàn chữ số (hoặc #123, bài 123) thì lọc đúng bài lên đầu.
 *  2. Backend SongSearchHelper ưu tiên trả về đúng bài theo số ở vị trí đầu tiên (index 0).
 *  3. Frontend LibraryUI lắng nghe phím Enter trên #search-input và tự động chọn kết quả đầu tiên.
 *  4. Frontend LibraryUI có cơ chế sắp xếp ưu tiên số bài khớp chính xác lên đầu và chống race condition.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/services/SongService.php';

$passed = 0;
$failed = 0;
$checks = [];

function check(bool $condition, string $id, string $desc, bool $isBehavioral = true): void {
    global $passed, $failed, $checks;
    $typeTag = $isBehavioral ? '[PASS:B]' : '[PASS:S]';
    if ($condition) {
        $passed++;
        echo "  {$typeTag} [{$id}] {$desc}\n";
    } else {
        $failed++;
        echo "  [FAIL] [{$id}] {$desc}\n";
    }
}

echo "========================================================\n";
echo "   Ticket L0-7: Search by Song Number & Enter to Open\n";
echo "========================================================\n\n";

// ── 1. Backend Behavioral Checks ─────────────────────────────

// 1.1 Tìm kiếm chuỗi "123"
$res123 = SongSearchHelper::search('123');
check(
    !empty($res123) && isset($res123[0]['id']) && $res123[0]['id'] === 'thanh-ca-123' && (int)$res123[0]['httlvnId'] === 123,
    'backend_search_digits_123',
    'SongSearchHelper::search("123") trả về bài thanh-ca-123 ở vị trí đầu tiên (index 0)'
);

// 1.2 Tìm kiếm chuỗi "#123"
$resHash123 = SongSearchHelper::search('#123');
check(
    !empty($resHash123) && isset($resHash123[0]['id']) && $resHash123[0]['id'] === 'thanh-ca-123',
    'backend_search_hash_123',
    'SongSearchHelper::search("#123") trả về bài thanh-ca-123 ở vị trí đầu tiên (index 0)'
);

// 1.3 Tìm kiếm chuỗi "bài 123"
$resBai123 = SongSearchHelper::search('bài 123');
check(
    !empty($resBai123) && isset($resBai123[0]['id']) && $resBai123[0]['id'] === 'thanh-ca-123',
    'backend_search_bai_prefix_123',
    'SongSearchHelper::search("bài 123") hỗ trợ tiền tố tiếng Việt và trả về bài 123 đầu tiên'
);

// 1.4 Tìm kiếm chuỗi "001" (dạng STT 3 chữ số)
$res001 = SongSearchHelper::search('001');
check(
    !empty($res001) && isset($res001[0]['id']) && $res001[0]['id'] === 'thanh-ca-001',
    'backend_search_padded_001',
    'SongSearchHelper::search("001") trả về bài thanh-ca-001 ở vị trí đầu tiên'
);

// ── 2. Frontend Static & Contract Checks ─────────────────────

$libraryJs = (string)file_get_contents(__DIR__ . '/../assets/js/library-ui.js');

// 2.1 Enter keydown handler trên search input
check(
    strpos($libraryJs, "e.key === 'Enter'") !== false &&
    strpos($libraryJs, "first?.dataset?.id") !== false &&
    strpos($libraryJs, "selectSong(first.dataset.id)") !== false,
    'frontend_enter_key_opens_first_result',
    'LibraryUI lắng nghe Enter trên ô tìm kiếm và kích hoạt selectSong(first.dataset.id)',
    false
);

// 2.2 Sắp xếp target STT lên đầu danh sách
check(
    strpos($libraryJs, "Number(a.httlvnId) === target") !== false,
    'frontend_numeric_target_sort_first',
    'LibraryUI ép kiểu số và sắp xếp STT mục tiêu (target) lên trước các bài khác',
    false
);

// 2.3 Chống race condition với _searchSeq
check(
    strpos($libraryJs, "_searchSeq") !== false &&
    strpos($libraryJs, "seq !== _searchSeq") !== false,
    'frontend_search_race_condition_protection',
    'LibraryUI có cơ chế _searchSeq chống race condition giữa các truy vấn tìm kiếm async',
    false
);

// 2.4 Lưu trữ _lastRenderedSongs để selectSong an toàn
check(
    strpos($libraryJs, "_lastRenderedSongs") !== false,
    'frontend_last_rendered_songs_tracking',
    'LibraryUI lưu lại danh sách kết quả render gần nhất để selectSong không bị phụ thuộc mảng gốc',
    false
);

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
