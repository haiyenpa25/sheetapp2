<?php
/**
 * tests/feature_flags_regression.php
 *
 * Kiểm tra hồi quy cho Task 1.10 — Làm thật hoặc ẩn tính năng giả:
 * 1. LiveSyncService lưu trữ và phát sóng loop, inkStroke, inkClear, bandState.
 * 2. Follower nhận được dữ liệu loop, inkStroke, inkClear, bandState qua pollRoom.
 * 3. Sanitizer không làm mất các trường live sync mới trong follower payload.
 * 4. PracticeService nhận accuracy_total và accuracy thực tế thay vì hardcode 100.0.
 * 5. FeatureFlags JS và các file liên quan tồn tại với cấu trúc hợp lệ.
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/services/LiveSyncService.php';
require_once __DIR__ . '/../api/services/PracticeService.php';

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== FEATURE FLAGS & CAPABILITIES REGRESSION (TASK 1.10) ===\n";

// --- TEST 1: LiveSyncService updateRoom lưu trữ loop, ink, bandState ---
$tmpLiveSyncDir = sys_get_temp_dir() . '/sheetapp_test_feature_flags_' . bin2hex(random_bytes(4));
LiveSyncService::setRoomDir($tmpLiveSyncDir);

$roomCode = 'TEST-' . rand(1000, 9999);
$created = LiveSyncService::createRoom($roomCode, ['title' => 'Chúa Mở Lối'], 'host-token-xyz');
check($created['success'] === true, 'Tạo phòng LiveSync test thành công');

$hostToken = $created['hostToken'];

// Cập nhật loop, ink, bandState
$updatePayload = [
    'loop' => [
        'active' => true,
        'start'  => 5,
        'end'    => 12
    ],
    'bandState' => [
        'key'   => 'break',
        'label' => '🛑 BREAK',
        'icon'  => '🛑'
    ],
    'inkStroke' => [
        'id'    => 'stroke-1234',
        'tool'  => 'pen',
        'color' => '#ef4444',
        'width' => 3,
        'points' => [['x' => 10, 'y' => 20], ['x' => 15, 'y' => 25]]
    ]
];

$updateRes = LiveSyncService::updateRoom($roomCode, $hostToken, $updatePayload);
check($updateRes['success'] === true, 'LiveSync updateRoom thành công với payload loop, ink, bandState');
check(isset($updateRes['state']['loop']) && $updateRes['state']['loop']['active'] === true, 'updateRoom trả về state chứa loop');
check(isset($updateRes['state']['bandState']) && $updateRes['state']['bandState']['key'] === 'break', 'updateRoom trả về state chứa bandState');
check(isset($updateRes['state']['inkStroke']) && $updateRes['state']['inkStroke']['id'] === 'stroke-1234', 'updateRoom trả về state chứa inkStroke');

// --- TEST 2: Follower pollRoom nhận được loop, ink, bandState ---
$pollRes = LiveSyncService::pollRoom($roomCode, 0, 'client-follower-1', 'musician');
check($pollRes['success'] === true && $pollRes['modified'] === true, 'Follower pollRoom thành công');
$followerData = $pollRes['data'];
check(isset($followerData['loop']) && $followerData['loop']['start'] === 5 && $followerData['loop']['end'] === 12, 'Follower nhận đúng dữ liệu A-B loop');
check(isset($followerData['bandState']) && $followerData['bandState']['key'] === 'break', 'Follower nhận đúng bandState');
check(isset($followerData['inkStroke']) && $followerData['inkStroke']['id'] === 'stroke-1234', 'Follower nhận đúng inkStroke');
check(!isset($followerData['hostToken']), 'Follower tuyệt đối không nhận được hostToken');

// --- TEST 3: Cập nhật inkClear ---
$clearPayload = ['inkClear' => true];
$clearRes = LiveSyncService::updateRoom($roomCode, $hostToken, $clearPayload);
check($clearRes['success'] === true, 'updateRoom nhận và xử lý inkClear');
$pollRes2 = LiveSyncService::pollRoom($roomCode, 0, 'client-follower-1', 'musician');
check(isset($pollRes2['data']['inkClear']) && $pollRes2['data']['inkClear'] === true, 'Follower nhận đúng tín hiệu inkClear');

// Dọn dẹp phòng test
LiveSyncService::closeRoom($roomCode, $hostToken);
$roomFile = $tmpLiveSyncDir . '/' . strtolower($roomCode) . '.json';
if (file_exists($roomFile)) {
    @unlink($roomFile);
}
@rmdir($tmpLiveSyncDir);
LiveSyncService::setRoomDir(null);

// --- TEST 4: PracticeService ghi nhận dynamic accuracy thay vì 100.0 ---
$db = createTestDatabase();
DB::setPdo($db);
// Tạo bài và user test
$db->exec("INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name) VALUES (10, 'tester_practice', 'hash', 'banhat', 'Tester')");
$db->exec("INSERT OR IGNORE INTO songs (id, title, xmlPath) VALUES ('101', 'Bài Hát 101', '001.xml')");

// Start practice session
$startRes = PracticeService::startSession(10, '101', 'piano', 80);
check($startRes['session_id'] > 0, 'Khởi tạo practice session thành công');
$sessionId = $startRes['session_id'];

// Checkpoint với accuracy = 75.5
$checkpointOk = PracticeService::checkpoint($sessionId, [
    ['measure_no' => 1, 'attempts' => 3, 'accuracy' => 75.5, 'timing_score' => 80.0, 'best_bpm' => 90]
]);
check($checkpointOk === true, 'Lưu checkpoint practice thành công');

// Finish với accuracy_total = 75.5
$finishOk = PracticeService::finishSession($sessionId, 120, 90, 75.5);
check($finishOk === true, 'Hoàn tất practice session với accuracy thật');

$progress = PracticeService::getProgress('101', 10);
check(!empty($progress['recent_sessions']), 'Lấy recent_sessions practice thành công');
check(abs((float)$progress['recent_sessions'][0]['accuracy_total'] - 75.5) < 0.01, 'accuracy_total lưu đúng giá trị thực 75.5%');

// --- TEST 5: Kiểm tra file FeatureFlags.js và StageInkEngine idempotent check ---
$ffPath = __DIR__ . '/../assets/js/core/FeatureFlags.js';
check(file_exists($ffPath), 'File assets/js/core/FeatureFlags.js đã được tạo');
$ffContent = file_get_contents($ffPath);
check(str_contains($ffContent, 'LIVE_BAND_SATB'), 'FeatureFlags định nghĩa cờ LIVE_BAND_SATB');

$inkPath = __DIR__ . '/../assets/js/performance/stage-ink-engine.js';
$inkContent = file_get_contents($inkPath);
check(str_contains($inkContent, 'renderRemoteStroke'), 'StageInkEngine có hàm renderRemoteStroke');

echo "\n>>> ALL 5/5 FEATURE FLAGS & CAPABILITIES REGRESSION CHECKS PASSED!\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
