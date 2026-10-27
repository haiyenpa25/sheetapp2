<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral

$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
passthru(escapeshellarg($node) . ' ' . escapeshellarg(__DIR__ . '/js/m2_api_timeout_retry.cjs'), $status);
exit($status);
