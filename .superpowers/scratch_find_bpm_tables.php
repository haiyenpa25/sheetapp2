<?php
$db = new PDO('sqlite:storage/data/app.sqlite');
$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
echo "Tables in app.sqlite:\n";
foreach ($tables as $t) {
    $cols = $db->query("PRAGMA table_info($t)")->fetchAll(PDO::FETCH_ASSOC);
    $cNames = array_column($cols, 'name');
    $hasBpmOrTempo = array_intersect($cNames, ['bpm', 'tempo', 'speed']);
    if (!empty($hasBpmOrTempo)) {
        echo "Table '$t' has columns: " . implode(', ', $hasBpmOrTempo) . "\n";
    }
}
