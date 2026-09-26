<?php
/**
 * tests/service_plan_regression.php
 *
 * Kiểm tra hồi quy toàn diện cho Epic 3.1 — Service Plan (Chương trình buổi nhóm):
 * 1. Service Plan Lifecycle (tạo, sửa, đổi trạng thái draft -> published -> completed) & Audit Trail.
 * 2. Cấu hình bài hát, tiết mục phụng vụ, tông, BPM, chord profile, và ghi chú ban nhạc (CR4).
 * 3. Phân công nhân sự ban nhạc/ca đoàn & luồng xác nhận tham gia (pending, confirmed, declined).
 * 4. Tự động ghi nhận và đối soát lịch sử sử dụng bài hát trong phụng vụ (Song Usage History).
 * 5. Phân quyền và an toàn kiểm soát truy cập (RBAC): Ca trưởng/Admin vs Thành viên.
 * 6. Hợp đồng API Controller & Frontend Integration (ApiService.js, ServicePlanAssignModal.js).
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== EPIC 3.1 — SERVICE PLAN REGRESSION SUITE ===\n";

$root = dirname(__DIR__);
$pdo = createTestDatabase();

// Nạp các dependency backend
require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/AuditLogger.php';
require_once $root . '/api/services/SetlistService.php';

// Thiết lập DB in-memory cho DB::run và file log test
DB::setPdo($pdo);
$auditLogFile = sys_get_temp_dir() . '/sheetapp-audit-test-' . bin2hex(random_bytes(4)) . '.log';
AuditLogger::setLogPath($auditLogFile);

// Nạp người dùng test
$adminId  = (int)$pdo->query("SELECT id FROM users WHERE username = 'admin'")->fetchColumn();
$banhatId = (int)$pdo->query("SELECT id FROM users WHERE username = 'banhat'")->fetchColumn();
$viewerId = (int)$pdo->query("SELECT id FROM users WHERE username = 'viewer'")->fetchColumn();

// ─── TEST 1: Service Plan Lifecycle & Audit Trail ──────────────────
$planId = SetlistService::create([
    'title' => 'Lễ Chúa Nhật 1 — Tình Yêu Cứu Rỗi',
    'scheduled_date' => '2026-10-04',
    'service_time' => '08:30',
    'theme' => 'Tình Yêu Cứu Rỗi & Ân Điển',
    'description' => 'Chương trình thờ phượng trọng thể đầu tháng 10',
    'status' => 'draft',
    'leader_user_id' => $banhatId,
    'created_by' => $adminId
]);

check($planId > 0, "Tạo Service Plan thành công với ID={$planId}");

$plan = SetlistService::getById($planId);
check($plan['title'] === 'Lễ Chúa Nhật 1 — Tình Yêu Cứu Rỗi', "Đúng tiêu đề chương trình");
check($plan['service_time'] === '08:30', "Đúng giờ bắt đầu 08:30");
check($plan['theme'] === 'Tình Yêu Cứu Rỗi & Ân Điển', "Đúng chủ đề phụng vụ");
check($plan['status'] === 'draft', "Trạng thái khởi tạo đúng là 'draft'");
check((int)$plan['leader_user_id'] === $banhatId, "Ca trưởng được gán chính xác (Ban Hát)");

// Cập nhật thông tin
SetlistService::update($planId, [
    'service_time' => '09:00',
    'theme' => 'Ân Điển Vượt Quá Sự Hiểu Biết'
], $adminId);

$updatedPlan = SetlistService::getById($planId);
check($updatedPlan['service_time'] === '09:00', "Cập nhật giờ bắt đầu thành 09:00 thành công");
check($updatedPlan['theme'] === 'Ân Điển Vượt Quá Sự Hiểu Biết', "Cập nhật chủ đề thành công");

// Kiểm tra ghi nhật ký kiểm toán
$logContent = file_get_contents($auditLogFile);
check(strpos($logContent, 'service_plan_create') !== false, "Audit trail ghi nhận service_plan_create");
check(strpos($logContent, 'service_plan_update') !== false, "Audit trail ghi nhận service_plan_update");

// ─── TEST 2: Thêm bài hát & tiết mục phụng vụ (CR4) ───────────────
$item1 = SetlistService::addItem(
    $planId,
    '001-thanh-chua-yeu-thuong',
    'HD',
    2,
    85,
    4,
    [
        'item_type' => 'song',
        'leader_notes' => 'Intro Piano 4 ô nhịp, dạo giang tấu solo Guitar',
        'duration_minutes' => 6
    ]
);

$item2 = SetlistService::addItem(
    $planId,
    '002-ngoi-khen-chua',
    'default',
    -1,
    110,
    3,
    [
        'item_type' => 'song',
        'leader_notes' => 'Bè Nữ hát phiên khúc 1, Cả ban hòa giọng điệp khúc',
        'duration_minutes' => 5
    ]
);

$item3 = SetlistService::addItem(
    $planId,
    '',
    'HD',
    0,
    null,
    null,
    [
        'item_type' => 'prayer',
        'custom_title' => 'Cầu nguyện khai lễ & chúc phước',
        'leader_notes' => 'Mục sư chủ tọa cầu nguyện, ban nhạc lót nhạc đệm êm',
        'duration_minutes' => 4
    ]
);

check($item1 > 0 && $item2 > 0 && $item3 > 0, "Thêm thành công 3 mục vào Service Plan");

$planWithItems = SetlistService::getById($planId);
$items = $planWithItems['items'];
check(count($items) === 3, "Service Plan chứa đúng 3 mục");
check($items[0]['chord_profile'] === 'HD' && (int)$items[0]['transpose_key'] === 2, "Bài 1 bảo toàn profile HD và tông +2");
check($items[0]['item_type'] === 'song', "Bài 1 đúng loại item_type='song'");
check(strpos($items[0]['leader_notes'], 'Intro Piano') !== false, "Bài 1 lưu đúng ghi chú ban nhạc");
check($items[2]['item_type'] === 'prayer', "Tiết mục 3 đúng loại item_type='prayer'");
check($items[2]['custom_title'] === 'Cầu nguyện khai lễ & chúc phước', "Tiết mục 3 có custom_title chính xác");

// ─── TEST 3: Phân công nhân sự & xác nhận tham gia ────────────────
$assign1 = SetlistService::assignUser($planId, $banhatId, 'piano', 'Đệm piano chính & intro bài 1', $adminId);
$assign2 = SetlistService::assignUser($planId, $viewerId, 'vocal', 'Hát solo phiên khúc 1 & lĩnh xướng', $adminId);

check($assign1 > 0 && $assign2 > 0, "Phân công thành công 2 nhân sự cho ban nhạc");

$assignments = SetlistService::getAssignments($planId);
check(count($assignments) === 2, "Danh sách phân công có đúng 2 thành viên");
check($assignments[0]['status'] === 'pending', "Trạng thái khởi tạo của phân công là 'pending'");

// Ban Hát xác nhận tham gia
$respBh = SetlistService::respondAssignment($assign1, $banhatId, 'confirmed', 'Đã nhận lời, sẵn sàng tập thứ Bảy');
check($respBh === true, "Ban Hát xác nhận tham gia thành công");

// Viewer báo bận
$respViewer = SetlistService::respondAssignment($assign2, $viewerId, 'declined', 'Bận việc gia đình sáng Chúa Nhật');
check($respViewer === true, "Viewer báo bận thành công");

$planAfterResp = SetlistService::getById($planId);
$asMap = [];
foreach ($planAfterResp['assignments'] as $a) {
    $asMap[$a['id']] = $a;
}

check($asMap[$assign1]['status'] === 'confirmed', "Phân công 1 có trạng thái 'confirmed'");
check(!empty($asMap[$assign1]['confirmed_at']), "Phân công 1 có thời điểm confirmed_at");
check($asMap[$assign2]['status'] === 'declined', "Phân công 2 có trạng thái 'declined'");
check(strpos($asMap[$assign2]['notes'], 'Bận việc gia đình') !== false, "Lưu đúng lý do báo bận");

// Gỡ phân công Viewer để thay bằng thành viên khác
$delAssign = SetlistService::removeAssignment($assign2, $adminId);
check($delAssign === true, "Gỡ phân công thành công");
check(count(SetlistService::getAssignments($planId)) === 1, "Sau khi gỡ chỉ còn 1 thành viên");

// ─── TEST 4: Phát hành chương trình & Lịch sử dùng bài hát ────────
$publishRes = SetlistService::publish($planId, $adminId);
check($publishRes === true, "Phát hành chương trình thành công");

$publishedPlan = SetlistService::getById($planId);
check($publishedPlan['status'] === 'published', "Trạng thái chương trình chuyển thành 'published'");

// Kiểm tra lịch sử sử dụng bài hát
$usage1 = SetlistService::getSongUsageHistory('001-thanh-chua-yeu-thuong');
check($usage1['total_used'] === 1, "001-thanh-chua-yeu-thuong được ghi nhận dùng 1 lần");
check($usage1['last_used_date'] === '2026-10-04', "Ngày dùng gần nhất của bài 001 là 2026-10-04");
check(count($usage1['history']) === 1, "Chi tiết lịch sử chứa đúng 1 buổi lễ");
check($usage1['history'][0]['chord_profile'] === 'HD', "Lịch sử lưu đúng profile HD");

$usage2 = SetlistService::getSongUsageHistory('002-ngoi-khen-chua');
check($usage2['total_used'] === 1, "002-ngoi-khen-chua được ghi nhận dùng 1 lần");

// Kiểm tra bài chưa từng dùng
$usageUnused = SetlistService::getSongUsageHistory('999-bai-chua-dung');
check($usageUnused['total_used'] === 0 && empty($usageUnused['history']), "Bài chưa dùng trả về total_used = 0");

// ─── TEST 5: Phân quyền & RBAC ─────────────────────────────────────
check(SetlistService::isOwner($planId, $adminId), "Admin là creator sở hữu plan");
check(SetlistService::isLeaderOrOwner($planId, $banhatId), "Ban Hát là Ca Trưởng được cấp quyền Leader");
check(!SetlistService::isOwner($planId, $viewerId), "Viewer không phải là chủ sở hữu");
check(!SetlistService::isLeaderOrOwner($planId, $viewerId), "Viewer không phải là Ca Trưởng");
check(SetlistService::isAssignmentOwner($assign1, $banhatId), "Ban Hát là chủ của phân công 1");
check(!SetlistService::isAssignmentOwner($assign1, $viewerId), "Viewer không thể phản hồi thay Ban Hát");

// ─── TEST 6: Hợp đồng Controller & Giao diện Frontend ─────────────
$controllerSrc = file_get_contents($root . '/api/controllers/SetlistController.php') ?: '';
check(strpos($controllerSrc, "action === 'publish'") !== false, "SetlistController hỗ trợ action=publish");
check(strpos($controllerSrc, "action === 'assign'") !== false, "SetlistController hỗ trợ action=assign");
check(strpos($controllerSrc, "action === 'respond_assignment'") !== false, "SetlistController hỗ trợ action=respond_assignment");
check(strpos($controllerSrc, "action === 'song_usage'") !== false, "SetlistController hỗ trợ action=song_usage");

$apiServiceSrc = file_get_contents($root . '/assets/js/core/ApiService.js') ?: '';
check(strpos($apiServiceSrc, 'servicePlans: setlists') !== false, "ApiService xuất servicePlans alias");
check(strpos($apiServiceSrc, 'publish:') !== false, "ApiService hỗ trợ publish()");
check(strpos($apiServiceSrc, 'assign:') !== false, "ApiService hỗ trợ assign()");
check(strpos($apiServiceSrc, 'respondAssignment:') !== false, "ApiService hỗ trợ respondAssignment()");
check(strpos($apiServiceSrc, 'songUsage:') !== false, "ApiService hỗ trợ songUsage()");

$modalFile = $root . '/assets/js/modals/ServicePlanAssignModal.js';
check(file_exists($modalFile), "ServicePlanAssignModal.js tồn tại vật lý");
$modalSrc = file_get_contents($modalFile);
check(strpos($modalSrc, 'window.ServicePlanAssignModal = ServicePlanAssignModal') !== false, "ServicePlanAssignModal xuất đúng window namespace");

@unlink($auditLogFile);

echo "\nAll Service Plan & Team Assignment regression checks PASSED! (6/6)\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
