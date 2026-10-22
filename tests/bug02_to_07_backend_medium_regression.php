<?php
declare(strict_types=1);

/**
 * tests/bug02_to_07_backend_medium_regression.php
 * Behavioral regression suite for Backend Medium bugs (BUG-02..BUG-07):
 * - BUG-02: ReviewService::submit & ReviewActionHelper::approve reject update_hd for song_version or invalid chord snapshot
 * - BUG-03: SongService::delete succeeds without TypeError when song has existing XML file and storage/uploads is missing, preserving master library XML
 * - BUG-04: Logged-in viewer reads setlists/offline_package via public view (no drafts, no assignments)
 * - BUG-05: ArrangementService::saveArrangement rejects arrangement id or section_id belonging to another song (IDOR)
 * - BUG-06: PracticeController leader_view requires view_team_progress (403 for banhat) and PracticeService::getLeaderView hides user_id/role/metrics for non-consenting members
 * - BUG-07: PracticeAssignmentService::createFromServicePlan adds targets and notifies newly assigned members on subsequent runs without re-notifying existing targets
 */

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/core/HttpException.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/ArrangementService.php';
require_once __DIR__ . '/../api/services/PracticeService.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentService.php';
require_once __DIR__ . '/../api/controllers/SetlistController.php';
require_once __DIR__ . '/../api/controllers/PracticeController.php';

$tempChordDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sheetapp_bug02_07_chords_' . uniqid();
@mkdir($tempChordDir, 0755, true);
putenv("CHORD_SETS_DIR={$tempChordDir}");
putenv("SHEETAPP_CHORD_SETS_DIR={$tempChordDir}");
$_ENV['CHORD_SETS_DIR'] = $tempChordDir;
$_ENV['SHEETAPP_CHORD_SETS_DIR'] = $tempChordDir;

$tempXmlRel = 'storage/Thanh ca/test_bug03_temp_' . uniqid() . '.xml';
$tempXmlAbs = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $tempXmlRel);
@file_put_contents($tempXmlAbs, '<score-partwise version="3.1"><part id="P1"><measure number="1"/></part></score-partwise>');

register_shutdown_function(static function () use ($tempChordDir, $tempXmlAbs): void {
    if (is_file($tempXmlAbs)) @unlink($tempXmlAbs);
    if (is_dir($tempChordDir)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempChordDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) {
            if ($f->isDir()) @rmdir($f->getPathname());
            else @unlink($f->getPathname());
        }
        @rmdir($tempChordDir);
    }
});

$pdo = createTestDatabase();
DB::setPdo($pdo);
Auth::resetDbCache();

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$pdo->exec("INSERT INTO users (id, username, password_hash, role, display_name, voice_part, consent_practice_share, status) VALUES
    (10, 'leader_u', 'hash', 'leader', 'Ca Trưởng', 'T', 1, 'active'),
    (11, 'banhat_1', 'hash', 'banhat', 'Ca Viên 1', 'S', 1, 'active'),
    (12, 'banhat_2', 'hash', 'banhat', 'Ca Viên 2', 'A', 0, 'active')
");

$passed = 0;
$failed = 0;

function check(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        echo "[PASS:B] {$label}\n";
        $passed++;
    } else {
        echo "[FAIL:B] {$label}\n";
        $failed++;
    }
}

$songA = '001-thanh-chua-yeu-thuong';
$songB = '002-ngoi-khen-chua';

// ── BUG-02: update_hd with target_type = song_version ──────────────────
$_SESSION = ['user_id' => 11, 'username' => 'banhat_1', 'role' => 'banhat'];
Auth::resetDbCache();
ChordSetService::saveSet($songA, 'HD', [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'F']], 1, 'admin');
$pdo->prepare("INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json, review_status) VALUES (50, ?, 11, 'banhat_1', 'Set50', '[{\"measureIdx\":0,\"noteIdx\":0,\"chord\":\"C\"}]', 'none')")
    ->execute([$songA]);
$pdo->prepare("INSERT INTO song_versions (id, song_id, user_id, username, version_name, version_slug, xml_path) VALUES (50, ?, 11, 'banhat_1', 'Ver50', 'ver-50', 'storage/users/v50.xml')")
    ->execute([$songA]);

$submitRejected = false;
try {
    ReviewService::submit(11, 'song_version', 50, $songA, 'update_hd', 'Try invalid combo');
} catch (Throwable $e) {
    $submitRejected = true;
}
check($submitRejected, 'BUG-02: ReviewService::submit từ chối cặp target_type=song_version + review_type=update_hd');

// Insert corrupted review_request directly into DB and attempt approve as leader
$pdo->prepare("INSERT INTO review_requests (id, target_type, target_id, song_id, review_type, base_snapshot_json, proposed_snapshot_json, submitted_by, status) VALUES (900, 'song_version', 50, ?, 'update_hd', '[]', '{\"xml_path\":\"storage/users/v50.xml\",\"version_name\":\"Ver50\"}', 11, 'pending')")
    ->execute([$songA]);
$_SESSION = ['user_id' => 10, 'username' => 'leader_u', 'role' => 'leader'];
Auth::resetDbCache();
$approveRejected = false;
try {
    ReviewActionHelper::approve(900, 10, 'Try approve');
} catch (Throwable $e) {
    $approveRejected = true;
}
$hdAfter = ChordSetService::loadSet($songA, 'HD');
$set50Status = $pdo->query("SELECT review_status FROM user_chord_sets WHERE id = 50")->fetchColumn();
check(
    $approveRejected && ($hdAfter[0]['chord'] ?? '') === 'F' && $set50Status === 'none',
    'BUG-02: ReviewActionHelper::approve chặn update_hd cho song_version, giữ nguyên HD và không chạm user_chord_sets có cùng ID'
);

// ── BUG-03: SongService::delete with existing XML file ─────────────────
$_SESSION = ['user_id' => 1, 'username' => 'admin', 'role' => 'admin'];
Auth::resetDbCache();
$delSongId = 'test-bug03-song';
SongService::add(['id' => $delSongId, 'title' => 'Bài Xóa Test BUG-03', 'xmlPath' => $tempXmlRel, 'category_id' => 1]);
$delRes = [];
try {
    $delRes = SongService::delete($delSongId);
} catch (Throwable $e) {
    $delRes = ['success' => false, 'error' => $e->getMessage()];
}
$rowStillExists = (bool)$pdo->query("SELECT 1 FROM songs WHERE id = '{$delSongId}'")->fetchColumn();
check(
    ($delRes['success'] ?? false) === true && !$rowStillExists && is_file($tempXmlAbs),
    'BUG-03: SongService::delete xóa bài có XML thành công (không lỗi 500) và bảo toàn file XML trong storage/Thanh ca/'
);

// ── BUG-04: Viewer reads setlists as public (no drafts, no assignments) ─
$draftPlanId = SetlistService::create(['title' => 'Nháp Nội Bộ', 'scheduled_date' => '2026-11-01', 'status' => 'draft', 'created_by' => 1]);
$pubPlanId   = SetlistService::create(['title' => 'Lễ Công Bố', 'scheduled_date' => '2026-11-08', 'status' => 'published', 'created_by' => 1]);
SetlistService::addItem($pubPlanId, $songA, 'HD', 0, 80);
SetlistService::assignUser($pubPlanId, 11, 'Ca viên', 'Ghi chú nội bộ', 1);

$_SESSION = ['user_id' => 3, 'username' => 'viewer', 'role' => 'viewer'];
Auth::resetDbCache();
$ctrl = new SetlistController();

$_GET = [];
ob_start();
$ctrl->handleRequest('GET');
$listJson = json_decode((string)ob_get_clean(), true);
$viewerListIds = array_map('intval', array_column($listJson['data'] ?? [], 'id'));
check(
    !in_array($draftPlanId, $viewerListIds, true) && in_array($pubPlanId, $viewerListIds, true),
    'BUG-04: Viewer gọi GET /api/setlists chỉ thấy chương trình published, không thấy bản draft'
);

$_GET = ['id' => (string)$draftPlanId];
ob_start();
$ctrl->handleRequest('GET');
$draftDetailJson = json_decode((string)ob_get_clean(), true);
check(($draftDetailJson['success'] ?? true) === false, 'BUG-04: Viewer gọi GET /api/setlists?id=<draft> bị từ chối (404)');

$_GET = ['id' => (string)$pubPlanId];
ob_start();
$ctrl->handleRequest('GET');
$pubDetailJson = json_decode((string)ob_get_clean(), true);
check(
    ($pubDetailJson['success'] ?? false) === true && !isset($pubDetailJson['data']['assignments']),
    'BUG-04: Viewer gọi GET /api/setlists?id=<published> không nhận danh sách phân công nội bộ (assignments)'
);

$_GET = ['action' => 'offline_package', 'id' => (string)$draftPlanId];
ob_start();
$ctrl->handleRequest('GET');
$draftPkgJson = json_decode((string)ob_get_clean(), true);
check(($draftPkgJson['success'] ?? true) === false, 'BUG-04: Viewer không tải được offline_package của chương trình draft');

// ── BUG-05: ArrangementService::saveArrangement IDOR ───────────────────
$secA = ArrangementService::upsertSection(['song_id' => $songA, 'name' => 'Intro A', 'type' => 'intro', 'start_measure' => 1, 'end_measure' => 4]);
$secB = ArrangementService::upsertSection(['song_id' => $songB, 'name' => 'Intro B', 'type' => 'intro', 'start_measure' => 1, 'end_measure' => 4]);
$arrB = ArrangementService::saveArrangement($songB, ['name' => 'Roadmap B'], [['section_id' => $secB, 'repeat_count' => 2]]);

$idorArrRejected = false;
try {
    ArrangementService::saveArrangement($songA, ['id' => $arrB, 'name' => 'Overwrite B'], [['section_id' => $secA, 'repeat_count' => 1]]);
} catch (Throwable $e) {
    $idorArrRejected = true;
}
$stepsBAfter = ArrangementService::getArrangementSteps($arrB);
check(
    $idorArrRejected && count($stepsBAfter) === 1 && (int)$stepsBAfter[0]['section_id'] === $secB,
    'BUG-05: ArrangementService::saveArrangement chặn sửa/xóa steps của kịch bản thuộc bài hát khác (IDOR)'
);

$idorSecRejected = false;
try {
    ArrangementService::saveArrangement($songA, ['name' => 'Roadmap A with B sec'], [['section_id' => $secB, 'repeat_count' => 1]]);
} catch (Throwable $e) {
    $idorSecRejected = true;
}
check($idorSecRejected, 'BUG-05: ArrangementService::saveArrangement từ chối section_id thuộc bài hát khác');

// ── BUG-06: PracticeController leader_view & PracticeService consent ───
$_SESSION = ['user_id' => 11, 'username' => 'banhat_1', 'role' => 'banhat'];
Auth::resetDbCache();
$_GET = ['action' => 'leader_view'];
$pracCtrl = new PracticeController();
$banhatForbidden = false;
try {
    ob_start();
    $pracCtrl->handleRequest('GET');
    $pracOut = json_decode((string)ob_get_clean(), true);
    if (($pracOut['success'] ?? true) === false) $banhatForbidden = true;
} catch (HttpException $e) {
    ob_end_clean();
    $banhatForbidden = ($e->getStatusCode() === 403);
}
check($banhatForbidden, 'BUG-06: Ban Hát thường bị chặn (403) khi gọi action=leader_view');

// Create practice session for non-consenting user 12
$s12 = PracticeService::startSession(12, $songA, 'piano', 80);
PracticeService::finishSession((int)$s12['session_id'], 180, 88, 92.0, 40, 37);

$lv = PracticeService::getLeaderView(10);
$leakedNoConsent = false;
foreach ($lv['members'] ?? [] as $m) {
    if (($m['has_consent'] ?? true) === false) {
        if (!empty($m['user_id']) || !empty($m['role']) || !empty($m['sessions_count']) || !empty($m['total_minutes']) || !empty($m['avg_accuracy'])) {
            $leakedNoConsent = true;
        }
    }
}
check(!$leakedNoConsent, 'BUG-06: PracticeService::getLeaderView ẩn hoàn toàn user_id, role và các chỉ số tập của thành viên tắt chia sẻ');

// ── BUG-07: createFromServicePlan subsequent run adds late assignees ───
$plan7 = SetlistService::create(['title' => 'Lễ BUG-07', 'scheduled_date' => '2026-11-15', 'status' => 'draft', 'created_by' => 10]);
SetlistService::addItem($plan7, $songA, 'HD', 0, 84);
SetlistService::assignUser($plan7, 11, 'Ca viên S', null, 10);

$firstRun = PracticeAssignmentService::createFromServicePlan($plan7, 10);
$assign7Id = (int)($firstRun['assignments'][0] ?? 0);
$notifCountAfter1 = (int)$pdo->query("SELECT COUNT(*) FROM domain_events WHERE type = 'practice.assigned' AND subject_id = '{$assign7Id}'")->fetchColumn();

// Now assign user 12 to the same plan and run createFromServicePlan again
SetlistService::assignUser($plan7, 12, 'Ca viên A', null, 10);
PracticeAssignmentService::createFromServicePlan($plan7, 10);

$target12Exists = (bool)$pdo->query("SELECT 1 FROM practice_assignment_targets WHERE assignment_id = {$assign7Id} AND user_id = 12")->fetchColumn();
$eventsAfter2 = $pdo->query("SELECT payload_json FROM domain_events WHERE type = 'practice.assigned' AND subject_id = '{$assign7Id}' ORDER BY id ASC")->fetchAll(PDO::FETCH_COLUMN);
$secondEventUsers = isset($eventsAfter2[1]) ? (json_decode((string)$eventsAfter2[1], true)['user_ids'] ?? []) : [];

check(
    $target12Exists && count($eventsAfter2) === 2 && $secondEventUsers === [12],
    'BUG-07: createFromServicePlan lần 2 gán target cho người mới phân công và chỉ phát thông báo cho người mới'
);

echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed={$passed} failed={$failed}\n";
exit($failed > 0 ? 1 : 0);
