<?php
/**
 * api/omr_worker.php
 * Trình chạy ngầm xử lý OMR — gọi Docker OMR Engine qua HTTP.
 *
 * Luồng:
 *   1. Nhận job_id từ argv
 *   2. POST http://localhost:5555/process → OMR Engine xử lý async
 *   3. Polling status mỗi 5 giây (timeout 10 phút)
 *   4. Khi completed → copy file XML ra, cập nhật DB
 *   5. Khi error    → cập nhật DB status = error
 *
 * Cách gọi: php api/omr_worker.php <job_id>
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/core/DB.php';
$pdo = DB::get();

$job_id = $argv[1] ?? null;
if (!$job_id) {
    die("Thiếu Job ID\n");
}

require_once __DIR__ . '/core/Config.php';

define('WORKSPACE_DIR', __DIR__ . '/../storage/omr_workspace/');
define('OMR_ENGINE_URL', Config::get('OMR_ENGINE_URL', 'http://localhost:5555'));
define('POLL_INTERVAL', 5);      // Polling mỗi 5 giây
define('MAX_WAIT', 600);         // Tối đa 10 phút

// ── Ghi log helper ────────────────────────────────────────────────────────────
function log_job(string $job_id, string $msg): void {
    $ts = date('H:i:s');
    file_put_contents(
        WORKSPACE_DIR . $job_id . '_worker.log',
        "[$ts] $msg\n",
        FILE_APPEND | LOCK_EX
    );
    echo "[$ts] $msg\n";
}

// ── HTTP helper (không dùng curl để tránh extension dependency) ───────────────
function http_post(string $url, array $data): ?array {
    $json = json_encode($data);
    $ctx  = stream_context_create([
        'http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\nContent-Length: " . strlen($json) . "\r\n",
            'content'       => $json,
            'timeout'       => 15,
            'ignore_errors' => true,
        ],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) return null;
    return json_decode($res, true);
}

function http_get(string $url): ?array {
    $ctx = stream_context_create([
        'http' => ['timeout' => 10, 'ignore_errors' => true],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) return null;
    return json_decode($res, true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

try {
    // ── 1. Kiểm tra job tồn tại trong DB ──────────────────────────────────────
    $stmt = $pdo->prepare("SELECT * FROM omr_workspace WHERE id = ? AND status = 'waiting'");
    $stmt->execute([$job_id]);
    $job = $stmt->fetch();

    if (!$job) {
        die("Không tìm thấy job hoặc đã xử lý: $job_id\n");
    }

    $ext = strtolower(pathinfo($job['original_filename'], PATHINFO_EXTENSION));

    // ── 2. Đánh dấu processing ─────────────────────────────────────────────────
    $pdo->prepare("UPDATE omr_workspace SET status = 'processing' WHERE id = ?")
        ->execute([$job_id]);
    log_job($job_id, "Job started (ext=$ext)");

    // ── 3. Kiểm tra OMR Engine sống không ────────────────────────────────────
    $health = http_get(OMR_ENGINE_URL . '/health');
    if (!$health || ($health['status'] ?? '') !== 'ok') {
        throw new RuntimeException("OMR Engine không phản hồi tại " . OMR_ENGINE_URL . ". Kiểm tra Docker container sheetapp-omr.");
    }
    log_job($job_id, "OMR Engine OK — homr: " . ($health['homr_available'] ? 'yes' : 'no'));

    // ── 4. Gửi job cho OMR Engine ─────────────────────────────────────────────
    $response = http_post(OMR_ENGINE_URL . '/process', [
        'job_id' => $job_id,
        'ext'    => $ext,
    ]);

    if (!$response || ($response['status'] ?? '') !== 'processing') {
        throw new RuntimeException("OMR Engine từ chối job: " . json_encode($response));
    }
    log_job($job_id, "OMR Engine nhận job, bắt đầu xử lý...");

    // ── 5. Polling kết quả ────────────────────────────────────────────────────
    $elapsed = 0;
    $last_step = '';

    while ($elapsed < MAX_WAIT) {
        sleep(POLL_INTERVAL);
        $elapsed += POLL_INTERVAL;

        $status = http_get(OMR_ENGINE_URL . '/status/' . $job_id);
        if (!$status) {
            log_job($job_id, "Polling lỗi (elapsed={$elapsed}s), thử lại...");
            continue;
        }

        $step = $status['step'] ?? '';
        if ($step !== $last_step) {
            log_job($job_id, "Step: $step (elapsed={$elapsed}s)");
            $last_step = $step;
        }

        $jobStatus = $status['status'] ?? 'processing';

        if ($jobStatus === 'completed') {
            // ── 6. Job hoàn tất ────────────────────────────────────────────────
            $outputFile = $status['output_file'] ?? ($job_id . '.mxl');
            $xmlPath = WORKSPACE_DIR . $outputFile;

            if (!file_exists($xmlPath)) {
                throw new RuntimeException("Output file không tồn tại: $xmlPath");
            }

            $pages = $status['pages_processed'] ?? 1;
            log_job($job_id, "Completed! Pages=$pages, output=$outputFile");

            $pdo->prepare("UPDATE omr_workspace SET status = 'completed', musicxml_path = ? WHERE id = ?")
                ->execute([$outputFile, $job_id]);

            log_job($job_id, "DB updated. Done!");
            exit(0);
        }

        if ($jobStatus === 'error') {
            $errMsg = $status['error'] ?? 'Unknown error';
            throw new RuntimeException("OMR Engine báo lỗi: $errMsg");
        }

        // Vẫn đang xử lý — tiếp tục chờ
        if (isset($status['current_page'], $status['total_pages'])) {
            $cur   = $status['current_page'];
            $total = $status['total_pages'];
            if ($cur !== ($last_step)) {
                log_job($job_id, "  → Page $cur/$total");
            }
        }
    }

    // Timeout
    throw new RuntimeException("Timeout sau " . MAX_WAIT . " giây — bài nhạc quá dài hoặc engine bị treo");

} catch (Exception $e) {
    $errMsg = $e->getMessage();
    log_job($job_id ?? 'unknown', "ERROR: $errMsg");

    if (isset($pdo) && $job_id) {
        $pdo->prepare("UPDATE omr_workspace SET status = 'error' WHERE id = ?")
            ->execute([$job_id]);
        file_put_contents(WORKSPACE_DIR . $job_id . '_error.txt', $errMsg);
    }
    exit(1);
}
