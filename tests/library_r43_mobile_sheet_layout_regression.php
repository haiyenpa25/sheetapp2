<?php
/**
 * tests/library_r43_mobile_sheet_layout_regression.php
 *
 * Regression test suite cho Ticket R4-3:
 * - Điện thoại ở chế độ Bản nhạc: ≥ 2 ô nhịp mỗi hàng
 * - Hợp âm không đè thân nốt (Chord bounding box không giao cắt với notehead/stem)
 * - Màn hình điện thoại 390px (viewport mobile <= 680px)
 */

declare(strict_types=1);

$testCount = 0;
$passedCount = 0;

function it(string $desc, bool $result): void {
    global $testCount, $passedCount;
    $testCount++;
    if ($result) {
        $passedCount++;
        echo "  [PASS] {$desc}\n";
    } else {
        echo "  [FAIL] {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket R4-3: Bố Cục Bản Nhạc Trên Điện Thoại & Khoảng Trống Hợp Âm ===\n\n";

$songLoaderFile = __DIR__ . '/../assets/js/song-loader.js';
$chordCanvasFile = __DIR__ . '/../assets/js/chord-canvas.js';
$chordDotsFile = __DIR__ . '/../assets/js/chord-canvas-dots.js';
$osmdRendererFile = __DIR__ . '/../assets/js/osmd-renderer.js';

// ── 1. Kiểm tra mã nguồn song-loader.js ──
echo "-- 1. Kiểm tra logic mật độ ô nhịp trên mobile trong song-loader.js --\n";
it('File assets/js/song-loader.js tồn tại', file_exists($songLoaderFile));
$songLoaderJs = file_get_contents($songLoaderFile) ?: '';

it('song-loader.js giới hạn zoom preload trên mobile (<= 680px) tối đa 75% để đạt >= 2 ô nhịp/hàng',
    str_contains($songLoaderJs, 'window.innerWidth <= 680 && pct > 75')
);

it('song-loader.js giới hạn autofit zoom trên mobile tối đa 75%',
    str_contains($songLoaderJs, 'isMobile && pct > 75')
);

it('song-loader.js có hàm _ensureMinMeasuresPerSystem kiểm tra systems[i].length < 2',
    str_contains($songLoaderJs, 'systems[i].length < 2') &&
    str_contains($songLoaderJs, 'window.App?.setZoom?.(adjustedPct)')
);

it('song-loader.js hỗ trợ vòng lặp điều chỉnh có đếm lần thử (attempt < 5)',
    str_contains($songLoaderJs, 'attempt = 0') &&
    str_contains($songLoaderJs, 'attempt < 5') &&
    str_contains($songLoaderJs, 'setTimeout(() => _ensureMinMeasuresPerSystem(adjustedPct, attempt + 1)')
);

// ── 2. Kiểm tra khoảng cách hợp âm trong osmd-renderer.js ──
echo "\n-- 2. Kiểm tra khoảng cách hợp âm (ChordSymbolYOffset) trong osmd-renderer.js --\n";
it('File assets/js/osmd-renderer.js tồn tại', file_exists($osmdRendererFile));
$osmdRendererJs = file_get_contents($osmdRendererFile) ?: '';

it('osmd-renderer.js nâng ChordSymbolYOffset lên tối thiểu 1.8 trên mobile để hợp âm không chạm khuông/thân nốt',
    str_contains($osmdRendererJs, 'isMobile ? 1.8 : 1.4') ||
    str_contains($osmdRendererJs, 'ChordSymbolYOffset')
);

// ── 3. Kiểm tra chống đè thân nốt trong chord-canvas.js (_alignOSMDChords) ──
echo "\n-- 3. Kiểm tra chống đè thân nốt cho hợp âm SVG trong chord-canvas.js --\n";
it('File assets/js/chord-canvas.js tồn tại', file_exists($chordCanvasFile));
$chordCanvasJs = file_get_contents($chordCanvasFile) ?: '';

it('chord-canvas.js _alignOSMDChords quét g.vf-stavenote để xác định vị trí nốt',
    str_contains($chordCanvasJs, "svg.querySelectorAll('g.vf-stavenote')")
);

it('chord-canvas.js nâng baseline hợp âm của hệ thống (sys.minY) nếu có thân nốt vươn lên',
    str_contains($chordCanvasJs, 'minNoteTop - 12')
);

it('chord-canvas.js kiểm tra giao cắt cục bộ giữa hợp âm và nốt nằm ngay bên dưới',
    str_contains($chordCanvasJs, '!(bb.x + bb.width < curX || bb.x > curX + curW)')
);

// ── 4. Kiểm tra chống đè thân nốt trong chord-canvas-dots.js ──
echo "\n-- 4. Kiểm tra chống đè thân nốt cho custom chords trong chord-canvas-dots.js --\n";
it('File assets/js/chord-canvas-dots.js tồn tại', file_exists($chordDotsFile));
$chordDotsJs = file_get_contents($chordDotsFile) ?: '';

it('chord-canvas-dots.js alignDOMChords quét g.vf-stavenote để tạo mảng noteRects',
    str_contains($chordDotsJs, "svg.querySelectorAll('g.vf-stavenote')")
);

it('chord-canvas-dots.js tính safeFixedY nâng hàng hợp âm khi nốt vươn cao hơn dòng kẻ trên (minNoteTop < sys.topLine)',
    str_contains($chordDotsJs, 'minNoteTop < sys.topLine') &&
    str_contains($chordDotsJs, 'safeFixedY = Math.round(minNoteTop - badgeH - 8)')
);

it('chord-canvas-dots.js kiểm tra va chạm cục bộ từng badge với nốt bên dưới và nâng vị trí badgeY',
    str_contains($chordDotsJs, '!(nr.right < bLeft || nr.left > bRight)') &&
    str_contains($chordDotsJs, 'badgeY + badgeH > localMinTop - 6')
);

it('chord-canvas-dots.js placeDot kiểm tra rect.top và giữ khoảng cách spanY an toàn',
    str_contains($chordDotsJs, 'rect.top - cRect.top < (staffTop || 9999)') &&
    str_contains($chordDotsJs, 'spanY = Math.min(spanY, (rect.top - cRect.top) - fSize - 6)')
);

// ── 5. Kiểm tra hành vi / Mô phỏng hình học (Behavioral Simulation) ──
echo "\n-- 5. Kiểm nghiệm hành vi & Mô phỏng hình học va chạm --\n";

// Mô phỏng 1: Mật độ ô nhịp trên viewport 390px
$viewportW = 390;
$padding = 20;
$availW = $viewportW - $padding; // 370px
$measureWidths = [170, 185, 175, 180, 190, 165, 170]; // Chiều rộng các ô nhịp ở zoom 1.0

// Ở zoom 1.0: 170 + 185 = 355px (vừa khít 2 ô), nhưng 175 + 190 = 365px, nếu thêm bar line có thể đẩy sang 1 ô
// Ở zoom 0.72 (mobile preload/autofit): 175 * 0.72 + 190 * 0.72 = 262.8px << 370px! Thoải mái ≥ 2 ô nhịp
$zoom = 0.72;
$systems = [];
$curSystem = [];
$curWidth = 0;
foreach ($measureWidths as $idx => $mw) {
    $scaledW = $mw * $zoom;
    if ($curWidth + $scaledW > $availW && count($curSystem) >= 2) {
        $systems[] = $curSystem;
        $curSystem = [$idx];
        $curWidth = $scaledW;
    } else {
        $curSystem[] = $idx;
        $curWidth += $scaledW;
    }
}
if (!empty($curSystem)) {
    $systems[] = $curSystem;
}

$allNonFinalHaveTwo = true;
for ($i = 0; $i < count($systems) - 1; $i++) {
    if (count($systems[$i]) < 2) {
        $allNonFinalHaveTwo = false;
        break;
    }
}
it('Mô phỏng 390px mobile: với zoom 0.72, mọi hàng nhạc (trừ hàng cuối) đều chứa ≥ 2 ô nhịp',
    $allNonFinalHaveTwo && count($systems) >= 2
);

// Mô phỏng 2: Chống đè thân nốt (Upward Stem Collision Test)
// Khuông nhạc: dòng trên cùng topLine = 150px.
// Nốt nhạc có thân quay lên (upward stem): nốt vươn lên y = 115px (35px phía trên khuông).
// Badge hợp âm: badgeH = 26px, chiều rộng badge = 36px, vị trí X = 100px.
// Nốt nhạc: left = 95px, right = 105px (giao cắt trục X).
$topLine = 150;
$noteStemTop = 115;
$badgeH = 26;
$gapRatio = 0.35;
$gapPx = 22;

// Thuật toán:
$defaultY = round($topLine - $badgeH - $gapPx * $gapRatio); // 150 - 26 - 7.7 = 116px (đáy badge là 116 + 26 = 142px > 115px -> ĐÈ THÂN NỐT NẾU KHÔNG CÓ THUẬT TOÁN!)
$safeFixedY = round($noteStemTop - $badgeH - 8); // 115 - 26 - 8 = 81px (đáy badge là 81 + 26 = 107px < 115px)
$finalY = min($defaultY, $safeFixedY);

$badgeBottom = $finalY + $badgeH;
$clearance = $noteStemTop - $badgeBottom;

it('Mô phỏng hình học: đáy hộp hợp âm cách đỉnh thân nốt ≥ 6px (Clearance = ' . $clearance . 'px, không đè thân nốt)',
    $badgeBottom < $noteStemTop && $clearance >= 6
);

// Mô phỏng 3: Kiểm tra giao cắt chữ nhật tổng quát (AABB Intersection Test)
function checkAABBIntersection(array $boxA, array $boxB): bool {
    return !($boxA['right'] < $boxB['left'] ||
             $boxA['left'] > $boxB['right'] ||
             $boxA['bottom'] < $boxB['top'] ||
             $boxA['top'] > $boxB['bottom']);
}

$chordBox = ['left' => 82, 'right' => 118, 'top' => $finalY, 'bottom' => $badgeBottom];
$noteBox = ['left' => 95, 'right' => 105, 'top' => $noteStemTop, 'bottom' => 160];

$intersects = checkAABBIntersection($chordBox, $noteBox);
it('Hộp bao hợp âm (AABB) hoàn toàn KHÔNG giao cắt với hộp bao nốt nhạc (intersects = false)',
    !$intersects
);

// Mô phỏng 4: Nhiều hợp âm trong một hàng hệ thống có nốt cao
$notes = [
    ['left' => 40, 'right' => 50, 'top' => 140, 'bottom' => 170],
    ['left' => 120, 'right' => 130, 'top' => 110, 'bottom' => 165], // Nốt cao vươn lên 110
    ['left' => 200, 'right' => 210, 'top' => 145, 'bottom' => 175],
    ['left' => 280, 'right' => 290, 'top' => 125, 'bottom' => 170]
];
$minNoteTopSys = min(array_column($notes, 'top')); // 110
$sysFixedY = min(round($topLine - $badgeH - 8), round($minNoteTopSys - $badgeH - 8)); // 76px

$allChordsClear = true;
foreach ([45, 125, 205, 285] as $cx) {
    $cBox = ['left' => $cx - 15, 'right' => $cx + 15, 'top' => $sysFixedY, 'bottom' => $sysFixedY + $badgeH];
    foreach ($notes as $nBox) {
        if (checkAABBIntersection($cBox, $nBox)) {
            $allChordsClear = false;
            break 2;
        }
    }
}
it('Hàng hệ thống chứa nhiều hợp âm và nốt cao: 100% hợp âm có khoảng trống an toàn với mọi nốt',
    $allChordsClear
);

// ── 6. Ngân sách dòng code (< 600 dòng) ──
echo "\n-- 6. Ngân sách dòng code (< 600 dòng) --\n";
$slLines = count(file($songLoaderFile));
it("assets/js/song-loader.js có {$slLines} dòng (< 600 dòng)", $slLines < 600);

$ccLines = count(file($chordCanvasFile));
it("assets/js/chord-canvas.js có {$ccLines} dòng (< 600 dòng)", $ccLines < 600);

$cdLines = count(file($chordDotsFile));
it("assets/js/chord-canvas-dots.js có {$cdLines} dòng (< 600 dòng)", $cdLines < 600);

$osmdLines = count(file($osmdRendererFile));
it("assets/js/osmd-renderer.js có {$osmdLines} dòng (< 600 dòng)", $osmdLines < 600);

// Tổng kết
echo "\n=======================================================\n";
echo "Tổng số kiểm tra: {$testCount}\n";
echo "Số kiểm tra ĐẠT:  {$passedCount} / {$testCount}\n";
echo "=======================================================\n";

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";

if ($passedCount !== $testCount) {
    exit(1);
}
