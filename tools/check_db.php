<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../api/core/DB.php';
$pdo = DB::get();
$cols = $pdo->query('PRAGMA table_info(songs)')->fetchAll(PDO::FETCH_ASSOC);
echo "Columns: ";
foreach($cols as $c) echo $c['name'].' ';
echo PHP_EOL;
$cnt = $pdo->query('SELECT COUNT(*) FROM songs')->fetchColumn();
echo "Total songs: ".$cnt.PHP_EOL;
$sample = $pdo->query('SELECT id,title,xmlPath FROM songs LIMIT 2')->fetchAll(PDO::FETCH_ASSOC);
print_r($sample);
