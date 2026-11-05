<?php
declare(strict_types=1);

/**
 * tools/verify_multi_church.php — kiểm tra CHỈ ĐỌC trạng thái đa Hội Thánh trên một cơ sở dữ liệu.
 * Dùng trước/sau khi chạy `php tools/migrate.php` và trước khi bật cờ MULTI_CHURCH trên web.
 *
 *   php tools/verify_multi_church.php           # in báo cáo, thoát 0 nếu ổn, 1 nếu có vấn đề
 *
 * Không ghi gì vào cơ sở dữ liệu.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../api/core/DB.php';

$pdo = DB::get();
$problems = [];
$say = static function (string $label, $value): void { echo str_pad($label, 52) . $value . "\n"; };
$hasTable = static fn(string $t): bool => (bool)$pdo->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=" . $pdo->quote($t))->fetchColumn();
$hasColumn = static function (string $t, string $c) use ($pdo): bool {
    foreach ($pdo->query("PRAGMA table_info($t)")->fetchAll(PDO::FETCH_ASSOC) as $col) if ($col['name'] === $c) return true;
    return false;
};

echo "== Kiểm tra đa Hội Thánh ==\n";
if (!$hasTable('churches') || !$hasTable('church_members')) {
    echo "CHƯA có bảng churches/church_members → chạy: php tools/migrate.php (sao lưu trước)\n";
    exit(1);
}
foreach (['setlists', 'categories'] as $t) {
    if (!$hasColumn($t, 'church_id')) $problems[] = "$t chưa có cột church_id";
}

$say('Số Hội Thánh', (int)$pdo->query('SELECT COUNT(*) FROM churches')->fetchColumn());
$say('Hội Thánh mặc định (slug mac-dinh)', (int)$pdo->query("SELECT COUNT(*) FROM churches WHERE slug = 'mac-dinh'")->fetchColumn());
foreach ($pdo->query("SELECT c.id, c.name, c.status,
        (SELECT COUNT(*) FROM church_members m WHERE m.church_id = c.id AND m.status = 'active') AS active_members,
        (SELECT COUNT(*) FROM church_members m WHERE m.church_id = c.id AND m.status = 'pending') AS pending_members,
        (SELECT COUNT(*) FROM church_members m WHERE m.church_id = c.id AND m.role = 'church_admin' AND m.status = 'active') AS admins
        FROM churches c ORDER BY c.id")->fetchAll(PDO::FETCH_ASSOC) as $c) {
    $say("  #{$c['id']} {$c['name']} [{$c['status']}]", "hoạt động {$c['active_members']}, chờ duyệt {$c['pending_members']}, quản trị {$c['admins']}");
    if ($c['status'] === 'active' && (int)$c['admins'] === 0) $problems[] = "Hội Thánh #{$c['id']} không có quản trị HT hoạt động";
}

if ($hasColumn('setlists', 'church_id')) {
    $orphan = (int)$pdo->query('SELECT COUNT(*) FROM setlists WHERE church_id IS NULL')->fetchColumn();
    $say('Chương trình lễ chưa gắn Hội Thánh', $orphan);
    if ($orphan > 0) $problems[] = "$orphan chương trình lễ chưa có church_id (chạy lại migration)";
    $say('Chương trình lễ tổng', (int)$pdo->query('SELECT COUNT(*) FROM setlists')->fetchColumn());
}

$noMembership = (int)$pdo->query("SELECT COUNT(*) FROM users u WHERE u.status = 'active' AND NOT EXISTS (SELECT 1 FROM church_members m WHERE m.user_id = u.id AND m.status = 'active')")->fetchColumn();
$say('Tài khoản hoạt động chưa thuộc HT nào', $noMembership);
if ($noMembership > 0) $problems[] = "$noMembership tài khoản hoạt động không thuộc Hội Thánh nào (bật cờ sẽ không tạo/ghi được chương trình)";

if ($hasColumn('categories', 'church_id')) {
    $say('Danh mục riêng của HT', (int)$pdo->query('SELECT COUNT(*) FROM categories WHERE church_id IS NOT NULL')->fetchColumn());
    $notPrivate = (int)$pdo->query("SELECT COUNT(*) FROM categories WHERE church_id IS NOT NULL AND COALESCE(visibility, 'public') = 'public'")->fetchColumn();
    if ($notPrivate > 0) $problems[] = "$notPrivate danh mục riêng của HT đang đặt công khai";
}

echo $problems ? "\nVẤN ĐỀ:\n - " . implode("\n - ", $problems) . "\n" : "\nỔn: có thể bật cờ MULTI_CHURCH (storage/config/features.local.json).\n";
exit($problems ? 1 : 0);
