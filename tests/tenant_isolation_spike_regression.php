<?php
/**
 * tests/tenant_isolation_spike_regression.php
 *
 * Kiểm thử Hồi quy & Nghiệm thu Spike: Kiến Trúc Đa Hội Thánh (Multi-Tenant ADR-005)
 * Epic 4.5 — Quyết định D7:
 * - Xác thực Slug & Chặn đứng tấn công Path Traversal.
 * - Phân giải Tenant Context từ Request (Header, Query, Subdomain).
 * - Cô lập vật lý tuyệt đối 100% giữa các Database-per-Tenant SQLite.
 * - Thư viện chung Master Repertoire Read-Only dùng chung cho tất cả tenants.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/TenantContext.php';
require_once __DIR__ . '/../api/core/DB.php';

$passed = 0;
$failed = 0;

function check(bool $cond, string $msg): void {
    global $passed, $failed;
    if ($cond) {
        echo "  ✅ PASS: {$msg}\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: {$msg}\n";
        $failed++;
    }
}

echo "=== KIỂM THỬ HỒI QUY EPIC 4.5: KIẾN TRÚC ĐA HỘI THÁNH & CÔ LẬP DỮ LIỆU (ADR-005 SPIKE) ===\n\n";

// ── 1. Kiểm tra Xác thực Slug & Phòng Chống Path Traversal ──
echo "[1/4] Kiểm tra Xác thực Tenant Slug & Chống Tấn Công Path Traversal...\n";

check(TenantContext::validateSlug('saigon') === true, "Slug hợp lệ 'saigon' được chấp thuận");
check(TenantContext::validateSlug('hoi-thanh-tin-lanh_01') === true, "Slug hợp lệ chứa gạch nối và gạch dưới được chấp thuận");
check(TenantContext::validateSlug('../saigon') === false, "Từ chối slug chứa '../' (Path Traversal)");
check(TenantContext::validateSlug('saigon/data') === false, "Từ chối slug chứa dấu '/'");
check(TenantContext::validateSlug('saigon\\data') === false, "Từ chối slug chứa dấu '\\'");
check(TenantContext::validateSlug('a') === false, "Từ chối slug quá ngắn (< 2 ký tự)");
check(TenantContext::validateSlug(str_repeat('x', 51)) === false, "Từ chối slug quá dài (> 50 ký tự)");
check(TenantContext::validateSlug('') === false, "Từ chối slug rỗng");
check(TenantContext::validateSlug(null) === false, "Từ chối slug null");

$caughtTraversal = false;
try {
    TenantContext::setTenant('../../etc/passwd');
} catch (InvalidArgumentException $e) {
    $caughtTraversal = true;
}
check($caughtTraversal, "TenantContext::setTenant chặn đứng Path Traversal và ném InvalidArgumentException");

// ── 2. Kiểm tra Phân giải Tenant Context từ Request ──
echo "\n[2/4] Kiểm tra Phân giải Tenant Slug từ HTTP Request...\n";

// 2.1: Phân giải từ Header X-Tenant-ID
$_SERVER['HTTP_X_TENANT_ID'] = 'hoi-thanh-saigon';
check(TenantContext::resolveFromRequest() === 'hoi-thanh-saigon', "Phân giải chính xác từ Header HTTP_X_TENANT_ID");
unset($_SERVER['HTTP_X_TENANT_ID']);

// 2.2: Phân giải từ Query Parameter (?tenant=hanoi)
$_GET['tenant'] = 'hoi-thanh-hanoi';
check(TenantContext::resolveFromRequest() === 'hoi-thanh-hanoi', "Phân giải chính xác từ Query Parameter ?tenant=");
unset($_GET['tenant']);

// 2.3: Phân giải từ Subdomain
$_SERVER['HTTP_HOST'] = 'danang.sheetapp.vn:8080';
check(TenantContext::resolveFromRequest() === 'danang', "Phân giải chính xác từ Subdomain danang.sheetapp.vn");
$_SERVER['HTTP_HOST'] = 'sheet.hyb.io.vn';
check(TenantContext::resolveFromRequest() === null, "Bỏ qua subdomain hệ thống (sheet, www, api)");
unset($_SERVER['HTTP_HOST']);

// ── 3. Kiểm chứng Cô Lập Vật Lý Tuyệt Đối Giữa Các Database Tenant (Zero Cross-Tenant Leakage) ──
echo "\n[3/4] Kiểm chứng Cô Lập Vật Lý Tuyệt Đối Giữa Các Database Tenant...\n";

$tempDir = sys_get_temp_dir() . '/sheetapp_multitenant_spike_' . bin2hex(random_bytes(4));
TenantContext::setBaseDir($tempDir);
DB::setPdo(null); // Giải phóng mọi mock PDO

try {
    // 3.1: Ngữ cảnh Tenant Saigon
    TenantContext::setTenant('saigon');
    check(TenantContext::isMultiTenant() === true, "Ngữ cảnh Saigon: isMultiTenant = true");
    check(TenantContext::getTenant() === 'saigon', "Tenant slug hiện hành là 'saigon'");

    $dbSaigon = DB::get();
    $dbSaigon->exec("CREATE TABLE IF NOT EXISTS setlists (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, date TEXT);");
    $dbSaigon->exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, role TEXT);");

    $dbSaigon->exec("INSERT INTO setlists (title, date) VALUES ('Thánh Lễ Saigon Mở Đầu', '2026-10-01');");
    $dbSaigon->exec("INSERT INTO users (username, role) VALUES ('leader_saigon', 'leader');");

    $countSaigon = (int)$dbSaigon->query("SELECT COUNT(*) FROM setlists")->fetchColumn();
    check($countSaigon === 1, "Tenant Saigon có 1 setlist");

    // 3.2: Chuyển sang Ngữ cảnh Tenant Hanoi
    TenantContext::setTenant('hanoi');
    check(TenantContext::getTenant() === 'hanoi', "Chuyển thành công sang tenant slug 'hanoi'");

    $dbHanoi = DB::get();
    $dbHanoi->exec("CREATE TABLE IF NOT EXISTS setlists (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, date TEXT);");
    $dbHanoi->exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, role TEXT);");

    // Xác nhận Tenant Hanoi KHÔNG THỂ nhìn thấy dữ liệu của Saigon
    $hanoiSeesSetlists = (int)$dbHanoi->query("SELECT COUNT(*) FROM setlists")->fetchColumn();
    check($hanoiSeesSetlists === 0, "CÔ LẬP HOÀN TOÀN: Tenant Hanoi có 0 setlist, không nhìn thấy setlist của Saigon");

    $hanoiSeesUser = $dbHanoi->query("SELECT * FROM users WHERE username = 'leader_saigon'")->fetch();
    check($hanoiSeesUser === false, "CÔ LẬP HOÀN TOÀN: Tenant Hanoi không nhìn thấy người dùng của Saigon");

    // Tạo dữ liệu riêng cho Hanoi
    $dbHanoi->exec("INSERT INTO setlists (title, date) VALUES ('Chương Trình Hanoi Mùa Thu', '2026-10-05');");
    $countHanoi = (int)$dbHanoi->query("SELECT COUNT(*) FROM setlists")->fetchColumn();
    check($countHanoi === 1, "Tenant Hanoi tạo thành công setlist riêng");

    // 3.3: Chuyển lại Ngữ cảnh Saigon để kiểm tra tính toàn vẹn hai chiều
    TenantContext::setTenant('saigon');
    $dbSaigonAgain = DB::get();
    $saigonSeesHanoi = $dbSaigonAgain->query("SELECT * FROM setlists WHERE title LIKE '%Hanoi%'")->fetch();
    check($saigonSeesHanoi === false, "CÔ LẬP HAI CHIỀU: Tenant Saigon không nhìn thấy setlist của Hanoi");

    $saigonTitle = $dbSaigonAgain->query("SELECT title FROM setlists LIMIT 1")->fetchColumn();
    check($saigonTitle === 'Thánh Lễ Saigon Mở Đầu', "Tenant Saigon bảo toàn trọn vẹn dữ liệu gốc");

} finally {
    // Đóng connections và dọn dẹp thư mục tạm
    DB::closeTenantPool();
    TenantContext::reset();

    // Dọn dẹp files tạm
    if (is_dir($tempDir)) {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($files as $fileinfo) {
            $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
            @$todo($fileinfo->getRealPath());
        }
        @rmdir($tempDir);
    }
}

// ── 4. Kiểm tra Master Repertoire Read-Only & Tương Thích Ngược ──
echo "\n[4/4] Kiểm tra Master Repertoire Read-Only & Tương Thích Ngược Single-Tenant...\n";

check(TenantContext::isMultiTenant() === false, "Sau khi reset: isMultiTenant = false (Single-Tenant Mode)");
check(TenantContext::getTenant() === null, "Tenant slug mặc định là null");

// Kiểm tra Master Repertoire kết nối được
$masterPdo = DB::getMaster();
check($masterPdo instanceof PDO, "DB::getMaster() trả về đối tượng PDO hợp lệ");

echo "\n----------------------------------------------------\n";
echo "Tổng kết Spike ADR-005:\n";
echo "  - Checks đạt : {$passed}\n";
echo "  - Checks lỗi : {$failed}\n";

if ($failed === 0) {
    echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA CHO EPIC 4.5 MULTI-TENANT SPIKE ĐỀU ĐẠT (PASS 100%)!\n";
    exit(0);
} else {
    echo "❌ CÓ {$failed} KIỂM TRA THẤT BẠI!\n";
    exit(1);
}
