<?php
/**
 * tests/library_l63_bulk_labels_regression.php
 *
 * Kiểm thử hồi quy Ticket L6-3 (Chất lượng dữ liệu):
 * - Gắn nhãn mùa lễ / chủ đề hàng loạt trong Manager (chọn nhiều bài -> gắn nhãn).
 * - Dữ liệu nhãn: ≥300 bài có nhãn mùa lễ / chủ đề (thực tế 500 bài theo mục lục Thánh Ca HTTLVN).
 * - Backend service ManagerRepertoireHelper::bulkUpdateLabels và router ManagerController action bulk_update_labels.
 * - Bộ lọc mùa lễ / chủ đề trong Thư viện (library-ui.js) tự động kích hoạt khi có dữ liệu.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/SongVersionHelper.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/ManagerRepertoireHelper.php';

$passed = 0;
$failed = 0;

function it(string $desc, bool $condition): void {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY TICKET L6-3: GẮN NHÃN MÙA LỄ / CHỦ ĐỀ HÀNG LOẠT & BỘ LỌC THƯ VIỆN ===\n";

$pdo = DB::get();

// ── 1. Cấu trúc CSDL và Dữ liệu Nhãn (≥300 bài có nhãn) ──
echo "\n-- 1. Cấu trúc CSDL và Dữ liệu Nhãn --\n";

// 1.1 Cột liturgical_season và theme tồn tại
$cols = $pdo->query("PRAGMA table_info(songs)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');
it("Cột 'liturgical_season' tồn tại trong bảng songs", in_array('liturgical_season', $colNames, true));
it("Cột 'theme' tồn tại trong bảng songs", in_array('theme', $colNames, true));

// 1.2 Số lượng bài có nhãn đạt tiêu chí nghiệm thu (≥300 bài)
$seasonCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != ''")->fetchColumn();
$themeCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE theme IS NOT NULL AND theme != ''")->fetchColumn();
$eitherCount = (int)$pdo->query("SELECT COUNT(*) FROM songs WHERE (liturgical_season IS NOT NULL AND liturgical_season != '') OR (theme IS NOT NULL AND theme != '')")->fetchColumn();

it("Số bài có Mùa Lễ (liturgical_season) ≥ 200 bài (thực tế: {$seasonCount} bài)", $seasonCount >= 200);
it("Số bài có Chủ Đề (theme) ≥ 300 bài (thực tế: {$themeCount} bài)", $themeCount >= 300);
it("Tổng số bài có ít nhất 1 nhãn ≥ 300 bài (thực tế: {$eitherCount} bài)", $eitherCount >= 300);

// 1.3 Kiểm tra sự đa dạng của các Mùa Lễ
$seasons = $pdo->query("SELECT DISTINCT liturgical_season FROM songs WHERE liturgical_season IS NOT NULL AND liturgical_season != ''")->fetchAll(PDO::FETCH_COLUMN);
it("Có ít nhất 5 mùa lễ khác nhau trong cơ sở dữ liệu", count($seasons) >= 5);
it("Có Mùa Lễ 'Giáng Sinh'", in_array('Giáng Sinh', $seasons, true) || in_array('Lễ Giáng Sinh', $seasons, true));
it("Có Mùa Lễ 'Thương Khó'", in_array('Thương Khó', $seasons, true) || in_array('Lễ Thương Khó', $seasons, true));
it("Có Mùa Lễ 'Phục Sinh'", in_array('Phục Sinh', $seasons, true) || in_array('Lễ Phục Sinh', $seasons, true));
it("Đa dạng dịp lễ Tin Lành (Lễ Cảm Tạ / Thăng Thiên / Lễ Ngũ Tuần)", in_array('Lễ Cảm Tạ', $seasons, true) || in_array('Thăng Thiên', $seasons, true) || in_array('Lễ Thăng Thiên', $seasons, true) || in_array('Lễ Ngũ Tuần', $seasons, true) || in_array('Thường Niên', $seasons, true));

// 1.4 Kiểm tra sự đa dạng của các Chủ Đề
$themes = $pdo->query("SELECT DISTINCT theme FROM songs WHERE theme IS NOT NULL AND theme != ''")->fetchAll(PDO::FETCH_COLUMN);
it("Có ít nhất 8 chủ đề khác nhau trong cơ sở dữ liệu", count($themes) >= 8);
it("Có Chủ Đề 'Tôn Vinh & Ngợi Khen' hoặc 'Thờ phượng'", in_array('Tôn Vinh & Ngợi Khen', $themes, true) || in_array('Thờ phượng', $themes, true));
it("Có Chủ Đề 'Chúa Giáng Sinh' hoặc 'Chúa Jêsus Christ'", in_array('Chúa Giáng Sinh', $themes, true) || in_array('Chúa Jêsus Christ', $themes, true));

// ── 2. Kiểm tra Backend ManagerRepertoireHelper & ManagerService ──
echo "\n-- 2. Backend Services & Bulk Update API --\n";

// 2.1 getRepertoire() trả về trường liturgical_season, theme, tags
$rep = ManagerRepertoireHelper::getRepertoire();
it("getRepertoire() trả về danh sách bài hát", !empty($rep['songs']));
$firstRep = $rep['songs'][0] ?? [];
it("Mỗi phần tử repertoire có trường 'liturgical_season'", array_key_exists('liturgical_season', $firstRep));
it("Mỗi phần tử repertoire có trường 'theme'", array_key_exists('theme', $firstRep));
it("Mỗi phần tử repertoire có trường 'tags'", array_key_exists('tags', $firstRep));

// 2.2 bulkUpdateLabels() cập nhật thành công hàng loạt khi có quyền banhat
$_SESSION['role'] = 'banhat';
$_SESSION['user_id'] = 1;

$testIds = ['thanh-ca-001', 'thanh-ca-002'];
// Lưu lại giá trị cũ
$orig001 = $pdo->query("SELECT liturgical_season, theme FROM songs WHERE id = 'thanh-ca-001'")->fetch();
$orig002 = $pdo->query("SELECT liturgical_season, theme FROM songs WHERE id = 'thanh-ca-002'")->fetch();

$bulkRes = ManagerService::bulkUpdateLabels($testIds, [
    'liturgical_season' => 'Lễ Cảm Tạ',
    'theme' => 'Tôn Vinh & Ngợi Khen Test',
]);

it("bulkUpdateLabels trả về success = true", isset($bulkRes['success']) && $bulkRes['success'] === true);
it("bulkUpdateLabels trả về affected = 2", isset($bulkRes['affected']) && (int)$bulkRes['affected'] === 2);

// Kiểm tra trong DB
$check001 = $pdo->query("SELECT liturgical_season, theme FROM songs WHERE id = 'thanh-ca-001'")->fetch();
it("Bài thanh-ca-001 đã cập nhật theme mới", $check001['theme'] === 'Tôn Vinh & Ngợi Khen Test');

// Khôi phục lại giá trị gốc
ManagerService::bulkUpdateLabels(['thanh-ca-001', 'thanh-ca-002'], [
    'liturgical_season' => $orig001['liturgical_season'],
    'theme' => $orig001['theme'],
]);
$checkRestored = $pdo->query("SELECT theme FROM songs WHERE id = 'thanh-ca-001'")->fetch();
it("Khôi phục thành công giá trị gốc cho thanh-ca-001", $checkRestored['theme'] === $orig001['theme']);

// 2.3 bulkUpdateLabels với danh sách rỗng
$emptyRes = ManagerService::bulkUpdateLabels([], ['theme' => 'Test']);
it("bulkUpdateLabels từ chối khi song_ids rỗng", isset($emptyRes['success']) && $emptyRes['success'] === false);

// 2.4 bulkUpdateLabels không có trường cập nhật nào
$noFieldsRes = ManagerService::bulkUpdateLabels(['thanh-ca-001'], []);
it("bulkUpdateLabels từ chối khi labels rỗng", isset($noFieldsRes['success']) && $noFieldsRes['success'] === false);

// 2.5 Phân quyền bảo mật: role 'viewer' bị chặn bởi Auth::requireBanhat()
$_SESSION['role'] = 'viewer';
$blocked = false;
try {
    ManagerService::bulkUpdateLabels(['thanh-ca-001'], ['theme' => 'Forbidden']);
} catch (Throwable $e) {
    $blocked = true;
}
it("bulkUpdateLabels chặn người dùng không có quyền banhat (role viewer)", $blocked);
$_SESSION['role'] = 'banhat'; // Khôi phục quyền banhat

// ── 3. Kiểm tra SongService & Tích hợp Bộ Lọc Thư Viện ──
echo "\n-- 3. SongService & Bộ lọc Thư Viện --\n";

// 3.1 SongService::getAll() có liturgical_season và theme
$allSongs = SongService::getAll();
$christmasSongs = array_filter($allSongs, fn($s) => in_array($s['liturgical_season'] ?? '', ['Lễ Giáng Sinh', 'Giáng Sinh'], true));
it("SongService::getAll() lọc được các bài mùa Giáng Sinh ({count} bài)", count($christmasSongs) >= 20);

// 3.2 SongSearchHelper hỗ trợ tìm kiếm theo mùa lễ
$searchSeasonRes = SongService::search('', ['season' => 'Lễ Giáng Sinh']);
if (empty($searchSeasonRes)) {
    $searchSeasonRes = SongService::search('', ['season' => 'Giáng Sinh']);
}
it("SongService::search với filter season='Lễ Giáng Sinh' / 'Giáng Sinh' trả về kết quả", !empty($searchSeasonRes));

// ── 4. Kiểm tra Frontend Contract & File Integrity ──
echo "\n-- 4. Frontend Contract & UI Template --\n";

// 4.1 tab_repertoire.php có thanh bulk bar và các control
$tabContent = (string)file_get_contents(__DIR__ . '/../manager/partials/tab_repertoire.php');
it("tab_repertoire.php có container #mgr-bulk-bar", str_contains($tabContent, 'id="mgr-bulk-bar"'));
it("tab_repertoire.php có select #mgr-bulk-season", str_contains($tabContent, 'id="mgr-bulk-season"'));
it("tab_repertoire.php có input #mgr-bulk-theme", str_contains($tabContent, 'id="mgr-bulk-theme"'));
it("tab_repertoire.php có nút #btn-mgr-bulk-apply", str_contains($tabContent, 'id="btn-mgr-bulk-apply"'));
it("tab_repertoire.php có nút #btn-mgr-bulk-clear", str_contains($tabContent, 'id="btn-mgr-bulk-clear"'));
it("tab_repertoire.php có checkbox chọn tất cả #chk-select-all-songs", str_contains($tabContent, 'id="chk-select-all-songs"'));

// 4.2 manager-repertoire.js có logic bulk actions
$mgrJsContent = (string)file_get_contents(__DIR__ . '/../manager/js/manager-repertoire.js');
it("manager-repertoire.js có _selectedSongIds Set", str_contains($mgrJsContent, '_selectedSongIds'));
it("manager-repertoire.js có _initBulkActionHandlers", str_contains($mgrJsContent, '_initBulkActionHandlers'));
it("manager-repertoire.js có _updateBulkBar", str_contains($mgrJsContent, '_updateBulkBar'));
it("manager-repertoire.js có gọi ApiService.manager.bulkUpdateLabels", str_contains($mgrJsContent, 'bulkUpdateLabels'));

// 4.3 ApiService.js có phương thức bulkUpdateLabels
$apiServiceContent = (string)file_get_contents(__DIR__ . '/../assets/js/core/ApiService.js');
it("ApiService.js định nghĩa manager.bulkUpdateLabels", str_contains($apiServiceContent, 'bulkUpdateLabels:'));

// 4.4 ManagerController.php có route bulk_update_labels
$ctrlContent = (string)file_get_contents(__DIR__ . '/../api/controllers/ManagerController.php');
it("ManagerController.php có action bulk_update_labels", str_contains($ctrlContent, "case 'bulk_update_labels':"));

// ── Tổng kết ──
$total = $passed + $failed;
echo "\n=======================================================\n";
echo "KẾT QUẢ: {$passed}/{$total} kiểm tra đạt thành công.\n";
if ($failed === 0) {
    echo "SUITE_COMPLETE total={$total} passed={$passed} failed=0\n";
    exit(0);
} else {
    echo "❌ CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
