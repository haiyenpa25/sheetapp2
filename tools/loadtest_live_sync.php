<?php
declare(strict_types=1);

/**
 * tools/loadtest_live_sync.php
 * 
 * Script CLI Kiểm thử Tải & Độ Ổn Định Live Sync (Ticket T11)
 * Mô phỏng: 1 Host + N Follower Clients (mặc định 10) đồng thời qua SSE (curl_multi).
 * Host đổi bài K lần (mặc định 50).
 * 
 * Đo lường & Báo cáo:
 * - Tỉ lệ Client nhận đủ sự kiện (%)
 * - Số lần Revision bị lùi
 * - Số lượng Cue bị trùng
 * - Độ trễ p50, p95, Max (ms)
 * 
 * Sử dụng:
 * php tools/loadtest_live_sync.php [--clients=10] [--changes=50] [--delay-ms=100] [--url=http://localhost/sheetapp2]
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

$options = getopt('', ['clients::', 'changes::', 'delay-ms::', 'url::', 'help::']);

if (isset($options['help'])) {
    echo "Sử dụng: php tools/loadtest_live_sync.php [options]\n";
    echo "  --clients=N     Số client theo dõi (mặc định: 10)\n";
    echo "  --changes=N     Số lần Host đổi bài/cập nhật (mặc định: 50)\n";
    echo "  --delay-ms=N    Khoảng dừng giữa các lần cập nhật (mặc định: 60ms)\n";
    echo "  --url=URL       Địa chỉ gốc của ứng dụng (mặc định: http://localhost/sheetapp2)\n";
    exit(0);
}

$numClients = isset($options['clients']) ? max(1, (int)$options['clients']) : 10;
$numChanges = isset($options['changes']) ? max(5, (int)$options['changes']) : 50;
$delayMs    = isset($options['delay-ms']) ? max(10, (int)$options['delay-ms']) : 60;
$baseUrl    = rtrim($options['url'] ?? (getenv('SHEETAPP_TEST_URL') ?: 'http://localhost/sheetapp2'), '/');

echo "========================================================\n";
echo "   SheetApp2 — Live Sync Load & Concurrency Test (T11)  \n";
echo "========================================================\n";
echo "  Base URL:        {$baseUrl}\n";
echo "  Số Clients SSE:  {$numClients}\n";
echo "  Số lần đổi bài:  {$numChanges}\n";
echo "  Delay mỗi bước:  {$delayMs}ms\n\n";

// 1. Khởi tạo phòng test
$room = 'LOADTEST_' . time() . '_' . bin2hex(random_bytes(2));
$apiUrl = "{$baseUrl}/api/index.php";

$chCreate = curl_init("{$apiUrl}?route=live_sync&action=create");
$createPayload = json_encode([
    'room'   => $room,
    'leader' => ['name' => 'Loadtest Host']
]);
curl_setopt_array($chCreate, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $createPayload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT        => 5
]);
$createRaw = curl_exec($chCreate);
curl_close($chCreate);

$createRes = json_decode((string)$createRaw, true);
$hostToken = $createRes['data']['hostToken'] ?? ($createRes['hostToken'] ?? '');

if (empty($hostToken)) {
    // Thử fallback trực tiếp qua Service nếu chạy local không qua HTTP login Auth
    require_once __DIR__ . '/../api/services/LiveSyncService.php';
    $directRes = LiveSyncService::createRoom($room, ['name' => 'Loadtest Host']);
    $hostToken = $directRes['hostToken'] ?? '';
}

if (empty($hostToken)) {
    echo "[ERROR] Không thể tạo phòng test $room. Kết quả: $createRaw\n";
    exit(1);
}

echo "✅ Đã tạo phòng: {$room} (hostToken: " . substr($hostToken, 0, 8) . "...)\n";

// 2. Khởi tạo kết nối SSE cho N clients bằng curl_multi
$mh = curl_multi_init();
$clientHandles = [];
$clientBuffers = [];
$clientStats   = [];

for ($c = 1; $c <= $numClients; $c++) {
    $clientId = "follower-client-{$c}";
    $clientStats[$clientId] = [
        'receivedRevisions' => [],
        'receivedCues'      => [],
        'latencies'         => [],
        'regressionCount'   => 0
    ];
    $clientBuffers[$clientId] = '';

    $sseUrl = "{$apiUrl}?route=live_sync&action=events&room={$room}&clientId={$clientId}&role=viewer";
    $ch = curl_init($sseUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_TIMEOUT        => 300,
        CURLOPT_WRITEFUNCTION  => function($ch, $data) use ($clientId, &$clientBuffers) {
            $clientBuffers[$clientId] .= $data;
            return strlen($data);
        }
    ]);

    curl_multi_add_handle($mh, $ch);
    $clientHandles[$clientId] = $ch;
}

echo "⏳ Đang kết nối {$numClients} clients SSE qua HTTP...";
// Cho curl_multi khởi động kết nối
for ($i = 0; $i < 10; $i++) {
    curl_multi_exec($mh, $active);
    usleep(50000);
}
echo " ĐÃ KẾT NỐI.\n\n";

// 3. Tiến hành Host đổi bài K lần và ghi nhận thời gian
echo "🚀 Bắt đầu quá trình Host đổi bài ({$numChanges} lần)...\n";
$dispatchTimestamps = []; // revision => sendTime
$totalHostSent = 0;

function parseEventsFromBuffer(string &$buffer): array {
    $events = [];
    while (($pos = strpos($buffer, "\n\n")) !== false) {
        $rawEvent = substr($buffer, 0, $pos);
        $buffer = substr($buffer, $pos + 2);

        $lines = explode("\n", $rawEvent);
        $dataStr = '';
        foreach ($lines as $line) {
            if (str_starts_with($line, 'data: ')) {
                $dataStr .= substr($line, 6);
            }
        }
        if ($dataStr !== '') {
            $parsed = json_decode($dataStr, true);
            if (is_array($parsed)) {
                $events[] = $parsed;
            }
        }
    }
    return $events;
}

function recordEventRevision(int $eRev, string $cId, float $now, array &$clientStats, array &$dispatchTimestamps): void {
    if (in_array($eRev, $clientStats[$cId]['receivedRevisions'], true)) {
        return; // Đã nhận revision này trước đó, bỏ qua (idempotent)
    }

    $lastRev = empty($clientStats[$cId]['receivedRevisions']) ? 0 : end($clientStats[$cId]['receivedRevisions']);
    if ($eRev < $lastRev) {
        $clientStats[$cId]['regressionCount']++;
        echo "  [REGRESSION DETECTED] Client $cId received revision $eRev after $lastRev\n";
    }
    $clientStats[$cId]['receivedRevisions'][] = $eRev;

    if (isset($dispatchTimestamps[$eRev])) {
        $latencyMs = ($now - $dispatchTimestamps[$eRev]) * 1000;
        $clientStats[$cId]['latencies'][] = max(0, $latencyMs);
    }
}

function processSingleEvent(array $evt, string $cId, float $now, array &$clientStats, array &$dispatchTimestamps): void {
    // 1. Xử lý các sự kiện bỏ lỡ (replays) trước theo thứ tự tăng dần
    $replays = $evt['replayEvents'] ?? ($evt['data']['replayEvents'] ?? []);
    if (is_array($replays) && !empty($replays)) {
        usort($replays, fn($a, $b) => ((int)($a['revision'] ?? 0)) <=> ((int)($b['revision'] ?? 0)));
        foreach ($replays as $rEvt) {
            $rRev = $rEvt['revision'] ?? null;
            if ($rRev !== null) {
                recordEventRevision((int)$rRev, $cId, $now, $clientStats, $dispatchTimestamps);
            }
        }
    }

    // 2. Ghi nhận revision chính của event/state
    $eRev = $evt['revision'] ?? ($evt['data']['revision'] ?? null);
    if ($eRev !== null) {
        recordEventRevision((int)$eRev, $cId, $now, $clientStats, $dispatchTimestamps);
    }

    $cueId = $evt['cue']['cueId'] ?? ($evt['data']['cue']['cueId'] ?? ($evt['cueId'] ?? null));
    if ($cueId) {
        if (!isset($clientStats[$cId]['activeCueId']) || $clientStats[$cId]['activeCueId'] !== $cueId) {
            if (in_array($cueId, $clientStats[$cId]['seenCueIds'] ?? [], true)) {
                $clientStats[$cId]['duplicateCueCount']++;
            }
            $clientStats[$cId]['seenCueIds'][] = $cueId;
            $clientStats[$cId]['activeCueId'] = $cueId;
        }
    }
}

$startTime = microtime(true);

for ($step = 1; $step <= $numChanges; $step++) {
    $sendTime = microtime(true);
    $songId = "song-test-" . str_pad((string)$step, 3, '0', STR_PAD_LEFT);
    $songTitle = "Bài Hát Thử Nghiệm Số {$step}";
    $cueText = ($step % 5 === 0) ? "CUE-STEP-{$step}" : null;

    $updatePayload = [
        'room'      => $room,
        'hostToken' => $hostToken,
        'songId'    => $songId,
        'songTitle' => $songTitle,
        'measure'   => $step,
        'bpm'       => 80 + ($step % 30),
    ];
    if ($cueText) {
        $updatePayload['cue'] = ['text' => $cueText, 'durationMs' => 3000];
    }

    // Gửi update qua HTTP POST
    $chUpdate = curl_init("{$apiUrl}?route=live_sync");
    curl_setopt_array($chUpdate, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($updatePayload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "X-Host-Token: {$hostToken}"],
        CURLOPT_TIMEOUT        => 3
    ]);
    $updateRes = curl_exec($chUpdate);
    curl_close($chUpdate);

    $upData = json_decode((string)$updateRes, true);
    $rev = $upData['data']['revision'] ?? ($upData['revision'] ?? null);

    if ($rev !== null) {
        $dispatchTimestamps[$rev] = $sendTime;
        $totalHostSent++;
    }

    // Cho curl_multi xử lý các gói tin SSE đến
    curl_multi_exec($mh, $active);

    // Xử lý buffer từng client trong vòng lặp chính
    $now = microtime(true);
    foreach ($clientBuffers as $cId => &$buf) {
        $evts = parseEventsFromBuffer($buf);
        foreach ($evts as $evt) {
            processSingleEvent($evt, $cId, $now, $clientStats, $dispatchTimestamps);
        }
    }
    unset($buf);

    if ($step % 10 === 0 || $step === $numChanges) {
        echo "  → Đã gửi {$step}/{$numChanges} lượt đổi bài...\n";
    }

    usleep($delayMs * 1000);
}

// Chờ thêm 2 giây để các packet SSE còn sót lại về hết client
$drainUntil = microtime(true) + 2.0;
while (microtime(true) < $drainUntil) {
    curl_multi_exec($mh, $active);
    $now = microtime(true);
    foreach ($clientBuffers as $cId => &$buf) {
        $evts = parseEventsFromBuffer($buf);
        foreach ($evts as $evt) {
            processSingleEvent($evt, $cId, $now, $clientStats, $dispatchTimestamps);
        }
    }
    unset($buf);
    usleep(25000);
}

$elapsedTotal = microtime(true) - $startTime;

// Đóng toàn bộ handle
foreach ($clientHandles as $h) {
    curl_multi_remove_handle($mh, $h);
    curl_close($h);
}
curl_multi_close($mh);

// 4. Tổng hợp & Tính toán chỉ số thống kê
$allLatencies = [];
$totalRegressions = 0;
$totalDuplicateCues = 0;
$clientSuccessCounts = 0;

$targetRevisions = array_keys($dispatchTimestamps);
$totalExpectedEvents = count($targetRevisions) * $numClients;
$totalReceivedEvents = 0;

foreach ($clientStats as $cId => $stat) {
    $uniqueRevs = array_unique($stat['receivedRevisions']);
    $receivedCount = count(array_intersect($targetRevisions, $uniqueRevs));
    $totalReceivedEvents += $receivedCount;

    if ($receivedCount === count($targetRevisions)) {
        $clientSuccessCounts++;
    }

    $totalRegressions += $stat['regressionCount'];

    // Kiểm tra trùng cue
    $cueCounts = array_count_values($stat['receivedCues']);
    foreach ($cueCounts as $cnt) {
        if ($cnt > 1) {
            $totalDuplicateCues += ($cnt - 1);
        }
    }

    $allLatencies = array_merge($allLatencies, $stat['latencies']);
}

sort($allLatencies);
$latencyCount = count($allLatencies);
$p50 = $latencyCount > 0 ? $allLatencies[(int)floor($latencyCount * 0.50)] : 0;
$p95 = $latencyCount > 0 ? $allLatencies[(int)floor($latencyCount * 0.95)] : 0;
$maxLat = $latencyCount > 0 ? end($allLatencies) : 0;

$deliveryRate = $totalExpectedEvents > 0 ? ($totalReceivedEvents / $totalExpectedEvents) * 100 : 0;

echo "\n--------------------------------------------------------\n";
echo "   KẾT QUẢ KIỂM THỬ TẢI LIVE SYNC (1 HOST + {$numClients} CLIENTS)   \n";
echo "--------------------------------------------------------\n";
printf("  Thời gian thực thi:           %.2fs\n", $elapsedTotal);
printf("  Tổng lượt Host đổi bài:       %d lượt\n", $totalHostSent);
printf("  Tỉ lệ Client nhận đủ sự kiện: %.1f%% (%d/%d clients nhận 100%%)\n", $deliveryRate, $clientSuccessCounts, $numClients);
printf("  Số lần Revision bị lùi:       %d lần\n", $totalRegressions);
printf("  Số lượng Cue bị trùng lặp:    %d lượt\n", $totalDuplicateCues);
printf("  Độ trễ p50 (median):          %.2f ms\n", $p50);
printf("  Độ trễ p95:                   %.2f ms\n", $p95);
printf("  Độ trễ tối đa (Max):          %.2f ms\n", $maxLat);
echo "--------------------------------------------------------\n";

// Dọn dẹp phòng sau test
foreach (glob(__DIR__ . "/../storage/data/live_sync/" . strtolower($room) . "*") as $f) {
    @unlink($f);
}
foreach (glob(__DIR__ . "/../storage/data/live_sync/" . strtoupper($room) . "*") as $f) {
    @unlink($f);
}

$isPass = ($deliveryRate >= 99.0 && $totalRegressions === 0 && $totalDuplicateCues === 0);

if ($isPass) {
    echo "KẾT LUẬN: ✅ LOAD TEST ĐẠT CHUẨN (PASS)\n";
    exit(0);
} else {
    echo "KẾT LUẬN: ❌ LOAD TEST CHƯA ĐẠT (FAIL)\n";
    exit(1);
}
