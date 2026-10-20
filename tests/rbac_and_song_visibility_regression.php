<?php
declare(strict_types=1);

/**
 * tests/rbac_and_song_visibility_regression.php
 * Kiểm thử hồi quy:
 * 1. Hệ thống 4 nhóm tài khoản: Guest (viewer), Ban Hát (banhat), Ban Nhạc (bannhac), Quản Trị (admin)
 * 2. Chế độ bài hát Public / Private và Upload XML (Admin tạo bài mới Public/Private, Guest chỉ xem được bài Public)
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/services/UserService.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
require_once __DIR__ . '/../api/services/ImportService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';

// Test roles against independent accounts, never the deployment's user IDs.
DB::setPdo(createTestDatabase());
Auth::resetDbCache();

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$passed = 0;
$failed = 0;

function assertTrue(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$label}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$label}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY: 4 NHÓM TÀI KHOẢN & BÀI HÁT PUBLIC/PRIVATE ===\n";

// 1. Kiểm thử Auth::normalizeRole & AuthPolicy cho 4 nhóm
assertTrue(Auth::normalizeRole('guest') === 'viewer', "Auth::normalizeRole('guest') -> 'viewer'");
assertTrue(Auth::normalizeRole('bannhac') === 'bannhac', "Auth::normalizeRole('bannhac') -> 'bannhac'");
assertTrue(Auth::normalizeRole('banhat') === 'banhat', "Auth::normalizeRole('banhat') -> 'banhat'");
assertTrue(Auth::normalizeRole('admin') === 'admin', "Auth::normalizeRole('admin') -> 'admin'");

assertTrue(!AuthPolicy::can('viewer', 'view_private_songs'), "Guest (viewer) không có quyền xem bài Private");
assertTrue(AuthPolicy::can('banhat', 'view_private_songs'), "Ban Hát (banhat) có quyền xem bài Private");
assertTrue(AuthPolicy::can('bannhac', 'view_private_songs'), "Ban Nhạc (bannhac) có quyền xem bài Private");
assertTrue(AuthPolicy::can('bannhac', 'edit_chords'), "Ban Nhạc (bannhac) có quyền biên tập hợp âm");
assertTrue(AuthPolicy::can('admin', 'upload_songs'), "Admin có quyền upload bài hát XML");
assertTrue(!AuthPolicy::can('banhat', 'upload_songs'), "Ban Hát không có quyền upload bài hát XML");

// 2. Tạo bài hát thử nghiệm ở chế độ Private và Public
$testSongId = 'test_private_song_' . time();

try {
    // Giả lập phiên Admin để thêm bài hát Private
    $_SESSION['user_id'] = 1;
    $_SESSION['username'] = 'admin_test';
    $_SESSION['role'] = 'admin';

    $created = SongService::add([
        'id' => $testSongId,
        'title' => 'Bài Thánh Ca Nội Bộ Test Private',
        'composer' => 'Tester',
        'xmlFile' => 'storage/musicxml/test_private.xml',
        'category_id' => 1,
        'visibility' => 'private',
        'is_public' => 0,
        'created_by' => 1,
        'lyrics_text' => 'Lời bài hát nội bộ tập dượt ban nhạc ban hát'
    ]);

    assertTrue(($created['visibility'] ?? '') === 'private', "Tạo bài hát chế độ Private lưu đúng visibility = 'private'");
    assertTrue((int)($created['is_public'] ?? 1) === 0, "Tạo bài hát chế độ Private lưu đúng is_public = 0");

    // Kiểm tra Admin thấy bài Private
    $adminSong = SongService::getById($testSongId);
    assertTrue($adminSong !== null && $adminSong['id'] === $testSongId, "Admin truy cập được bài hát Private qua getById()");

    // Kiểm tra Ban Nhạc ('bannhac') thấy bài Private
    $_SESSION['role'] = 'bannhac';
    assertTrue(Auth::isBannhac() === true, "Tài khoản Ban Nhạc: Auth::isBannhac() === true");
    assertTrue(Auth::isBanhat() === true, "Tài khoản Ban Nhạc tương thích ngược với Auth::isBanhat() === true");
    $bannhacSong = SongService::getById($testSongId);
    assertTrue($bannhacSong !== null, "Ban Nhạc truy cập được bài hát Private");

    // Kiểm tra Ban Hát ('banhat') thấy bài Private
    $_SESSION['role'] = 'banhat';
    $banhatSong = SongService::getById($testSongId);
    assertTrue($banhatSong !== null, "Ban Hát truy cập được bài hát Private");

    // Kiểm tra Guest ('viewer' hoặc chưa đăng nhập) KHÔNG thấy bài Private
    $_SESSION = [];
    $guestSong = SongService::getById($testSongId);
    assertTrue($guestSong === null, "Khách (chưa đăng nhập) bị chặn truy cập bài hát Private qua getById()");

    $guestAll = SongService::getAll();
    $foundInGuestAll = false;
    foreach ($guestAll as $s) {
        if (($s['id'] ?? '') === $testSongId) {
            $foundInGuestAll = true;
            break;
        }
    }
    assertTrue(!$foundInGuestAll, "Danh sách bài hát của Guest (getAll + Public Cache) tuyệt đối không lộ bài Private");

    $guestSearch = SongSearchHelper::search('Bài Thánh Ca Nội Bộ Test Private', []);
    $foundInGuestSearch = false;
    foreach ($guestSearch as $s) {
        if (($s['id'] ?? '') === $testSongId) {
            $foundInGuestSearch = true;
            break;
        }
    }
    assertTrue(!$foundInGuestSearch, "Tìm kiếm FTS5 của Guest không trả về bài hát Private");

    // 3. Admin chuyển bài hát từ Private -> Public
    $_SESSION['user_id'] = 1;
    $_SESSION['role'] = 'admin';
    $updated = SongService::update($testSongId, ['visibility' => 'public', 'is_public' => 1]);
    assertTrue(($updated['success'] ?? false) === true, "Admin chuyển đổi bài hát sang chế độ Public thành công");

    // Giờ Guest có thể xem bài hát sau khi đã chuyển sang Public
    $_SESSION = [];
    $guestSongAfterPublic = SongService::getById($testSongId);
    assertTrue($guestSongAfterPublic !== null && ($guestSongAfterPublic['visibility'] ?? '') === 'public', "Sau khi Admin mở Public, Guest xem được bài hát");

    // 4. Kiểm thử tạo và chuyển đổi tài khoản 4 nhóm (Guest, Ban Hát, Ban Nhạc, Admin)
    $_SESSION['user_id'] = 1;
    $_SESSION['role'] = 'admin';
    $testUserId = UserService::create('test_bannhac_' . time(), 'StrongPass#2026!', 'bannhac', 'Nhạc Công Test', 'Guitar', 'BN01');
    $createdUser = UserService::findById($testUserId);
    assertTrue(($createdUser['role'] ?? '') === 'bannhac', "UserService::create tạo tài khoản nhóm Ban Nhạc ('bannhac') thành công");
    UserService::updateRole($testUserId, 'guest');
    $reloadedUser = UserService::findById($testUserId);
    assertTrue(($reloadedUser['role'] ?? '') === 'viewer', "UserService::updateRole('guest') chuẩn hóa thành 'viewer' (Guest)");
    UserService::delete($testUserId);

} finally {
    // Dọn dẹp dữ liệu test
    $_SESSION['user_id'] = 1;
    $_SESSION['role'] = 'admin';
    SongService::delete($testSongId);
    $_SESSION = [];
}

echo "\nKết quả: {$passed} PASS, {$failed} FAIL\n";
echo "SUITE_COMPLETE total={$passed}\n";
exit($failed > 0 ? 1 : 0);
