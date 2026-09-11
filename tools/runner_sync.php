<?php
header('Content-Type: application/json');
$output = shell_exec('cd /home/sheet.hyb.io.vn/public_html && ./sync.sh 2>&1');
echo json_encode(['output' => $output]);
@unlink(__FILE__);
