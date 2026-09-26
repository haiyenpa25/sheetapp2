<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$expectations = [
    'api/controllers/AnnotationController.php' => ['Auth.php', 'Auth::requireAdmin();'],
    'api/controllers/SessionController.php' => ['Auth.php', 'Auth::requireLogin();'],
    'api/controllers/ArrangementController.php' => ['Auth::requireBanhat();'],
    'api/controllers/LearningController.php' => ['Auth::requireLogin();'],
    'api/controllers/PracticeController.php' => ['Auth::requireLogin();'],
];

$failures = [];
foreach ($expectations as $relative => $needles) {
    $source = file_get_contents($root . '/' . $relative) ?: '';
    foreach ($needles as $needle) {
        $ok = str_contains($source, $needle);
        echo ($ok ? 'PASS: ' : 'FAIL: ') . "{$relative} contains {$needle}" . PHP_EOL;
        if (!$ok) $failures[] = "{$relative}: {$needle}";
    }
}

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d write-auth regression test(s) failed.\n", count($failures)));
    exit(1);
}
echo "\nAll write-auth regression tests passed.\n";
echo "\nSUITE_COMPLETE total=7\n";
