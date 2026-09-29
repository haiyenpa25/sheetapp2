<?php
/**
 * tests/library_r31_vocabulary_audit_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R3-1:
 * "Thay toàn bộ 35 chỗ trong Phụ lục A (giao diện, thông báo, email, hướng dẫn)
 *  Grep chặn tái phát: 0 lần xuất hiện 'phụng vụ', 'thánh lễ', 'Mùa Vọng', 'Mùa Chay',
 *  'Thường Niên', 'Thánh Thể', 'Lĩnh xướng', 'Đức Mẹ' trong chữ người dùng thấy.
 *  Giữ nguyên định danh nội bộ: liturgy-card, cột liturgical_season, tên bảng."
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/SetlistUsageHelper.php';
require_once __DIR__ . '/../api/services/NotificationService.php';
require_once __DIR__ . '/../api/services/NotificationPreferenceService.php';
require_once __DIR__ . '/../api/services/NotificationDeliveryService.php';

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function assertCheck($name, $condition, $isBehavioral = false) {
    global $totalChecks, $passedChecks, $failedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }

    if ($condition) {
        $passedChecks++;
        echo "  [PASS] $name\n";
    } else {
        $failedChecks++;
        echo "  [FAIL] $name\n";
    }
}

echo "=== R3-1: Protestant Vocabulary Audit & Grep Barrier Regression Suite ===\n\n";

// ── 1. Kiểm tra Behavioral: Taxonomy API & Backend Services ─────────────────
echo "-- 1. Behavioral Backend Tests --\n";

$tax = SongService::getTaxonomy();
$allNames = array_merge(
    array_column($tax['seasons'], 'name'),
    array_column($tax['themes'], 'name')
);
$taxText = implode(' ', $allNames);

$forbiddenTerms = [
    'phụng vụ',
    'thánh lễ',
    'mùa vọng',
    'mùa chay',
    'thường niên',
    'thánh thể',
    'lĩnh xướng',
    'đức mẹ'
];

$foundInTax = [];
foreach ($forbiddenTerms as $term) {
    if (mb_stripos($taxText, $term) !== false) {
        $foundInTax[] = $term;
    }
}
assertCheck("Taxonomy seasons & themes không chứa bất kỳ từ Công giáo nào", empty($foundInTax), true);

$seasonNames = array_column($tax['seasons'], 'name');
assertCheck("Taxonomy có 'Lễ Giáng Sinh'", in_array('Lễ Giáng Sinh', $seasonNames, true), true);
assertCheck("Taxonomy có 'Lễ Thương Khó'", in_array('Lễ Thương Khó', $seasonNames, true), true);
assertCheck("Taxonomy có 'Lễ Phục Sinh'", in_array('Lễ Phục Sinh', $seasonNames, true), true);
assertCheck("Taxonomy có 'Lễ nghi Hội Thánh'", in_array('Lễ nghi Hội Thánh', $seasonNames, true), true);

$themeNames = array_column($tax['themes'], 'name');
assertCheck("Taxonomy có 'Khai lễ'", in_array('Khai lễ', $themeNames, true), true);
assertCheck("Taxonomy có 'Kinh tiết ca / Đoản ca'", in_array('Kinh tiết ca / Đoản ca', $themeNames, true), true);
assertCheck("Taxonomy có 'Dâng hiến'", in_array('Dâng hiến', $themeNames, true), true);
assertCheck("Taxonomy có 'Tiệc Thánh'", in_array('Tiệc Thánh', $themeNames, true), true);
assertCheck("Taxonomy có 'Tất lễ'", in_array('Tất lễ', $themeNames, true), true);
assertCheck("Taxonomy có 'Huyết Chúa / Thập tự giá'", in_array('Huyết Chúa / Thập tự giá', $themeNames, true), true);

// 1.2 NotificationPreferenceService
$prefEvents = NotificationPreferenceService::EVENT_TYPES;
$prefText = implode(' ', array_values($prefEvents));
assertCheck("NotificationPreferenceService plan.published dùng 'Chương trình thờ phượng mới'", ($prefEvents['plan.published'] ?? '') === 'Chương trình thờ phượng mới', true);
assertCheck("NotificationPreferenceService plan.role_assigned dùng 'Phân công phục vụ buổi nhóm'", ($prefEvents['plan.role_assigned'] ?? '') === 'Phân công phục vụ buổi nhóm', true);

// 1.3 Setlist publish default title
$planId = SetlistService::create('Chương trình Test R3-1', '2026-10-10', 1, ['status' => 'draft']);
SetlistService::publish($planId, 1);
$evt = DB::run("SELECT payload_json FROM domain_events WHERE subject_id = ? ORDER BY id DESC LIMIT 1", [(string)$planId])->fetch(PDO::FETCH_ASSOC);
$payload = json_decode($evt['payload_json'] ?? '{}', true);
assertCheck("DomainEvent plan.published lưu đúng tiêu đề chương trình thờ phượng", ($payload['title'] ?? '') === 'Chương trình Test R3-1', true);

// Cleanup test setlist
DB::run("DELETE FROM domain_events WHERE subject_id = ?", [(string)$planId]);
DB::run("DELETE FROM setlists WHERE id = ?", [$planId]);

// ── 2. Grep Barrier: 0 xuất hiện của 8 từ cấm trong mọi file giao diện ─────────
echo "\n-- 2. Grep Barrier Verification across User-Facing Files --\n";

$userFacingFiles = [
    'includes/sidebar.php',
    'includes/toolbar.php',
    'includes/sheet_viewer.php',
    'includes/modals.php',
    'index.php',
    'huong-dan/index.php',
    'huong-dan/partials/chapters_1_to_5.php',
    'huong-dan/partials/chapters_6_to_10.php',
    'print/service-booklet.php',
    'print/chord-sheet.php',
    'editor/partials/modals.php',
    'learn/partials/modals.php',
    'live-band/projector.php',
    'api/services/SongSearchHelper.php',
    'api/services/NotificationDeliveryService.php',
    'api/services/NotificationService.php',
    'api/services/NotificationPreferenceService.php',
    'api/services/SetlistService.php',
    'api/services/SetlistUsageHelper.php',
    'api/services/PracticeAssignmentCreationHelper.php',
    'api/controllers/PracticeAssignmentController.php',
    'api/controllers/SetlistController.php',
    'assets/js/modals/ServicePlanAssignModal.js',
    'assets/js/liturgy-card.js',
    'assets/js/library-ui.js',
    'assets/js/setlist-list.js',
    'assets/js/learn/ui/learn-assignments-ui.js',
    'assets/js/performance/cue-engine.js'
];

$barrierViolations = [];
foreach ($userFacingFiles as $relPath) {
    $fullPath = realpath(__DIR__ . '/../' . $relPath);
    if (!$fullPath || !file_exists($fullPath)) {
        continue;
    }
    $content = file_get_contents($fullPath);
    foreach ($forbiddenTerms as $term) {
        if (mb_stripos($content, $term) !== false) {
            $barrierViolations[] = "$relPath chứa '$term'";
        }
    }
}

assertCheck(
    "Grep barrier: 0 lần xuất hiện 8 từ cấm trong " . count($userFacingFiles) . " file người dùng thấy",
    empty($barrierViolations),
    false
);

if (!empty($barrierViolations)) {
    echo "  LỖI PHÁT HIỆN TỪ CẤM:\n";
    foreach ($barrierViolations as $viol) {
        echo "    - $viol\n";
    }
}

// ── 3. Kiểm tra bảo toàn định danh nội bộ ──────────────────────────────────
echo "\n-- 3. Preserve Internal Code Identifiers --\n";

$liturgyCardJs = file_get_contents(__DIR__ . '/../assets/js/liturgy-card.js');
assertCheck("Định danh LiturgyCard được giữ nguyên", str_contains($liturgyCardJs, 'const LiturgyCard'), false);

$sidebarPhp = file_get_contents(__DIR__ . '/../includes/sidebar.php');
assertCheck("Định danh season-filter được giữ nguyên", str_contains($sidebarPhp, 'id="season-filter"'), false);
assertCheck("Nhãn Dịp lễ được áp dụng trên sidebar", str_contains($sidebarPhp, 'Dịp lễ:'), false);
assertCheck("Nhãn Số bài Thánh Ca được áp dụng trên sidebar", str_contains($sidebarPhp, 'Số bài Thánh Ca'), false);

$modalsPhp = file_get_contents(__DIR__ . '/../includes/modals.php');
assertCheck("Nhật ký phục vụ hiển thị trong modals.php", str_contains($modalsPhp, 'Nhật ký phục vụ'), false);
assertCheck("Thánh Ca tương tác hiển thị trong modals.php", str_contains($modalsPhp, 'Thánh Ca tương tác'), false);

$bookletPhp = file_get_contents(__DIR__ . '/../print/service-booklet.php');
assertCheck("Tập chương trình thờ phượng hiển thị trong service-booklet.php", str_contains($bookletPhp, 'Tập chương trình thờ phượng'), false);
assertCheck("Tông hát hiển thị trong service-booklet.php", str_contains($bookletPhp, 'Tông hát'), false);

$chordSheetPhp = file_get_contents(__DIR__ . '/../print/chord-sheet.php');
assertCheck("Tông hát hiển thị trong chord-sheet.php", str_contains($chordSheetPhp, 'Tông hát:'), false);

$rolesJs = file_get_contents(__DIR__ . '/../assets/js/modals/ServicePlanAssignModal.js');
assertCheck("ServicePlanAssignModal có vai trò Mục sư / Truyền đạo", str_contains($rolesJs, 'Mục sư / Truyền đạo'), false);
assertCheck("ServicePlanAssignModal có vai trò Hát dẫn", str_contains($rolesJs, 'Hát dẫn'), false);
assertCheck("ServicePlanAssignModal có vai trò Hướng dẫn chương trình", str_contains($rolesJs, 'Hướng dẫn chương trình'), false);
assertCheck("ServicePlanAssignModal có vai trò Đọc Kinh Thánh", str_contains($rolesJs, 'Đọc Kinh Thánh'), false);

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: $totalChecks (Behavioral: $behavioralChecks, Static: $staticChecks)\n";
echo "Số kiểm tra đạt: $passedChecks\n";
echo "Số kiểm tra lỗi: $failedChecks\n";

if ($failedChecks === 0) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA R3-1 ĐỀU ĐẠT (PASS 100%)!\n";
} else {
    echo "❌ KẾT QUẢ: CÓ $failedChecks KIỂM TRA THẤT BẠI!\n";
    exit(1);
}

echo "\nSUITE_COMPLETE total=$totalChecks\n";
