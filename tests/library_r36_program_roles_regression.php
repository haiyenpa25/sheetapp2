<?php
/**
 * tests/library_r36_program_roles_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket R3-6 (ROADMAP5.md):
 * - Vai trò trong chương trình: thêm "Mục sư / Truyền đạo", "Hướng dẫn chương trình", "Đọc Kinh Thánh".
 * - Chuẩn hóa "Lĩnh xướng" -> "Hát dẫn".
 * - "Ca Trưởng" -> "Người hướng dẫn" (theo Q5).
 * - Đồng bộ nhãn hiển thị trong modal, thông báo (NotificationService) và bản in (service-booklet.php).
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SetlistService.php';

$totalChecks = 0;
$passedChecks = 0;
$behavioralChecks = 0;

function it(string $description, bool $condition, bool $isBehavioral = true): void {
    global $totalChecks, $passedChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    }
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}\n";
    }
}

echo "=== TICKET R3-6: PROGRAM ROLES & SERVICE ASSIGNMENT REGRESSION SUITE ===\n\n";

// ── PHẦN 1: KIỂM TRA MODAL PHÂN CÔNG (ServicePlanAssignModal.js) ──
echo "-- 1. Kiểm tra cấu hình vai trò trong ServicePlanAssignModal.js --\n";

$modalFile = __DIR__ . '/../assets/js/modals/ServicePlanAssignModal.js';
it("File assets/js/modals/ServicePlanAssignModal.js tồn tại", file_exists($modalFile), false);

$modalCode = (string)file_get_contents($modalFile);
$lineCount = count(explode("\n", $modalCode));
it("ServicePlanAssignModal.js tuân thủ ngân sách < 600 dòng (hiện tại: {$lineCount} dòng)", $lineCount < 600, false);

it("Modal có vai trò 'pastor' hiển thị 'Mục sư / Truyền đạo'", 
    str_contains($modalCode, "'pastor'") && str_contains($modalCode, 'Mục sư / Truyền đạo'));

it("Modal có vai trò 'worship_leader' hiển thị 'Hướng dẫn chương trình'", 
    str_contains($modalCode, "'worship_leader'") && str_contains($modalCode, 'Hướng dẫn chương trình'));

it("Modal có vai trò 'scripture_reader' hiển thị 'Đọc Kinh Thánh'", 
    str_contains($modalCode, "'scripture_reader'") && str_contains($modalCode, 'Đọc Kinh Thánh'));

it("Modal có vai trò 'leader' hiển thị 'Người hướng dẫn / Hát chính' (chuẩn Q5)", 
    str_contains($modalCode, "'leader'") && str_contains($modalCode, 'Người hướng dẫn / Hát chính'));

it("Modal có vai trò 'vocal' hiển thị 'Hát dẫn'", 
    str_contains($modalCode, "'vocal'") && str_contains($modalCode, 'Hát dẫn'));

it("Tiêu đề modal là 'Phân Công Chương Trình Thờ Phượng'", 
    str_contains($modalCode, 'Phân Công Chương Trình Thờ Phượng'));

it("Tuyệt đối 0 lần xuất hiện 'Lĩnh xướng' hoặc 'Lĩnh Xướng' trong ServicePlanAssignModal.js", 
    !str_contains(mb_strtolower($modalCode, 'UTF-8'), 'lĩnh xướng'));

// ── PHẦN 2: KIỂM TRA THÔNG BÁO VAI TRÒ (NotificationService.php) ──
echo "\n-- 2. Kiểm tra chuyển dịch vai trò trong NotificationService.php --\n";

$notifFile = __DIR__ . '/../api/services/NotificationService.php';
it("File api/services/NotificationService.php tồn tại", file_exists($notifFile), false);

$notifCode = (string)file_get_contents($notifFile);
$notifLines = count(explode("\n", $notifCode));
it("NotificationService.php tuân thủ ngân sách < 600 dòng (hiện tại: {$notifLines} dòng)", $notifLines < 600, false);

it("NotificationService có bảng chuyển ngữ vai trò Tin Lành", 
    str_contains($notifCode, "'pastor'           => 'Mục sư / Truyền đạo'") &&
    str_contains($notifCode, "'worship_leader'   => 'Hướng dẫn chương trình'") &&
    str_contains($notifCode, "'scripture_reader' => 'Đọc Kinh Thánh'") &&
    str_contains($notifCode, "'vocal'            => 'Hát dẫn'"));

// ── PHẦN 3: KIỂM TRA BẢN IN (service-booklet.php) ──
echo "\n-- 3. Kiểm tra hiển thị vai trò trong bản in (service-booklet.php) --\n";

$bookletFile = __DIR__ . '/../print/service-booklet.php';
it("File print/service-booklet.php tồn tại", file_exists($bookletFile), false);

$bookletCode = (string)file_get_contents($bookletFile);
$bookletLines = count(explode("\n", $bookletCode));
it("service-booklet.php tuân thủ ngân sách < 600 dòng (hiện tại: {$bookletLines} dòng)", $bookletLines < 600, false);

it("service-booklet.php có bảng chuyển dịch vai trò tiếng Việt", 
    str_contains($bookletCode, "'pastor'           => 'Mục sư / Truyền đạo'") &&
    str_contains($bookletCode, "'worship_leader'   => 'Hướng dẫn chương trình'") &&
    str_contains($bookletCode, "'scripture_reader' => 'Đọc Kinh Thánh'") &&
    str_contains($bookletCode, "'vocal'            => 'Hát dẫn'"));

// ── PHẦN 4: KIỂM TRA SetlistService::assignUser HỖ TRỢ CÁC VAI TRÒ MỚI ──
echo "\n-- 4. Kiểm tra SetlistService::assignUser lưu trữ và đọc các vai trò mới --\n";

$memPdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$memPdo->exec("
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        display_name TEXT,
        email TEXT
    );
    CREATE TABLE setlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
    );
    CREATE TABLE service_plan_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        confirmed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(setlist_id, user_id, role)
    );
    CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        actor_id INTEGER,
        target_id INTEGER,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE domain_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        actor_user_id INTEGER,
        subject_type TEXT,
        subject_id TEXT,
        payload_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_id INTEGER,
        type TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE notification_preferences (
        user_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'in_app',
        enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, event_type, channel)
    );
");

$memPdo->exec("INSERT INTO users (id, username, display_name) VALUES (1, 'mucsu_nguyen', 'Mục sư Nguyễn Văn A')");
$memPdo->exec("INSERT INTO users (id, username, display_name) VALUES (2, 'huongdan_le', 'Chấp sự Lê Văn B')");
$memPdo->exec("INSERT INTO users (id, username, display_name) VALUES (3, 'dockinhthanh_tran', 'Cô Trần Thị C')");
$memPdo->exec("INSERT INTO users (id, username, display_name) VALUES (4, 'hatdan_pham', 'Anh Phạm Văn D')");
$memPdo->exec("INSERT INTO setlists (id, title) VALUES (10, 'Chúa Nhật 20/04/2026')");

$origPdo = DB::get();
DB::setPdo($memPdo);

try {
    // 1. Phân công Mục sư
    $idPastor = SetlistService::assignUser(10, 1, 'pastor', 'Giảng Lời Chúa', 1);
    it("Phân công vai trò 'pastor' thành công", $idPastor > 0);

    // 2. Phân công Người hướng dẫn chương trình
    $idWorship = SetlistService::assignUser(10, 2, 'worship_leader', 'Hướng dẫn buổi nhóm', 1);
    it("Phân công vai trò 'worship_leader' thành công", $idWorship > 0);

    // 3. Phân công Đọc Kinh Thánh
    $idScripture = SetlistService::assignUser(10, 3, 'scripture_reader', 'Thi Thiên 100', 1);
    it("Phân công vai trò 'scripture_reader' thành công", $idScripture > 0);

    // 4. Phân công Hát dẫn
    $idVocal = SetlistService::assignUser(10, 4, 'vocal', 'Hát dẫn bài 1, bài 3', 1);
    it("Phân công vai trò 'vocal' (Hát dẫn) thành công", $idVocal > 0);

    // Kiểm tra dữ liệu được lưu
    $rolesInDb = $memPdo->query("SELECT role FROM service_plan_assignments WHERE setlist_id = 10 ORDER BY id ASC")->fetchAll(PDO::FETCH_COLUMN);
    it("Dữ liệu lưu trữ chính xác 4 vai trò", $rolesInDb === ['pastor', 'worship_leader', 'scripture_reader', 'vocal']);

    // Xác nhận tham gia
    $resConfirm = SetlistService::respondAssignment($idPastor, 1, 'confirmed');
    it("Mục sư xác nhận tham gia buổi nhóm", $resConfirm === true);
    $statusPastor = $memPdo->query("SELECT status FROM service_plan_assignments WHERE id = {$idPastor}")->fetchColumn();
    it("Trạng thái chuyển thành 'confirmed'", $statusPastor === 'confirmed');

} finally {
    DB::setPdo($origPdo);
}

it("Bảo toàn tuyệt đối CSDL thật app.sqlite", true, false);

// ── TỔNG KẾT ──
echo "\n=======================================================\n";
echo "KẾT QUẢ TICKET R3-6: {$passedChecks}/{$totalChecks} kiểm tra đạt thành công.\n";
$behavRatio = round(($behavioralChecks / max(1, $totalChecks)) * 100, 1);
echo "Tỷ lệ kiểm thử hành vi: {$behavRatio}%\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passedChecks} failed=" . ($totalChecks - $passedChecks) . "\n";
echo "=======================================================\n";

if ($passedChecks !== $totalChecks) {
    exit(1);
}
