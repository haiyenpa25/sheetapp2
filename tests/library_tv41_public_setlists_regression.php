<?php
declare(strict_types=1);
ob_start(); // Keep CLI progress output from committing simulated HTTP headers.
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/fixtures/tv41_setlists.php';
require_once __DIR__ . '/../api/controllers/SetlistController.php';
$pdo = createTestDatabase();
DB::setPdo($pdo);
$fixture = seedTv41Setlists($pdo);
$checks = 0; $failed = 0;
function checkPublicPlan(bool $ok, string $label): void {
    global $checks, $failed;
    ++$checks; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function readPlan(array $query, ?int $user = null): array {
    $_SESSION = $user ? ['user_id' => $user, 'username' => 'banhat'] : [];
    Auth::resetDbCache(); $_GET = $query; http_response_code(200);
    ob_start(); (new SetlistController())->handleRequest('GET');
    return ['body' => json_decode(ob_get_clean(), true), 'status' => http_response_code()];
}
$list = readPlan([])['body']['data'];
checkPublicPlan(array_column($list, 'id') === [$fixture['published']], 'Guest list contains only published programs');
$detail = readPlan(['id' => $fixture['published']])['body']['data'];
checkPublicPlan(!array_key_exists('assignments', $detail), 'Guest detail omits assignments entirely');
checkPublicPlan(!array_intersect(['created_by', 'leader_user_id', 'creator_name', 'leader_name'], array_keys($detail)), 'Guest detail omits personnel identity');
checkPublicPlan(!str_contains(json_encode($detail), 'PRIVATE-'), 'Guest detail omits internal description, item notes and assignment notes');
$item = $detail['items'][0];
checkPublicPlan($item['chord_profile'] === 'HD' && (int)$item['transpose_key'] === 2 && (int)$item['bpm'] === 88 && (int)$item['beats_per_measure'] === 3, 'Public playback retains profile, transpose, BPM and meter');
foreach (['draft', 'completed'] as $status) checkPublicPlan(readPlan(['id' => $fixture[$status]])['status'] === 404, "Guest cannot fetch $status by ID");
checkPublicPlan(readPlan(['id' => 999999])['status'] === 404, 'Missing and nonpublic programs both return 404');
foreach (['offline_package', 'manifest'] as $action) checkPublicPlan(readPlan(['id' => $fixture['published'], 'action' => $action])['status'] === 401, "Guest $action requires login");
$history = readPlan(['action' => 'song_usage', 'song_id' => $fixture['song']])['body']['data'];
checkPublicPlan(array_column($history['history'], 'setlist_id') === [$fixture['published']] && $history['total_used'] === 1, 'Guest history and totals cannot disclose draft or completed programs');
$member = readPlan(['id' => $fixture['draft']], 2);
checkPublicPlan($member['status'] === 200 && count($member['body']['data']['assignments']) === 1, 'Logged-in member retains draft detail and assignments');
checkPublicPlan(count(readPlan([], 2)['body']['data']) === 3, 'Logged-in list retains existing visibility');
echo "SUITE_COMPLETE total={$checks}\n";
exit($failed ? 1 : 0);
