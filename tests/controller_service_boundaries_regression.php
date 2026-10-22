<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
$total = 0;
$failed = 0;
function boundaryCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
$pdo = createTestDatabase();
DB::setPdo($pdo);
$_SESSION = ['user_id' => 2, 'username' => 'banhat', 'role' => 'banhat'];
$song = '001-thanh-chua-yeu-thuong';
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public) VALUES (?, 2, 'banhat', 'Mine', 0)")->execute([$song]);
$setId = (int)$pdo->lastInsertId();
if (!method_exists(ReviewService::class, 'resolveChordSetTarget')) {
    boundaryCheck(false, 'Review target lookup is available in service');
} else {
    boundaryCheck(ReviewService::resolveChordSetTarget($song, 'Mine', 2) === $setId, 'Own private review target resolves to its row');
    boundaryCheck(ReviewService::resolveChordSetTarget($song, 'banhat__Mine', 2) === $setId, 'Qualified alias resolves to the same review target');
    boundaryCheck((int)$pdo->query('SELECT COUNT(*) FROM user_chord_sets')->fetchColumn() === 1, 'Lookup does not duplicate existing chord sets');
}
$pdo->exec("INSERT INTO setlists (id, title, created_by) VALUES (1, 'Fixture plan', 2)");
$pdo->exec("INSERT INTO service_plan_assignments (id, setlist_id, user_id, role) VALUES (1, 1, 2, 'guitar')");
if (!method_exists(SetlistService::class, 'getAssignmentSetlistId')) {
    boundaryCheck(false, 'Assignment parent lookup is available in service');
} else {
    boundaryCheck(SetlistService::getAssignmentSetlistId(1) === 1, 'Assignment resolves to its parent plan');
    boundaryCheck(SetlistService::getAssignmentSetlistId(999) === null, 'Missing assignment returns null');
    boundaryCheck((int)$pdo->query('SELECT COUNT(*) FROM service_plan_assignments')->fetchColumn() === 1, 'Parent lookup leaves assignments unchanged');
}
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
