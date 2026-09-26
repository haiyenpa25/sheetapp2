<?php
/**
 * tests/live_sync_v2_regression.php
 *
 * Kiểm tra hồi quy toàn diện cho Epic 3.3 — Live Sync v2:
 * 1. Protocol V2 Room Creation & State Snapshot (lastEventId, events ring buffer, sanitize hostToken).
 * 2. Sequential Event ID & State Update Integrity (EVT-{room}-{rev}-{hash}, revision auto-increment).
 * 3. Exactly-Once Cue Delivery (cueId, createdAt, expiresAt, deduplication guard).
 * 4. Bounded Replay Ring Buffer & Catch-Up on Reconnect (30 events ring buffer, replayEvents).
 * 5. High-Precision Synchronized Count-In (countInStartServerTime anchor).
 * 6. High-Frequency Simulation (1 Host + 10 Followers, 100 state transitions, 100% integrity).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit('CLI only');
}

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== EPIC 3.3 — LIVE SYNC V2 REGRESSION SUITE ===\n";

$root = dirname(__DIR__);
require_once $root . '/api/services/LiveSyncService.php';

$tmpDir = sys_get_temp_dir() . '/sheetapp_ls_v2_' . bin2hex(random_bytes(4));
LiveSyncService::setRoomDir($tmpDir);

$testRoom = 'REGTEST_' . strtoupper(bin2hex(random_bytes(4)));

$safeTestFile = $tmpDir . '/' . strtolower($testRoom) . '.json';
if (file_exists($safeTestFile)) {
    @unlink($safeTestFile);
}

// ─── TEST 1: Protocol V2 Room Creation & Initial State Snapshot ─────
echo "\n--- TEST 1: Room Creation & State Snapshot ---\n";

$createRes = LiveSyncService::createRoom($testRoom, [
    'leader'       => 'Trưởng Ban Nhạc Test',
    'songId'       => '001-thanh-chua-yeu-thuong',
    'songTitle'    => 'Thánh Chúa Yêu Thương',
    'baseKey'      => 'G',
    'transpose'    => 0,
    'chordProfile' => 'HD',
    'bpm'          => 88
]);

check($createRes['success'] === true, "Khởi tạo phòng Live Sync {$testRoom} thành công");
check(!empty($createRes['hostToken']), "Nhận được hostToken bảo mật từ server");
$hostToken = $createRes['hostToken'];

$state = $createRes['state'];
check(($state['protocolVersion'] ?? 0) === 2, "Protocol Version là 2");
check(($state['revision'] ?? 0) === 1, "Revision khởi tạo là 1");
check(isset($state['lastEventId']) && str_starts_with($state['lastEventId'], 'EVT-' . $testRoom . '-1'), "lastEventId hợp lệ: {$state['lastEventId']}");
check(isset($state['events']) && is_array($state['events']), "Khởi tạo events ring buffer rỗng");
check(!isset($state['hostToken']), "hostToken không bị rò rỉ trong state của follower");

// ─── TEST 2: Sequential Event ID & State Update Integrity ───────────
echo "\n--- TEST 2: Sequential Event ID & State Updates ---\n";

// Cập nhật 1: Đổi tông +2
$up1 = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'transpose' => 2
]);
check($up1['success'] === true && $up1['revision'] === 2, "Cập nhật 1: transpose=+2, revision=2");
check(str_starts_with($up1['lastEventId'], 'EVT-' . $testRoom . '-2-'), "lastEventId có hash tuần tự: {$up1['lastEventId']}");

// Cập nhật 2: Cuộn ô nhịp sang measure 9
$up2 = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'measure'   => 9,
    'sectionId' => 'chorus'
]);
check($up2['success'] === true && $up2['revision'] === 3, "Cập nhật 2: measure=9, revision=3");
check($up2['state']['position']['measure'] === 9, "Vị trí ô nhịp đã cập nhật thành 9");

// Cập nhật 3: Đổi bài hát
$up3 = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'songId'    => '002-nguyen-tung-ngoi-chua',
    'songTitle' => 'Nguyện Tụng Ngợi Chúa'
]);
check($up3['success'] === true && $up3['revision'] === 4, "Cập nhật 3: songId mới, revision=4");
check($up3['state']['song']['songId'] === '002-nguyen-tung-ngoi-chua', "ID bài hát mới chính xác");

// ─── TEST 3: Exactly-Once Cue Delivery with Expiration & Dedup ──────
echo "\n--- TEST 3: Exactly-Once Cue Delivery ---\n";

$cueText = "Chuẩn bị vào Điệp khúc lần 2!";
$cueRes = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'cue' => [
        'text'       => $cueText,
        'type'       => 'warning',
        'durationMs' => 3000,
        'ttlSec'     => 3.0
    ]
]);

check($cueRes['success'] === true, "Host phát sóng cue cảnh báo thành công");
$cue = $cueRes['state']['cue'];
check(!empty($cue['cueId']) && str_starts_with($cue['cueId'], 'CUE-'), "Cue có cueId độc nhất: {$cue['cueId']}");
check(isset($cue['createdAt']) && isset($cue['expiresAt']), "Cue có createdAt và expiresAt");
check($cue['expiresAt'] > $cue['createdAt'], "expiresAt > createdAt (~3 giây)");

// Mô phỏng follower nhận polling:
$pollFollower1 = LiveSyncService::pollRoom($testRoom, 0, 'client-f1', 'guitar');
check($pollFollower1['modified'] === true, "Follower 1 poll lần đầu: modified=true");
check($pollFollower1['state']['cue']['cueId'] === $cue['cueId'], "Follower 1 nhận đúng cueId");

// Follower poll lại với cùng revision: modified phải là false (không kích hoạt cue lần 2)
$pollFollower2 = LiveSyncService::pollRoom($testRoom, $cueRes['revision'], 'client-f1', 'guitar');
check($pollFollower2['modified'] === false, "Follower 1 poll lại với revision hiện tại: modified=false (tiết kiệm băng thông, không lặp cue)");

// ─── TEST 4: Bounded Replay Ring Buffer & Catch-Up on Polling ───────
echo "\n--- TEST 4: Bounded Replay Buffer (30 Events Ring Buffer) ---\n";

$revBeforeLoop = $cueRes['revision']; // hiện tại là 5
// Gửi liên tiếp 35 updates đo nhịp
for ($i = 1; $i <= 35; $i++) {
    LiveSyncService::updateRoom($testRoom, $hostToken, [
        'measure' => 10 + $i
    ]);
}

$latestPoll = LiveSyncService::pollRoom($testRoom, 0);
$totalEventsInFile = count($latestPoll['state']['events'] ?? []);
check($totalEventsInFile === 30, "Ring Buffer giới hạn tối đa đúng 30 sự kiện gần nhất (thực tế: {$totalEventsInFile})");

// Giả sử follower bị rớt mạng ở revision ($latestPoll['revision'] - 7)
$clientOldRev = $latestPoll['revision'] - 7;
$catchUpPoll = LiveSyncService::pollRoom($testRoom, $clientOldRev, 'client-reconnect', 'piano');
check($catchUpPoll['modified'] === true, "Follower rớt mạng nhận được modified=true");
check(isset($catchUpPoll['replayEvents']) && count($catchUpPoll['replayEvents']) === 7, "Follower nhận chính xác 7 replayEvents đã bỏ lỡ");
check($catchUpPoll['replayEvents'][0]['revision'] === $clientOldRev + 1, "Replay events bắt đầu từ revision kế tiếp");
check(end($catchUpPoll['replayEvents'])['revision'] === $latestPoll['revision'], "Replay events kết thúc ở revision mới nhất");

// ─── TEST 5: Synchronized High-Precision Count-In ───────────────────
echo "\n--- TEST 5: Synchronized Count-In (Server Time Anchor) ---\n";

$countInRes = LiveSyncService::updateRoom($testRoom, $hostToken, [
    'transport' => [
        'state'       => 'count_in',
        'countInBars' => 2
    ]
]);

check($countInRes['success'] === true, "Host kích hoạt count-in thành công");
$transport = $countInRes['state']['transport'];
check($transport['state'] === 'count_in', "Trạng thái transport là count_in");
check(!empty($transport['countInStartServerTime']), "Server đã cấp countInStartServerTime: {$transport['countInStartServerTime']}");

$serverNow = microtime(true);
$diffMs = ($transport['countInStartServerTime'] - $serverNow) * 1000;
check($diffMs >= 0 && $diffMs <= 250, "countInStartServerTime được đồng bộ trong tương lai gần (+150ms buffer): diff=" . round($diffMs, 1) . "ms");

// ─── TEST 6: High-Frequency Simulation (1 Host + 10 Followers) ──────
echo "\n--- TEST 6: 1 Host + 10 Followers High-Frequency Simulation ---\n";

// Host xóa cue cũ trước khi bắt đầu mô phỏng 100 bước
$clearCueRes = LiveSyncService::updateRoom($testRoom, $hostToken, ['cue' => null]);
check($clearCueRes['success'] === true && $clearCueRes['state']['cue'] === null, "Host xóa cue cũ, phòng sẵn sàng cho mô phỏng");

$simFollowers = [];
for ($f = 1; $f <= 10; $f++) {
    $simFollowers[] = [
        'clientId'              => 'sim-client-' . $f,
        'role'                  => ($f % 2 === 0) ? 'vocal' : 'guitar',
        'rev'                   => $clearCueRes['revision'],
        'processedCues'         => [],
        'displayedBannerCount'  => 0,
        'duplicateIgnoredCount' => 0
    ];
}

$stateTransitions = 100;
$startRev = $clearCueRes['revision'];
$step50CueId = null;

for ($step = 1; $step <= $stateTransitions; $step++) {
    // Host cập nhật
    $updateData = [
        'measure' => ($step % 64) + 1,
        'beat'    => ($step % 4) + 1
    ];

    if ($step === 50) {
        $updateData['cue'] = [
            'text'       => 'Chuyển sang đoạn Kết!',
            'type'       => 'danger',
            'durationMs' => 4000
        ];
    }

    $hostUp = LiveSyncService::updateRoom($testRoom, $hostToken, $updateData);
    if (!$hostUp['success']) {
        check(false, "Lỗi cập nhật ở bước {$step}: " . ($hostUp['error'] ?? 'Unknown'));
    }
    if ($step === 50) {
        $step50CueId = $hostUp['state']['cue']['cueId'] ?? null;
    }

    // 2 ngẫu nhiên follower poll trong mỗi vòng lặp
    $selectedFollowers = [rand(0, 4), rand(5, 9)];
    foreach ($selectedFollowers as $idx) {
        $f = &$simFollowers[$idx];
        $poll = LiveSyncService::pollRoom($testRoom, $f['rev'], $f['clientId'], $f['role']);
        if ($poll['modified']) {
            $f['rev'] = $poll['revision'];
            $cueId = $poll['state']['cue']['cueId'] ?? null;
            if ($cueId) {
                if (!isset($f['processedCues'][$cueId])) {
                    $f['processedCues'][$cueId] = true;
                    $f['displayedBannerCount']++;
                } else {
                    $f['duplicateIgnoredCount']++;
                }
            }
        }
    }
}

// Tất cả 10 followers poll lần cuối để catch-up hoàn toàn
$expectedFinalRev = $startRev + $stateTransitions;
$allInSync = true;
$allCuesExactlyOnce = true;

foreach ($simFollowers as &$f) {
    $finalPoll = LiveSyncService::pollRoom($testRoom, $f['rev'], $f['clientId'], $f['role']);
    if ($finalPoll['modified']) {
        $f['rev'] = $finalPoll['revision'];
        $cueId = $finalPoll['state']['cue']['cueId'] ?? null;
        if ($cueId) {
            if (!isset($f['processedCues'][$cueId])) {
                $f['processedCues'][$cueId] = true;
                $f['displayedBannerCount']++;
            } else {
                $f['duplicateIgnoredCount']++;
            }
        }
    }
    if ($f['rev'] !== $expectedFinalRev) {
        $allInSync = false;
    }
    // Đảm bảo cue bước 50 chỉ hiển thị đúng 1 lần (Exactly-Once Delivery)
    if (!isset($f['processedCues'][$step50CueId]) || $f['displayedBannerCount'] !== 1) {
        $allCuesExactlyOnce = false;
    }
}

check($allInSync, "Tất cả 10 followers đạt đúng revision cuối cùng: {$expectedFinalRev}");
check($allCuesExactlyOnce, "Tất cả 10 followers nhận và hiển thị cue đúng 1 lần duy nhất (Exactly-Once Cue Delivery)");

// Dọn dẹp phòng test sau kiểm thử
$closeRes = LiveSyncService::closeRoom($testRoom, $hostToken);
check($closeRes['success'] === true, "Đã đóng phòng Live test thành công");

$pollClosed = LiveSyncService::pollRoom($testRoom, 0);
check(($pollClosed['active'] ?? true) === false, "Phòng đã chuyển sang trạng thái active=false");

// Xóa file test
$safeTestFile = $tmpDir . '/' . strtolower($testRoom) . '.json';
if (file_exists($safeTestFile)) {
    @unlink($safeTestFile);
}
if (is_dir($tmpDir)) {
    @rmdir($tmpDir);
}
LiveSyncService::setRoomDir(null);
check(!file_exists($safeTestFile), "Đã xóa file dữ liệu phòng test an toàn");

echo "\n=======================================================\n";
echo "SUCCESS: Tất cả 6 bài kiểm tra Live Sync v2 ĐẠT 100%!\n";
echo "=======================================================\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
