<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
require_once __DIR__ . '/../api/core/DB.php';
$total = 0;
$failed = 0;
function schemaCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
if (!method_exists(DB::class, 'hasTable') || !method_exists(DB::class, 'hasColumn')) {
    schemaCheck(false, 'Shared schema metadata API exists');
} else {
    $first = new PDO('sqlite::memory:');
    DB::setPdo($first);
    schemaCheck(!DB::hasTable('example'), 'Missing table is absent');
    $first->exec('CREATE TABLE example (id INTEGER)');
    schemaCheck(DB::hasTable('EXAMPLE'), 'New table is found case-insensitively');
    schemaCheck(DB::hasColumn('example', 'ID'), 'Existing column is found case-insensitively');
    schemaCheck(!DB::hasColumn('example', 'title'), 'Missing column is absent');
    $first->exec('ALTER TABLE example ADD COLUMN title TEXT');
    schemaCheck(DB::hasColumn('example', 'title'), 'DDL invalidates cached column metadata');
    DB::setPdo(new PDO('sqlite::memory:'));
    schemaCheck(!DB::hasTable('example'), 'Connection switch cannot reuse another DB metadata');
    DB::setPdo($first);
    schemaCheck(DB::hasColumn('example', 'title'), 'Original connection still has correct metadata');
    $first->exec('DROP TABLE example');
    schemaCheck(!DB::hasTable('example'), 'Dropped table invalidates metadata');
    schemaCheck(!DB::hasColumn('example', 'id'), 'Dropped table has no stale columns');
    schemaCheck(!DB::hasColumn('example); DROP TABLE users;--', 'id'), 'Invalid identifier returns absent');
}
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
