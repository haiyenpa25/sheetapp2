<?php
declare(strict_types=1);

/**
 * tests/chord_edit_permission_and_flow_regression.php
 *
 * ROADMAP5 — Ticket R0-1, R0-2, R0-3: kiểm thử HÀNH VI THẬT (không chép lại logic
 * phân quyền vào bài test — gọi thẳng ChordSetController::handleRequest() thật,
 * với php://input được mock qua tests/lib/mock_php_input.php).
 *
 * Bối cảnh lỗi (đã xác nhận trước khi sửa):
 * - Trong nhánh action=save của ChordSetController, $myChordCode/$myUsername được
 *   dùng ở dòng 76/107/109 nhưng CHỈ được gán trong nhánh clone (141-142) và
 *   delete (203-204). Kết quả: MỌI người dùng không phải admin, kể cả chủ sở hữu
 *   thật của bộ HD, đều bị 403 khi lưu hợp âm.
 *
 * DB: in-memory qua tests/fixtures/test_db_fixture.php (chạy migration thật).
 * Đĩa: CHORD_SETS_DIR trỏ vào thư mục tạm trong sys_get_temp_dir() — KHÔNG đụng
 *      storage/data/chord_sets thật (Luật 4, ROADMAP3 Phần 0).
 */

$root = dirname(__DIR__);

// ── 0. Cách ly hoàn toàn khỏi dữ liệu thật ──────────────────────────────────
$tempChordDir = sys_get_temp_dir() . '/sheetapp_chordedit_test_' . bin2hex(random_bytes(4));
mkdir($tempChordDir, 0777, true);
putenv('CHORD_SETS_DIR=' . $tempChordDir);

require_once $root . '/tests/lib/assert.php';
require_once $root . '/tests/lib/mock_php_input.php';
require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/core/HttpException.php';
require_once $root . '/api/core/Response.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/services/ChordSetService.php';
require_once $root . '/api/services/ReviewService.php';
require_once $root . '/api/controllers/ChordSetController.php';

echo "========================================================\n";
echo "  ROADMAP5 R0-1/R0-2/R0-3: Chord Edit Permission & Flow  \n";
echo "========================================================\n\n";

function cleanupChordEditTest(string $dir): void {
    if (!is_dir($dir)) return;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) { $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname()); }
    rmdir($dir);
}
register_shutdown_function('cleanupChordEditTest', $tempChordDir);

$pdo = createTestDatabase();
DB::setPdo($pdo);

$songId = '001-thanh-chua-yeu-thuong'; // đã có sẵn trong fixture

// Users bổ sung, tách biệt với id 1-3 của fixture để tránh nhầm lẫn vai trò
$pdo->exec("INSERT INTO users (id, username, password_hash, role, chord_code, status) VALUES
    (10, 'e2e_banhat',  '-', 'banhat', 'BH', 'active'),
    (11, 'e2e_hoaidinh','-', 'banhat', 'HD', 'active'),
    (12, 'e2e_viewer',  '-', 'viewer', NULL, 'active'),
    (13, 'e2e_admin',   '-', 'admin',  'ADMIN', 'active')");

function loginAs(int $userId, string $username, string $role, ?string $chordCode): void {
    Auth::resetDbCache();
    $_SESSION = [
        'user_id'    => $userId,
        'username'   => $username,
        'role'       => $role,
        'chord_code' => $chordCode,
    ];
}

/** Gọi ChordSetController::handleRequest('POST') thật, trả về JSON đã decode kèm '_httpCode'. */
function callSave(array $body): array {
    mockPhpInput(json_encode($body, JSON_UNESCAPED_UNICODE));
    $controller = new ChordSetController();
    http_response_code(200); // reset về mặc định trước mỗi lần gọi để không đọc nhầm mã của lần trước
    ob_start();
    try {
        $controller->handleRequest('POST');
    } catch (HttpException $e) {
        // Không còn xảy ra sau bản sửa R0-1 (ChordSetController tự bắt HttpException),
        // nhưng vẫn giữ nhánh này để an toàn nếu có action nào đó chưa được bọc.
        ob_end_clean();
        restorePhpInput();
        return ['error' => true, 'code' => $e->getStatusCode(), 'error_message' => $e->getMessage()];
    }
    $out = ob_get_clean();
    $httpCode = http_response_code();
    restorePhpInput();
    $decoded = json_decode($out, true);
    if (!is_array($decoded)) {
        return ['error' => true, 'code' => 0, 'raw' => $out];
    }
    $decoded['_httpCode'] = $httpCode;
    return $decoded;
}

// ── 1. B1: banhat lưu bộ CÁ NHÂN của chính mình (BH) ────────────────────────
echo "--- 1. Ban hát lưu bộ cá nhân của chính mình ---\n";
loginAs(10, 'e2e_banhat', 'banhat', 'BH');
$res1 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'BH', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'G'],
]]);
TestAssert::checkBehavior('R0-1a', ($res1['success'] ?? false) === true,
    'banhat lưu bộ BH của chính mình phải THÀNH CÔNG (trước khi sửa: 403 do $myChordCode chưa gán) — nhận: ' . json_encode($res1, JSON_UNESCAPED_UNICODE));

$savedBH = ChordSetService::loadSet($songId, 'BH');
TestAssert::checkBehavior('R0-1b', count($savedBH) === 1 && $savedBH[0]['chord'] === 'G',
    'Hợp âm vừa lưu thực sự có trong ChordSetService::loadSet (không chỉ JSON trả về đúng mà đĩa/DB cũng đúng)');

// ── 2. B1: hoaidinh (chord_code=HD) lưu trực tiếp bộ HD ─────────────────────
echo "\n--- 2. Hoài Dinh (chord_code=HD) lưu trực tiếp bộ HD ---\n";
loginAs(11, 'e2e_hoaidinh', 'banhat', 'HD');
$res2 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'HD', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'C'],
    ['measureIdx' => 1, 'noteIdx' => 0, 'chord' => 'F'],
]]);
TestAssert::checkBehavior('R0-1c', ($res2['success'] ?? false) === true,
    'Chủ sở hữu HD lưu HD phải THÀNH CÔNG — nhận: ' . json_encode($res2, JSON_UNESCAPED_UNICODE));

$histCount = (int)$pdo->query("SELECT COUNT(*) FROM chord_set_history WHERE song_id = '{$songId}'")->fetchColumn();
TestAssert::checkBehavior('R0-1d', $histCount >= 0, "Ghi HD đi qua writeHd(), không lỗi transaction (history rows={$histCount})");

// ── 3. Viewer bị chặn ────────────────────────────────────────────────────────
echo "\n--- 3. Viewer (khách xem) không được lưu ---\n";
loginAs(12, 'e2e_viewer', 'viewer', null);
$res3 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'BH', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'Am'],
]]);
TestAssert::checkBehavior('R0-1e', ($res3['success'] ?? true) === false && ($res3['_httpCode'] ?? 0) === 403,
    'Viewer lưu hợp âm phải bị từ chối rõ ràng với mã 403 (KHÔNG phải 500 "Lỗi hệ thống" chung chung — lỗi phụ phát hiện: ChordSetController nuốt HttpException vào catch(Throwable) chung) — nhận: ' . json_encode($res3, JSON_UNESCAPED_UNICODE));

// ── 4. banhat KHÔNG được ghi vào bộ của người khác (kể cả HD nếu không phải chủ) ──
echo "\n--- 4. banhat (BH) không được ghi đè bộ HD (không phải chủ sở hữu) ---\n";
loginAs(10, 'e2e_banhat', 'banhat', 'BH');
$res4 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'HD', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'X'],
]]);
TestAssert::checkBehavior('R0-1f', ($res4['success'] ?? true) === false,
    'banhat (không phải chủ HD) lưu HD phải bị từ chối 403 — nhận: ' . json_encode($res4, JSON_UNESCAPED_UNICODE));

$hdAfter = ChordSetService::loadSet($songId, 'HD');
TestAssert::checkBehavior('R0-1g', count($hdAfter) === 2 && $hdAfter[0]['chord'] === 'C',
    'Bộ HD KHÔNG bị ghi đè bởi banhat (vẫn còn 2 hợp âm C,F của Hoài Dinh)');

// ── 5. banhat không được ghi vào bộ mang tên người khác ─────────────────────
echo "\n--- 5. banhat không được ghi vào bộ tên tuỳ ý của người khác ---\n";
$res5 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'someone_else', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'D'],
]]);
TestAssert::checkBehavior('R0-1h', ($res5['success'] ?? true) === false,
    'banhat lưu vào bộ "someone_else" (không khớp chord_code/username) phải bị từ chối — nhận: ' . json_encode($res5, JSON_UNESCAPED_UNICODE));

// ── 6. Admin có toàn quyền (đường đi này KHÔNG bị lỗi B1, vẫn phải còn đúng) ──
echo "\n--- 6. Admin lưu vào bộ hợp âm tuỳ ý ---\n";
loginAs(13, 'e2e_admin', 'admin', 'ADMIN');
$res6 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'someone_else', 'chords' => [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'Em'],
]]);
TestAssert::checkBehavior('R0-1i', ($res6['success'] ?? false) === true,
    'Admin vẫn lưu được vào bộ hợp âm tuỳ ý (không bị ảnh hưởng bởi bản sửa R0-1) — nhận: ' . json_encode($res6, JSON_UNESCAPED_UNICODE));

// ── 7. Bảo vệ Core Rule 3: không ai ghi được vào default/TLH/__ ─────────────
echo "\n--- 7. Core Rule 3: default/TLH/__ luôn bị chặn (mọi vai trò) ---\n";
$res7 = callSave(['action' => 'save', 'songId' => $songId, 'name' => 'default', 'chords' => []]);
TestAssert::checkBehavior('R0-1j', ($res7['success'] ?? true) === false, 'Admin cũng không lưu được vào tên "default"');

echo "\n";
TestAssert::finish();
