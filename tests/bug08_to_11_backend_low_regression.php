<?php
declare(strict_types=1);

/**
 * tests/bug08_to_11_backend_low_regression.php
 * Behavioral regression suite for Backend Low bugs (BUG-08..BUG-11):
 * - BUG-08: ReviewService::submit & getDetail resolve relative xml_path via SongService::resolveManagedXmlPath so MusicXML diff is non-empty
 * - BUG-09: ManagerService::updateUserChordSet updates checksum column on canonical row so ChordSetService::getChecksum changes and stale save returns 409
 * - BUG-10: SetlistService::respondAssignment checks rowCount() > 0; admin responding to another member's assignment fails without writing audit log
 * - BUG-11: PracticeAssignmentService::markDone is idempotent (only 1 assignment.completed event) and rejects archived assignments
 */

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/AuthPolicy.php';
require_once __DIR__ . '/../api/core/AuditLogger.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/PracticeAssignmentService.php';
require_once __DIR__ . '/../api/controllers/ChordSetController.php';

$tempChordDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sheetapp_bug08_11_chords_' . uniqid();
@mkdir($tempChordDir, 0755, true);
putenv("CHORD_SETS_DIR={$tempChordDir}");
putenv("SHEETAPP_CHORD_SETS_DIR={$tempChordDir}");
$_ENV['CHORD_SETS_DIR'] = $tempChordDir;
$_ENV['SHEETAPP_CHORD_SETS_DIR'] = $tempChordDir;

$tempAuditLog = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sheetapp_bug08_11_audit_' . uniqid() . '.log';
putenv("SHEETAPP_AUDIT_LOG={$tempAuditLog}");
$_ENV['SHEETAPP_AUDIT_LOG'] = $tempAuditLog;

$tempUserXmlRel = 'storage/users/u11_bug08_' . uniqid() . '.xml';
$tempUserXmlAbs = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $tempUserXmlRel);
@mkdir(dirname($tempUserXmlAbs), 0755, true);
@file_put_contents($tempUserXmlAbs, <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type><lyric number="1"><text>Lời mới</text></lyric></note>
    </measure>
  </part>
</score-partwise>
XML
);

register_shutdown_function(static function () use ($tempChordDir, $tempUserXmlAbs, $tempAuditLog): void {
    if (is_file($tempUserXmlAbs)) @unlink($tempUserXmlAbs);
    if (is_file($tempAuditLog)) @unlink($tempAuditLog);
    if (is_dir($tempChordDir)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempChordDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) {
            if ($f->isDir()) @rmdir($f->getPathname());
            else @unlink($f->getPathname());
        }
        @rmdir($tempChordDir);
    }
});

// Change working directory to tests/ so relative 'storage/...' paths fail unless resolved via SongService::resolveManagedXmlPath
$origCwd = getcwd();
chdir(__DIR__);

$pdo = createTestDatabase();
DB::setPdo($pdo);
Auth::resetDbCache();

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$pdo->exec("INSERT INTO users (id, username, password_hash, role, display_name, voice_part, status) VALUES
    (10, 'leader_u', 'hash', 'leader', 'Ca Trưởng', 'T', 'active'),
    (11, 'banhat_1', 'hash', 'banhat', 'Ca Viên 1', 'S', 'active')
");

$passed = 0;
$failed = 0;

function check(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        echo "[PASS:B] {$label}\n";
        $passed++;
    } else {
        echo "[FAIL:B] {$label}\n";
        $failed++;
    }
}

$songId = '001-thanh-chua-yeu-thuong';

// ── BUG-08: ReviewService diff MusicXML non-empty with relative path ──
$_SESSION = ['user_id' => 11, 'username' => 'banhat_1', 'role' => 'banhat'];
Auth::resetDbCache();
$pdo->prepare("INSERT INTO song_versions (id, song_id, user_id, username, version_name, version_slug, xml_path) VALUES (80, ?, 11, 'banhat_1', 'Ver80', 'ver-80', ?)")
    ->execute([$songId, $tempUserXmlRel]);

$subRes = ReviewService::submit(11, 'song_version', 80, $songId, 'recommend', 'Test diff');
$revId  = (int)($subRes['id'] ?? $subRes['request_id'] ?? 0);
$detail = ReviewService::getDetail($revId);
$hasDiffChanges = ($detail['diff']['summary']['has_changes'] ?? false) === true && (int)($detail['diff']['summary']['proposed_measures'] ?? 0) === 1;
check(
    $hasDiffChanges,
    'BUG-08: ReviewService::submit và getDetail phân giải đường dẫn XML qua SongService::resolveManagedXmlPath nên diff MusicXML không rỗng'
);

// ── BUG-09: ManagerService::updateUserChordSet updates checksum ──
$initChords = [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'C']];
ChordSetService::saveSet($songId, 'MySet09', $initChords, 11, 'banhat_1', null, true);
$setRowId = (int)$pdo->query("SELECT id FROM user_chord_sets WHERE song_id = '{$songId}' AND set_name = 'MySet09'")->fetchColumn();
$oldChecksum = ChordSetService::getChecksum($songId, 'MySet09');

ManagerService::saveUserChordSet($setRowId, [
    'set_name' => 'MySet09',
    'chords' => [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'G7']]
]);
$newChecksum = ChordSetService::getChecksum($songId, 'MySet09');
check(
    $newChecksum !== '' && $newChecksum !== $oldChecksum,
    'BUG-09: Sau khi sửa hợp âm qua ManagerService::updateUserChordSet, ChordSetService::getChecksum trả về checksum mới'
);

// ── BUG-10: SetlistService::respondAssignment checks rowCount() ──
$planId = SetlistService::create(['title' => 'Lễ BUG-10', 'scheduled_date' => '2026-11-22', 'status' => 'published', 'created_by' => 10]);
$assignRowId = SetlistService::assignUser($planId, 11, 'Ca viên', null, 10);
$auditSizeBefore = is_file($tempAuditLog) ? filesize($tempAuditLog) : 0;

// Admin (user 1) attempts to respond to user 11's assignment
$respOk = SetlistService::respondAssignment($assignRowId, 1, 'confirmed', 'Admin bấm hộ');
$auditSizeAfter = is_file($tempAuditLog) ? filesize($tempAuditLog) : 0;
check(
    $respOk === false && $auditSizeAfter === $auditSizeBefore,
    'BUG-10: SetlistService::respondAssignment trả về false và không ghi audit log khi không khớp người được phân công'
);

// ── BUG-11: PracticeAssignmentService::markDone idempotent & active-only ──
$pracAssignId = PracticeAssignmentService::createAdHoc([
    'song_id' => $songId,
    'title' => 'Bài Tập BUG-11',
    'target_user_ids' => [11]
], 10);

$firstDone  = PracticeAssignmentService::markDone($pracAssignId, 11);
$secondDone = PracticeAssignmentService::markDone($pracAssignId, 11);
$completedEvents = (int)$pdo->query("SELECT COUNT(*) FROM domain_events WHERE type = 'assignment.completed' AND subject_id = '{$pracAssignId}'")->fetchColumn();
check(
    $firstDone === true && $secondDone === false && $completedEvents === 1,
    'BUG-11: Gọi markDone 2 lần liên tiếp chỉ ghi nhận đúng 1 sự kiện assignment.completed'
);

$archAssignId = PracticeAssignmentService::createAdHoc([
    'song_id' => $songId,
    'title' => 'Bài Tập Archived BUG-11',
    'target_user_ids' => [11]
], 10);
PracticeAssignmentService::archive($archAssignId, 10);
$archDone = PracticeAssignmentService::markDone($archAssignId, 11);
check(
    $archDone === false,
    'BUG-11: Không cho phép markDone trên bài tập đã lưu trữ (archived)'
);

chdir($origCwd ?: dirname(__DIR__));
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed={$passed} failed={$failed}\n";
exit($failed > 0 ? 1 : 0);
