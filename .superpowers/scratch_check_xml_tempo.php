<?php
$files = glob('storage/Thanh ca/*.xml');
$with104 = 0;
$withOtherTempo = 0;
$noTempo = 0;
$otherTempos = [];

foreach ($files as $f) {
    $c = file_get_contents($f);
    $hasTempo = false;
    if (preg_match('/tempo=["\'](\d+)["\']/i', $c, $m)) {
        $hasTempo = true;
        $t = (int)$m[1];
        if ($t === 104) $with104++;
        else {
            $withOtherTempo++;
            $otherTempos[$t] = ($otherTempos[$t] ?? 0) + 1;
        }
    } elseif (preg_match('/<per-minute>(\d+)<\/per-minute>/i', $c, $m)) {
        $hasTempo = true;
        $t = (int)$m[1];
        if ($t === 104) $with104++;
        else {
            $withOtherTempo++;
            $otherTempos[$t] = ($otherTempos[$t] ?? 0) + 1;
        }
    }
    if (!$hasTempo) {
        $noTempo++;
    }
}

echo "Total files: " . count($files) . "\n";
echo "Files with tempo 104: $with104\n";
echo "Files with other tempo: $withOtherTempo\n";
echo "Files with no tempo: $noTempo\n";
print_r($otherTempos);
