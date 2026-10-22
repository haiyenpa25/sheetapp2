<?php
declare(strict_types=1);

/**
 * tests/bug02_03_song_and_version_visibility_regression.php
 * Behavioral regression test for BUG-02 and BUG-03:
 * - ManagerService::getSongDetails and SongService::getVersions block private songs for guests/viewers
 * - ManagerService::getSongDetails hides user A's private chord sets from user B, while allowing user A / Admin to see them
 * - ManagerService::getCommunityChordSets excludes chord sets belonging to private songs for guests
 * - ManagerService::getRepertoire and ManagerService::getVersionsList exclude private songs/versions for guests/other users
 */

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/services/ManagerService.php';
require_once __DIR__ . '/../api/services/SongService.php';

$pdo = createTestDatabase();
DB::setPdo($pdo);
Auth::resetDbCache();

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$pdo->exec("INSERT INTO users (id, username, password_hash, role, display_name, chord_code) VALUES
    (11, 'banhat_a', 'hash', 'banhat', 'Ban Hat A', 'BHA'),
    (12, 'banhat_b', 'hash', 'banhat', 'Ban Hat B', 'BHB')
");

$publicSong = '001-thanh-chua-yeu-thuong';
$privateSong = '002-ngoi-khen-chua';
$pdo->prepare("UPDATE songs SET visibility = 'private', is_public = 0 WHERE id = ?")->execute([$privateSong]);

// User A creates a private chord set on publicSong, and a public chord set on privateSong
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, chords_json, is_public) VALUES (?, 11, 'banhat_a', 'PrivateSetA', '[]', 0)")
    ->execute([$publicSong]);
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, chords_json, is_public) VALUES (?, 11, 'banhat_a', 'SetOnPrivateSong', '[]', 1)")
    ->execute([$privateSong]);

// User A creates a private version on publicSong, and a public version on privateSong
$pdo->prepare("INSERT INTO song_versions (song_id, user_id, username, version_name, version_slug, xml_path, is_public) VALUES (?, 11, 'banhat_a', 'PrivVerA', 'priv-ver-a', 'storage/users/a.xml', 0)")
    ->execute([$publicSong]);
$pdo->prepare("INSERT INTO song_versions (song_id, user_id, username, version_name, version_slug, xml_path, is_public) VALUES (?, 11, 'banhat_a', 'VerOnPrivSong', 'ver-priv-song', 'storage/users/b.xml', 1)")
    ->execute([$privateSong]);

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

// 1. Guest cannot read private song details or versions
$_SESSION = [];
Auth::resetDbCache();
check(ManagerService::getSongDetails($privateSong) === [], 'Guest bị chặn đọc getSongDetails của bài hát private (BUG-02)');
check(SongService::getVersions($privateSong) === [], 'Guest bị chặn đọc SongService::getVersions của bài hát private (BUG-02)');

// 2. User B cannot see User A's private chord set in getSongDetails, but User A CAN see their own private chord set
$_SESSION = ['user_id' => 12, 'username' => 'banhat_b', 'role' => 'banhat'];
Auth::resetDbCache();
$detailsForB = ManagerService::getSongDetails($publicSong);
$setNamesForB = array_column($detailsForB['user_chord_sets'] ?? [], 'set_name');
check(!in_array('PrivateSetA', $setNamesForB, true), 'User B không thấy bộ hợp âm is_public=0 của User A trong getSongDetails (BUG-02)');

$_SESSION = ['user_id' => 11, 'username' => 'banhat_a', 'role' => 'banhat'];
Auth::resetDbCache();
$detailsForA = ManagerService::getSongDetails($publicSong);
$setNamesForA = array_column($detailsForA['user_chord_sets'] ?? [], 'set_name');
check(in_array('PrivateSetA', $setNamesForA, true), 'Chủ sở hữu (User A) thấy bộ hợp âm is_public=0 của chính mình trong getSongDetails (BUG-02)');

// 3. Guest calling getCommunityChordSets does not see chord sets of private songs
$_SESSION = [];
Auth::resetDbCache();
$commSetsGuest = ManagerService::getCommunityChordSets([]);
$commSongIds = array_column($commSetsGuest, 'song_id');
check(!in_array($privateSong, $commSongIds, true), 'Guest gọi getCommunityChordSets không thấy bộ hợp âm thuộc bài hát private (BUG-02)');

// 4. Guest calling getVersionsList does not see versions of private songs; User B calling getRepertoire does not see User A's private version
$verListGuest = ManagerService::getVersionsList([]);
check(($verListGuest['total'] ?? -1) === 0, 'Guest gọi getVersionsList không thấy version của bài private hay version is_public=0 (BUG-03)');

$_SESSION = ['user_id' => 12, 'username' => 'banhat_b', 'role' => 'banhat'];
Auth::resetDbCache();
$repForB = ManagerService::getRepertoire([]);
$pubSongRepForB = null;
foreach ($repForB['songs'] ?? [] as $s) {
    if ($s['id'] === $publicSong) $pubSongRepForB = $s;
}
$verNamesInRepB = array_column($pubSongRepForB['song_versions'] ?? [], 'version_name');
check(!in_array('PrivVerA', $verNamesInRepB, true), 'User B gọi getRepertoire không thấy song_versions có is_public=0 của User A (BUG-03)');

echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed={$passed} failed={$failed}\n";
exit($failed > 0 ? 1 : 0);
