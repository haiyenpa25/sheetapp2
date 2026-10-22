<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = dirname(__DIR__);
$result = json_decode(file_get_contents($root.'/docs/fix-evidence/data-repair-applied.json'), true, 512, JSON_THROW_ON_ERROR);
$plan = json_decode(file_get_contents($root.'/docs/fix-evidence/data-repair-dry-run.json'), true, 512, JSON_THROW_ON_ERROR);
$open = static fn(string $file): PDO => new PDO('sqlite:file:'.str_replace('\\', '/', realpath($file)).'?mode=ro', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db = $open($root.'/storage/data/app.sqlite');
$backup = $open($result['backup']);
$checks = [];
$checks['database_integrity'] = $db->query('PRAGMA integrity_check')->fetchColumn() === 'ok';
$checks['backup_integrity'] = $backup->query('PRAGMA integrity_check')->fetchColumn() === 'ok';
$checks['foreign_keys'] = $db->query('PRAGMA foreign_key_check')->fetchAll() === [];
$checks['backup_hash'] = hash_file('sha256', $result['backup']) === $result['backup_sha256'];
$checks['unique_index'] = (bool)$db->query("SELECT sql FROM sqlite_master WHERE type='index' AND name='users_chord_code_unique'")->fetchColumn();
foreach (['notification_deliveries'=>'deliveries', 'notifications'=>'notifications', 'domain_events'=>'events'] as $table=>$key) {
    $ids = array_column($plan[$key], 'id');
    $where = implode(',', array_map('intval', $ids));
    $checks[$table.'_removed'] = (int)$db->query("SELECT COUNT(*) FROM $table WHERE id IN ($where)")->fetchColumn() === 0;
    $checks[$table.'_backup_preserved'] = (int)$backup->query("SELECT COUNT(*) FROM $table WHERE id IN ($where)")->fetchColumn() === count($ids);
    $remaining = $db->query("SELECT * FROM $table ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    $expected = $backup->query("SELECT * FROM $table WHERE id NOT IN ($where) ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    $checks[$table.'_only_approved_rows'] = $remaining === $expected;
}
$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    if (in_array($table, ['domain_events','notifications','notification_deliveries'], true)) continue;
    $quoted = '"'.str_replace('"', '""', $table).'"';
    $checks['unchanged_'.$table] = $db->query('SELECT * FROM '.$quoted)->fetchAll(PDO::FETCH_ASSOC) === $backup->query('SELECT * FROM '.$quoted)->fetchAll(PDO::FETCH_ASSOC);
}
$report = ['checks'=>$checks, 'all_passed'=>!in_array(false, $checks, true), 'database_sha256'=>hash_file('sha256',$root.'/storage/data/app.sqlite')];
echo json_encode($report, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES), "\n";
exit($report['all_passed'] ? 0 : 1);
