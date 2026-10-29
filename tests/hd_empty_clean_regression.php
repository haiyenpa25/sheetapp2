<?php
declare(strict_types=1);

/**
 * tests/hd_empty_clean_regression.php — luật HD mặc định (2026-10-29): HD rỗng thì hiện bản nhạc sạch,
 * không rơi về TLH. Chạy mã JS thật trong sandbox Node (tests/js/hd_empty_clean.cjs).
 */
$node = getenv('SHEETAPP_NODE_BINARY') ?: 'node';
$out = [];
exec(escapeshellarg($node) . ' ' . escapeshellarg(__DIR__ . '/js/hd_empty_clean.cjs') . ' 2>&1', $out, $exit);
echo implode("\n", $out) . "\n";
exit($exit === 0 ? 0 : 1);
