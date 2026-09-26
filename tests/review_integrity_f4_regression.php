<?php
/**
 * tests/review_integrity_f4_regression.php
 * 
 * Kiểm thử hồi quy cho Ticket F4 (ROADMAP3):
 * 1. Submit đề xuất gửi kèm song_id của bài khác -> trả về 422 (HttpException), HD bài khác không đổi.
 * 2. Leader tự duyệt đề xuất của chính mình -> bị chặn 403 (HttpException) (Quyết định B5). Admin tự duyệt được.
 * 3. Mỗi quyết định duyệt / từ chối chỉ sinh đúng 1 notification (không gửi 2 lần).
 * 4. Giao dịch nguyên tử (Atomic Transaction): Nếu xảy ra lỗi giữa chừng, toàn bộ rollback, không có dòng mồ côi.
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/HttpException.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/DomainEventService.php';
require_once __DIR__ . '/../api/services/NotificationService.php';

$testCount = 0;
$passCount = 0;
$failCount = 0;

function check(string $name, bool $condition, string $detail = ''): void {
    global $suiteTotalChecks;
    $suiteTotalChecks++;
    global $testCount, $passCount, $failCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo "  [PASS:B] [{$name}] {$detail}\n";
    } else {
        $failCount++;
        echo "  [FAIL:B] [{$name}] {$detail}\n";
    }
}

echo "========================================================\n";
echo "   SheetApp2 — F4: Review Integrity & Workflow Tests    \n";
echo "========================================================\n\n";

$pdo = createTestDatabase();
DB::setPdo($pdo);

// 1. Tạo 2 bài hát khác nhau
$pdo->exec("INSERT INTO songs (id, title, xmlPath) VALUES ('song-A', 'Bài Hát A', 'storage/songA.xml')");
$pdo->exec("INSERT INTO songs (id, title, xmlPath) VALUES ('song-B', 'Bài Hát B', 'storage/songB.xml')");

// Chuẩn bị người dùng
// 1: admin, 4: leader_user, 3: member_user (viewer)
$pdo->exec("INSERT INTO users (id, username, password_hash, role, display_name, status) VALUES (4, 'leader_user', 'hash', 'leader', 'Trưởng Ban', 'active')");
$pdo->exec("UPDATE users SET role = 'viewer', username = 'member_user' WHERE id = 3");

// Thiết lập HD ban đầu cho cả 2 bài
$chordsSongA = [['measure' => 1, 'chord' => 'C']];
$chordsSongB = [['measure' => 1, 'chord' => 'G']];
ChordSetService::saveSet('song-A', 'HD', $chordsSongA, 1, 'HD');
ChordSetService::saveSet('song-B', 'HD', $chordsSongB, 1, 'HD');

// Tạo một bộ hợp âm của member_user thuộc bài song-A
$pdo->exec("
    INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json)
    VALUES (501, 'song-A', 3, 'member_user', 'MySetA', '[{\"measure\":1,\"chord\":\"D\"}]')
");

// ── Test 1: Submit đề xuất sai song_id -> Bị chặn 422 ──────────────────
echo "--- 1. Kiểm tra gửi đề xuất sai song_id (Anti-Spoofing 422) ---\n";

$_SESSION = ['user_id' => 3, 'username' => 'member_user', 'role' => 'viewer'];

$mismatchBlocked = false;
$errorCode = 0;
try {
    // Bộ hợp âm 501 thuộc song-A, nhưng gửi kèm song_id='song-B'
    ReviewService::submit(3, 'chord_set', 501, 'song-B', 'update_hd', 'Đề xuất đổi HD nhưng gán nhầm bài B');
} catch (HttpException $e) {
    $mismatchBlocked = true;
    $errorCode = $e->getCode();
} catch (Throwable $e) {
    // Có thể là exception khác
}

check("F4-1.1", $mismatchBlocked === true && $errorCode === 422, "Submit bộ hợp âm sai song_id bị ném HttpException 422");

// Xác minh HD của bài B không bị thay đổi
$currentSongB = ChordSetService::loadSet('song-B', 'HD');
check("F4-1.2", count($currentSongB) === 1 && $currentSongB[0]['chord'] === 'G', "HD bài B hoàn toàn không bị ảnh hưởng");

// ── Test 2: Leader tự duyệt đề xuất của chính mình bị chặn 403 (B5) ─────
echo "\n--- 2. Kiểm tra Cấm Leader Tự Duyệt Đề Xuất Của Mình (B5) ---\n";

// Leader tạo bộ hợp âm cho song-A và nộp đề xuất
$pdo->exec("
    INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json)
    VALUES (502, 'song-A', 4, 'leader_user', 'LeaderSetA', '[{\"measure\":1,\"chord\":\"Em\"}]')
");

$_SESSION = ['user_id' => 4, 'username' => 'leader_user', 'role' => 'leader'];
$submitLeader = ReviewService::submit(4, 'chord_set', 502, 'song-A', 'recommend', 'Leader tự nộp đề xuất');
$leaderReqId = (int)$submitLeader['id'];

// Leader tự approve đề xuất của chính mình -> phải bị 403
$selfApproveBlocked = false;
$selfApproveCode = 0;
try {
    ReviewService::approve($leaderReqId, 4, 'Tôi tự thấy hay nên tự duyệt');
} catch (HttpException $e) {
    $selfApproveBlocked = true;
    $selfApproveCode = $e->getCode();
}

check("F4-2.1", $selfApproveBlocked === true && $selfApproveCode === 403, "Leader tự duyệt đề xuất của mình bị chặn 403 Forbidden theo B5");

// Trạng thái vẫn là pending
$statusAfterSelf = $pdo->query("SELECT status FROM review_requests WHERE id = {$leaderReqId}")->fetchColumn();
check("F4-2.2", $statusAfterSelf === 'pending', "Trạng thái đề xuất vẫn giữ nguyên là pending");

// Admin duyệt đề xuất của leader -> thành công
$_SESSION = ['user_id' => 1, 'username' => 'admin', 'role' => 'admin'];
$adminApprove = ReviewService::approve($leaderReqId, 1, 'Admin duyệt giúp Leader');
check("F4-2.3", $adminApprove['success'] === true, "Admin có quyền duyệt đề xuất của Leader");

// ── Test 3: Mỗi quyết định sinh đúng 1 notification (Không trùng lặp) ──
echo "\n--- 3. Kiểm tra thông báo duy nhất (No duplicate notifications) ---\n";

// Nộp một đề xuất mới từ member
$_SESSION = ['user_id' => 3, 'username' => 'member_user', 'role' => 'viewer'];
$submitNotif = ReviewService::submit(3, 'chord_set', 501, 'song-A', 'recommend', 'Xin duyệt hợp âm mới');
$notifReqId = (int)$submitNotif['id'];

// Đếm số notification của member trước khi duyệt
$notifCountBefore = (int)$pdo->query("SELECT COUNT(*) FROM notifications WHERE user_id = 3")->fetchColumn();

// Leader (id=4) duyệt đề xuất của member (id=3)
$_SESSION = ['user_id' => 4, 'username' => 'leader_user', 'role' => 'leader'];
ReviewService::approve($notifReqId, 4, 'Bản phối rất tốt!');

// Đếm số notification của member sau khi duyệt
$notifCountAfter = (int)$pdo->query("SELECT COUNT(*) FROM notifications WHERE user_id = 3")->fetchColumn();
$newNotifCount = $notifCountAfter - $notifCountBefore;
check("F4-3.1", $newNotifCount === 1, "Mỗi quyết định phê duyệt sinh ra ĐÚNG 1 thông báo tới tác giả (không bị trùng 2 lần)");

// ── Test 4: Giao dịch nguyên tử (Atomic Transaction) khi xảy ra lỗi ──────
echo "\n--- 4. Kiểm tra tính toàn vẹn Transaction khi có lỗi giữa chừng ---\n";

// Nộp đề xuất update_hd
$_SESSION = ['user_id' => 3, 'username' => 'member_user', 'role' => 'viewer'];
$pdo->exec("
    INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, chords_json)
    VALUES (503, 'song-A', 3, 'member_user', 'BadSet', '[{\"measure\":1,\"chord\":\"Bb\"}]')
");
$submitFail = ReviewService::submit(3, 'chord_set', 503, 'song-A', 'update_hd', 'Đề xuất thử nghiệm rollback');
$failReqId = (int)$submitFail['id'];

$historyBeforeFail = (int)$pdo->query("SELECT COUNT(*) FROM chord_set_history WHERE song_id = 'song-A'")->fetchColumn();

// Đổi role sang admin
$_SESSION = ['user_id' => 1, 'username' => 'admin', 'role' => 'admin'];

// Giả lập lỗi bằng cách ép đề xuất mang proposed_snapshot rỗng hoặc lỗi DB
// Ta update proposed_snapshot_json trong review_requests thành '[]'
$pdo->exec("UPDATE review_requests SET proposed_snapshot_json = '[]' WHERE id = {$failReqId}");

$errorCaught = false;
try {
    ReviewService::approve($failReqId, 1, 'Thử duyệt bản rỗng');
} catch (DomainException $e) {
    $errorCaught = true;
}

check("F4-4.1", $errorCaught === true, "Duyệt đề xuất lỗi bị chặn ném Exception");

// Kiểm tra: Không có dòng lịch sử mồ côi nào được tạo
$historyAfterFail = (int)$pdo->query("SELECT COUNT(*) FROM chord_set_history WHERE song_id = 'song-A'")->fetchColumn();
check("F4-4.2", $historyAfterFail === $historyBeforeFail, "Không có dòng chord_set_history mồ côi nào được sinh ra");

// Kiểm tra: review_requests không bị đánh dấu approved
$reqStatusAfter = $pdo->query("SELECT status FROM review_requests WHERE id = {$failReqId}")->fetchColumn();
check("F4-4.3", $reqStatusAfter === 'pending', "review_requests vẫn ở trạng thái pending, không bị cập nhật dở dang");

echo "\n--------------------------------------------------------\n";
echo "Tổng số kiểm tra: {$testCount} | Đạt: {$passCount} | Lỗi: {$failCount}\n";

if ($failCount > 0) {
    echo "❌ KẾT QUẢ: THẤT BẠI!\n";
    exit(1);
}

echo "✅ KẾT QUẢ: TẤT CẢ KIỂM TRA F4 ĐỀU ĐẠT (PASS 100%)!\n";

echo "\nSUITE_COMPLETE total={$suiteTotalChecks}\n";
exit(0);
