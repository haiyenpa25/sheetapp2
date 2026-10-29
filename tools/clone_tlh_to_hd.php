<?php
declare(strict_types=1);

/**
 * tools/clone_tlh_to_hd.php — sao chép hợp âm TLH (trong MusicXML) vào bộ HD cho các bài mà HD đang rỗng.
 * Quyết định 2026-10-29: mọi bài có HD đầy đủ; bài nào XML không có hợp âm thì HD vẫn rỗng (hiện bản nhạc sạch).
 *
 * Quy trình (mặc định chỉ đọc):
 *   1. php tools/clone_tlh_to_hd.php --export-targets=targets.json     liệt kê bài HD rỗng + đường dẫn XML
 *   2. node tools/xml_chords_to_json.cjs targets.json plan.json        trích hợp âm bằng mã JS của sản phẩm
 *   3. php tools/clone_tlh_to_hd.php --plan=plan.json                  dry-run: báo cáo sẽ ghi gì
 *   4. php tools/clone_tlh_to_hd.php --plan=plan.json --apply          sao lưu CSDL rồi ghi qua ChordSetService::writeHd
 *
 * Mỗi bài ghi trong một transaction (writeHd) và lưu bản HD cũ vào chord_set_history. Chỉ ghi khi HD vẫn còn rỗng.
 * Hoàn tác: khôi phục file sao lưu in ra ở bước 4 (và xoá các HD.json mới ghi nếu cần).
 * Tuỳ chọn: --db=<sqlite> --limit=<n> (làm thử trên n bài đầu).
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$root = dirname(__DIR__);
require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/Auth.php';
require_once $root . '/api/services/SongService.php';
require_once $root . '/api/services/ChordSetService.php';

const HD_SET = 'HD';
const HD_OWNER_CHORD_CODE = 'HD';
const CHANGE_REASON = 'Sao chép tự động từ TLH (XML) vào HD — quyết định chủ dự án 2026-10-29';

$options = getopt('', ['db::', 'export-targets::', 'plan::', 'apply', 'limit::']);
$limit = isset($options['limit']) ? max(1, (int)$options['limit']) : null;

/** @return list<array{id:string,xmlPath:string}> bài có HD rỗng (hoặc chưa có dòng HD) */
function emptyHdSongs(PDO $pdo): array {
    $rows = $pdo->query("SELECT s.id, s.xmlPath, (SELECT u.chords_json FROM user_chord_sets u WHERE u.song_id = s.id AND u.set_name = 'HD' ORDER BY u.id LIMIT 1) AS hd FROM songs s ORDER BY s.id")->fetchAll(PDO::FETCH_ASSOC);
    $out = [];
    foreach ($rows as $r) {
        $decoded = ($r['hd'] === null || $r['hd'] === '') ? [] : json_decode((string)$r['hd'], true);
        if (!is_array($decoded) || count($decoded) === 0) $out[] = ['id' => (string)$r['id'], 'xmlPath' => (string)$r['xmlPath']];
    }
    return $out;
}

try {
    $target = isset($options['db']) ? (string)$options['db'] : $root . '/storage/data/app.sqlite';
    if (!is_file($target)) throw new RuntimeException("Không thấy CSDL: {$target}");
    DB::setPdo(DB::createConnection($target));
    $pdo = DB::get();

    if (isset($options['export-targets'])) {
        $targets = [];
        foreach (emptyHdSongs($pdo) as $song) {
            $abs = SongService::resolveManagedXmlPath($song['xmlPath']);
            if ($abs !== null && is_file($abs)) $targets[] = ['id' => $song['id'], 'path' => $abs];
        }
        if ($limit !== null) $targets = array_slice($targets, 0, $limit);
        file_put_contents((string)$options['export-targets'], json_encode($targets, JSON_UNESCAPED_UNICODE));
        echo count($targets) . " bài HD rỗng có file XML → " . $options['export-targets'] . "\n";
        exit(0);
    }

    if (!isset($options['plan'])) throw new RuntimeException('Dùng --export-targets=<file> hoặc --plan=<plan.json> (xem đầu file).');
    $plan = json_decode((string)file_get_contents((string)$options['plan']), true);
    if (!is_array($plan)) throw new RuntimeException('plan.json không hợp lệ.');

    $ownerStmt = $pdo->prepare('SELECT id, username FROM users WHERE UPPER(TRIM(chord_code)) = ? LIMIT 1');
    $ownerStmt->execute([HD_OWNER_CHORD_CODE]);
    $hdOwner = $ownerStmt->fetch(PDO::FETCH_ASSOC);
    $ownerStmt->closeCursor(); // con trỏ còn mở sẽ làm VACUUM INTO (sao lưu) thất bại
    if (!$hdOwner) throw new RuntimeException('Không có tài khoản chủ bộ HD (chord_code=HD).');

    $stillEmpty = array_flip(array_column(emptyHdSongs($pdo), 'id'));
    $todo = [];
    $skipped = 0;
    foreach ($plan as $songId => $chords) {
        if (!isset($stillEmpty[$songId])) { $skipped++; continue; }
        if (is_array($chords) && $chords) $todo[$songId] = $chords;
    }
    if ($limit !== null) $todo = array_slice($todo, 0, $limit, true);

    echo 'Chủ bộ HD: @' . $hdOwner['username'] . " (id {$hdOwner['id']})\n";
    echo 'Sẽ ghi HD cho ' . count($todo) . ' bài (tổng ' . array_sum(array_map('count', $todo)) . " hợp âm); bỏ qua {$skipped} bài HD đã có hợp âm hoặc không còn trong CSDL.\n";
    if (!isset($options['apply'])) { echo "Chạy thử (dry-run): chưa ghi gì. Thêm --apply để ghi.\n"; exit(0); }

    $backupDir = $root . '/storage/backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0775, true);
    $backup = $backupDir . '/app.before-hd-clone-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.sqlite';
    $pdo->prepare('VACUUM INTO ?')->execute([$backup]);
    echo "Đã sao lưu CSDL: {$backup}\n";

    $ok = 0; $failed = [];
    foreach ($todo as $songId => $chords) {
        try {
            ChordSetService::writeHd((string)$songId, $chords, (int)$hdOwner['id'], (string)$hdOwner['username'], CHANGE_REASON);
            if (count(ChordSetService::loadSet((string)$songId, HD_SET)) !== count($chords)) throw new RuntimeException('đọc lại không khớp số hợp âm');
            $ok++;
        } catch (Throwable $e) {
            $failed[$songId] = $e->getMessage();
        }
    }
    echo "Hoàn tất: {$ok} bài ghi thành công, " . count($failed) . " lỗi.\n";
    foreach (array_slice($failed, 0, 10, true) as $id => $msg) echo "  - {$id}: {$msg}\n";
    exit($failed ? 1 : 0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Lỗi: ' . $e->getMessage() . "\n");
    exit(1);
}
