<?php
declare(strict_types=1);

// SUITE_TYPE: behavioral
// Real HTTP controller/Auth with synthetic users, memory DB and private temp disk.
$root = dirname(__DIR__, 2);
$dir = sys_get_temp_dir() . '/sheetapp_chord_privacy_' . bin2hex(random_bytes(8));
mkdir($dir . '/sets/001-thanh-chua-yeu-thuong', 0775, true);
$song = '001-thanh-chua-yeu-thuong';
file_put_contents($dir . '/sets/' . $song . '/Secret.json', '[{"chord":"SECRET"}]');
file_put_contents($dir . '/sets/' . $song . '/DiskOnly.json', '[{"chord":"DISK"}]');
$router = <<<'PHP'
<?php
require_once ROOT . '/tests/fixtures/test_db_fixture.php';
require_once ROOT . '/api/controllers/ChordSetController.php';
require_once ROOT . '/api/controllers/ReviewController.php';
require_once ROOT . '/api/controllers/SongController.php';
$pdo = createTestDatabase();
DB::setPdo($pdo);
putenv('CHORD_SETS_DIR=' . __DIR__ . '/sets');
putenv('SHEETAPP_AUDIT_LOG=' . __DIR__ . '/audit.log');
putenv('SHEETAPP_MAIL_DIR=' . __DIR__ . '/mail');
$actor = (int)($_SERVER['HTTP_X_TEST_ACTOR'] ?? 0);
$_SESSION = $actor ? ['user_id' => $actor, 'username' => $actor === 2 ? 'banhat' : 'admin'] : [];
$stmt = $pdo->prepare('INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public, chords_json, checksum) VALUES (?, 2, ?, ?, ?, ?, ?)');
foreach (['HD' => 0, 'TLH' => 0, 'default' => 0, 'Public' => 1, 'Secret' => 0] as $name => $public) {
    $stmt->execute(['001-thanh-chua-yeu-thuong', 'banhat', $name, $public, json_encode([['chord' => $name]]), 'checksum-' . $name]);
}
header('Content-Type: application/json');
if (($_GET['route'] ?? '') === 'songs') {
    $file = glob(ROOT . '/storage/users/admin/thanh-ca-001/*.xml')[0];
    $path = 'storage/users/admin/thanh-ca-001/' . basename($file);
    $pdo->prepare("INSERT INTO song_versions(song_id,user_id,username,version_name,version_slug,xml_path,is_public) VALUES (?,2,'banhat','HTTP fixture','http-fixture',?,0)")->execute(['001-thanh-chua-yeu-thuong',$path]);
    $_GET['version_id'] = (int)$pdo->lastInsertId();
    (new SongController())->handleRequest($_SERVER['REQUEST_METHOD']);
    return;
}
if (($_GET['route'] ?? '') === 'reviews') {
    ob_start();
    (new ReviewController())->handleRequest($_SERVER['REQUEST_METHOD']);
    $response = ob_get_clean();
    header('X-Fixture-Victim-Hash: ' . md5((string)$pdo->query("SELECT chords_json FROM user_chord_sets WHERE set_name='Secret'")->fetchColumn()));
    echo $response;
    return;
}
(new ChordSetController())->handleRequest($_SERVER['REQUEST_METHOD']);
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
function privacyCheck(bool $ok, string $message): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $message . "\n";
}
function requestSet(string $address, string $song, string $action, string $name, int $actor): array {
    $query = http_build_query(['route' => 'chord_sets', 'songId' => $song, 'action' => $action, 'name' => $name]);
    $curl = curl_init('http://' . $address . '/api/index.php?' . $query);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => ['X-Test-Actor: ' . $actor]]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = is_string($body) ? json_decode($body, true) : null;
    privacyCheck($status === 200 && is_array($data), "HTTP {$action}/{$name} actor={$actor} returns JSON 200");
    return $data ?? [];
}
foreach (['guest' => 0, 'owner' => 2, 'other' => 3, 'admin' => 1] as $role => $actor) {
    $list = requestSet($address, $song, 'list', '', $actor)['sets'] ?? [];
    privacyCheck(in_array('Secret', $list, true) === ($actor === 2), "{$role}: private set listed only for owner");
    privacyCheck(!in_array('DiskOnly', $list, true), "{$role}: disk scan does not publish unknown sets");
    foreach (['HD', 'TLH', 'default', 'Public', 'Secret', 'banhat__Secret', 'DiskOnly'] as $name) {
        $allowed = in_array($name, ['HD', 'TLH', 'default', 'Public'], true) || ($actor === 2 && in_array($name, ['Secret', 'banhat__Secret'], true));
        $loaded = requestSet($address, $song, 'load', $name, $actor);
        privacyCheck(!empty($loaded['chords']) === $allowed, "{$role}: {$name} chord access follows Q4");
        if (!$allowed) privacyCheck(($loaded['checksum'] ?? '') === md5('[]'), "{$role}: {$name} checksum does not disclose private state");
        $details = requestSet($address, $song, 'details', $name, $actor);
        privacyCheck(!empty($details['details']) === $allowed, "{$role}: {$name} metadata access follows Q4");
    }
}

require_once $root . '/tests/fixtures/test_db_fixture.php';
require_once $root . '/api/services/ChordSetService.php';
require_once $root . '/api/services/ManagerService.php';
foreach (['HD', 'TLH', 'default'] as $protected) {
    $curl = curl_init('http://' . $address . '/api/index.php?route=chord_sets');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['X-Test-Actor: 1', 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['action' => 'delete', 'songId' => $song, 'name' => 'banhat__' . $protected])]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = is_string($body) ? json_decode($body, true) : null;
    privacyCheck($status === 403 && ($data['success'] ?? true) === false, "HTTP admin cannot delete qualified {$protected} alias");
}
$pdo = createTestDatabase();
DB::setPdo($pdo);
putenv('CHORD_SETS_DIR=' . $dir . '/sets');
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public) VALUES (?, 2, 'banhat', 'Secret', 0)")->execute([$song]);
privacyCheck(!ChordSetService::deleteSet($song, 'Secret', 3), 'Other user cannot delete private set');
privacyCheck(is_file($dir . '/sets/' . $song . '/Secret.json'), 'Denied DB delete preserves disk file');
privacyCheck(!ChordSetService::deleteSet($song, 'Secret'), 'Anonymous service caller cannot delete private set');
privacyCheck(ChordSetService::deleteSet($song, 'Secret', 2), 'Owner can delete own private set');
privacyCheck(!is_file($dir . '/sets/' . $song . '/Secret.json'), 'Authorized delete removes disk export');
foreach (['HD', 'TLH', 'default'] as $protected) {
    foreach (['owner' => [2, false], 'admin' => [1, true]] as $role => [$actor, $admin]) {
        $pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public) VALUES (?, 2, 'banhat', ?, 1)")->execute([$song, $protected]);
        $protectedId = (int)$pdo->lastInsertId();
        $alias = 'banhat__' . $protected;
        $file = $dir . '/sets/' . $song . '/' . $alias . '.json';
        file_put_contents($file, '[]');
        privacyCheck(!ChordSetService::deleteSet($song, $alias, $actor, $admin), "{$role}: service rejects {$protected} alias deletion");
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM user_chord_sets WHERE song_id = ? AND set_name = ?');
        $stmt->execute([$song, $protected]);
        privacyCheck((int)$stmt->fetchColumn() === 1 && is_file($file), "{$role}: protected {$protected} row and disk export survive");
        $_SESSION = ['user_id' => $actor, 'username' => $admin ? 'admin' : 'banhat'];
        Auth::resetDbCache();
        $managerResult = ManagerService::deleteUserChordSet($protectedId);
        $stmt->execute([$song, $protected]);
        privacyCheck(!($managerResult['success'] ?? true) && (int)$stmt->fetchColumn() === 1, "{$role}: Manager also preserves protected {$protected} row");
        $pdo->prepare('DELETE FROM user_chord_sets WHERE song_id = ? AND set_name = ?')->execute([$song, $protected]);
    }
}
$_SESSION = ['user_id' => 2, 'username' => 'banhat'];
Auth::resetDbCache();
$pdo->prepare("INSERT INTO user_chord_sets (song_id, user_id, username, set_name, is_public) VALUES (?, 2, 'banhat', 'Personal', 0)")->execute([$song]);
$personalId = (int)$pdo->lastInsertId();
$personalFile = $dir . '/sets/' . $song . '/banhat__Personal.json';
file_put_contents($personalFile, '[]');
$deleted = ManagerService::deleteUserChordSet($personalId);
$stmt = $pdo->prepare('SELECT COUNT(*) FROM user_chord_sets WHERE id = ?');
$stmt->execute([$personalId]);
privacyCheck(($deleted['success'] ?? false) && (int)$stmt->fetchColumn() === 0 && !is_file($personalFile), 'Manager still deletes an owned personal row and disk export');
foreach ([3 => 404, 2 => 200] as $actor => $expected) {
    $victimHash = '';
    $curl = curl_init('http://' . $address . '/api/index.php?route=reviews&action=submit');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['X-Test-Actor: ' . $actor, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['song_id' => $song, 'set_name' => 'Secret']),
        CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$victimHash): int {
            if (stripos($header, 'X-Fixture-Victim-Hash:') === 0) $victimHash = trim(substr($header, strlen('X-Fixture-Victim-Hash:')));
            return strlen($header);
        }]);
    curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE); curl_close($curl);
    privacyCheck($status === $expected, "HTTP review submission actor={$actor} obeys owner-only name resolution");
    privacyCheck($victimHash === md5(json_encode([['chord' => 'Secret']])), "HTTP review actor={$actor} never changes private victim chords");
}
foreach ([0=>404,2=>200,3=>404,1=>200] as $actor=>$expected) {
    $curl=curl_init('http://'.$address.'/api/index.php?route=songs&action=version_xml');
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_HTTPHEADER=>['X-Test-Actor: '.$actor]]);
    $body=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);$type=curl_getinfo($curl,CURLINFO_CONTENT_TYPE);curl_close($curl);
    privacyCheck($status===$expected,'HTTP private version XML access actor='.$actor);
    if ($expected===200) privacyCheck(str_contains((string)$type,'application/xml')&&str_contains((string)$body,'<score-partwise'),'Allowed version XML has XML content type and sheet content');
    else privacyCheck(!str_contains((string)$body,'<score-partwise'),'Denied version response does not disclose XML');
}
echo "SUITE_COMPLETE total={$total}\n";
exit($failed > 0 ? 1 : 0);
