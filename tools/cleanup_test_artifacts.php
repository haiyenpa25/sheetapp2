<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

/**
 * tools/cleanup_test_artifacts.php
 * 
 * Dọn dẹp an toàn các bản ghi rác phát sinh từ test E2E trong CSDL thật.
 * 
 * Cách dùng:
 *   php tools/cleanup_test_artifacts.php --dry-run
 *   php tools/cleanup_test_artifacts.php --execute
 */

$root = dirname(__DIR__);
$dbPath = $root . '/storage/data/app.sqlite';

if (!file_exists($dbPath)) {
    fwrite(STDERR, "Không tìm thấy CSDL tại {$dbPath}\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$isDryRun = in_array('--dry-run', $argv, true);
$isExecute = in_array('--execute', $argv, true);

if (!$isDryRun && !$isExecute) {
    echo "Usage: php tools/cleanup_test_artifacts.php [--dry-run | --execute]\n";
    exit(0);
}

echo "========================================================\n";
echo "   SheetApp2 — Test Artifacts Cleanup Tool              \n";
echo "   Chế độ: " . ($isExecute ? "THỰC THI (EXECUTE)" : "XEM THỬ (DRY-RUN)") . "\n";
echo "========================================================\n\n";

// 1. Tìm setlist test
$setlists = $pdo->query("SELECT id, title, created_at FROM setlists WHERE title LIKE '%E2E%' OR title LIKE '%Test%' OR title LIKE 'Kịch bản%'")->fetchAll(PDO::FETCH_ASSOC);
$setlistIds = array_column($setlists, 'id');

echo "1. Setlists rác do test tạo: " . count($setlists) . " mục\n";
foreach ($setlists as $s) {
    echo "   - ID {$s['id']}: \"{$s['title']}\" (tạo lúc {$s['created_at']})\n";
}

// 2. Tìm song_usage_history gắn với các setlist rác
$usageCount = 0;
if (!empty($setlistIds)) {
    $inClause = implode(',', array_map('intval', $setlistIds));
    $usageCount = (int)$pdo->query("SELECT COUNT(*) FROM song_usage_history WHERE setlist_id IN ({$inClause})")->fetchColumn();
}
echo "2. Lịch sử sử dụng bài hát gắn với setlist rác: {$usageCount} dòng\n";

// 3. Tìm domain_events rác
$eventsCount = (int)$pdo->query("SELECT COUNT(*) FROM domain_events WHERE payload_json LIKE '%E2E%' OR payload_json LIKE '%test%' OR type LIKE '%test%' OR subject_type='test_fixture'")->fetchColumn();
echo "3. Domain events phát sinh do test: {$eventsCount} dòng\n";

// 4. Tìm notifications rác
$notifCount = (int)$pdo->query("SELECT COUNT(*) FROM notifications WHERE title LIKE '%E2E%' OR title LIKE '%Test%' OR body LIKE '%E2E%' OR body LIKE '%test%'")->fetchColumn();
echo "4. Notifications phát sinh do test: {$notifCount} dòng\n";

// 5. Tìm learning_arrangements rác
$arrCount = 0;
$hasArrTable = $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='learning_arrangements'")->fetchColumn();
if ($hasArrTable) {
    $arrCount = (int)$pdo->query("SELECT COUNT(*) FROM learning_arrangements WHERE song_id='tc001-khuc-ca'")->fetchColumn();
}
echo "5. Learning arrangements rác (tc001-khuc-ca): {$arrCount} dòng\n";

// 6. Kiểm tra admin email
$adminEmail = $pdo->query("SELECT email FROM users WHERE id = 1")->fetchColumn();
echo "6. Email tài khoản Admin (ID 1): " . ($adminEmail ? "\"{$adminEmail}\"" : "NULL") . "\n";

if ($isDryRun) {
    echo "\n[DRY-RUN HOÀN TẤT] Không có thay đổi nào được ghi vào CSDL.\n";
    echo "Để thực thi xóa và khôi phục email admin, chạy lệnh với cờ --execute\n";
    exit(0);
}

// ── THỰC THI ──
$pdo->beginTransaction();
try {
    // Xóa song_usage_history
    if (!empty($setlistIds)) {
        $inClause = implode(',', array_map('intval', $setlistIds));
        $pdo->exec("DELETE FROM song_usage_history WHERE setlist_id IN ({$inClause})");
        $pdo->exec("DELETE FROM setlist_items WHERE setlist_id IN ({$inClause})");
        $pdo->exec("DELETE FROM service_plan_assignments WHERE setlist_id IN ({$inClause})");
        $pdo->exec("DELETE FROM setlists WHERE id IN ({$inClause})");
    }

    // Xóa domain_events
    $pdo->exec("DELETE FROM domain_events WHERE payload_json LIKE '%E2E%' OR payload_json LIKE '%test%' OR type LIKE '%test%' OR subject_type='test_fixture'");

    // Xóa notifications
    $pdo->exec("DELETE FROM notifications WHERE title LIKE '%E2E%' OR title LIKE '%Test%' OR body LIKE '%E2E%' OR body LIKE '%test%'");

    // Xóa learning_arrangements rác
    if ($hasArrTable) {
        $pdo->exec("DELETE FROM learning_arrangements WHERE song_id='tc001-khuc-ca'");
    }

    // Khôi phục email admin về NULL nếu đang mang email test
    if ($adminEmail && str_contains($adminEmail, 'e2e-test')) {
        $pdo->exec("UPDATE users SET email = NULL WHERE id = 1");
    }

    $pdo->commit();
    echo "\n✅ Đã dọn dẹp toàn bộ dữ liệu test artifact thành công!\n";

    // Kiểm tra tính toàn vẹn
    $integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
    echo "PRAGMA integrity_check: {$integrity}\n";

} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "\n❌ Lỗi khi dọn dẹp: " . $e->getMessage() . "\n");
    exit(1);
}
