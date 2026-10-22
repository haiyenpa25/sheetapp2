<?php
declare(strict_types=1);
// SUITE_TYPE: behavioral
passthru(escapeshellarg(getenv('SHEETAPP_NODE_BINARY')?:'node').' '.escapeshellarg(__DIR__.'/js/practice_csrf.cjs'),$status);exit($status);
