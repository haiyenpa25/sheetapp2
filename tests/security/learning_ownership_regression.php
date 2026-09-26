<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$dbPath = tempnam(sys_get_temp_dir(), 'sheetapp-learning-');
$failures = [];

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . "\n";
    if (!$condition) $failures[] = $message;
}

try {
    putenv('DB_PATH=' . $dbPath);
    ob_start();
    require $root . '/api/database/migrate_learn_tables.php';
    $migrationOutput = (string)ob_get_clean();
    check(str_contains($migrationOutput, 'created successfully'), 'Learning migration runs successfully on an empty database');

    $pdo = new PDO('sqlite:' . $dbPath);
    $columns = $pdo->query('PRAGMA table_info(learning_arrangements)')->fetchAll(PDO::FETCH_COLUMN, 1);
    check(in_array('user_id', $columns, true), 'Learning arrangements store their owner');

    $indexes = $pdo->query('PRAGMA index_list(learning_arrangements)')->fetchAll(PDO::FETCH_ASSOC);
    $indexNames = array_column($indexes, 'name');
    check(in_array('idx_learning_arrangements_user_song', $indexNames, true), 'Learning ownership lookup has an index');

    $service = file_get_contents($root . '/api/services/LearningService.php');
    $controller = file_get_contents($root . '/api/controllers/LearningController.php');
    check(str_contains($service, 'WHERE song_id = ? AND user_id = ?'), 'Learning reads and updates are scoped to user and song');
    check(str_contains($service, '(song_id, user_id,'), 'New learning arrangements persist the owner');
    check(str_contains($controller, 'Auth::userId()'), 'Learning controller derives ownership from the session');
    check(!str_contains($controller, "\$body['user_id']"), 'Learning controller never trusts a client-supplied owner');

    require_once $root . '/api/services/LearningService.php';
    $first = LearningService::saveArrangement(['song_id' => 101, 'name' => 'User One'], 1);
    $second = LearningService::saveArrangement(['song_id' => 101, 'name' => 'User Two'], 2);
    check(($first['name'] ?? '') === 'User One', 'First user can save a learning arrangement');
    check(($second['name'] ?? '') === 'User Two', 'Second user can save an independent arrangement for the same song');
    check((LearningService::getArrangement(101, 1)['name'] ?? '') === 'User One', 'User one reads only their arrangement');
    check((LearningService::getArrangement(101, 2)['name'] ?? '') === 'User Two', 'User two reads only their arrangement');
    check(LearningService::getArrangement(101, 0) === null, 'Anonymous reads do not expose persisted learning arrangements');
} finally {
    $pdo = null;
    gc_collect_cycles();
    if (is_file($dbPath)) @unlink($dbPath);
}

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d learning ownership regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll learning ownership regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
