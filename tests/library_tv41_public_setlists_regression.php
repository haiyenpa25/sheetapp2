<?php
declare(strict_types=1);
ob_start(); // Keep CLI progress output from committing simulated HTTP headers.
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/fixtures/tv41_setlists.php';
require_once __DIR__ . '/../api/controllers/SetlistController.php';
$pdo = createTestDatabase();
DB::setPdo($pdo);
$fixture = seedTv41Setlists($pdo);
$pdo->exec("INSERT OR IGNORE INTO users (username, password_hash, role, status) VALUES ('viewer_tv41', 'x', 'viewer', 'active')");
$viewerId = (int)$pdo->query("SELECT id FROM users WHERE username='viewer_tv41'")->fetchColumn();
$checks = 0; $failed = 0;
function checkPublicPlan(bool $ok, string $label): void {
    global $checks, $failed;
    ++$checks; if (!$ok) ++$failed;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
function readPlan(array $query, ?int $user = null, string $username = 'banhat'): array {
    $_SESSION = $user ? ['user_id' => $user, 'username' => $username] : [];
    Auth::resetDbCache(); $_GET = $query; http_response_code(200);
    ob_start(); (new SetlistController())->handleRequest('GET');
    return ['body' => json_decode(ob_get_clean(), true), 'status' => http_response_code()];
}

// Khách (chưa đăng nhập) không thấy gì về chương trình: mọi đường đọc đều 401 và không kèm dữ liệu.
$guestReads = [
    'danh sách'            => [],
    'chi tiết published'   => ['id' => $fixture['published']],
    'chi tiết draft'       => ['id' => $fixture['draft']],
    'lịch sử dùng bài'     => ['action' => 'song_usage', 'song_id' => $fixture['song']],
    'offline_package'      => ['id' => $fixture['published'], 'action' => 'offline_package'],
    'manifest'             => ['id' => $fixture['published'], 'action' => 'manifest'],
];
foreach ($guestReads as $label => $query) {
    $r = readPlan($query);
    checkPublicPlan($r['status'] === 401 && !isset($r['body']['data']), "Guest $label yêu cầu đăng nhập (401, không có dữ liệu)");
}

// Tài khoản viewer đã đăng nhập vẫn chỉ nhận bản rút gọn của chương trình đã công bố.
$list = readPlan([], $viewerId, 'viewer_tv41')['body']['data'];
checkPublicPlan(array_column($list, 'id') === [$fixture['published']], 'Viewer đã đăng nhập: danh sách chỉ gồm chương trình published');
$detail = readPlan(['id' => $fixture['published']], $viewerId, 'viewer_tv41')['body']['data'];
checkPublicPlan(!array_key_exists('assignments', $detail), 'Viewer: chi tiết không có assignments');
checkPublicPlan(!array_intersect(['created_by', 'leader_user_id', 'creator_name', 'leader_name'], array_keys($detail)), 'Viewer: chi tiết không lộ danh tính nhân sự');
checkPublicPlan(!str_contains(json_encode($detail), 'PRIVATE-'), 'Viewer: chi tiết không lộ mô tả nội bộ, ghi chú mục và ghi chú phân công');
$item = $detail['items'][0];
checkPublicPlan($item['chord_profile'] === 'HD' && (int)$item['transpose_key'] === 2 && (int)$item['bpm'] === 88 && (int)$item['beats_per_measure'] === 3, 'Viewer: phát lại giữ đúng bộ hợp âm, tông, tempo, số phách');
foreach (['draft', 'completed'] as $status) checkPublicPlan(readPlan(['id' => $fixture[$status]], $viewerId, 'viewer_tv41')['status'] === 404, "Viewer không đọc được chương trình $status theo ID");
checkPublicPlan(readPlan(['id' => 999999], $viewerId, 'viewer_tv41')['status'] === 404, 'Viewer: chương trình không tồn tại và không công khai đều trả 404');
$history = readPlan(['action' => 'song_usage', 'song_id' => $fixture['song']], $viewerId, 'viewer_tv41')['body']['data'];
checkPublicPlan(array_column($history['history'], 'setlist_id') === [$fixture['published']] && $history['total_used'] === 1, 'Viewer: lịch sử dùng bài không lộ chương trình draft/completed');

// Thành viên ban nhạc vẫn thấy đầy đủ.
$member = readPlan(['id' => $fixture['draft']], 2);
checkPublicPlan($member['status'] === 200 && count($member['body']['data']['assignments']) === 1, 'Thành viên đã đăng nhập giữ chi tiết draft và assignments');
checkPublicPlan(count(readPlan([], 2)['body']['data']) === 3, 'Thành viên đã đăng nhập giữ nguyên phạm vi danh sách');
echo "SUITE_COMPLETE total={$checks}\n";
exit($failed ? 1 : 0);
