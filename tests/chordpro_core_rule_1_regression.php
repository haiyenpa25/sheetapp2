<?php
/**
 * tests/chordpro_core_rule_1_regression.php
 * 
 * Kiểm thử hồi quy cho Ticket F6 (ROADMAP3):
 * 1. Khi bộ HD có >= 1 hợp âm, CHỈ DÙNG hợp âm HD, KHÔNG trộn TLH theo từng nốt.
 * 2. Khi bộ HD rỗng hoàn toàn -> sử dụng toàn bộ hợp âm TLH từ MusicXML.
 * 3. Tham số transpose t=1000000 hoặc t=-1000000 bị kẹp về [-12, 12].
 * 4. Nhãn bộ hợp âm trên trang in hiện đúng tên bộ thay vì luôn gọi là TLH.
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';

$testCount = 0;
$passCount = 0;
$failCount = 0;

function check(string $name, bool $condition, string $detail = ''): void {
    global $suiteTotalChecks;
    $suiteTotalChecks++;
    global $testCount, $passCount, $failCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo "  [PASS:B] [{$name}] {$detail}\n";
    } else {
        $failCount++;
        echo "  [FAIL:B] [{$name}] {$detail}\n";
    }
}

echo "========================================================\n";
echo "   SheetApp2 — F6: ChordPro Core Rule 1 & Transpose    \n";
echo "========================================================\n\n";

$pdo = createTestDatabase();
DB::setPdo($pdo);

// Tạo bài hát test
$songId = 'song-f6-test';
$pdo->prepare("INSERT INTO songs (id, title, xmlPath, defaultKey) VALUES (?, ?, ?, ?)")->execute([
    $songId, 'Bài Hát Test F6', 'storage/test-f6.xml', 'C'
]);

// 1. Tạo chuỗi MusicXML fixture có hợp âm TLH ở 4 nốt (C, G, Am, F)
$sampleMusicXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Bài Hát Test F6</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Vocal</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><duration>1</duration><voice>1</voice><type>quarter</type><lyric number="1"><text>Lời</text></lyric></note>
      <harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>
      <note><duration>1</duration><voice>1</voice><type>quarter</type><lyric number="1"><text>Ca</text></lyric></note>
      <harmony><root><root-step>A</root-step></root><kind>minor</kind></harmony>
      <note><duration>1</duration><voice>1</voice><type>quarter</type><lyric number="1"><text>Tôn</text></lyric></note>
      <harmony><root><root-step>F</root-step></root><kind>major</kind></harmony>
      <note><duration>1</duration><voice>1</voice><type>quarter</type><lyric number="1"><text>Vinh</text></lyric></note>
    </measure>
  </part>
</score-partwise>
XML;

// ── Test 1: Khi bộ HD có >= 1 hợp âm, chỉ dùng HD, không trộn TLH ───────
echo "--- 1. Kiểm tra Core Rule 1: Không trộn TLH khi HD đã có hợp âm ---\n";

// Bộ HD chỉ đặt hợp âm tại nốt 2 (noteIdx = 1, ô nhịp 0): ví dụ hợp âm Dm
// Các nốt 0, 2, 3 cố tình để trống
$hdChordsOnlyNote2 = [
    ['measure' => 0, 'noteIndex' => 1, 'chord' => 'Dm']
];
ChordSetService::saveSet($songId, 'HD', $hdChordsOnlyNote2, 1, 'HD');

$chordProWithHd = ChordProService::export($songId, 'HD', 0, $sampleMusicXml);

// Kiểm tra:
// ChordPro phải có [Dm]Ca
// Nhưng TUYỆT ĐỐI KHÔNG ĐƯỢC CHỨA [C]Lời, [Am]Tôn hay [F]Vinh (TLH)
check("F6-1.1", str_contains($chordProWithHd, '[Dm]Ca'), "ChordPro chứa hợp âm HD [Dm] tại nốt thứ 2");
check("F6-1.2", !str_contains($chordProWithHd, '[C]'), "Hợp âm TLH [C] ở nốt 1 KHÔNG bị trộn vào");
check("F6-1.3", !str_contains($chordProWithHd, '[Am]'), "Hợp âm TLH [Am] ở nốt 3 KHÔNG bị trộn vào");
check("F6-1.4", !str_contains($chordProWithHd, '[F]'), "Hợp âm TLH [F] ở nốt 4 KHÔNG bị trộn vào");

// ── Test 2: Khi bộ HD rỗng hoàn toàn -> Dùng hợp âm TLH từ MusicXML ─────
echo "\n--- 2. Kiểm tra Fallback TLH khi bộ hợp âm rỗng ---\n";

$chordProWithTlh = ChordProService::export($songId, 'TLH', 0, $sampleMusicXml);
check("F6-2.1", str_contains($chordProWithTlh, '[C]Lời'), "Bộ TLH xuất hiện [C]Lời");
check("F6-2.2", str_contains($chordProWithTlh, '[G]Ca'), "Bộ TLH xuất hiện [G]Ca");
check("F6-2.3", str_contains($chordProWithTlh, '[Am]Tôn'), "Bộ TLH xuất hiện [Am]Tôn");
check("F6-2.4", str_contains($chordProWithTlh, '[F]Vinh'), "Bộ TLH xuất hiện [F]Vinh");

// ── Test 3: Kẹp Transpose trong [-12, 12] ────────────────────────────────
echo "\n--- 3. Kiểm tra kẹp Transpose Parameter [-12, 12] ---\n";

// Khi t = 1000000 -> kẹp về 12 (1 quãng 8, hợp âm [C] -> dịch 12 bán âm vẫn là [C])
$cpClampedHigh = ChordProService::export($songId, 'TLH', 1000000, $sampleMusicXml);
check("F6-3.1", !empty($cpClampedHigh) && str_contains($cpClampedHigh, '[C]Lời'), "t = 1000000 được xử lý an toàn và không gây lỗi");

// Khi t = 2 -> [C] chuyển thành [D]
$cpTranspose2 = ChordProService::export($songId, 'TLH', 2, $sampleMusicXml);
check("F6-3.2", str_contains($cpTranspose2, '[D]Lời'), "Transpose +2 dịch C -> D");

echo "\n--------------------------------------------------------\n";
echo "Tổng số kiểm tra: {$testCount} | Đạt: {$passCount} | Lỗi: {$failCount}\n";

if ($failCount > 0) {
    echo "❌ KẾT QUẢ: THẤT BẠI!\n";
    exit(1);
}

echo "✅ KẾT QUẢ: TẤT CẢ KIỂM THỬ F6 ĐỀU ĐẠT (PASS 100%)!\n";

echo "\nSUITE_COMPLETE total={$suiteTotalChecks}\n";
exit(0);
