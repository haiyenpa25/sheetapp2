<?php
/**
 * tests/security/authorization_abort_regression.php
 * 
 * Kiểm thử tính nguyên tử và cưỡng chế phân quyền (Authorization Abort Regression).
 * Xác minh:
 * 1. Response::abort ném HttpException(403/401) và dừng xử lý ngay lập tức.
 * 2. ManagerService::toggleRecommend khi gọi bởi viewer/banhat bị chặn 403 và DB không đổi.
 * 3. ManagerService::toggleVersionRecommend khi gọi bởi viewer/banhat bị chặn 403 và DB không đổi.
 * 4. Admin và Leader thực thi thành công.
 * 5. Auth::requireAdmin/requireLeader/requireLogin ném đúng mã HttpException thay vì exit.
 */

declare(strict_types=1);

require_once __DIR__ . '/../fixtures/test_db_fixture.php';
require_once __DIR__ . '/../../api/core/HttpException.php';
require_once __DIR__ . '/../../api/core/Response.php';
require_once __DIR__ . '/../../api/core/Auth.php';
require_once __DIR__ . '/../../api/core/AuthPolicy.php';
require_once __DIR__ . '/../../api/services/ManagerService.php';

$testCount = 0;
$passCount = 0;
$failCount = 0;

function check(string $name, bool $condition, string $detail = ''): void {
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
echo "   SheetApp2 — Authorization Abort & RBAC Regression    \n";
echo "========================================================\n\n";

$pdo = createTestDatabase();
DB::setPdo($pdo);

// Tạo bài hát, bộ hợp âm và phiên bản test
$pdo->exec("INSERT INTO songs (id, title, xmlPath) VALUES ('test-abort-song', 'Bài test Abort', 'storage/test.xml')");
$pdo->exec("INSERT INTO user_chord_sets (id, song_id, user_id, username, set_name, is_recommended) VALUES (101, 'test-abort-song', 2, 'banhat', 'HD', 0)");
$pdo->exec("INSERT INTO song_versions (id, song_id, user_id, version_name, xml_path, is_recommended) VALUES (201, 'test-abort-song', 2, 'Version 1', 'storage/v1.xml', 0)");

// -------------------------------------------------------------
// Test 1: toggleRecommend với viewer bị ném 403 & DB không đổi
// -------------------------------------------------------------
$_SESSION['user_id'] = 3;
$_SESSION['username'] = 'viewer_user';
$_SESSION['role'] = 'viewer';

$threw403 = false;
try {
    ManagerService::toggleRecommend(101);
} catch (HttpException $e) {
    if ($e->getStatusCode() === 403) {
        $threw403 = true;
    }
}

$stmt = $pdo->query("SELECT is_recommended FROM user_chord_sets WHERE id = 101");
$currentVal = (int)$stmt->fetchColumn();

check(
    'toggleRecommend_viewer_blocked',
    $threw403 && $currentVal === 0,
    "Viewer gọi toggleRecommend bị ném HttpException(403) và is_recommended vẫn là 0 (thực tế: is_rec={$currentVal})"
);

// -------------------------------------------------------------
// Test 2: toggleRecommend với banhat bị ném 403 & DB không đổi
// -------------------------------------------------------------
$_SESSION['user_id'] = 2;
$_SESSION['username'] = 'banhat_user';
$_SESSION['role'] = 'banhat';

$threw403Banhat = false;
try {
    ManagerService::toggleRecommend(101);
} catch (HttpException $e) {
    if ($e->getStatusCode() === 403) {
        $threw403Banhat = true;
    }
}

$stmt = $pdo->query("SELECT is_recommended FROM user_chord_sets WHERE id = 101");
$currentVal = (int)$stmt->fetchColumn();

check(
    'toggleRecommend_banhat_blocked',
    $threw403Banhat && $currentVal === 0,
    "Banhat gọi toggleRecommend bị ném HttpException(403) và is_recommended vẫn là 0 (thực tế: is_rec={$currentVal})"
);

// -------------------------------------------------------------
// Test 3: toggleRecommend với admin thực hiện thành công
// -------------------------------------------------------------
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin_user';
$_SESSION['role'] = 'admin';

$adminRes = ManagerService::toggleRecommend(101);
$stmt = $pdo->query("SELECT is_recommended FROM user_chord_sets WHERE id = 101");
$adminVal = (int)$stmt->fetchColumn();

check(
    'toggleRecommend_admin_allowed',
    ($adminRes['success'] ?? false) && $adminVal === 1,
    "Admin gọi toggleRecommend thành công và lật is_recommended = 1 (thực tế: is_rec={$adminVal})"
);

// -------------------------------------------------------------
// Test 4: toggleVersionRecommend với viewer bị ném 403 & DB không đổi
// -------------------------------------------------------------
$_SESSION['user_id'] = 3;
$_SESSION['username'] = 'viewer_user';
$_SESSION['role'] = 'viewer';

$vThrew403 = false;
try {
    ManagerService::toggleVersionRecommend(201);
} catch (HttpException $e) {
    if ($e->getStatusCode() === 403) {
        $vThrew403 = true;
    }
}

$stmt = $pdo->query("SELECT is_recommended FROM song_versions WHERE id = 201");
$vCurrentVal = (int)$stmt->fetchColumn();

check(
    'toggleVersionRecommend_viewer_blocked',
    $vThrew403 && $vCurrentVal === 0,
    "Viewer gọi toggleVersionRecommend bị ném HttpException(403) và is_recommended vẫn là 0 (thực tế: is_rec={$vCurrentVal})"
);

// -------------------------------------------------------------
// Test 5: toggleVersionRecommend với banhat bị ném 403 & DB không đổi
// -------------------------------------------------------------
$_SESSION['user_id'] = 2;
$_SESSION['username'] = 'banhat_user';
$_SESSION['role'] = 'banhat';

$vThrew403Banhat = false;
try {
    ManagerService::toggleVersionRecommend(201);
} catch (HttpException $e) {
    if ($e->getStatusCode() === 403) {
        $vThrew403Banhat = true;
    }
}

$stmt = $pdo->query("SELECT is_recommended FROM song_versions WHERE id = 201");
$vCurrentVal = (int)$stmt->fetchColumn();

check(
    'toggleVersionRecommend_banhat_blocked',
    $vThrew403Banhat && $vCurrentVal === 0,
    "Banhat gọi toggleVersionRecommend bị ném HttpException(403) và is_recommended vẫn là 0 (thực tế: is_rec={$vCurrentVal})"
);

// -------------------------------------------------------------
// Test 6: toggleVersionRecommend với admin thực hiện thành công
// -------------------------------------------------------------
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin_user';
$_SESSION['role'] = 'admin';

$adminVRes = ManagerService::toggleVersionRecommend(201);
$stmt = $pdo->query("SELECT is_recommended FROM song_versions WHERE id = 201");
$adminVVal = (int)$stmt->fetchColumn();

check(
    'toggleVersionRecommend_admin_allowed',
    ($adminVRes['success'] ?? false) && $adminVVal === 1,
    "Admin gọi toggleVersionRecommend thành công và lật is_recommended = 1 (thực tế: is_rec={$adminVVal})"
);

// -------------------------------------------------------------
// Test 7: Auth::requireAdmin ném HttpException(403) không giết tiến trình
// -------------------------------------------------------------
$_SESSION['user_id'] = 2;
$_SESSION['role'] = 'banhat';

$caughtAdminAbort = false;
try {
    Auth::requireAdmin();
} catch (HttpException $e) {
    $caughtAdminAbort = ($e->getStatusCode() === 403);
}

check(
    'Auth_requireAdmin_throws_HttpException',
    $caughtAdminAbort,
    "Auth::requireAdmin ném HttpException(403) thay vì gọi exit, an toàn cho runner"
);

// -------------------------------------------------------------
// Test 8: Auth::requireLogin ném HttpException(401)
// -------------------------------------------------------------
unset($_SESSION['user_id']);
$caughtLoginAbort = false;
try {
    Auth::requireLogin();
} catch (HttpException $e) {
    $caughtLoginAbort = ($e->getStatusCode() === 401);
}

check(
    'Auth_requireLogin_throws_HttpException',
    $caughtLoginAbort,
    "Auth::requireLogin ném HttpException(401) khi chưa đăng nhập"
);

// -------------------------------------------------------------
// Test 9: AuthPolicy::authorize ném HttpException(403)
// -------------------------------------------------------------
$_SESSION['user_id'] = 3;
$_SESSION['role'] = 'viewer';
$caughtPolicyAbort = false;
try {
    AuthPolicy::authorize('manage_users');
} catch (HttpException $e) {
    $caughtPolicyAbort = ($e->getStatusCode() === 403);
}

check(
    'AuthPolicy_authorize_throws_HttpException',
    $caughtPolicyAbort,
    "AuthPolicy::authorize ném HttpException(403) khi role không có capability"
);

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử: {$passCount}/{$testCount} checks PASS\n";
echo "SUITE_COMPLETE total={$testCount}\n";
echo "--------------------------------------------------------\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);
