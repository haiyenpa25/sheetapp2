<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
passthru(escapeshellarg(getenv('SHEETAPP_NODE_BINARY') ?: 'node') . ' ' . escapeshellarg(__DIR__ . '/js/bug12_apply_preloaded_undo.cjs'), $status);
exit($status);
