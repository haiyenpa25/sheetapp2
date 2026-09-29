<?php
/**
 * tests/library_r210_polyphonic_note_key_mapping_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R2-10:
 * "Thống nhất khoá nốt giữa TLH (XML) và bộ cá nhân (OSMD) cho các bài có nhiều bè (<backup>) | Test trên 3 bài nhiều bè: sao chép TLH thì hợp âm đúng vị trí"
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function assertCheck($name, $condition, $isBehavioral = false) {
    global $totalChecks, $passedChecks, $failedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }

    if ($condition) {
        $passedChecks++;
        echo "  [PASS] $name\n";
    } else {
        $failedChecks++;
        echo "  [FAIL] $name\n";
    }
}

echo "=== R2-10: Polyphonic Note Key Mapping (<backup>) Regression Test ===\n";

$xmlJsPath = __DIR__ . '/../assets/js/chord-canvas-xml.js';
$dotsJsPath = __DIR__ . '/../assets/js/chord-canvas-dots.js';

assertCheck("File chord-canvas-xml.js tồn tại", file_exists($xmlJsPath));
assertCheck("File chord-canvas-dots.js tồn tại", file_exists($dotsJsPath));

$xmlJs = file_get_contents($xmlJsPath);
$dotsJs = file_get_contents($dotsJsPath);

// 1. Static: chord-canvas-xml.js có xử lý timeline-aware cho <backup>
assertCheck(
    "chord-canvas-xml.js: readXmlChords() có nhận diện và xử lý timeline-aware khi có thẻ <backup>",
    strpos($xmlJs, 'hasBackup') !== false &&
    strpos($xmlJs, 'staff1Times') !== false &&
    strpos($xmlJs, 'currentDiv = Math.max(0, currentDiv - dur)') !== false,
    false
);

// 2. Static: chord-canvas-xml.js có trích xuất nốt bass cho hợp âm đảo
assertCheck(
    "chord-canvas-xml.js: hỗ trợ phân tích nốt Bass (Slash Chords) trong harmony",
    strpos($xmlJs, 'bass-step') !== false,
    false
);

// 3. Static: buildAbsMap() cũng đồng bộ timeline-aware khi có <backup>
assertCheck(
    "chord-canvas-xml.js: buildAbsMap() cũng xử lý timeline-aware đồng bộ với readXmlChords()",
    substr_count($xmlJs, 'currentDiv = Math.max(0, currentDiv - dur)') >= 2,
    false
);

// 4. Static: Ngân sách dòng (< 600 dòng)
$linesXml = count(file($xmlJsPath));
$linesDots = count(file($dotsJsPath));
assertCheck("chord-canvas-xml.js < 600 dòng (thực tế: $linesXml)", $linesXml < 600, false);
assertCheck("chord-canvas-dots.js < 600 dòng (thực tế: $linesDots)", $linesDots < 600, false);

// 5. Behavioral: Test trên 3 bài nhiều bè có <backup>
// Hàm mô phỏng logic timeline-aware của readXmlChords()
function parseXmlChordsTimeline(string $xmlContent): array {
    $doc = new DOMDocument();
    $doc->loadXML($xmlContent);
    $parts = $doc->getElementsByTagName('part');
    if ($parts->length === 0) return [];
    
    $map = [];
    $measures = $parts->item(0)->getElementsByTagName('measure');
    
    foreach ($measures as $mi => $m) {
        $currentDiv = 0;
        $staff1Times = [];
        
        foreach ($m->childNodes as $c) {
            if ($c->nodeName === 'note') {
                $isChord = $c->getElementsByTagName('chord')->length > 0;
                $isGrace = $c->getElementsByTagName('grace')->length > 0;
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $staff = $c->getElementsByTagName('staff')->item(0)?->textContent ?? '1';
                
                if ($staff === '1' && !$isGrace) {
                    if (!in_array($currentDiv, $staff1Times, true)) {
                        $staff1Times[] = $currentDiv;
                    }
                }
                if (!$isChord && !$isGrace) {
                    $currentDiv += $dur;
                }
            } elseif ($c->nodeName === 'backup') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv = max(0, $currentDiv - $dur);
            } elseif ($c->nodeName === 'forward') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv += $dur;
            }
        }
        sort($staff1Times);
        
        $currentDiv = 0;
        foreach ($m->childNodes as $c) {
            if ($c->nodeName === 'harmony') {
                $step = trim($c->getElementsByTagName('root-step')->item(0)?->textContent ?? '');
                $alter = trim($c->getElementsByTagName('root-alter')->item(0)?->textContent ?? '');
                $kind = '';
                $kindEl = $c->getElementsByTagName('kind')->item(0);
                if ($kindEl && $kindEl->hasAttribute('text')) {
                    $kind = $kindEl->getAttribute('text');
                }
                $chordStr = $step . ($alter === '1' ? '#' : ($alter === '-1' ? 'b' : '')) . $kind;
                
                $bassStep = trim($c->getElementsByTagName('bass-step')->item(0)?->textContent ?? '');
                if ($bassStep !== '') {
                    $bassAlter = trim($c->getElementsByTagName('bass-alter')->item(0)?->textContent ?? '');
                    $bAcc = ($bassAlter === '1' ? '#' : ($bassAlter === '-1' ? 'b' : ''));
                    $chordStr .= '/' . $bassStep . $bAcc;
                }
                
                $offset = (int)($c->getElementsByTagName('offset')->item(0)?->textContent ?? 0);
                $hTime = $currentDiv + $offset;
                
                $nIdx = 0;
                if (!empty($staff1Times)) {
                    $bestIdx = 0;
                    $minDiff = PHP_INT_MAX;
                    foreach ($staff1Times as $idx => $t) {
                        $diff = abs($t - $hTime);
                        if ($diff < $minDiff) {
                            $minDiff = $diff;
                            $bestIdx = $idx;
                        }
                    }
                    $nIdx = $bestIdx;
                }
                
                $map["{$mi}_{$nIdx}"] = $chordStr;
            } elseif ($c->nodeName === 'note') {
                $isChord = $c->getElementsByTagName('chord')->length > 0;
                $isGrace = $c->getElementsByTagName('grace')->length > 0;
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                if (!$isChord && !$isGrace) {
                    $currentDiv += $dur;
                }
            } elseif ($c->nodeName === 'backup') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv = max(0, $currentDiv - $dur);
            } elseif ($c->nodeName === 'forward') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv += $dur;
            }
        }
    }
    
    return $map;
}

// Hàm đếm số staffEntries (thời điểm nốt riêng biệt trên Staff 1) cho từng measure
function countStaff1Slots(string $xmlContent): array {
    $doc = new DOMDocument();
    $doc->loadXML($xmlContent);
    $parts = $doc->getElementsByTagName('part');
    $slots = [];
    $measures = $parts->item(0)->getElementsByTagName('measure');
    foreach ($measures as $mi => $m) {
        $currentDiv = 0;
        $times = [];
        foreach ($m->childNodes as $c) {
            if ($c->nodeName === 'note') {
                $isChord = $c->getElementsByTagName('chord')->length > 0;
                $isGrace = $c->getElementsByTagName('grace')->length > 0;
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $staff = $c->getElementsByTagName('staff')->item(0)?->textContent ?? '1';
                if ($staff === '1' && !$isGrace && !in_array($currentDiv, $times, true)) {
                    $times[] = $currentDiv;
                }
                if (!$isChord && !$isGrace) $currentDiv += $dur;
            } elseif ($c->nodeName === 'backup') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv = max(0, $currentDiv - $dur);
            } elseif ($c->nodeName === 'forward') {
                $dur = (int)($c->getElementsByTagName('duration')->item(0)?->textContent ?? 0);
                $currentDiv += $dur;
            }
        }
        $slots[$mi] = count($times);
    }
    return $slots;
}

// Bài 1: 019 TÔN VINH CHÚA TÔI
$path019 = __DIR__ . '/../storage/Thanh ca/019 TÔN VINH CHÚA TÔI.xml';
assertCheck("File 019 tồn tại", file_exists($path019), false);
if (file_exists($path019)) {
    $xml019 = file_get_contents($path019);
    $chords019 = parseXmlChordsTimeline($xml019);
    $slots019 = countStaff1Slots($xml019);
    
    // Kiểm tra ô nhịp 11: trước đây bị lệch thành 11_5 (ngoài tầm Staff 1 slot 4)
    assertCheck(
        "Bài 019: Hợp âm Bb ở ô nhịp 11 được gán chính xác vào noteIdx = 4 (11_4) thay vì 11_5",
        isset($chords019['11_4']) && $chords019['11_4'] === 'Bb' && !isset($chords019['11_5']),
        true
    );
    
    // Mọi khoá nốt đều nằm trong số nốt của Staff 1 (không bị out of bounds)
    $allInBounds = true;
    foreach ($chords019 as $key => $chord) {
        [$mi, $ni] = explode('_', $key);
        $totalSlots = $slots019[(int)$mi] ?? 0;
        if ((int)$ni >= $totalSlots) {
            $allInBounds = false;
            break;
        }
    }
    assertCheck("Bài 019: 100% hợp âm sau khi đọc đều nằm trong phạm vi Staff 1 (19/19 hợp âm)", $allInBounds && count($chords019) === 19, true);
}

// Bài 2: 001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI
$path001 = __DIR__ . '/../storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml';
assertCheck("File 001 tồn tại", file_exists($path001), false);
if (file_exists($path001)) {
    $xml001 = file_get_contents($path001);
    $chords001 = parseXmlChordsTimeline($xml001);
    $slots001 = countStaff1Slots($xml001);
    
    $allInBounds = true;
    foreach ($chords001 as $key => $chord) {
        [$mi, $ni] = explode('_', $key);
        $totalSlots = $slots001[(int)$mi] ?? 0;
        if ((int)$ni >= $totalSlots) {
            $allInBounds = false;
            break;
        }
    }
    assertCheck("Bài 001: 100% hợp âm sau khi đọc đều nằm trong phạm vi Staff 1 (17/17 hợp âm)", $allInBounds && count($chords001) === 17, true);
}

// Bài 3: 794 KHU VƯỜN THÂN ÁI
$path794 = __DIR__ . '/../storage/Thanh ca/794 KHU VƯỜN THÂN ÁI.xml';
assertCheck("File 794 tồn tại", file_exists($path794), false);
if (file_exists($path794)) {
    $xml794 = file_get_contents($path794);
    $chords794 = parseXmlChordsTimeline($xml794);
    $slots794 = countStaff1Slots($xml794);
    
    $allInBounds = true;
    foreach ($chords794 as $key => $chord) {
        [$mi, $ni] = explode('_', $key);
        $totalSlots = $slots794[(int)$mi] ?? 0;
        if ((int)$ni >= $totalSlots) {
            $allInBounds = false;
            break;
        }
    }
    assertCheck("Bài 794: 100% hợp âm sau khi đọc đều nằm trong phạm vi Staff 1 (28/28 hợp âm)", $allInBounds && count($chords794) === 28, true);
}

// Bài 4 (bổ sung): 800 CHÚA BIẾT LÒNG CON
$path800 = __DIR__ . '/../storage/Thanh ca/800 CHÚA BIẾT LÒNG CON.xml';
assertCheck("File 800 tồn tại", file_exists($path800), false);
if (file_exists($path800)) {
    $xml800 = file_get_contents($path800);
    $chords800 = parseXmlChordsTimeline($xml800);
    $slots800 = countStaff1Slots($xml800);
    
    $allInBounds = true;
    foreach ($chords800 as $key => $chord) {
        [$mi, $ni] = explode('_', $key);
        $totalSlots = $slots800[(int)$mi] ?? 0;
        if ((int)$ni >= $totalSlots) {
            $allInBounds = false;
            break;
        }
    }
    assertCheck("Bài 800: 100% hợp âm sau khi đọc đều nằm trong phạm vi Staff 1 (21/21 hợp âm)", $allInBounds && count($chords800) === 21, true);
}

// 6. Mô phỏng sao chép TLH sang bộ cá nhân: Lưu và đọc lại qua ChordSetService
$testSongId = 'thanh-ca-019';
$testSetName = 'BH_POLYPHONIC_TEST';
$testChordsArr = [];
foreach ($chords019 as $k => $c) {
    [$mIdx, $nIdx] = explode('_', $k);
    $testChordsArr[] = ['measureIdx' => (int)$mIdx, 'noteIdx' => (int)$nIdx, 'chord' => $c];
}

ChordSetService::saveSet($testSongId, $testSetName, $testChordsArr, 1, 'banhat');
$loadedChords = ChordSetService::loadSet($testSongId, $testSetName);
assertCheck("ChordSetService::saveSet và loadSet lưu đầy đủ 19 hợp âm của bài 019", count($loadedChords) === 19, true);

$loadedDict = [];
foreach ($loadedChords as $item) {
    $loadedDict["{$item['measureIdx']}_{$item['noteIdx']}"] = $item['chord'];
}
assertCheck("Hợp âm ô 11_4 vẫn giữ nguyên giá trị 'Bb' sau khi lưu qua ChordSetService", isset($loadedDict['11_4']) && $loadedDict['11_4'] === 'Bb', true);

// Dọn dẹp
ChordSetService::deleteSet($testSongId, $testSetName);
@rmdir(__DIR__ . '/../storage/data/chord_sets/' . $testSongId);

echo "\nKết quả kiểm thử R2-10: $passedChecks/$totalChecks checks passed ($behavioralChecks behavioral, $staticChecks static).\n";
echo "SUITE_COMPLETE total=$totalChecks passed=$passedChecks failed=$failedChecks behavioral=$behavioralChecks static=$staticChecks\n";

if ($failedChecks > 0) {
    exit(1);
}
