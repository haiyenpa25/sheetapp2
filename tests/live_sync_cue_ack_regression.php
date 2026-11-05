<?php
declare(strict_types=1);

/**
 * tests/live_sync_cue_ack_regression.php — Band nhạc: thành viên báo "đã nhận" lệnh (cue), Ca trưởng đếm được.
 * Kiểm: ack ghi vào presence (không đụng state Host), đếm đúng theo mã lệnh, lệnh mới đặt lại bộ đếm,
 * nhịp tim (poll) không xóa ack, thiết bị hết hạn không tính, mã không hợp lệ bị chặn, phòng không tồn tại báo lỗi.
 */
if (PHP_SAPI !== 'cli') { exit('CLI only'); }

$total = 0;
function checkAck(bool $ok, string $label): void {
    global $total;
    ++$total;
    echo ($ok ? 'PASS: ' : 'FAIL: ') . $label . "\n";
    if (!$ok) { echo "SUITE_COMPLETE total={$total}\n"; exit(1); }
}

$root = dirname(__DIR__);
require_once $root . '/api/services/LiveSyncService.php';

$tmpDir = sys_get_temp_dir() . '/sheetapp_ls_ack_' . bin2hex(random_bytes(4));
LiveSyncService::setRoomDir($tmpDir);
$room = 'ACK' . strtoupper(bin2hex(random_bytes(3)));

$created = LiveSyncService::createRoom($room, ['leader' => ['clientId' => 'host-1', 'name' => 'Ca Trưởng']]);
checkAck(!empty($created['success']), 'Tạo phòng thử');
$hostToken = (string)($created['hostToken'] ?? '');

// 3 thiết bị vào phòng (poll ghi presence)
foreach (['dev-a' => 'guitar', 'dev-b' => 'piano', 'dev-c' => 'drummer'] as $id => $role) {
    LiveSyncService::pollRoom($room, 0, $id, $role);
}
$before = LiveSyncService::cueAcks($room, 'cue-1');
checkAck($before['success'] && $before['acked'] === 0 && $before['total'] === 3, 'Chưa ai nhận: 0/3');

checkAck(LiveSyncService::ackCue($room, 'dev-a', 'cue-1')['success'], 'dev-a báo nhận cue-1');
checkAck(LiveSyncService::ackCue($room, 'dev-b', 'cue-1')['success'], 'dev-b báo nhận cue-1');
$mid = LiveSyncService::cueAcks($room, 'cue-1');
checkAck($mid['acked'] === 2 && $mid['total'] === 3, 'Đếm đúng 2/3');

LiveSyncService::ackCue($room, 'dev-a', 'cue-1');
checkAck(LiveSyncService::cueAcks($room, 'cue-1')['acked'] === 2, 'Báo nhận hai lần không đếm đôi');

// Nhịp tim lần sau (poll sau ≥4s) không xóa ack: ép lastSeen cũ để buộc ghi lại
$pFile = $tmpDir . '/' . strtolower($room) . '.presence.json';
$members = json_decode((string)file_get_contents($pFile), true);
$members['dev-a']['lastSeen'] = time() - 6;
file_put_contents($pFile, json_encode($members));
LiveSyncService::pollRoom($room, 0, 'dev-a', 'guitar');
checkAck(LiveSyncService::cueAcks($room, 'cue-1')['acked'] === 2, 'Nhịp tim (poll) không làm mất ack');

// Lệnh mới: bộ đếm riêng, không dính lệnh cũ
checkAck(LiveSyncService::cueAcks($room, 'cue-2')['acked'] === 0, 'Lệnh mới bắt đầu từ 0');
LiveSyncService::ackCue($room, 'dev-c', 'cue-2');
checkAck(LiveSyncService::cueAcks($room, 'cue-2')['acked'] === 1, 'cue-2: dev-c đã nhận → 1/3');

// Thiết bị rời đi (quá 15 giây) không tính vào tổng
$members = json_decode((string)file_get_contents($pFile), true);
$members['dev-b']['lastSeen'] = time() - 60;
file_put_contents($pFile, json_encode($members));
$after = LiveSyncService::cueAcks($room, 'cue-1');
checkAck($after['total'] === 2 && $after['acked'] === 1, 'Thiết bị hết hạn không tính (1/2)');

// State của Host không bị follower sửa
$state = json_decode((string)file_get_contents($tmpDir . '/' . strtolower($room) . '.json'), true);
checkAck(($state['hostToken'] ?? '') === $hostToken, 'ack không đụng state của Host');

// Đầu vào xấu
checkAck(!LiveSyncService::ackCue($room, 'dev x', 'cue-1')['success'], 'Mã thiết bị có khoảng trắng bị chặn');
checkAck(!LiveSyncService::ackCue($room, 'dev-a', '../etc')['success'], 'Mã lệnh chứa ký tự lạ bị chặn');
checkAck(!LiveSyncService::cueAcks($room, '')['success'], 'Thiếu mã lệnh bị chặn');
checkAck(!LiveSyncService::ackCue('KHONGCO', 'dev-a', 'cue-1')['success'], 'Phòng không tồn tại báo lỗi');

array_map('unlink', glob($tmpDir . '/*') ?: []);
@rmdir($tmpDir);
echo "SUITE_COMPLETE total={$total}\n";
