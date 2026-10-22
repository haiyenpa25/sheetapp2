<?php
declare(strict_types=1);

// SUITE_TYPE: behavioral
$root = dirname(__DIR__, 2);
$dir = sys_get_temp_dir() . '/sheetapp_client_log_' . bin2hex(random_bytes(8));
mkdir($dir);
$router = <<<'PHP'
<?php
ini_set('session.save_path', __DIR__);
putenv('LOGIN_RATE_LIMIT_DIR=' . __DIR__ . '/limits');
putenv('SHEETAPP_CLIENT_ERROR_LOG=' . __DIR__ . '/client_errors.log');
if (isset($_GET['fixture_error'])) {
    require_once ROOT . '/tests/fixtures/test_db_fixture.php';
    require_once ROOT . '/api/core/Session.php';
    require_once ROOT . '/api/core/Auth.php';
    require_once ROOT . '/api/core/FeatureFlags.php';
    Session::start();
    $pdo = createTestDatabase();
    DB::setPdo($pdo);
    $_SESSION = ['user_id' => 1, 'username' => 'admin', 'role' => 'admin'];
    Auth::userId();
    FeatureFlags::setOverride('PRACTICE_ASSIGNMENTS', true);
    FeatureFlags::setOverride('EXPORT_CHORDPRO', true);
    switch ($_GET['fixture_error']) {
        case 'profile': $pdo->exec('DROP TABLE users'); break;
        case 'hd': $pdo->exec('DROP TABLE chord_set_history'); break;
        case 'plan': $pdo->exec('DROP TABLE setlists'); break;
        case 'assignment': $pdo->exec('DROP TABLE practice_assignments'); break;
        case 'export':
            file_put_contents(__DIR__ . '/outside.xml', '<score-partwise><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><lyric><text>OUTSIDE_SECRET</text></lyric></note></measure></part></score-partwise>');
            $pdo->prepare('UPDATE songs SET xmlPath = ? WHERE id = ?')->execute([__DIR__ . '/outside.xml', '001-thanh-chua-yeu-thuong']);
            break;
    }
}
if (str_starts_with($_SERVER['REQUEST_URI'], '/api/log_error.php')) {
    require ROOT . '/api/log_error.php';
} else {
    require ROOT . '/api/index.php';
}
PHP;
file_put_contents($dir . '/router.php', str_replace('ROOT', var_export($root, true), $router));
$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
if (!$socket) throw new RuntimeException($error);
$address = stream_socket_get_name($socket, false);
fclose($socket);
$process = proc_open([PHP_BINARY, '-S', $address, $dir . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $dir . '/server.log', 'a'], 2 => ['file', $dir . '/server.log', 'a']], $pipes, $root);
if (!is_resource($process)) throw new RuntimeException('Cannot start isolated HTTP server');
fclose($pipes[0]);
register_shutdown_function(static function () use ($process, $dir): void {
    proc_terminate($process);
    proc_close($process);
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    rmdir($dir);
});
for ($attempt = 0; $attempt < 50; $attempt++) {
    $ready = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
    if ($ready) { fclose($ready); break; }
    usleep(100000);
}
$total = 0;
$failed = 0;
function clientLogCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
function logRequest(string $path, string $method, string $body, ?string $origin, string $client = 'default'): array {
    global $address, $dir;
    $headers = ['Content-Type: application/json'];
    if ($origin !== null) $headers[] = 'Origin: ' . $origin;
    $curl = curl_init('http://' . $address . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers]);
    curl_setopt($curl, CURLOPT_COOKIEFILE, $dir . '/cookies-' . $client . '.txt');
    curl_setopt($curl, CURLOPT_COOKIEJAR, $dir . '/cookies-' . $client . '.txt');
    if ($method === 'POST') curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return [$status, json_decode((string)$response, true)];
}
$origin = 'http://' . $address;
$route = '/api/index.php?route=client_log';
$body = '{"type":"error","message":"fixture-only","source":"test.js"}';
foreach ([$route, '/api/log_error.php'] as $path) {
    clientLogCheck(logRequest($path, 'POST', $body, 'https://other.invalid')[0] === 403, $path . ': rejects cross-origin write');
    clientLogCheck(logRequest($path, 'POST', $body, null)[0] === 403, $path . ': rejects missing origin');
    clientLogCheck(logRequest($path, 'GET', '', $origin)[0] === 405, $path . ': only POST is accepted');
    clientLogCheck(logRequest($path, 'POST', str_repeat('x', 8193), $origin)[0] === 413, $path . ': body is capped at 8 KiB');
    clientLogCheck(logRequest($path, 'POST', '{', $origin)[0] === 400, $path . ': rejects malformed JSON');
    clientLogCheck(logRequest($path, 'POST', '{"message":[]}', $origin)[0] === 400, $path . ': rejects non-string log fields');
}
clientLogCheck(!is_file($dir . '/client_errors.log'), 'Rejected requests do not write log entries');
for ($number = 1; $number <= 60; $number++) {
    $path = $number % 2 ? $route : '/api/log_error.php';
    [$status, $data] = logRequest($path, 'POST', $body, $origin);
    clientLogCheck($status === 200 && ($data['success'] ?? false), "Accepted same-origin record {$number}");
}
clientLogCheck(logRequest($route, 'POST', $body, $origin)[0] === 429, 'Per-session quota rejects request 61');
clientLogCheck(logRequest($route, 'POST', $body, $origin, 'second')[0] === 200, 'Another device sharing the IP still reports errors');
$lines = is_file($dir . '/client_errors.log') ? file($dir . '/client_errors.log') : [];
clientLogCheck(count($lines) === 61, 'Only accepted session records reach isolated log');
for ($number = 1; $number <= 10; $number++) {
    $payload = json_encode(['username' => 'fixture-' . $number, 'password' => '']);
    clientLogCheck(logRequest('/api/index.php?route=auth&action=register', 'POST', $payload, $origin)[0] === 400, "Registration attempt {$number} validates input");
}
clientLogCheck(logRequest('/api/index.php?route=auth&action=register', 'POST', '{"username":"another","password":""}', $origin)[0] === 429, 'Registration quota follows IP even when username changes');
$failureCases = [
    'profile' => ['auth', 'update_profile', []],
    'hd' => ['chord_sets', '', ['action' => 'save', 'songId' => '001-thanh-chua-yeu-thuong', 'name' => 'HD', 'chords' => [['chord' => 'C']]]],
    'plan' => ['practice_assignments', 'create_from_plan', ['setlist_id' => 1]],
    'assignment' => ['practice_assignments', 'create', ['song_id' => '001-thanh-chua-yeu-thuong']],
];
foreach ($failureCases as $fixture => [$name, $action, $payload]) {
    $path = '/api/index.php?' . http_build_query(['route' => $name, 'action' => $action, 'fixture_error' => $fixture]);
    [$status, $data] = logRequest($path, 'POST', json_encode($payload), $origin);
    clientLogCheck($status === 500 && ($data['error'] ?? '') === 'Lỗi hệ thống. Vui lòng thử lại sau.', "{$fixture}: internal DB failure returns safe 500");
}
$path = '/api/index.php?route=export&format=chordpro&song_id=001-thanh-chua-yeu-thuong&as_json=1&fixture_error=export';
[$status, $data] = logRequest($path, 'GET', '', $origin);
clientLogCheck($status === 500 && !isset($data['content']), 'ChordPro refuses existing XML outside managed roots');
$validationCases = [
    'profile_validation' => ['auth', 'update_profile', ['current_password' => 'wrong', 'new_password' => 'A-strong-new-password-2026']],
    'assignment_validation' => ['practice_assignments', 'create', []],
    'plan_validation' => ['practice_assignments', 'create_from_plan', ['setlist_id' => 999]],
];
foreach ($validationCases as $fixture => [$name, $action, $payload]) {
    $path = '/api/index.php?' . http_build_query(['route' => $name, 'action' => $action, 'fixture_error' => $fixture]);
    [$status, $data] = logRequest($path, 'POST', json_encode($payload), $origin);
    clientLogCheck($status === 400 && !empty($data['error']), "{$fixture}: expected validation error remains HTTP 400");
}
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
