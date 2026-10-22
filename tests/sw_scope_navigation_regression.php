<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
passthru(escapeshellarg(getenv('SHEETAPP_NODE_BINARY')?:'node').' '.escapeshellarg(__DIR__.'/js/sw_scope_navigation.cjs'),$status);exit($status);
