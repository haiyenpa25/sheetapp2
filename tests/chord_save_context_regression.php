<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
passthru(escapeshellarg($node) . ' ' . escapeshellarg(__DIR__ . '/js/chord_save_context.cjs'), $status);
exit($status);
