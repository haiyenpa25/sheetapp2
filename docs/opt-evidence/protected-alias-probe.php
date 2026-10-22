<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = dirname(__DIR__, 2);
require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/services/ChordSetService.php';
$pdo = createTestDatabase();
DB::setPdo($pdo);
// No directory or production export is involved in this memory-only probe.
putenv('CHORD_SETS_DIR=' . sys_get_temp_dir() . '/sheetapp_alias_probe_' . bin2hex(random_bytes(8)));
$pdo->exec("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public) VALUES ('001-thanh-chua-yeu-thuong', 2, 'banhat', 'HD', 1)");
$direct = ChordSetService::deleteSet('001-thanh-chua-yeu-thuong', 'HD', 1, true);
$alias = ChordSetService::deleteSet('001-thanh-chua-yeu-thuong', 'banhat__HD', 1, true);
echo json_encode([
    'direct_hd_delete' => $direct,
    'qualified_hd_alias_delete' => $alias,
    'remaining_hd_rows' => (int)$pdo->query("SELECT COUNT(*) FROM user_chord_sets WHERE set_name='HD'")->fetchColumn(),
    'database' => 'memory fixture only',
], JSON_PRETTY_PRINT), "\n";
