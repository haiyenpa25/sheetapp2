<?php
/**
 * tests/review_workflow_regression.php
 *
 * Kiểm thử hồi quy toàn diện cho Epic 4.2 — Quy trình duyệt bộ hợp âm & Visual Diff:
 * 1. Schema CSDL Migration 011 (review_requests, chord_set_history, columns & indexes).
 * 2. Diff Engine: ReviewDiffEngine (normalized chords, added, modified, removed, unchanged, summaries).
 * 3. Submission Workflow: Submit request, snapshot creation, review_status = 'pending', auto-supersede.
 * 4. RBAC Controls: Viewer/Banhat không thể approve/reject (DomainException), Leader/Admin duyệt thành công.
 * 5. Approval Workflow (recommend): Gắn is_recommended = 1, cập nhật review_status = 'approved', gửi notification.
 * 6. Core Rule 1 & 4 (update_hd & rollback):
 *    - Chặn cập nhật mảng hợp âm rỗng vào HD.
 *    - Ghi snapshot lịch sử vào chord_set_history trước khi cập nhật HD.
 *    - Cập nhật HD thành công.
 *    - Hoàn tác Rollback khôi phục bản HD trước đó chính xác 100%.
 * 7. Rejection Workflow: Bắt buộc có lý do từ chối (note), cập nhật review_status = 'rejected', gửi notification.
 * 8. Withdrawal Workflow: Tác giả tự rút đề xuất pending, người khác không được rút.
 * 9. Anti-Bypass Guard: ManagerService::toggleRecommend chặn người không có quyền review_chord_set.
 */

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/AuditLogger.php';
require_once __DIR__ . '/../api/core/MigrationRunner.php';
require_once __DIR__ . '/../api/services/ReviewDiffEngine.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';
require_once __DIR__ . '/../api/services/NotificationService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';

$failures = [];
$totalChecks = 0;

function check(bool $cond, string $msg, array &$failures, int &$totalChecks): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    $totalChecks++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

function loginAs(int $id, string $username, string $role, string $displayName = ''): void {
    $_SESSION['user_id'] = $id;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $role;
    $_SESSION['display_name'] = $displayName ?: $username;
}

echo "=== KIỂM THỬ HỒI QUY QUY TRÌNH DUYỆT & DIFF ENGINE (EPIC 4.2) ===\n\n";

// ── 1. Khởi tạo In-Memory Database với đầy đủ Schema ──
echo "[1/8] Kiểm tra Schema Migration 011 & CSDL SQLite In-Memory...\n";
$db = createTestDatabase();
DB::setPdo($db);

$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
check(in_array('review_requests', $tables, true), 'Bảng review_requests tồn tại trong CSDL', $failures, $totalChecks);
check(in_array('chord_set_history', $tables, true), 'Bảng chord_set_history tồn tại trong CSDL', $failures, $totalChecks);

// Kiểm tra cột review_status
$userChordCols = $db->query("PRAGMA table_info(user_chord_sets)")->fetchAll(PDO::FETCH_ASSOC);
$colNamesChords = array_column($userChordCols, 'name');
check(in_array('review_status', $colNamesChords, true), 'Bảng user_chord_sets có cột review_status', $failures, $totalChecks);
check(in_array('approved_by', $colNamesChords, true), 'Bảng user_chord_sets có cột approved_by', $failures, $totalChecks);

$songVerCols = $db->query("PRAGMA table_info(song_versions)")->fetchAll(PDO::FETCH_ASSOC);
$colNamesVers = array_column($songVerCols, 'name');
check(in_array('review_status', $colNamesVers, true), 'Bảng song_versions có cột review_status', $failures, $totalChecks);

// Seed thêm user Leader & Banhat & Song test
$db->exec("
    INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, status) VALUES
    (4, 'leader_user', 'hash', 'leader', 'Ca Trưởng Hải', 'active'),
    (5, 'banhat_user', 'hash', 'banhat', 'Ban Hát Nam', 'active');
    
    INSERT OR IGNORE INTO songs (id, title, httlvnId, xmlPath, defaultKey, category_id) VALUES
    ('test-song-rev', 'Bài Ca Thử Nghiệm Duyệt', 999, 'storage/Thanh ca/999.xml', 'C', 1);
");

// ── 2. Kiểm tra Diff Engine (ReviewDiffEngine) ──
echo "\n[2/8] Kiểm tra Engine So Sánh Khác Biệt (ReviewDiffEngine)...\n";
$baseChords = [
    ['measure' => 0, 'note' => 0, 'chord' => 'C'],
    ['measure' => 1, 'note' => 0, 'chord' => 'F'],
    ['measure' => 2, 'note' => 0, 'chord' => 'G']
];

$proposedChords = [
    ['measure' => 0, 'note' => 0, 'chord' => 'Cmaj7'], // modified
    ['measure' => 1, 'note' => 0, 'chord' => 'F'],     // unchanged
    ['measure' => 1, 'note' => 2, 'chord' => 'Dm'],    // added
    // measure 2 note 0 (G) đã bị xóa (removed)
];

$diff = ReviewDiffEngine::diffChordSets($baseChords, $proposedChords);
check(isset($diff['summary'], $diff['changes']), 'DiffEngine trả về cấu trúc gồm summary và changes', $failures, $totalChecks);

$summary = $diff['summary'];
check($summary['added_count'] === 1, 'Phát hiện chính xác 1 hợp âm thêm mới (Dm)', $failures, $totalChecks);
check($summary['modified_count'] === 1, 'Phát hiện chính xác 1 hợp âm sửa đổi (C -> Cmaj7)', $failures, $totalChecks);
check($summary['removed_count'] === 1, 'Phát hiện chính xác 1 hợp âm bị xóa (G)', $failures, $totalChecks);
check($summary['unchanged_count'] === 1, 'Phát hiện chính xác 1 hợp âm giữ nguyên (F)', $failures, $totalChecks);
check($summary['total_changes'] === 3, 'Tổng số thay đổi = 3', $failures, $totalChecks);

// Test trường hợp hai bản giống nhau
$identicalDiff = ReviewDiffEngine::diffChordSets($baseChords, $baseChords);
check($identicalDiff['summary']['total_changes'] === 0, 'Hai bộ hợp âm giống nhau cho total_changes = 0', $failures, $totalChecks);
check($identicalDiff['summary']['unchanged_count'] === 3, 'Tất cả 3 nốt đều là unchanged', $failures, $totalChecks);

// ── 3. Kiểm tra Gửi Đề Xuất (ReviewService::submit) ──
echo "\n[3/8] Kiểm tra Nộp Đề Xuất Phê Duyệt (ReviewService::submit)...\n";

// Tạo một user chord set cho member (user_id = 3)
$db->exec("
    INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json, chord_count, is_public, review_status)
    VALUES (101, 'test-song-rev', 3, 'member', 'Bản Phối Ballad', '" . json_encode($proposedChords) . "', 3, 1, 'draft')
");

// Giả lập user 3 (member) đăng nhập
loginAs(3, 'member', 'viewer', 'Thành Viên');

$submitRes = ReviewService::submit(
    3,
    'chord_set',
    101,
    'test-song-rev',
    'recommend',
    'Kính nhờ Ca Trưởng duyệt bản phối đệm này cho ban hát'
);

check($submitRes['success'] === true, 'Member submit review request thành công', $failures, $totalChecks);
$requestId = $submitRes['request_id'];
check($requestId > 0, "Đã tạo review_requests record với ID = {$requestId}", $failures, $totalChecks);

// Kiểm tra trạng thái trong DB
$req = $db->query("SELECT * FROM review_requests WHERE id = {$requestId}")->fetch(PDO::FETCH_ASSOC);
check($req['status'] === 'pending', 'Trạng thái đề xuất là pending', $failures, $totalChecks);
check($req['review_type'] === 'recommend', 'Loại đề xuất là recommend', $failures, $totalChecks);

$setRow = $db->query("SELECT review_status FROM user_chord_sets WHERE id = 101")->fetch(PDO::FETCH_ASSOC);
check($setRow['review_status'] === 'pending', 'user_chord_sets.review_status được cập nhật sang pending', $failures, $totalChecks);

// Kiểm tra Domain Events được ghi nhận
$event = $db->query("SELECT * FROM domain_events WHERE type = 'review.submitted' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($event), 'Sự kiện domain_events review.submitted đã được ghi nhận', $failures, $totalChecks);

// Test auto-supersede: Nộp đề xuất mới cho cùng target sẽ làm đề xuất cũ bị superseded
$submitRes2 = ReviewService::submit(
    3,
    'chord_set',
    101,
    'test-song-rev',
    'update_hd',
    'Cập nhật lại bản hoàn chỉnh hơn'
);
$reqOld = $db->query("SELECT status FROM review_requests WHERE id = {$requestId}")->fetch(PDO::FETCH_ASSOC);
check($reqOld['status'] === 'superseded', 'Đề xuất pending cũ được tự động chuyển thành superseded', $failures, $totalChecks);
$activeRequestId = $submitRes2['request_id'];

// ── 4. Kiểm tra Phân Quyền RBAC Phê Duyệt / Từ Chối ──
echo "\n[4/8] Kiểm tra RBAC (Chỉ Leader & Admin có quyền duyệt)...\n";

// Viewer (id=3) thử duyệt -> phải bị từ chối
loginAs(3, 'member', 'viewer');
$viewerDenied = false;
try {
    ReviewService::approve($activeRequestId, 3, 'Duyệt thử');
} catch (DomainException $e) {
    $viewerDenied = true;
}
check($viewerDenied, 'Viewer không có quyền approve (bị chặn DomainException)', $failures, $totalChecks);

// Banhat thông thường (chưa có policy review) thử duyệt -> phải bị từ chối
loginAs(5, 'banhat_user', 'banhat');
$banhatDenied = false;
try {
    ReviewService::approve($activeRequestId, 5, 'Ban hát tự duyệt');
} catch (DomainException $e) {
    $banhatDenied = true;
}
check($banhatDenied, 'Banhat thông thường không có quyền approve (bị chặn DomainException)', $failures, $totalChecks);

// ── 5. Kiểm tra Phê Duyệt Ghim Khuyên Dùng (recommend) ──
echo "\n[5/8] Kiểm tra Phê Duyệt Recommend (Leader/Admin)...\n";

// Tạo một đề xuất recommend mới
loginAs(3, 'member', 'viewer');
$recSubmit = ReviewService::submit(
    3,
    'chord_set',
    101,
    'test-song-rev',
    'recommend',
    'Xin gắn huy hiệu khuyên dùng'
);
$recReqId = $recSubmit['request_id'];

// Leader (id=4) duyệt đề xuất này
loginAs(4, 'leader_user', 'leader', 'Ca Trưởng Hải');
$appRes = ReviewService::approve($recReqId, 4, 'Bản phối hợp âm rất chuẩn mực, biểu diễn tốt!');
check($appRes['success'] === true, 'Leader phê duyệt đề xuất recommend thành công', $failures, $totalChecks);

// Kiểm tra user_chord_sets đã được ghim is_recommended = 1
$setUpdated = $db->query("SELECT is_recommended, review_status, approved_by FROM user_chord_sets WHERE id = 101")->fetch(PDO::FETCH_ASSOC);
check((int)$setUpdated['is_recommended'] === 1, 'user_chord_sets.is_recommended = 1', $failures, $totalChecks);
check($setUpdated['review_status'] === 'approved', 'user_chord_sets.review_status = approved', $failures, $totalChecks);
check((int)$setUpdated['approved_by'] === 4, 'approved_by = 4 (Leader)', $failures, $totalChecks);

// Kiểm tra thông báo in-app gửi tới tác giả đề xuất (user 3)
$notif = $db->query("SELECT * FROM notifications WHERE user_id = 3 AND title LIKE '%phê duyệt%' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($notif), 'Đã gửi thông báo in-app phê duyệt tới tác giả', $failures, $totalChecks);

// ── 6. Kiểm tra Core Rule 1 & Core Rule 4 (update_hd & Rollback) ──
echo "\n[6/8] Kiểm tra Cập Nhật Bản HD & Hoàn Tác Snapshot (CR1 & CR4)...\n";

// Chuẩn bị môi trường file HD cho bài test-song-rev
$testSongSafe = 'test-song-rev';
$hdDir = ChordSetService::getBaseDir() . '/' . $testSongSafe;
if (!is_dir($hdDir)) @mkdir($hdDir, 0755, true);
$hdFile = $hdDir . '/HD.json';

// Ghi bản HD gốc ban đầu
$initialHdChords = [
    ['measure' => 0, 'note' => 0, 'chord' => 'C'],
    ['measure' => 1, 'note' => 0, 'chord' => 'F'],
    ['measure' => 2, 'note' => 0, 'chord' => 'G']
];
file_put_contents($hdFile, json_encode($initialHdChords, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// Tạo bộ hợp âm đề xuất update_hd
$newHdChords = [
    ['measure' => 0, 'note' => 0, 'chord' => 'C'],
    ['measure' => 1, 'note' => 0, 'chord' => 'Fmaj7'],
    ['measure' => 2, 'note' => 0, 'chord' => 'G7'],
    ['measure' => 3, 'note' => 0, 'chord' => 'C']
];
$db->exec("
    INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json, chord_count, is_public, review_status)
    VALUES (102, 'test-song-rev', 3, 'member', 'Đề xuất nâng cấp HD', '" . json_encode($newHdChords) . "', 4, 1, 'draft')
");

loginAs(3, 'member', 'viewer');
$hdSubmit = ReviewService::submit(
    3,
    'chord_set',
    102,
    'test-song-rev',
    'update_hd',
    'Bổ sung hợp âm ô nhịp 3 kết bài chuẩn hơn'
);
$hdReqId = $hdSubmit['request_id'];

// Admin (id=1) duyệt cập nhật HD
loginAs(1, 'admin', 'admin', 'Quản Trị Viên');
$approveHdRes = ReviewService::approve($hdReqId, 1, 'Đồng ý nâng cấp bản HD chính thức');
check($approveHdRes['success'] === true, 'Admin duyệt đề xuất update_hd thành công', $failures, $totalChecks);

// Kiểm tra file HD.json trên đĩa đã được cập nhật nội dung mới
$currentHdContent = json_decode(file_get_contents($hdFile), true);
check(count($currentHdContent) === 4, 'Bản HD.json trên đĩa đã cập nhật đủ 4 hợp âm', $failures, $totalChecks);
check($currentHdContent[1]['chord'] === 'Fmaj7', 'Hợp âm ô nhịp 1 là Fmaj7', $failures, $totalChecks);

// Kiểm tra bản snapshot đã được lưu vào chord_set_history (CR4)
$history = $db->query("SELECT * FROM chord_set_history WHERE song_id = 'test-song-rev' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($history), 'Đã ghi snapshot vào bảng chord_set_history (CR4)', $failures, $totalChecks);
$historyChords = json_decode($history['chords_json'], true);
check(count($historyChords) === 3, 'Bản snapshot lịch sử lưu chính xác 3 hợp âm của bản HD cũ', $failures, $totalChecks);
$historyId = (int)$history['id'];

// Test Rollback: Hoàn tác bản HD về snapshot cũ
$rollbackRes = ReviewService::rollbackHd($historyId, 1);
check($rollbackRes['success'] === true, 'Rollback HD về snapshot thành công', $failures, $totalChecks);

$rolledBackHd = json_decode(file_get_contents($hdFile), true);
check(count($rolledBackHd) === 3, 'Sau khi rollback, HD.json khôi phục chuẩn xác 3 hợp âm cũ', $failures, $totalChecks);
check($rolledBackHd[1]['chord'] === 'F', 'Hợp âm ô nhịp 1 được khôi phục về F', $failures, $totalChecks);

// Dọn dẹp file test
@unlink($hdFile);
@rmdir($hdDir);

// ── 7. Kiểm tra Từ Chối Đề Xuất (ReviewService::reject) ──
echo "\n[7/8] Kiểm tra Từ Chối Đề Xuất Có Lý Do (ReviewService::reject)...\n";

// Nộp một đề xuất mới để test từ chối
loginAs(3, 'member', 'viewer');
$rejSubmit = ReviewService::submit(
    3,
    'chord_set',
    101,
    'test-song-rev',
    'recommend',
    'Nhờ duyệt lại'
);
$rejReqId = $rejSubmit['request_id'];

// Thử từ chối mà không có lý do -> phải throw InvalidArgumentException
loginAs(4, 'leader_user', 'leader');
$emptyNoteRejected = false;
try {
    ReviewService::reject($rejReqId, 4, '');
} catch (InvalidArgumentException $e) {
    $emptyNoteRejected = true;
}
check($emptyNoteRejected, 'Từ chối không có ghi chú lý do bị chặn lại', $failures, $totalChecks);

// Từ chối có lý do cụ thể
$rejRes = ReviewService::reject($rejReqId, 4, 'Hợp âm ô nhịp 2 bị chói giọng với bè Nữ, vui lòng chỉnh lại');
check($rejRes['success'] === true, 'Từ chối đề xuất thành công khi có lý do', $failures, $totalChecks);

$rejReq = $db->query("SELECT status, review_note FROM review_requests WHERE id = {$rejReqId}")->fetch(PDO::FETCH_ASSOC);
check($rejReq['status'] === 'rejected', 'review_requests.status = rejected', $failures, $totalChecks);
check(!empty($rejReq['review_note']), 'review_note được lưu lại trong DB', $failures, $totalChecks);

$setAfterRej = $db->query("SELECT review_status FROM user_chord_sets WHERE id = 101")->fetch(PDO::FETCH_ASSOC);
check($setAfterRej['review_status'] === 'rejected', 'user_chord_sets.review_status = rejected', $failures, $totalChecks);

// Kiểm tra notification gửi lý do từ chối về cho user 3
$rejNotif = $db->query("SELECT * FROM notifications WHERE user_id = 3 AND title LIKE '%chưa được duyệt%' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
check(!empty($rejNotif), 'Đã gửi thông báo từ chối kèm lý do tới tác giả', $failures, $totalChecks);

// ── 8. Rút Đề Xuất & Chặn Đường Tắt (Withdraw & Anti-Bypass Guard) ──
echo "\n[8/8] Kiểm tra Tác Giả Rút Đề Xuất & Chặn Đường Tắt (Anti-Bypass)...\n";

// Nộp một đề xuất pending để test rút
loginAs(3, 'member', 'viewer');
$withSubmit = ReviewService::submit(
    3,
    'chord_set',
    101,
    'test-song-rev',
    'recommend',
    'Tôi muốn tự rút lại đề xuất này'
);
$withReqId = $withSubmit['request_id'];

// User khác (id=5) cố rút -> bị chặn
loginAs(5, 'banhat_user', 'banhat');
$otherWithdrawBlocked = false;
try {
    ReviewService::withdraw($withReqId, 5);
} catch (DomainException $e) {
    $otherWithdrawBlocked = true;
}
check($otherWithdrawBlocked, 'Người khác không thể rút đề xuất của tác giả', $failures, $totalChecks);

// Chính tác giả (id=3) rút -> thành công
loginAs(3, 'member', 'viewer');
$withRes = ReviewService::withdraw($withReqId, 3);
check($withRes['success'] === true, 'Chính tác giả rút đề xuất thành công', $failures, $totalChecks);

$withReq = $db->query("SELECT status FROM review_requests WHERE id = {$withReqId}")->fetch(PDO::FETCH_ASSOC);
check($withReq['status'] === 'withdrawn', 'review_requests.status = withdrawn', $failures, $totalChecks);

// Anti-Bypass Guard: ManagerService::toggleRecommend chặn người không có quyền
loginAs(3, 'member', 'viewer');
// Ghi nhận output buffer vì Response::forbidden echo JSON
ob_start();
try {
    $bypassRes = ManagerService::toggleRecommend(101);
} catch (HttpException $e) {
    $bypassRes = ['success' => false, 'error' => $e->getMessage()];
}
$bufferOutput = ob_get_clean();
$jsonResponse = json_decode($bufferOutput, true);
$isForbidden = ($bypassRes && isset($bypassRes['success']) && $bypassRes['success'] === false) || ($jsonResponse && isset($jsonResponse['success']) && $jsonResponse['success'] === false);
check($isForbidden, 'Anti-Bypass Guard: Viewer gọi toggleRecommend nhận 403 Forbidden', $failures, $totalChecks);

if (isset($hdDir) && is_dir($hdDir)) {
    foreach (glob($hdDir . '/*') as $f) @unlink($f);
    @rmdir($hdDir);
}

// Tổng kết
echo "\n=======================================================\n";
if (empty($failures)) {
    echo "🎉 TẤT CẢ {$totalChecks} KIỂM THỬ ĐÃ PASS HOÀN TOÀN!\n";
    echo "\nSUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo "❌ CÓ " . count($failures) . "/{$totalChecks} KIỂM THỬ THẤT BẠI:\n";
    foreach ($failures as $f) {
        echo "   - {$f}\n";
    }
    exit(1);
}

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
