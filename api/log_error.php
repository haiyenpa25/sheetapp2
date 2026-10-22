<?php
/** Compatibility URL: all client log writes use the central request guards. */
$_GET['route'] = 'client_log';
require __DIR__ . '/index.php';
