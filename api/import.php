<?php
/**
 * api/import.php — Legacy shim forwarding to MVC ImportController
 * Đảm bảo tương thích ngược 100% với các client gọi trực tiếp file này
 */

$_GET['route'] = 'import';
require_once __DIR__ . '/index.php';
