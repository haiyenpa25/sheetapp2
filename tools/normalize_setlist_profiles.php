<?php
declare(strict_types=1);

// Đưa các dòng bài hát trong chương trình đang để bộ trống/TLH (`default`) về bộ HD mặc định.
// Mặc định chỉ XEM TRƯỚC; thêm --apply để ghi (có sao lưu CSDL trước). Bộ cá nhân của người dùng không bị đụng tới.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/core/DB.php';
$options = getopt('', ['apply', 'db:']);
$target = $options['db'] ?? dirname(__DIR__) . '/storage/data/app.sqlite';
$pdo = DB::createConnection($target);
$rows = $pdo->query("SELECT id, setlist_id, song_id, chord_profile FROM setlist_items
                     WHERE COALESCE(item_type,'song')='song' AND song_id != ''
                       AND (chord_profile IS NULL OR TRIM(chord_profile)='' OR chord_profile='default')")->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) echo "  chương trình #{$r['setlist_id']} · {$r['song_id']} · '" . ($r['chord_profile'] ?? '') . "' → HD\n";
echo count($rows) . " dòng cần đổi.\n";
if (!isset($options['apply']) || !$rows) { echo isset($options['apply']) ? '' : "Chạy lại với --apply để ghi.\n"; exit(0); }
$backup = $target . '.before-setlist-hd-' . date('Ymd-His') . '.sqlite';
$pdo->prepare('VACUUM INTO ?')->execute([$backup]);
$n = $pdo->exec("UPDATE setlist_items SET chord_profile='HD'
                 WHERE COALESCE(item_type,'song')='song' AND song_id != ''
                   AND (chord_profile IS NULL OR TRIM(chord_profile)='' OR chord_profile='default')");
echo "Đã đổi {$n} dòng. Sao lưu: {$backup}\n";
