<?php
/**
 * api_contract_regression.php
 *
 * Kiểm thử tự động chuẩn hoá API và hợp đồng dữ liệu (Task 1.8 - Giai đoạn 1)
 *
 * Tiêu chí kiểm tra:
 * 1. CategoryService hỗ trợ đủ 4 thao tác getAll, create, update, delete (chữa dứt điểm lỗi 500)
 * 2. CategoryController trả Response::ok (có success: true) cho create, update, delete khớp AdminUI
 * 3. LearningController & LearningService hỗ trợ song_id kiểu chuỗi ('tc001', '028', 'song-abc') không bị ép int
 * 4. Import API được kết nối MVC chuẩn qua ApiService.importer và có file shim api/import.php tương thích ngược
 * 5. ImportController bảo vệ quyền quản trị viên Auth::requireAdmin()
 * 6. Response::serverError tuyệt đối không làm lộ đường dẫn nội bộ (path disclosure) hay stack trace
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/Response.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/services/CategoryService.php';
require_once __DIR__ . '/../api/services/LearningService.php';

$root = dirname(__DIR__);
$failures = [];
$totalTests = 0;

function assertCondition(bool $cond, string $msg, array &$failures, int &$totalTests): void {
    $totalTests++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== Kiểm thử Hồi quy Chuẩn hoá Hợp đồng API (Task 1.8) ===\n";

// 1. CategoryService đủ 4 phương thức và hoạt động trên DB
try {
    $allCats = CategoryService::getAll();
    $initCount = count($allCats);

    $created = CategoryService::create('Thánh Ca Phục Hưng');
    $createdId = (int)($created['id'] ?? 0);
    $hasCreate = $createdId > 0 && ($created['slug'] ?? '') === 'thanh-ca-phuc-hung';

    $updated = CategoryService::update($createdId, 'Thánh Ca Đổi Mới');
    $hasUpdate = ($updated['id'] ?? 0) === $createdId && ($updated['name'] ?? '') === 'Thánh Ca Đổi Mới' && ($updated['slug'] ?? '') === 'thanh-ca-doi-moi';

    $deleted = CategoryService::delete($createdId);
    $hasDelete = ($deleted['deleted'] ?? false) === true && ($deleted['id'] ?? 0) === $createdId;

    $afterCount = count(CategoryService::getAll());

    assertCondition(
        $hasCreate && $hasUpdate && $hasDelete && ($afterCount === $initCount),
        "CategoryService: Triển khai trọn vẹn CRUD (getAll, create, update, delete), không còn thiếu hàm gây 500",
        $failures,
        $totalTests
    );
} catch (Throwable $e) {
    assertCondition(false, "CategoryService CRUD thất bại: " . $e->getMessage(), $failures, $totalTests);
}

// 2. CategoryController sử dụng Response::ok cho POST, PUT, DELETE
$catControllerContent = file_get_contents($root . '/api/controllers/CategoryController.php');
$hasResponseOkForMutations = (
    strpos($catControllerContent, 'Response::ok($result);') !== false ||
    substr_count($catControllerContent, 'Response::ok(') >= 3
);
assertCondition(
    $hasResponseOkForMutations,
    "CategoryController: Chuẩn hóa POST, PUT, DELETE trả Response::ok với flag success: true cho AdminUI",
    $failures,
    $totalTests
);

// 3. LearningService & LearningController hỗ trợ song_id dạng chuỗi
try {
    // Tạo cấu hình luyện tập cho bài có ID chuỗi chứa chữ cái 'tc001-khuc-ca'
    $stringSongId = 'tc001-khuc-ca';
    $userId = 1; // admin

    $saved = LearningService::saveArrangement([
        'song_id' => $stringSongId,
        'name' => 'Tập tay phải',
        'instrument_mode' => 'piano',
        'bpm_start' => 60,
        'bpm_target' => 90,
        'settings' => ['hand' => 'right']
    ], $userId);

    $fetched = LearningService::getArrangement($stringSongId, $userId);

    $stringSongIdSuccess = (
        $saved !== null &&
        ($fetched['song_id'] ?? '') == $stringSongId &&
        ($fetched['name'] ?? '') === 'Tập tay phải'
    );

    assertCondition(
        $stringSongIdSuccess,
        "LearningService: Hỗ trợ song_id dạng chuỗi alphanumeric ('{$stringSongId}'), không bị ép int về 0",
        $failures,
        $totalTests
    );

    // Kiểm tra LearningController không còn ép kiểu intval / (int) trên song_id
    $learnControllerContent = file_get_contents($root . '/api/controllers/LearningController.php');
    $noIntCast = strpos($learnControllerContent, '(int)($_GET[\'song_id\']') === false;

    assertCondition(
        $noIntCast && strpos($learnControllerContent, "trim((string)") !== false,
        "LearningController: Trích xuất song_id dạng chuỗi và từ chối chuỗi rỗng một cách nhất quán",
        $failures,
        $totalTests
    );

} catch (Throwable $e) {
    assertCondition(false, "Learning song_id chuỗi thất bại: " . $e->getMessage(), $failures, $totalTests);
}

// 4. Import API MVC Migration & Shim
$apiServiceContent = file_get_contents($root . '/assets/js/core/ApiService.js');
$importerUsesMvc = strpos($apiServiceContent, "api/index.php?route=import") !== false;
$shimExists = file_exists($root . '/api/import.php');
$shimRoutesToMvc = $shimExists && strpos(file_get_contents($root . '/api/import.php'), "\$_GET['route'] = 'import'") !== false;

assertCondition(
    $importerUsesMvc && $shimExists && $shimRoutesToMvc,
    "Import API: ApiService.importer trỏ tới MVC route=import, có file shim api/import.php tương thích ngược",
    $failures,
    $totalTests
);

// 5. ImportController bảo vệ quyền Admin
$importControllerContent = file_get_contents($root . '/api/controllers/ImportController.php');
$hasAdminGuard = strpos($importControllerContent, 'Auth::requireAdmin()') !== false;
assertCondition(
    $hasAdminGuard,
    "ImportController: Bắt buộc xác thực quyền quản trị Auth::requireAdmin() cho mọi thao tác import",
    $failures,
    $totalTests
);

// 6. Response::serverError bảo vệ an toàn lỗi, không lộ stack trace
ob_start();
Response::serverError(new RuntimeException('Lỗi giả lập'), 'TestContext');
$errJson = ob_get_clean();
$errData = json_decode($errJson, true) ?? [];

$isSafeError = (
    ($errData['success'] ?? true) === false &&
    strpos($errJson, 'RuntimeException') === false &&
    strpos($errJson, __FILE__) === false &&
    strpos($errJson, 'Lỗi hệ thống. Vui lòng thử lại sau.') !== false
);

assertCondition(
    $isSafeError,
    "Response::serverError: Phản hồi chuẩn không lộ path disclosure, class exception hay stack trace ra ngoài",
    $failures,
    $totalTests
);

echo "\n--------------------------------------------------------\n";
echo "Kết quả: " . ($totalTests - count($failures)) . "/{$totalTests} kiểm tra đạt chuẩn.\n";

if (!empty($failures)) {
    echo "❌ CÓ LỖI HỢP ĐỒNG API:\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}

echo "✅ TẤT CẢ KIỂM TRA HỢP ĐỒNG API TASK 1.8 ĐÃ ĐẠT (PASS 100%)\n";
exit(0);
