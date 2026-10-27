<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral

$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
passthru(escapeshellarg($node) . ' ' . escapeshellarg(__DIR__ . '/js/m3_osmd_render_core.cjs'), $status);
exit($status);
