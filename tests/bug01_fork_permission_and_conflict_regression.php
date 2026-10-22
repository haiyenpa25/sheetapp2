<?php
declare(strict_types=1);

/**
 * tests/bug01_fork_permission_and_conflict_regression.php
 * Behavioral regression test for BUG-01:
 * - ManagerService::forkSong requires Ban Hát (rejects viewer with 403)
 * - ManagerService::forkSong, ChordSetService::forkSet, ManagerService::saveUserChordSet
 *   reject set_name colliding (COLLATE NOCASE) with another user's chord set on the same song.
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/core/HttpException.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';

$tempChordDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sheetapp_bug01_chords_' . uniqid();
@mkdir($tempChordDir, 0755, true);
putenv("CHORD_SETS_DIR={$tempChordDir}");
putenv("SHEETAPP_CHORD_SETS_DIR={$tempChordDir}");
$_ENV['CHORD_SETS_DIR'] = $tempChordDir;
$_ENV['SHEETAPP_CHORD_SETS_DIR'] = $tempChordDir;

register_shutdown_function(static function () use ($tempChordDir): void {
    if (is_dir($tempChordDir)) {
        foreach (glob($tempChordDir . DIRECTORY_SEPARATOR . '*') ?: [] as $f) {
            if (is_file($f)) @unlink($f);
        }
        @rmdir($tempChordDir);
    }
});

$pdo = createTestDatabase();
DB::setPdo($pdo);
Auth::resetDbCache();

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

// Seed extra users for collision testing: user 10 (viewer), user 11 (banhat A), user 12 (banhat B)
$pdo->exec("INSERT INTO users (id, username, password_hash, role, display_name, chord_code) VALUES
    (10, 'viewer_u', 'hash', 'viewer', 'Viewer User', 'VW'),
    (11, 'banhat_a', 'hash', 'banhat', 'Ban Hat A', 'BHA'),
    (12, 'banhat_b', 'hash', 'banhat', 'Ban Hat B', 'BHB')
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

// 1. Viewer cannot call ManagerService::forkSong (must throw HttpException 403)
$_SESSION = ['user_id' => 10, 'username' => 'viewer_u', 'role' => 'viewer'];
Auth::resetDbCache();
$viewerBlocked = false;
try {
    ManagerService::forkSong(['song_id' => $songId, 'set_name' => 'ViewerFork']);
} catch (HttpException $e) {
    $viewerBlocked = ($e->getStatusCode() === 403);
}
check($viewerBlocked, 'Viewer bị chặn (HTTP 403) khi gọi ManagerService::forkSong');

// 2. Ban Hát A tạo bộ hợp âm 'BHA_Custom' thành công
$_SESSION = ['user_id' => 11, 'username' => 'banhat_a', 'role' => 'banhat'];
Auth::resetDbCache();
$resA = ManagerService::forkSong(['song_id' => $songId, 'set_name' => 'BHA_Custom']);
check(($resA['success'] ?? false) === true, 'Ban Hát A fork bộ hợp âm BHA_Custom thành công');

// 3. Ban Hát B không được forkSong trùng tên bộ của A (không phân biệt hoa thường)
$_SESSION = ['user_id' => 12, 'username' => 'banhat_b', 'role' => 'banhat'];
Auth::resetDbCache();
$resBConflict = ManagerService::forkSong(['song_id' => $songId, 'set_name' => 'bha_custom']);
check(
    ($resBConflict['success'] ?? true) === false && !empty($resBConflict['conflict']),
    'ManagerService::forkSong từ chối tên bộ trùng (COLLATE NOCASE) với thành viên khác'
);

// 4. Ban Hát B không được ChordSetService::forkSet trùng tên bộ của A
$resForkSetConflict = ChordSetService::forkSet($songId, 'HD', 'bha_custom', 12, 'banhat_b');
check(
    ($resForkSetConflict['success'] ?? true) === false && !empty($resForkSetConflict['conflict']),
    'ChordSetService::forkSet từ chối tên bộ trùng (COLLATE NOCASE) với thành viên khác'
);

// 5. Ban Hát B tạo bộ riêng 'BHB_Custom' rồi đổi tên sang 'BHA_Custom' qua saveUserChordSet -> bị từ chối
$resBOwn = ManagerService::forkSong(['song_id' => $songId, 'set_name' => 'BHB_Custom']);
$setBId = (int)($resBOwn['data']['set_id'] ?? 0);
check($setBId > 0, 'Ban Hát B tạo bộ riêng BHB_Custom thành công');

$resRenameConflict = ManagerService::saveUserChordSet($setBId, ['set_name' => 'bha_custom']);
check(
    ($resRenameConflict['success'] ?? true) === false && !empty($resRenameConflict['conflict']),
    'ManagerService::saveUserChordSet từ chối đổi set_name sang tên bộ của thành viên khác'
);

echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed={$passed} failed={$failed}\n";
exit($failed > 0 ? 1 : 0);
