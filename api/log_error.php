<?php
/**
 * api/log_error.php — Client error logging endpoint
 */
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!empty($data) && is_array($data)) {
    $logDir = __DIR__ . '/../storage/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0775, true);
    }
    $logFile = $logDir . '/client_errors.log';
    $entry = sprintf(
        "[%s] [%s] %s | Source: %s:%s | IP: %s\n",
        date('Y-m-d H:i:s'),
        substr(trim($data['type'] ?? 'error'), 0, 30),
        substr(trim($data['message'] ?? ($data['reason'] ?? 'unknown')), 0, 1000),
        substr(trim($data['source'] ?? 'unknown'), 0, 200),
        intval($data['lineno'] ?? 0),
        $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'
    );
    @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

echo json_encode(['success' => true]);
