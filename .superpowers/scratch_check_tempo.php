<?php
$db = new PDO('sqlite:storage/data/app.sqlite');
$cols = $db->query('PRAGMA table_info(songs)')->fetchAll(PDO::FETCH_ASSOC);
foreach ($cols as $c) {
    echo $c['name'] . ' (' . $c['type'] . ")\n";
}

echo "\n--- Song count and tempo/bpm check ---\n";
// Kiểm tra xem cột tempo hay default_bpm có tồn tại không
$colNames = array_column($cols, 'name');
print_r(array_intersect($colNames, ['tempo', 'bpm', 'default_bpm', 'speed']));

// Đếm giá trị 104
foreach (['tempo', 'bpm', 'default_bpm'] as $col) {
    if (in_array($col, $colNames)) {
        $c104 = $db->query("SELECT count(*) FROM songs WHERE $col = 104 OR $col = '104'")->fetchColumn();
        $cNull = $db->query("SELECT count(*) FROM songs WHERE $col IS NULL OR $col = ''")->fetchColumn();
        $cTotal = $db->query("SELECT count(*) FROM songs")->fetchColumn();
        echo "Column '$col': total=$cTotal, value_104=$c104, null_or_empty=$cNull\n";
    }
}
