<?php
/**
 * tests/offline_package_version_regression.php
 *
 * TV2-7: package_version của gói ngoại tuyến phải đổi khi nội dung XML hoặc
 * hợp âm của một bài trong chương trình đổi, để máy offline biết cần tải lại.
 * Chạy trên DB memory; file XML tạm nằm trong tests/fixtures và được xoá khi kết thúc.
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS:B: {$message}\n";
}

echo "=== TV2-7 — OFFLINE PACKAGE VERSION REGRESSION ===\n";

$root = dirname(__DIR__);
$pdo = createTestDatabase();

require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/AuditLogger.php';
require_once $root . '/api/services/SetlistService.php';

DB::setPdo($pdo);
AuditLogger::setLogPath(sys_get_temp_dir() . '/sheetapp-audit-test-' . bin2hex(random_bytes(4)) . '.log');

$songId = '001-thanh-chua-yeu-thuong';
$xmlRel = 'tests/fixtures/tmp_offline_pkg_' . bin2hex(random_bytes(4)) . '.xml';
$xmlFull = $root . '/' . $xmlRel;
// check() gọi exit(), mà exit bỏ qua finally, nên dọn file tạm ở shutdown
register_shutdown_function(static function () use ($xmlFull): void {
    if (is_file($xmlFull)) unlink($xmlFull);
});

file_put_contents($xmlFull, '<score-partwise version="3.1"><work><work-title>A</work-title></work></score-partwise>');
$pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([$xmlRel, $songId]);
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, chords_json, is_public) VALUES (?, 1, 'admin', 'HD', ?, 1)")
    ->execute([$songId, json_encode(['0_0' => 'C'])]);

$setlistId = SetlistService::create([
    'title' => 'Gói offline TV2-7',
    'scheduled_date' => '2026-10-25',
    'status' => 'published',
    'created_by' => 1,
]);
SetlistService::addItem($setlistId, $songId, 'HD', 0, 80, 4, ['item_type' => 'song']);

$v1 = SetlistService::getOfflinePackage($setlistId)['package_version'] ?? '';
$v1Again = SetlistService::getOfflinePackage($setlistId)['package_version'] ?? '';
check($v1 !== '' && $v1 === $v1Again, 'Không đổi gì thì package_version giữ nguyên');

$pdo->prepare("UPDATE user_chord_sets SET chords_json = ? WHERE song_id = ? AND set_name = 'HD'")
    ->execute([json_encode(['0_0' => 'G']), $songId]);
$v2 = SetlistService::getOfflinePackage($setlistId)['package_version'] ?? '';
check($v2 !== $v1, 'Đổi hợp âm HD của bài thì package_version đổi');

file_put_contents($xmlFull, '<score-partwise version="3.1"><work><work-title>B</work-title></work></score-partwise>');
clearstatcache();
$v3 = SetlistService::getOfflinePackage($setlistId)['package_version'] ?? '';
check($v3 !== $v2, 'Đổi nội dung XML của bài thì package_version đổi');

echo "SUITE_COMPLETE total={$GLOBALS['suiteTotalChecks']} passed={$GLOBALS['suiteTotalChecks']} failed=0\n";
