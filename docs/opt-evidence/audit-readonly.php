<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = str_replace('\\', '/', $argv[1] ?? dirname(__DIR__, 2));
$pdo = new PDO('sqlite:file:' . $root . '/storage/data/app.sqlite?mode=ro', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$stmt = $pdo->prepare('SELECT checksum, chord_count, chords_json FROM user_chord_sets WHERE song_id = ? AND set_name = ?');
$result = ['scanned' => 0, 'matched' => 0, 'missing' => [], 'different' => []];
foreach (glob($root . '/storage/data/chord_sets/*/*.json') ?: [] as $file) {
    $result['scanned']++;
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) $data = [];
    $stmt->execute([basename(dirname($file)), pathinfo($file, PATHINFO_FILENAME)]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $name = substr($file, strlen($root) + 1);
    if (!$row) $result['missing'][] = $name;
    elseif ($row['checksum'] !== md5(json_encode($data)) || (int)$row['chord_count'] !== count($data)) {
        $result['different'][] = [
            'file' => $name,
            'disk_chord_count' => count($data),
            'database_chord_count' => (int)$row['chord_count'],
            'decoded_data_equal' => json_decode((string)$row['chords_json'], true) === $data,
        ];
    } else $result['matched']++;
}
$audit = $root . '/storage/logs/audit.log';
$backups = array_values(array_filter(glob($root . '/storage/backups/*') ?: [], 'is_file'));
$auto = array_values(array_filter($backups, static fn($file) => preg_match('/app_before_r34_\d{8}_\d{6}\.sqlite$/D', $file)));
rsort($auto);
$prunable = array_slice($auto, 3);
$metrics = [
    'db_sha256' => hash_file('sha256', $root . '/storage/data/app.sqlite'),
    'audit_lines' => is_file($audit) ? count(file($audit)) : 0,
    'audit_sha256' => is_file($audit) ? hash_file('sha256', $audit) : null,
    'mail_files' => count(glob($root . '/storage/logs/mail/*') ?: []),
    'backup_files' => count($backups),
    'prune_candidate_files' => count($prunable),
    'prune_candidate_bytes' => array_sum(array_map('filesize', $prunable)),
    'registry_bytes' => filesize($root . '/PROJECT_REGISTRY.md'),
    'reconciliation' => $result,
];
echo json_encode($metrics, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
