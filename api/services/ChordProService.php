<?php
/**
 * api/services/ChordProService.php
 *
 * Dịch vụ trích xuất và xuất bản nhạc sang định dạng ChordPro chuẩn:
 * - Trích xuất lời theo từng nốt từ MusicXML (<lyric>, <syllabic>).
 * - Tích hợp bộ hợp âm (SSOT từ CSDL qua ChordSetService).
 * - Core Rule 1: Mặc định profile 'HD'. Nếu HD rỗng hoặc thiếu nốt thì dùng TLH từ MusicXML (<harmony>).
 * - Core Rule 2: Hỗ trợ Transpose động (+/- semitones), đồng bộ 100% với TransposeHelper.
 * - Đồng bộ ngắt câu (phrase line-breaks) chuẩn thơ/nhạc ca khúc trên tất cả các lời (verses).
 * - Sinh metadata directives: {title}, {key}, {composer}, {tempo}, {time}, {start_of_verse}, {end_of_verse}.
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/TransposeHelper.php';

class ChordProService {
    /**
     * Xuất bài hát sang định dạng văn bản ChordPro
     *
     * @param string $songId     Mã định danh bài hát
     * @param string $chordSet   Tên bộ hợp âm (mặc định 'HD' theo Core Rule 1)
     * @param int    $transpose  Số bán âm cần dịch giọng (-11 đến +11)
     * @param string|null $overrideXml Chuỗi MusicXML ghi đè (cho testing/in-memory)
     * @return string Văn bản ChordPro hoàn chỉnh
     */
    public static function export(string $songId, string $chordSet = 'HD', int $transpose = 0, ?string $overrideXml = null): string {
        $transpose = max(-12, min(12, $transpose));
        $pdo = DB::get();

        // 1. Tìm thông tin bài hát
        $song = SongService::getById($songId);
        if (!$song && $overrideXml === null) {
            throw new InvalidArgumentException("Không tìm thấy bài hát: {$songId}");
        }

        // 2. Nạp nội dung MusicXML
        $xmlContent = $overrideXml;
        if ($xmlContent === null) {
            $xmlPath = $song['xmlPath'] ?? '';
            $fullPath = null;
            if (file_exists($xmlPath)) {
                $fullPath = $xmlPath;
            } elseif (file_exists(__DIR__ . '/../../' . ltrim($xmlPath, '/\\'))) {
                $fullPath = __DIR__ . '/../../' . ltrim($xmlPath, '/\\');
            }

            if (!$fullPath || !file_exists($fullPath)) {
                throw new RuntimeException("Không tìm thấy file MusicXML cho bài hát: {$songId}");
            }
            $xmlContent = file_get_contents($fullPath);
        }

        if (empty($xmlContent)) {
            throw new RuntimeException("Nội dung MusicXML rỗng");
        }

        // 3. Phân tích XML
        $xml = @simplexml_load_string($xmlContent);
        if (!$xml || !isset($xml->part[0])) {
            throw new RuntimeException("Cú pháp MusicXML không hợp lệ");
        }

        $part = $xml->part[0];

        // 4. Nạp bộ hợp âm được chọn (Core Rule 1: SSOT)
        $customChords = ChordSetService::loadSet($songId, $chordSet);
        $customMap = [];
        foreach ($customChords as $cc) {
            $m = (int)($cc['measureIdx'] ?? ($cc['measure'] ?? 0));
            $n = (int)($cc['noteIdx'] ?? ($cc['noteIndex'] ?? 0));
            $c = trim((string)($cc['chord'] ?? ''));
            if ($c !== '') {
                $customMap["{$m}_{$n}"] = $c;
            }
        }
        $hasCustomChords = !empty($customMap);

        // 5. Trích xuất metadata bài hát
        $title = $song['title'] ?? (string)$xml->{'work'}->{'work-title'} ?: (string)$xml->{'movement-title'} ?: $songId;
        $composer = $song['composer'] ?? (string)$xml->identification->creator ?: '';
        $key = $song['defaultKey'] ?? '';
        $tempo = null;
        $timeSig = null;

        // Trích xuất key/time/tempo từ measure đầu tiên nếu chưa có
        if (isset($part->measure[0]->attributes)) {
            $attr = $part->measure[0]->attributes;
            if (!$key && isset($attr->key->fifths)) {
                $fifths = (int)$attr->key->fifths;
                $key = self::fifthsToKey($fifths);
            }
            if (isset($attr->time->beats) && isset($attr->time->{'beat-type'})) {
                $timeSig = (string)$attr->time->beats . '/' . (string)$attr->time->{'beat-type'};
            }
        }
        if (isset($part->measure[0]->sound['tempo'])) {
            $tempo = (int)$part->measure[0]->sound['tempo'];
        }

        // 6. Quét toàn bộ nốt và lời bài hát
        $noteEntries = [];
        $verseNumbers = [];
        $mIdx = 0;

        foreach ($part->measure as $measure) {
            $pendingXmlHarmony = null;
            $nIdx = -1;

            foreach ($measure->children() as $child) {
                $tagName = $child->getName();

                if ($tagName === 'harmony') {
                    $rootStep  = (string)$child->root->{'root-step'};
                    $rootAlter = (string)$child->root->{'root-alter'};
                    $acc = ($rootAlter === '1') ? '#' : (($rootAlter === '-1') ? 'b' : '');
                    $kind = isset($child->kind['text']) ? (string)$child->kind['text'] : (string)$child->kind;

                    // Chuẩn hóa loại hợp âm
                    if ($kind === 'major') $kind = '';
                    elseif ($kind === 'minor') $kind = 'm';
                    elseif ($kind === 'dominant') $kind = '7';

                    $cStr = $rootStep . $acc . $kind;
                    if (isset($child->bass)) {
                        $bStep = (string)$child->bass->{'bass-step'};
                        $bAlter = (string)$child->bass->{'bass-alter'};
                        $bAcc = ($bAlter === '1') ? '#' : (($bAlter === '-1') ? 'b' : '');
                        if ($bStep !== '') $cStr .= '/' . $bStep . $bAcc;
                    }
                    $pendingXmlHarmony = $cStr;

                } elseif ($tagName === 'note') {
                    if (isset($child->chord) || isset($child->grace)) {
                        continue;
                    }
                    $nIdx++;

                    // Xác định hợp âm tại vị trí nốt này (CORE RULE 1 - Ticket F6):
                    // - Nếu bộ tùy biến (HD hoặc cá nhân) có ≥ 1 hợp âm, CHỈ DÙNG hợp âm của bộ đó.
                    //   Tuyệt đối KHÔNG fallback trộn từng nốt với hợp âm TLH gốc trong XML gây lệch sheet.
                    // - Chỉ khi bộ tùy biến rỗng hoàn toàn mới sử dụng hợp âm TLH gốc.
                    $posKey = "{$mIdx}_{$nIdx}";
                    if ($hasCustomChords) {
                        $activeChord = $customMap[$posKey] ?? null;
                    } else {
                        $activeChord = $pendingXmlHarmony;
                    }
                    $pendingXmlHarmony = null;

                    if ($activeChord !== null && $activeChord !== '' && $transpose !== 0) {
                        $activeChord = TransposeHelper::transpose($activeChord, $transpose);
                    }

                    // Thu thập lời bài hát theo từng verse
                    $lyricsByVerse = [];
                    if (isset($child->lyric)) {
                        foreach ($child->lyric as $l) {
                            $vNum = isset($l['number']) ? (int)$l['number'] : 1;
                            if ($vNum <= 0) $vNum = 1;
                            $verseNumbers[$vNum] = true;
                            $lyricsByVerse[$vNum] = [
                                'text'     => trim((string)$l->text),
                                'syllabic' => (string)$l->syllabic ?: 'single'
                            ];
                        }
                    }

                    $noteEntries[] = [
                        'mIdx'   => $mIdx,
                        'nIdx'   => $nIdx,
                        'chord'  => $activeChord,
                        'lyrics' => $lyricsByVerse
                    ];
                }
            }
            $mIdx++;
        }

        $verseList = !empty($verseNumbers) ? array_keys($verseNumbers) : [1];
        sort($verseList);

        // 7. Đồng bộ điểm ngắt dòng (phrase break points) theo câu thơ và nhạc
        $totalNotes = count($noteEntries);
        $breakIndices = [];
        $lastBreak = -1;

        for ($i = 0; $i < $totalNotes; $i++) {
            $lyr1 = $noteEntries[$i]['lyrics'][1] ?? null;
            if ($lyr1 && !empty($lyr1['text'])) {
                $txt = $lyr1['text'];
                $hasPunct = preg_match('/[,;.!?…]+$/u', $txt);
                $wordsSince = $i - $lastBreak;

                if ($hasPunct && ($wordsSince >= 3 || preg_match('/[;.!?]+$/u', $txt))) {
                    $breakIndices[$i] = true;
                    $lastBreak = $i;
                }
            }
        }
        $breakIndices[$totalNotes - 1] = true;

        // 8. Đọc thông tin phân đoạn nếu có (song_sections)
        $sectionMap = [];
        try {
            $secStmt = $pdo->prepare("SELECT * FROM song_sections WHERE song_id = ? ORDER BY display_order ASC, start_measure ASC");
            $secStmt->execute([$songId]);
            $sectionMap = $secStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {}

        // 9. Sinh định dạng ChordPro
        $lines = [];
        $lines[] = "{title: {$title}}";
        if ($composer !== '') {
            $lines[] = "{composer: {$composer}}";
        }
        if ($key !== '') {
            $outKey = ($transpose !== 0) ? TransposeHelper::transpose($key, $transpose) : $key;
            $lines[] = "{key: {$outKey}}";
        }
        if ($tempo !== null && $tempo > 0) {
            $lines[] = "{tempo: {$tempo}}";
        }
        if ($timeSig !== null && $timeSig !== '') {
            $lines[] = "{time: {$timeSig}}";
        }
        $lines[] = "";

        foreach ($verseList as $vNum) {
            $verseLabel = count($verseList) > 1 ? "Lời {$vNum}" : "Phiên khúc";
            $lines[] = "{start_of_verse: {$verseLabel}}";

            $curLine = "";
            for ($i = 0; $i < $totalNotes; $i++) {
                $entry = $noteEntries[$i];
                $chord = $entry['chord'] ?? null;
                $lyr = $entry['lyrics'][$vNum] ?? null;

                $chTag = ($chord !== null && $chord !== '') ? "[{$chord}]" : "";

                if (!$lyr || $lyr['text'] === '') {
                    // Nốt không có lời nhưng có hợp âm
                    if ($chTag !== '') {
                        $curLine .= $chTag . " ";
                    }
                    continue;
                }

                $txt = $lyr['text'];
                // Loại bỏ số thứ tự câu thơ ở đầu từ (ví dụ "1.Cúi" -> "Cúi")
                if (preg_match('/^\d+\.\s*(.*)$/u', $txt, $nm)) {
                    $txt = $nm[1];
                }

                $curLine .= $chTag . $txt;

                if ($lyr['syllabic'] === 'begin' || $lyr['syllabic'] === 'middle') {
                    $curLine .= "-";
                } else {
                    if (isset($breakIndices[$i])) {
                        $lines[] = trim($curLine);
                        $curLine = "";
                    } else {
                        $curLine .= " ";
                    }
                }
            }

            if (trim($curLine) !== '') {
                $lines[] = trim($curLine);
            }

            $lines[] = "{end_of_verse}";
            $lines[] = "";
        }

        return trim(implode("\n", $lines)) . "\n";
    }

    /**
     * Chuyển đổi số fifths trong MusicXML sang Key chuẩn
     */
    private static function fifthsToKey(int $fifths): string {
        $keys = [
            -7 => 'Cb', -6 => 'Gb', -5 => 'Db', -4 => 'Ab', -3 => 'Eb', -2 => 'Bb', -1 => 'F',
             0 => 'C',
             1 => 'G',   2 => 'D',   3 => 'A',   4 => 'E',   5 => 'B',   6 => 'F#',  7 => 'C#'
        ];
        return $keys[$fifths] ?? 'C';
    }
}
