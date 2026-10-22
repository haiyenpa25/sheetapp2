<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
passthru(escapeshellarg(getenv('SHEETAPP_NODE_BINARY') ?: 'node') . ' ' . escapeshellarg(__DIR__ . '/js/bug15_preloader_invalidation.cjs'), $status);
exit($status);
