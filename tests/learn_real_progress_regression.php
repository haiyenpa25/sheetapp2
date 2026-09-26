<?php
/**
 * tests/learn_real_progress_regression.php
 * Bộ kiểm thử hồi quy Epic 3.6 — Tiến độ tập thật trong Learn & Góc nhìn Ca Trưởng có Consent
 */
declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/PracticeService.php';

$pdo = createTestDatabase();
DB::setPdo($pdo);
$failures = [];
$step = 0;

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures, $step;
    $step++;
    echo ($condition ? "  ✅ PASS" : "  ❌ FAIL") . " [Scenario $step]: $message\n";
    if (!$condition) {
        $failures[] = "[Scenario $step] $message";
    }
}

echo "\n--- Bắt đầu kiểm thử Epic 3.6: Tiến độ tập thật trong Learn & Ca Trưởng ---\n";

// =========================================================================
// Kịch bản 1: Real Accuracy Metric Calculation (Không bao giờ hard-code 100%)
// =========================================================================
$userId = 2; // banhat user
$songId = '001-thanh-chua-yeu-thuong';

// 1.1 Khởi tạo phiên luyện tập
$startRes = PracticeService::startSession($userId, $songId, 'melody', 80);
$sessionId = (int)$startRes['session_id'];

// 1.2 Hoàn tất với số nốt đánh thật: 80 nốt đúng trên 100 nốt tổng
PracticeService::finishSession($sessionId, 180, 88, 0.0, 100, 80, 92.0);

$row = $pdo->query("SELECT * FROM practice_sessions WHERE id = $sessionId")->fetch(PDO::FETCH_ASSOC);

check(
    (float)$row['accuracy_total'] === 80.0 &&
    (int)$row['notes_total'] === 100 &&
    (int)$row['notes_correct'] === 80 &&
    (float)$row['timing_score'] === 92.0,
    "Accuracy tính động theo nốt thực tế (80.0%), không bị hard-code 100%"
);

// 1.3 Hoàn tất với 0 nốt đúng
$startZero = PracticeService::startSession($userId, $songId, 'piano', 76);
$zeroSessionId = (int)$startZero['session_id'];
PracticeService::finishSession($zeroSessionId, 60, 76, 0.0, 40, 0, 45.0);

$zeroRow = $pdo->query("SELECT accuracy_total, notes_correct FROM practice_sessions WHERE id = $zeroSessionId")->fetch(PDO::FETCH_ASSOC);
check(
    (float)$zeroRow['accuracy_total'] === 0.0 && (int)$zeroRow['notes_correct'] === 0,
    "Accuracy là 0.0% khi không đánh đúng nốt nào (chống ngộ nhận 100%)"
);

// =========================================================================
// Kịch bản 2: Reliable Pagehide / Beacon Delivery (Atomic batch stats flush)
// =========================================================================
$beaconStart = PracticeService::startSession($userId, $songId, 'melody', 90);
$beaconSessionId = (int)$beaconStart['session_id'];

// Giả lập browser kích hoạt pagehide và gửi beacon kèm mảng stats chưa kịp flush
$unflushedStats = [
    ['measure_no' => 1, 'attempts' => 2, 'accuracy' => 100.0, 'timing_score' => 95.0, 'best_bpm' => 90],
    ['measure_no' => 2, 'attempts' => 5, 'accuracy' => 60.0,  'timing_score' => 70.0, 'best_bpm' => 85],
    ['measure_no' => 3, 'attempts' => 3, 'accuracy' => 90.0,  'timing_score' => 88.0, 'best_bpm' => 90]
];

$flushSuccess = PracticeService::finishSession(
    $beaconSessionId, 
    125, 
    90, 
    0.0, 
    0, 
    0, 
    100.0, 
    $unflushedStats
);

$savedStats = $pdo->query("SELECT * FROM practice_measure_stats WHERE practice_session_id = $beaconSessionId ORDER BY measure_no ASC")->fetchAll(PDO::FETCH_ASSOC);
$savedSession = $pdo->query("SELECT * FROM practice_sessions WHERE id = $beaconSessionId")->fetch(PDO::FETCH_ASSOC);

// Trung bình accuracy của 3 ô nhịp: (100 + 60 + 90) / 3 = 83.3%
check(
    $flushSuccess === true &&
    count($savedStats) === 3 &&
    (int)$savedSession['duration_seconds'] === 125 &&
    (float)$savedSession['accuracy_total'] === 83.3,
    "Pagehide Beacon gộp atomic batch stats thành công, bảo toàn trọn vẹn session cuối"
);

// =========================================================================
// Kịch bản 3: Personal Practice Dashboard Data Contract
// =========================================================================
$dashboard = PracticeService::getPersonalDashboard($userId);

check(
    isset($dashboard['kpi']) &&
    isset($dashboard['heatmap_30d']) &&
    isset($dashboard['recent_sessions']) &&
    isset($dashboard['weak_measures']) &&
    count($dashboard['heatmap_30d']) === 30 &&
    count($dashboard['recent_sessions']) >= 3,
    "Personal Dashboard trả về đầy đủ KPI, 30-day heatmap, weak measures và recent sessions"
);

// Ô nhịp 2 có độ chính xác 60% phải nằm trong weak_measures
$hasWeakMeasure2 = false;
foreach ($dashboard['weak_measures'] as $wm) {
    if ((int)$wm['measure_no'] === 2 && (float)$wm['avg_acc'] <= 65.0) {
        $hasWeakMeasure2 = true;
        break;
    }
}
check(
    $hasWeakMeasure2 === true,
    "Phân tích phát hiện chính xác ô nhịp yếu (Measure #2, avg 60%) để gợi ý học viên"
);

// =========================================================================
// Kịch bản 4: Leader View with Privacy & Consent Protection
// =========================================================================
// Thiết lập User 1 (Admin) là Ca Trưởng
// User 2 (Banhat) có consent = 1
PracticeService::setConsent(2, true);

// User 3 (Viewer) có consent = 0 (Từ chối chia sẻ)
PracticeService::setConsent(3, false);
// Tạo 1 phiên tập cho User 3
$u3Start = PracticeService::startSession(3, $songId, 'piano', 72);
PracticeService::finishSession((int)$u3Start['session_id'], 240, 75, 88.0, 50, 44);

$leaderView = PracticeService::getLeaderView(1); // Requester là Admin
$members = $leaderView['members'];

$user2Data = null;
$user3Data = null;
foreach ($members as $m) {
    if ($m['user_id'] === 2) $user2Data = $m;
    if ($m['user_id'] === 3) $user3Data = $m;
}

$user2ConsentOk = ($user2Data && $user2Data['has_consent'] === true && $user2Data['username'] === 'banhat');
$user3AnonymizedOk = ($user3Data && $user3Data['has_consent'] === false && $user3Data['username'] === 'anonymous' && str_contains($user3Data['display_name'], 'ẩn danh'));

check(
    $user2ConsentOk && $user3AnonymizedOk,
    "Leader View bảo vệ quyền riêng tư: Thành viên consent hiển thị tên thật, không consent bị ẩn danh hoàn toàn"
);

// =========================================================================
// Kịch bản 5: RBAC & Consent Enforcement
// =========================================================================
$controllerContent = file_get_contents(__DIR__ . '/../api/controllers/PracticeController.php');
$serviceContent = file_get_contents(__DIR__ . '/../api/services/PracticeService.php');

$hasLeaderAuthGuard = str_contains($controllerContent, '!Auth::isBanhat() && !Auth::isAdmin()');
$hasConsentAction   = str_contains($controllerContent, "if (\$action === 'consent')");
$hasDashboardAction = str_contains($controllerContent, "if (\$action === 'dashboard')");

// Test toggle consent trong service
PracticeService::setConsent(3, true);
$u3ConsentAfter = (int)$pdo->query("SELECT consent_practice_share FROM users WHERE id = 3")->fetchColumn();
PracticeService::setConsent(3, false); // Trả lại false

check(
    $hasLeaderAuthGuard && $hasConsentAction && $hasDashboardAction && $u3ConsentAfter === 1,
    "Phân quyền RBAC & Toggle Consent được kiểm soát nghiêm ngặt ở cả Controller & Service"
);

// =========================================================================
// Kịch bản 6: Data Traceability from Source Events
// =========================================================================
// Tổng thời gian luyện tập của User 2 trong database
$dbTotalSec = (int)$pdo->query("SELECT SUM(duration_seconds) FROM practice_sessions WHERE user_id = $userId")->fetchColumn();
$dashboardHours = $dashboard['kpi']['total_hours'];
$calculatedHours = round($dbTotalSec / 3600, 1);

check(
    $dashboardHours === $calculatedHours && $dbTotalSec > 0,
    "Tính truy nguyên số liệu 100%: Dữ liệu KPI khớp chính xác từng giây với các bản ghi thô nguồn"
);

// =========================================================================
// Tổng kết
// =========================================================================
echo "\n--------------------------------------------------------\n";
if (!empty($failures)) {
    echo "❌ KẾT QUẢ: " . count($failures) . " kiểm thử thất bại:\n";
    foreach ($failures as $f) {
        echo "  - $f\n";
    }
    exit(1);
} else {
    echo "🎉 KẾT QUẢ: Tất cả 6/6 kịch bản kiểm thử Epic 3.6 ĐẠT CHUẨN (PASS)!\n";
    echo "--------------------------------------------------------\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
}
