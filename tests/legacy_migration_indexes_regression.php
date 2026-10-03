<?php
/** Migration 003 must accept the pre-migration learning_arrangements schema. */
declare(strict_types=1);

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
foreach ([
    'setlist_items' => 'setlist_id INTEGER, song_id TEXT',
    'songs' => 'category_id INTEGER',
    'arrangements' => 'song_id TEXT',
    'arrangement_steps' => 'arrangement_id INTEGER',
    'song_sections' => 'song_id TEXT',
    'categories' => 'slug TEXT',
    'practice_sessions' => 'user_id INTEGER, song_id TEXT',
    'learning_arrangements' => 'song_id TEXT',
    'song_versions' => 'user_id INTEGER, song_id TEXT',
    'user_chord_sets' => 'user_id INTEGER, song_id TEXT, is_public INTEGER, is_recommended INTEGER',
] as $table => $columns) {
    $db->exec("CREATE TABLE {$table} ({$columns})");
}

$migrate = require __DIR__ . '/../api/migrations/003_add_performance_indexes.php';
try {
    $migrate($db);
    $indexes = $db->query("SELECT name FROM sqlite_master WHERE type = 'index'")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('idx_song_versions_user_id', $indexes, true)) {
        throw new RuntimeException('Required index was not created');
    }
    if (in_array('idx_learning_arrangements_user_song', $indexes, true)) {
        throw new RuntimeException('Index references a nonexistent legacy column');
    }
    if (!in_array('idx_learning_arrangements_song_id', $indexes, true)) {
        throw new RuntimeException('Legacy song index was not created');
    }
    $db->exec('ALTER TABLE learning_arrangements ADD COLUMN user_id INTEGER');
    $migrate($db);
    $modernIndexes = $db->query("SELECT name FROM sqlite_master WHERE type = 'index'")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('idx_learning_arrangements_user_song', $modernIndexes, true)) {
        throw new RuntimeException('Modern user and song index was not created');
    }
    echo "PASS: legacy migration creates valid indexes without a user_id column\n";
    echo "PASS: modern schema retains the user and song index\n";
    echo "SUITE_COMPLETE total=2 passed=2 failed=0\n";
} catch (Throwable $error) {
    fwrite(STDERR, "FAIL: {$error->getMessage()}\n");
    echo "SUITE_COMPLETE total=2 passed=0 failed=2\n";
    exit(1);
}
