<?php
declare(strict_types=1);

$node = is_file('C:\\Program Files\\nodejs\\node.exe') ? '"C:\\Program Files\\nodejs\\node.exe"' : 'node';
$script = escapeshellarg(__DIR__ . '/js/m5_1_app_rules.cjs');
$output = [];
$code = 0;
exec("{$node} {$script} 2>&1", $output, $code);
foreach ($output as $line) {
    echo $line . PHP_EOL;
}
exit($code);
