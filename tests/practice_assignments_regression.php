<?php
/**
 * tests/practice_assignments_regression.php
 *
 * Kiểm thử hồi quy toàn diện cho Epic 4.1:
 * Giao bài & Tập bè cho ca đoàn (Practice Assignments Architecture):
 * 1. Lược đồ CSDL: bảng practice_assignments, practice_assignment_targets, practice_sessions.assignment_id.
 * 2. Tự động sinh từ Service Plan (createFromServicePlan) & Bảo vệ chống trùng lặp.
 * 3. Giao bài lẻ (createAdHoc) & Gán nhóm bè tự động.
 * 4. Danh sách "Bài tập của tôi" (getMyAssignments) chính xác theo ca viên.
 * 5. Tự động đánh giá tiến độ thật & 3 loại luật hoàn thành (manual, accuracy, minutes).
 * 6. Bảng tiến độ ca đoàn (getTeamBoard) & Bảo vệ quyền riêng tư (Privacy Guard D10).
 * 7. Kiểm soát quyền hạn RBAC (AuthPolicy: assign_practice, view_team_progress).
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentService.php';
require_once __DIR__ . '/../api/services/PracticeService.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';

$pdo = createTestDatabase();
DB::setPdo($pdo);

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = [];

function check(bool $cond, string $msg): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $totalChecks, $passedChecks, $failedChecks;
    $totalChecks++;
    if ($cond) {
        $passedChecks++;
        echo "  ✅ PASS: {$msg}\n";
    } else {
        $failedChecks[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    }
}

echo "=== KIỂM THỬ HỒI QUY EPIC 4.1: GIAO BÀI & TẬP BÈ CA ĐOÀN ===\n\n";

// [1/6] Kiểm tra Lược đồ CSDL
echo "[1/6] Kiểm tra Lược đồ CSDL Migration 010...\n";
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
check(in_array('practice_assignments', $tables, true), "Bảng practice_assignments tồn tại trong SQLite");
check(in_array('practice_assignment_targets', $tables, true), "Bảng practice_assignment_targets tồn tại trong SQLite");

$sessionCols = array_column($pdo->query("PRAGMA table_info(practice_sessions)")->fetchAll(PDO::FETCH_ASSOC), 'name');
check(in_array('assignment_id', $sessionCols, true), "Bảng practice_sessions có cột assignment_id");

// Tạo test users bổ sung cho ca đoàn
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, display_name, voice_part, consent_practice_share, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute([10, 'leader_user', 'hash', 'leader', 'Ca Trưởng Ban', 'T', 1, 'active']);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, display_name, voice_part, consent_practice_share, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute([11, 'soprano_user', 'hash', 'banhat', 'Ca Viên Soprano', 'S', 1, 'active']);
$pdo->prepare("INSERT INTO users (id, username, password_hash, role, display_name, voice_part, consent_practice_share, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute([12, 'alto_user', 'hash', 'banhat', 'Ca Viên Alto (No Consent)', 'A', 0, 'active']);

// Seed test songs cho foreign key
$songStmt = $pdo->prepare("INSERT INTO songs (id, title, xmlPath) VALUES (?, ?, ?)");
$songStmt->execute(['001-hoi-thanh-vuong', 'Hỡi Thánh Vương Kíp Ngự Lai', 'songs/001.musicxml']);
$songStmt->execute(['002-nguyen-tung-my-chua', 'Nguyện Tụng Mỹ Chúa Linh Năng', 'songs/002.musicxml']);
$songStmt->execute(['003-ngoi-gie-ho-va', 'Ngợi Giê-hô-va Thánh Đế', 'songs/003.musicxml']);
$songStmt->execute(['004-ha-le-lu-gia', 'Ha-lê-lu-gia Vinh Danh Ngài', 'songs/004.musicxml']);

// [2/6] Tạo từ Service Plan & Chống trùng lặp
echo "\n[2/6] Kiểm tra createFromServicePlan & Chống tạo trùng lặp...\n";
// Tạo 1 Service Plan với 2 bài hát và 2 ca viên được phân công
$planId = SetlistService::create('Thánh Lễ Chúa Nhật Phụng Vụ', '2026-10-01', 10, ['status' => 'draft']);
SetlistService::addItem($planId, '001-hoi-thanh-vuong', 'HD', 0, 84);
SetlistService::addItem($planId, '002-nguyen-tung-my-chua', 'HD', 2, 90);

SetlistService::assignUser($planId, 11, 'Ca viên Bè S', null, 10);
SetlistService::assignUser($planId, 12, 'Ca viên Bè A', null, 10);

$resPlan = PracticeAssignmentService::createFromServicePlan($planId, 10);
check($resPlan['created_count'] === 2, "Tạo đúng 2 assignments cho 2 bài hát trong Plan (nhận được: {$resPlan['created_count']})");

// Xác nhận targets được gán đúng bè cho từng người
$tStmt = $pdo->prepare("SELECT user_id, voice_part FROM practice_assignment_targets WHERE assignment_id = ? ORDER BY user_id ASC");
$tStmt->execute([$resPlan['assignments'][0]]);
$targets = $tStmt->fetchAll(PDO::FETCH_ASSOC);
check(count($targets) === 2, "Mỗi assignment được gán đúng cho 2 ca viên");
check($targets[0]['user_id'] == 11 && $targets[0]['voice_part'] === 'S', "Ca viên Soprano được gán đúng Bè S");
check($targets[1]['user_id'] == 12 && $targets[1]['voice_part'] === 'A', "Ca viên Alto được gán đúng Bè A");

// Chống tạo trùng lặp
$resPlanDuplicate = PracticeAssignmentService::createFromServicePlan($planId, 10);
$totalInPlan = (int)$pdo->query("SELECT COUNT(*) FROM practice_assignments WHERE setlist_id = {$planId}")->fetchColumn();
check($totalInPlan === 2, "Bảo vệ chống trùng lặp: Tổng số assignment vẫn là 2 sau khi gọi lại lần 2");

// [3/6] Tạo bài tập Ad-hoc
echo "\n[3/6] Kiểm tra createAdHoc (Giao lẻ theo nhóm bè & cá nhân)...\n";
$adHocId = PracticeAssignmentService::createAdHoc([
    'song_id'              => '003-ngoi-gie-ho-va',
    'title'                => 'Luyện bè Tenor bài 003',
    'voice_part'           => 'T',
    'due_at'               => '2026-10-05 20:00:00',
    'target_bpm'           => 100,
    'completion_rule'      => 'accuracy',
    'completion_threshold' => 85.0
], 10);
check($adHocId > 0, "Tạo bài tập Ad-hoc thành công (ID: {$adHocId})");

$adHocTargets = $pdo->query("SELECT user_id, voice_part FROM practice_assignment_targets WHERE assignment_id = {$adHocId}")->fetchAll(PDO::FETCH_ASSOC);
check(count($adHocTargets) === 1 && (int)$adHocTargets[0]['user_id'] === 10, "Giao bài theo voice_part T gán chính xác cho user có voice_part T");

// [4/6] Danh sách "Bài tập của tôi" (getMyAssignments)
echo "\n[4/6] Kiểm tra getMyAssignments...\n";
$myAssignments11 = PracticeAssignmentService::getMyAssignments(11);
check(count($myAssignments11) === 2, "Ca viên 11 có đúng 2 bài tập được giao");
check($myAssignments11[0]['voice_part'] === 'S', "Bè của ca viên 11 hiển thị đúng Bè S");
check($myAssignments11[0]['status'] === 'assigned', "Trạng thái ban đầu là 'assigned'");

// [5/6] Tiến độ tập thật & 3 loại completion_rule
echo "\n[5/6] Kiểm tra recordProgress & 3 Luật Hoàn Thành...\n";

// A. Luật 'manual': Tập xong chuyển sang 'in_progress', chỉ hoàn thành khi markDone
$aidManual = $resPlan['assignments'][0]; // Rule manual
$progManual = PracticeAssignmentService::recordProgress(101, 11, $aidManual, 120, 95.0);
check($progManual['updated'] === true && $progManual['new_status'] === 'in_progress', "Luật manual: Lần tập đầu chuyển từ assigned sang in_progress");
check($progManual['is_completed'] === false, "Luật manual: Chưa tự hoàn thành dù accuracy cao (95%)");

$doneSuccess = PracticeAssignmentService::markDone($aidManual, 11);
check($doneSuccess === true, "Thành viên tự đánh dấu hoàn thành (markDone) thành công");
$statAfterDone = $pdo->query("SELECT status, completed_at FROM practice_assignment_targets WHERE assignment_id = {$aidManual} AND user_id = 11")->fetch(PDO::FETCH_ASSOC);
check($statAfterDone['status'] === 'completed' && !empty($statAfterDone['completed_at']), "Trạng thái chuyển sang completed kèm completed_at");

// B. Luật 'accuracy': Đạt ngưỡng tự động hoàn thành
$aidAccuracy = $adHocId; // Rule accuracy threshold 85%
$progAccFail = PracticeAssignmentService::recordProgress(102, 10, $aidAccuracy, 180, 78.0);
check($progAccFail['is_completed'] === false, "Luật accuracy: 78% chưa đạt ngưỡng 85% -> không hoàn thành");

$progAccPass = PracticeAssignmentService::recordProgress(103, 10, $aidAccuracy, 200, 89.5);
check($progAccPass['is_completed'] === true && $progAccPass['new_status'] === 'completed', "Luật accuracy: 89.5% >= 85% -> TỰ ĐỘNG CHUYỂN SANG COMPLETED");

// C. Luật 'minutes': Tổng thời lượng tích lũy >= ngưỡng
$aidMinutes = PracticeAssignmentService::createAdHoc([
    'song_id'              => '004-ha-le-lu-gia',
    'user_ids'             => [11],
    'completion_rule'      => 'minutes',
    'completion_threshold' => 10.0 // 10 phút = 600 giây
], 10);

// Mô phỏng 2 session trong practice_sessions
$pdo->prepare("INSERT INTO practice_sessions (id, user_id, song_id, started_at, duration_seconds, accuracy_total, assignment_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    ->execute([201, 11, '004-ha-le-lu-gia', time() - 600, 300, 90.0, $aidMinutes]); // 5 phút
$progMin1 = PracticeAssignmentService::recordProgress(201, 11, $aidMinutes, 300, 90.0);
check($progMin1['is_completed'] === false, "Luật minutes: 5 phút / 10 phút -> chưa hoàn thành");

$pdo->prepare("INSERT INTO practice_sessions (id, user_id, song_id, started_at, duration_seconds, accuracy_total, assignment_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    ->execute([202, 11, '004-ha-le-lu-gia', time(), 350, 90.0, $aidMinutes]); // Thêm gần 6 phút (tổng 650s > 600s)
$progMin2 = PracticeAssignmentService::recordProgress(202, 11, $aidMinutes, 350, 90.0);
check($progMin2['is_completed'] === true && $progMin2['new_status'] === 'completed', "Luật minutes: Tổng tích lũy 650s >= 600s -> TỰ ĐỘNG HOÀN THÀNH");

// [6/6] Bảng tiến độ ca đoàn (getTeamBoard) & Bảo vệ quyền riêng tư (Privacy Guard D10)
echo "\n[6/6] Kiểm tra getTeamBoard & Bảo vệ quyền riêng tư (Privacy Guard D10)...\n";
$board = PracticeAssignmentService::getTeamBoard($planId, 10);
check($board['setlist_id'] === $planId, "Team board trả đúng setlist_id");
check(count($board['members']) === 2, "Team board có đủ 2 ca viên");

// Tìm ca viên 11 (có consent = 1) và ca viên 12 (không consent = 0)
$member11 = null;
$member12 = null;
foreach ($board['members'] as $m) {
    if ($m['user_id'] === 11) $member11 = $m;
    if ($m['user_id'] === 12) $member12 = $m;
}

check($member11 !== null && $member11['consent_practice_share'] === 1, "Ca viên 11 có consent_practice_share = 1");
check($member12 !== null && $member12['consent_practice_share'] === 0, "Ca viên 12 có consent_practice_share = 0");

$target11Data = $member11['assignments'][$aidManual] ?? [];
$target12Data = $member12['assignments'][$aidManual] ?? [];

check($target11Data['status'] === 'completed', "Ca viên 11 hiển thị trạng thái hoàn thành");
check($target12Data['status'] === 'assigned', "Ca viên 12 hiển thị trạng thái assigned");

// BẢO VỆ RIÊNG TƯ THEO D10: Ca viên 12 không consent thì accuracy và duration BẮT BUỘC LÀ NULL
check($target12Data['accuracy'] === null, "BẢO MẬT PRIVACY D10: Ca viên không consent có accuracy === NULL");
check($target12Data['duration_seconds'] === null, "BẢO MẬT PRIVACY D10: Ca viên không consent có duration_seconds === NULL");

// Quyền hạn RBAC AuthPolicy
check(AuthPolicy::can('leader', 'assign_practice') === true, "AuthPolicy: Leader có quyền assign_practice");
check(AuthPolicy::can('admin', 'assign_practice') === true, "AuthPolicy: Admin có quyền assign_practice");
check(AuthPolicy::can('banhat', 'assign_practice') === false, "AuthPolicy: Banhat KHÔNG có quyền assign_practice");
check(AuthPolicy::can('viewer', 'assign_practice') === false, "AuthPolicy: Viewer KHÔNG có quyền assign_practice");

echo "\n----------------------------------------------------\n";
echo "Tổng số kiểm tra: {$totalChecks}\n";
echo "Số kiểm tra đạt: {$passedChecks}\n";
echo "Số lỗi: " . count($failedChecks) . "\n";

if (!empty($failedChecks)) {
    echo "❌ CÁC KIỂM TRA THẤT BẠI:\n";
    foreach ($failedChecks as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}

echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA ĐỀU ĐẠT (PASS)!\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit(0);
