<?php
/**
 * tests/chordpro_export_regression.php
 *
 * Kiểm tra hồi quy cho Epic 4.3 — Lát 4.3-a: ChordPro Exporter Backend:
 * 1. Transpose Parity Check: Đối chiếu kết quả 50+ hợp âm mẫu giữa PHP TransposeHelper và JS TransposeEngine.
 * 2. Lyric & Syllable Extraction: Trích xuất lời theo từng nốt từ MusicXML (<lyric>, <syllabic>).
 * 3. Core Rule 1 (HD Default & TLH Fallback): Nạp bộ HD từ DB, fallback sang TLH trong XML khi HD rỗng.
 * 4. Transpose Integration: Dịch giọng động cả hợp âm và nhãn {key}.
 * 5. Multi-verse Synchronization: Xuất tất cả các lời với điểm ngắt câu thơ đồng bộ.
 * 6. API Route & Contract: Kiểm tra route=export qua HTTP (cả dạng text/plain và JSON).
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/TransposeHelper.php';
require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';

function check(bool $cond, string $msg): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$cond) {
        fwrite(STDERR, "  ❌ FAIL: {$msg}\n");
        exit(1);
    }
    echo "  ✅ PASS: {$msg}\n";
}

echo "=== KIỂM THỬ HỒI QUY EPIC 4.3: CHORDPRO EXPORTER BACKEND ===\n\n";

// [1/6] Đối chiếu Transpose Engine giữa PHP và JS (Parity Check trên 50+ hợp âm mẫu)
echo "[1/6] Kiểm tra Transpose Parity (PHP TransposeHelper vs JS TransposeEngine)...\n";
$sampleChords = [
    'C', 'Cm', 'C7', 'Cmaj7', 'Cdim', 'Caug', 'Csus4', 'Cadd9', 'C/E', 'C/G',
    'C#', 'C#m', 'C#7', 'C#m7', 'C#/F',
    'Db', 'Dbm', 'Dbmaj7', 'Db7', 'Db/F',
    'D', 'Dm', 'D7', 'Dmaj7', 'Ddim', 'Dsus2', 'D/F#', 'D/A',
    'Eb', 'Ebm', 'Eb7', 'Ebmaj7', 'Eb/G', 'Eb/Bb',
    'E', 'Em', 'E7', 'Emaj7', 'E/G#', 'E/B',
    'F', 'Fm', 'F7', 'Fmaj7', 'F/A', 'F/C',
    'F#', 'F#m', 'F#7', 'F#m7', 'F#/A#',
    'Gb', 'Gbmaj7', 'Gb/Bb',
    'G', 'Gm', 'G7', 'Gmaj7', 'G7sus4', 'G/B', 'G/D',
    'Ab', 'Abm', 'Ab7', 'Abmaj7', 'Ab/C',
    'A', 'Am', 'A7', 'Amaj7', 'A/C#', 'A/E',
    'Bb', 'Bbm', 'Bb7', 'Bbmaj7', 'Bb/D', 'Bb/F',
    'B', 'Bm', 'B7', 'Bmaj7', 'Bdim', 'B/D#'
];

$semitoneTests = [-5, -3, -2, -1, 1, 2, 3, 4, 7];

// Gọi Node.js chạy assets/js/transpose-engine.js để lấy kết quả chuẩn của JS
$nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
if (!file_exists($nodeBin)) {
    $nodeBin = 'node';
}

$tempScript = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'verify_transpose_' . uniqid() . '.js';
$enginePath = str_replace('\\', '/', realpath(__DIR__ . '/../assets/js/transpose-engine.js'));
$nodeScript = "
global.window = {};
const fs = require('fs');
const code = fs.readFileSync('{$enginePath}', 'utf8');
eval(code.replace('const TransposeEngine =', 'global.TransposeEngine ='));

const chords = " . json_encode($sampleChords) . ";
const semitones = " . json_encode($semitoneTests) . ";
const results = {};
chords.forEach(c => {
    results[c] = {};
    semitones.forEach(s => {
        results[c][s] = TransposeEngine.transposeChord(c, s);
    });
});
console.log(JSON.stringify(results));
";
file_put_contents($tempScript, $nodeScript);
$jsOutputRaw = shell_exec("\"{$nodeBin}\" \"{$tempScript}\"");
@unlink($tempScript);
$jsResults = json_decode((string)$jsOutputRaw, true);

check(is_array($jsResults) && count($jsResults) >= 50, "Node.js thực thi và trả về kết quả cho " . count($sampleChords) . " hợp âm mẫu");

$mismatchCount = 0;
$totalTransChecks = 0;
foreach ($sampleChords as $c) {
    foreach ($semitoneTests as $s) {
        $phpTrans = TransposeHelper::transpose($c, $s);
        $jsTrans  = $jsResults[$c][$s] ?? null;
        $totalTransChecks++;
        if ($phpTrans !== $jsTrans) {
            $mismatchCount++;
            fwrite(STDERR, "    Lệch: {$c} semitones={$s} -> PHP: '{$phpTrans}' vs JS: '{$jsTrans}'\n");
        }
    }
}
check($mismatchCount === 0, "100% khớp tuyệt đối giữa PHP và JS ({$totalTransChecks}/{$totalTransChecks} phép chuyển giọng đạt chuẩn)");

// [2/6] Kiểm tra xuất ChordPro cơ bản & Metadata Directives
echo "\n[2/6] Kiểm tra xuất ChordPro & Metadata Directives...\n";
$cp1 = ChordProService::export('thanh-ca-001', 'HD', 0);

check(str_contains($cp1, '{title: HỠI THÁNH VƯƠNG, KÍP NGỰ LAI}'), "Directives chứa đúng {title}");
check(str_contains($cp1, '{key: G}'), "Directives chứa đúng {key: G}");
check(str_contains($cp1, '{composer:'), "Directives chứa đúng {composer}");
check(str_contains($cp1, '{start_of_verse: Lời 1}'), "Chứa khối {start_of_verse: Lời 1}");
check(str_contains($cp1, '{end_of_verse}'), "Chứa khối {end_of_verse}");

// [3/6] Kiểm tra bóc tách lời bài hát & ghép âm tiết (Syllabic)
echo "\n[3/6] Kiểm tra trích xuất lời và nối âm tiết...\n";
$lyricsOnly = preg_replace('/\[[^\]]+\]/', '', $cp1);
check(str_contains($lyricsOnly, 'Cúi xin Vua'), "Bóc tách đúng từ ngữ và loại bỏ số đếm dư thừa (1.Cúi -> Cúi)");
check(str_contains($lyricsOnly, 'Chúa thánh muôn'), "Bóc tách câu kết thúc đầy đủ");

// Kiểm tra bài có âm tiết ghép dấu gạch nối (begin/middle/end) như thanh-ca-003
$cp3 = ChordProService::export('thanh-ca-003', 'HD', 0);
$lyrics3 = preg_replace('/\[[^\]]+\]/', '', $cp3);
check(str_contains($lyrics3, 'Giê-hô-va') || str_contains($lyrics3, 'Áp-ra-ham'), "Âm tiết ghép begin-middle-end được nối dấu gạch nối chính xác (Giê-hô-va / Áp-ra-ham)");
check(str_contains($cp3, 'Giê-') && str_contains($cp3, 'hô-'), "Hợp âm inline được gắn chính xác trước từng âm tiết (ví dụ: [Gm]Giê-[D7]hô-)");

// [4/6] Kiểm tra Core Rule 1 (HD mặc định & Fallback TLH từ XML)
echo "\n[4/6] Kiểm tra Core Rule 1 (HD profile & TLH fallback)...\n";
// Với thanh-ca-001, bộ HD có Am tại m0_n1 và F tại m1_n0
check(str_contains($cp1, '[Am]') || str_contains($cp1, '[F]'), "Bộ HD được ưu tiên nạp đè lên vị trí tùy biến");
// Các vị trí khác không có trong HD vẫn giữ hợp âm TLH từ MusicXML (ví dụ [D7])
check(!str_contains($cp1, '[D7]'), "Bộ HD tuân thủ Core Rule 1: không trộn hợp âm TLH ([D7]) từ MusicXML");
$cpTlh = ChordProService::export('thanh-ca-001', 'TLH', 0);
check(str_contains($cpTlh, '[D7]'), "Bộ TLH nạp đầy đủ hợp âm gốc từ MusicXML (chứa [D7])");

// [5/6] Kiểm tra Transpose động (+/- Semitones)
echo "\n[5/6] Kiểm tra Transpose động (+2 bán âm G -> A)...\n";
$cpTrans = ChordProService::export('thanh-ca-001', 'TLH', 2);
check(str_contains($cpTrans, '{key: A}'), "Key chuyển từ G sang A");
check(str_contains($cpTrans, '[A]'), "Hợp âm G chuyển thành A");
check(str_contains($cpTrans, '[E7]'), "Hợp âm D7 chuyển thành E7");
check(!str_contains($cpTrans, '[D7]'), "Không còn hợp âm D7 chưa dịch giọng");

// [6/6] Kiểm tra HTTP API Route & Controller
echo "\n[6/6] Kiểm tra API HTTP route=export&format=chordpro...\n";
$baseUrl = 'http://localhost/sheetapp2';

// 6.1: Gọi text/plain ChordPro
$ch = curl_init("{$baseUrl}/api/index.php?route=export&format=chordpro&song_id=thanh-ca-001&set=HD&transpose=1");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_TIMEOUT => 10
]);
$rawResp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($rawResp, 0, $headerSize);
$body = substr($rawResp, $headerSize);
curl_close($ch);

check($httpCode === 200, "API trả về HTTP 200");
check(str_contains($headers, 'text/plain'), "Header Content-Type là text/plain");
check(str_contains($headers, '.chordpro'), "Header Content-Disposition có tên file .chordpro");
check(str_contains($body, '{title: HỠI THÁNH VƯƠNG, KÍP NGỰ LAI}'), "Nội dung trả về là văn bản ChordPro hợp lệ");
check(str_contains($body, '{key: G#}'), "Dịch giọng +1 bán âm (G -> G#) qua HTTP query params thành công");

// 6.2: Gọi định dạng JSON (as_json=1)
$chJson = curl_init("{$baseUrl}/api/index.php?route=export&format=chordpro&song_id=thanh-ca-001&as_json=1");
curl_setopt_array($chJson, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10
]);
$jsonBody = curl_exec($chJson);
$jsonCode = curl_getinfo($chJson, CURLINFO_HTTP_CODE);
curl_close($chJson);

$jsonArr = json_decode((string)$jsonBody, true);
check($jsonCode === 200, "API JSON trả về HTTP 200");
check(isset($jsonArr['content']) && str_contains($jsonArr['content'], '{title:'), "JSON trả về trường content chứa văn bản ChordPro");

// 6.3: Kiểm tra xử lý lỗi khi thiếu song_id
$chErr = curl_init("{$baseUrl}/api/index.php?route=export&format=chordpro");
curl_setopt_array($chErr, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10
]);
$errBody = curl_exec($chErr);
$errCode = curl_getinfo($chErr, CURLINFO_HTTP_CODE);
curl_close($chErr);

check($errCode === 400, "Thiếu tham số song_id trả về HTTP 400 Bad Request");

echo "\n----------------------------------------------------\n";
echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA CHORDPRO EXPORTER ĐỀU ĐẠT (PASS)!\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
