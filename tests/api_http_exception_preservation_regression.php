<?php
declare(strict_types=1);

/**
 * tests/api_http_exception_preservation_regression.php
 *
 * F-SYS-1: Kiểm thử bảo toàn mã lỗi HTTP (401 Unauthorized / 403 Forbidden / 422 Unprocessable)
 * khi các API Controllers và Response::serverError bắt Throwable.
 *
 * Trước khi có bản sửa F-SYS-1:
 * - 16/17 controller trong api/controllers/ dùng catch (Throwable $e) { Response::serverError($e) }
 * - Response::serverError nuốt HttpException thành HTTP 500 "Lỗi hệ thống. Vui lòng thử lại sau.",
 *   làm mất lý do phân quyền thật sự (401/403) và che giấu trạng thái đối với client/frontend.
 *
 * Bản sửa F-SYS-1:
 * - Response::serverError tự kiểm tra `$error instanceof HttpException` và gọi Response::error
 *   với đúng mã trạng thái HTTP (401, 403, 422...) và thông điệp lỗi gốc.
 * - Bảo đảm toàn bộ 17 API controllers đều trả về mã lỗi HTTP chuẩn mực khi gặp ngoại lệ phân quyền.
 */

$root = dirname(__DIR__);

require_once $root . '/tests/lib/assert.php';
require_once $root . '/tests/lib/mock_php_input.php';
require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/core/HttpException.php';
require_once $root . '/api/core/Response.php';
require_once $root . '/api/core/Auth.php';

// Controllers cần kiểm thử
require_once $root . '/api/controllers/CategoryController.php';
require_once $root . '/api/controllers/SongController.php';
require_once $root . '/api/controllers/UserController.php';
require_once $root . '/api/controllers/ManagerController.php';
require_once $root . '/api/controllers/ArrangementController.php';
require_once $root . '/api/controllers/LearningController.php';
require_once $root . '/api/controllers/OmrController.php';
require_once $root . '/api/controllers/PracticeAssignmentController.php';
require_once $root . '/api/controllers/AuthController.php';
require_once $root . '/api/controllers/SetlistController.php';
require_once $root . '/api/controllers/ReviewController.php';

echo "========================================================\n";
echo "  F-SYS-1: API Controllers HttpException Preservation    \n";
echo "========================================================\n\n";

$pdo = createTestDatabase();
DB::setPdo($pdo);

/**
 * Helper gọi action và bắt output JSON kèm HTTP status code
 */
function captureControllerExecution(callable $fn): array {
    http_response_code(200);
    ob_start();
    try {
        $fn();
    } catch (HttpException $e) {
        // Nếu exception thoát khỏi controller ra ngoài router
        ob_end_clean();
        return [
            'success' => false,
            'error' => $e->getMessage(),
            '_httpCode' => $e->getStatusCode()
        ];
    } catch (Throwable $e) {
        ob_end_clean();
        return [
            'success' => false,
            'error' => $e->getMessage(),
            '_httpCode' => 500
        ];
    }
    $raw = ob_get_clean();
    $httpCode = http_response_code();
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['_raw' => $raw, '_httpCode' => $httpCode];
    }
    $decoded['_httpCode'] = $httpCode;
    return $decoded;
}

function clearSession(): void {
    Auth::resetDbCache();
    $_SESSION = [];
    $_GET = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Kiểm thử trực tiếp Response::serverError với các loại Exception
// ─────────────────────────────────────────────────────────────────────────────
echo "--- 1. Kiểm thử Response::serverError bảo toàn HttpException ---\n";

// 1.1 HttpException 401
$res401 = captureControllerExecution(function() {
    Response::serverError(new HttpException(401, 'Vui lòng đăng nhập'));
});
checkBehavior(
    'F_SYS_1_RESPONSE_401',
    $res401['_httpCode'] === 401 && ($res401['error'] ?? '') === 'Vui lòng đăng nhập' && ($res401['success'] ?? null) === false,
    'Response::serverError với HttpException(401) phải trả về HTTP 401 và giữ nguyên thông điệp'
);

// 1.2 HttpException 403
$res403 = captureControllerExecution(function() {
    Response::serverError(new HttpException(403, 'Cần quyền admin'));
});
checkBehavior(
    'F_SYS_1_RESPONSE_403',
    $res403['_httpCode'] === 403 && ($res403['error'] ?? '') === 'Cần quyền admin' && ($res403['success'] ?? null) === false,
    'Response::serverError với HttpException(403) phải trả về HTTP 403 và giữ nguyên thông điệp'
);

// 1.3 HttpException 422
$res422 = captureControllerExecution(function() {
    Response::serverError(new HttpException(422, 'Dữ liệu không hợp lệ'));
});
checkBehavior(
    'F_SYS_1_RESPONSE_422',
    $res422['_httpCode'] === 422 && ($res422['error'] ?? '') === 'Dữ liệu không hợp lệ',
    'Response::serverError với HttpException(422) phải trả về HTTP 422'
);

// 1.4 Ngoại lệ chung (RuntimeException / PDOException) phải trả về 500
$res500 = captureControllerExecution(function() {
    Response::serverError(new RuntimeException('Lỗi kết nối cơ sở dữ liệu nội bộ'));
});
checkBehavior(
    'F_SYS_1_RESPONSE_500_SAFETY',
    $res500['_httpCode'] === 500 && ($res500['error'] ?? '') === 'Lỗi hệ thống. Vui lòng thử lại sau.',
    'Response::serverError với Exception thường phải trả về HTTP 500 và thông điệp an toàn'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Kiểm thử hành vi thực tế trên các API Controllers
// ─────────────────────────────────────────────────────────────────────────────
echo "\n--- 2. Kiểm thử hành vi thực tế của các Controller khi gặp lỗi quyền ---\n";

// 2.1 CategoryController DELETE không đăng nhập admin
clearSession();
$_GET['id'] = '1';
$resCategory = captureControllerExecution(function() {
    $ctrl = new CategoryController();
    $ctrl->handleRequest('DELETE');
});
checkBehavior(
    'F_SYS_1_CATEGORY_CTRL_403',
    $resCategory['_httpCode'] === 403 && ($resCategory['success'] ?? null) === false,
    'CategoryController::handleRequest(DELETE) không có quyền admin phải trả về HTTP 403'
);

// 2.2 SongController DELETE không đăng nhập admin
clearSession();
$_GET['id'] = '1';
$resSong = captureControllerExecution(function() {
    $ctrl = new SongController();
    $ctrl->handleRequest('DELETE');
});
checkBehavior(
    'F_SYS_1_SONG_CTRL_403',
    $resSong['_httpCode'] === 403 && ($resSong['success'] ?? null) === false,
    'SongController::handleRequest(DELETE) không có quyền admin phải trả về HTTP 403'
);

// 2.3 UserController DELETE không đăng nhập admin
clearSession();
$_GET['id'] = '99';
$resUser = captureControllerExecution(function() {
    $ctrl = new UserController();
    $ctrl->handleRequest('DELETE');
});
checkBehavior(
    'F_SYS_1_USER_CTRL_403',
    $resUser['_httpCode'] === 403 && ($resUser['success'] ?? null) === false,
    'UserController::handleRequest(DELETE) không có quyền admin phải trả về HTTP 403'
);

// 2.4 ManagerController POST không đăng nhập admin
clearSession();
$_GET['action'] = 'manage_user';
$resManager = captureControllerExecution(function() {
    $ctrl = new ManagerController();
    $ctrl->handleRequest('POST');
});
checkBehavior(
    'F_SYS_1_MANAGER_CTRL_403',
    $resManager['_httpCode'] === 403 && ($resManager['success'] ?? null) === false,
    'ManagerController::handleRequest(POST manage_user) không có quyền admin phải trả về HTTP 403 (nhận: ' . ($resManager['_httpCode'] ?? 0) . ')'
);

// 2.5 ArrangementController POST delete không đăng nhập admin
clearSession();
$_GET['action'] = 'delete';
$resArrangement = captureControllerExecution(function() {
    $ctrl = new ArrangementController();
    $ctrl->handleRequest('POST');
});
checkBehavior(
    'F_SYS_1_ARRANGEMENT_CTRL_403',
    $resArrangement['_httpCode'] === 403 && ($resArrangement['success'] ?? null) === false,
    'ArrangementController::handleRequest(POST delete) không có quyền admin phải trả về HTTP 403'
);

// 2.6 LearningController POST save_arrangement chưa đăng nhập
clearSession();
$_GET['action'] = 'save_arrangement';
$resLearning = captureControllerExecution(function() {
    $ctrl = new LearningController();
    $ctrl->handleRequest('POST');
});
checkBehavior(
    'F_SYS_1_LEARNING_CTRL_401',
    $resLearning['_httpCode'] === 401 && ($resLearning['success'] ?? null) === false,
    'LearningController::handleRequest(POST) khi chưa đăng nhập phải trả về HTTP 401'
);

// 2.7 OmrController DELETE không đăng nhập admin
clearSession();
$_GET['id'] = '1';
$resOmr = captureControllerExecution(function() {
    $ctrl = new OmrController();
    $ctrl->handleRequest('DELETE');
});
checkBehavior(
    'F_SYS_1_OMR_CTRL_403',
    $resOmr['_httpCode'] === 403 && ($resOmr['success'] ?? null) === false,
    'OmrController::handleRequest(DELETE) không có quyền admin phải trả về HTTP 403'
);

// 2.8 PracticeAssignmentController POST create khi chưa đăng nhập (AuthPolicy kiểm tra login -> 401)
clearSession();
$_GET['action'] = 'create';
$resPractice = captureControllerExecution(function() {
    $ctrl = new PracticeAssignmentController();
    $ctrl->handleRequest('POST');
});
checkBehavior(
    'F_SYS_1_PRACTICE_ASSIGNMENT_CTRL_401_OR_403',
    in_array($resPractice['_httpCode'], [401, 403], true) && ($resPractice['success'] ?? null) === false,
    'PracticeAssignmentController::handleRequest(POST create) khi chưa đăng nhập phải trả về HTTP 401/403 (nhận: ' . ($resPractice['_httpCode'] ?? 0) . ')'
);

// 2.9 AuthController POST update_profile chưa đăng nhập
clearSession();
$_GET['action'] = 'update_profile';
$resAuth = captureControllerExecution(function() {
    $ctrl = new AuthController();
    $ctrl->handleRequest('POST');
});
checkBehavior(
    'F_SYS_1_AUTH_CTRL_401',
    $resAuth['_httpCode'] === 401 && ($resAuth['success'] ?? null) === false,
    'AuthController::handleRequest(POST update_profile) khi chưa đăng nhập phải trả về HTTP 401'
);

// 2.10 SetlistController GET usage_report chưa đăng nhập
clearSession();
$_GET['action'] = 'usage_report';
$resSetlist = captureControllerExecution(function() {
    $ctrl = new SetlistController();
    $ctrl->handleRequest('GET');
});
checkBehavior(
    'F_SYS_1_SETLIST_CTRL_401_OR_403',
    in_array($resSetlist['_httpCode'], [401, 403], true) && ($resSetlist['success'] ?? null) === false,
    'SetlistController::handleRequest(GET usage_report) khi chưa đăng nhập phải trả về HTTP 401/403'
);

// 2.11 ReviewController GET hd_history chưa đăng nhập
clearSession();
$_GET['action'] = 'hd_history';
$_GET['song_id'] = '001-thanh-chua-yeu-thuong';
$resReview = captureControllerExecution(function() {
    $ctrl = new ReviewController();
    $ctrl->handleRequest('GET');
});
checkBehavior(
    'F_SYS_1_REVIEW_CTRL_401',
    $resReview['_httpCode'] === 401 && ($resReview['success'] ?? null) === false,
    'ReviewController::handleRequest(GET hd_history) khi chưa đăng nhập phải trả về HTTP 401'
);

TestAssert::finish();
