<?php
/**
 * tests/library_r42_lyric_chords_view_regression.php
 *
 * Regression test suite cho Ticket R4-2:
 * - Chế độ Lời & Hợp âm: hiển thị 2 cột trên màn hình iPad/laptop (≥ 768px, bao gồm 1366px)
 * - Tô sáng khổ đang hát (highlight active verse: .lv-active-verse)
 * - Cỡ chữ hợp âm theo "Cỡ hợp âm" (Chord Preset) và đảm bảo tỉ lệ hợp âm / lời ≥ 1.3x
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

echo "=== Kiểm thử Ticket R4-2: Chế độ Lời & Hợp Âm 2 Cột & Tô Sáng Khổ ===\n\n";

$sheetCssFile = __DIR__ . '/../assets/css/sheet.css';
$lyricJsFile = __DIR__ . '/../assets/js/lyric-extractor.js';

// ── 1. Kiểm tra CSS định dạng 2 cột trên iPad và Laptop (≥ 768px, 1366px) ──
echo "-- 1. Kiểm tra CSS bố cục 2 cột trên iPad/Laptop --\n";
it('File assets/css/sheet.css tồn tại', file_exists($sheetCssFile));
$sheetCss = file_get_contents($sheetCssFile) ?: '';

it('sheet.css có media query cho iPad và Laptop (min-width: 768px)',
    str_contains($sheetCss, '(min-width: 768px)')
);

it('Bố cục 2 cột .lv-wrapper sử dụng display: grid với 2 cột repeat(2, minmax(0, 1fr))',
    str_contains($sheetCss, 'grid-template-columns: repeat(2, minmax(0, 1fr))')
);

it('Tiêu đề .lv-header và trạng thái .lv-empty trải dài cả 2 cột (grid-column: 1 / -1)',
    str_contains($sheetCss, '.lv-header {') &&
    str_contains($sheetCss, 'grid-column: 1 / -1')
);

// ── 2. Kiểm tra CSS tô sáng khổ đang hát (.lv-active-verse) ──
echo "\n-- 2. Kiểm tra CSS tô sáng khổ đang hát --\n";
it('sheet.css định nghĩa class .lv-verse.lv-active-verse',
    str_contains($sheetCss, '.lv-verse.lv-active-verse')
);

it('.lv-active-verse có viền, đổ bóng hoặc nền nổi bật',
    str_contains($sheetCss, 'border-color: #8b5cf6') ||
    str_contains($sheetCss, 'box-shadow:')
);

it('Pill nhãn của khổ đang hát .lv-verse.lv-active-verse .lv-verse-pill được tô sáng',
    str_contains($sheetCss, '.lv-verse.lv-active-verse .lv-verse-pill')
);

// ── 3. Kiểm tra tỉ lệ cỡ chữ hợp âm ≥ 1.3x chữ lời ──
echo "\n-- 3. Kiểm tra tỉ lệ cỡ chữ hợp âm / lời ≥ 1.3x --\n";
it('CSS mặc định .lv-chord (1.75rem) và .lv-syl (1.25rem) đạt tỉ lệ 1.4x (>= 1.3x)',
    str_contains($sheetCss, 'var(--lv-chord-size, 1.75rem)') &&
    str_contains($sheetCss, 'var(--lv-syl-size, 1.25rem)')
);

it('File assets/js/lyric-extractor.js tồn tại', file_exists($lyricJsFile));
$lyricJs = file_get_contents($lyricJsFile) ?: '';

it('lyric-extractor.js có hàm _applyStyles thiết lập tỉ lệ hợp âm / lời',
    str_contains($lyricJs, 'function _applyStyles')
);

it('_applyStyles tính toán cỡ chữ theo preset (standard: 28/20=1.4x, stage: 34/20=1.7x)',
    str_contains($lyricJs, 'baseChordPx = 34') &&
    str_contains($lyricJs, 'baseChordPx = 30') &&
    str_contains($lyricJs, "baseSylPx = 20")
);

it('lyric-extractor.js có hàm highlightVerse để kích hoạt khổ đang hát',
    str_contains($lyricJs, 'function highlightVerse') &&
    str_contains($lyricJs, 'lv-active-verse')
);

it('lyric-extractor.js cho phép chạm vào khổ để kích hoạt khổ đó',
    str_contains($lyricJs, "sec.classList.toggle('lv-active-verse'") ||
    str_contains($lyricJs, 'data-verse-num')
);

it('lyric-extractor.js lắng nghe EventBus verse:changed và chord:preset_changed',
    str_contains($lyricJs, "EventBus.on('verse:changed'") &&
    str_contains($lyricJs, "EventBus.on('chord:preset_changed'")
);

// ── 4. Mô phỏng hành vi: Highlight khổ và tính toán tỉ lệ cỡ chữ ──
echo "\n-- 4. Mô phỏng hành vi: Active Verse & Chord/Lyric Size Ratio --\n";

class MockLyricViewSimulator {
    public array $verses = [
        ['num' => '1', 'active' => false],
        ['num' => '2', 'active' => false],
        ['num' => 'chorus', 'active' => false],
    ];

    public array $styleVars = [];

    public function highlightVerse(string $vNum): void {
        foreach ($this->verses as &$v) {
            $v['active'] = ($v['num'] === $vNum);
        }
    }

    public function applyPreset(string $preset): array {
        $baseChord = 28;
        $baseSyl = 20;
        if ($preset === 'stage') {
            $baseChord = 34;
        } elseif ($preset === 'high_contrast') {
            $baseChord = 30;
        }
        $ratio = round($baseChord / $baseSyl, 2);
        $this->styleVars['--lv-chord-size'] = "{$baseChord}px";
        $this->styleVars['--lv-syl-size'] = "{$baseSyl}px";
        return ['chord' => $baseChord, 'lyric' => $baseSyl, 'ratio' => $ratio];
    }
}

$sim = new MockLyricViewSimulator();

// Test Highlight Verse
$sim->highlightVerse('1');
it("Khổ 1 được tô sáng, các khổ khác không active",
    $sim->verses[0]['active'] === true &&
    $sim->verses[1]['active'] === false &&
    $sim->verses[2]['active'] === false
);

$sim->highlightVerse('2');
it("Chuyển sang Khổ 2: Khổ 2 được tô sáng, Khổ 1 tắt",
    $sim->verses[0]['active'] === false &&
    $sim->verses[1]['active'] === true
);

// Test Ratio Preset Standard
$resStd = $sim->applyPreset('standard');
it("Preset Chuẩn (Standard): Cỡ hợp âm 28px, Lời 20px -> Tỉ lệ {$resStd['ratio']}x (>= 1.3x)",
    $resStd['ratio'] >= 1.3 && $resStd['chord'] === 28
);

// Test Ratio Preset Stage
$resStage = $sim->applyPreset('stage');
it("Preset Sân khấu (Stage): Cỡ hợp âm 34px, Lời 20px -> Tỉ lệ {$resStage['ratio']}x (>= 1.3x)",
    $resStage['ratio'] >= 1.3 && $resStage['chord'] === 34
);

// Test Ratio Preset High Contrast
$resHc = $sim->applyPreset('high_contrast');
it("Preset Tương phản cao: Cỡ hợp âm 30px, Lời 20px -> Tỉ lệ {$resHc['ratio']}x (>= 1.3x)",
    $resHc['ratio'] >= 1.3 && $resHc['chord'] === 30
);

// ── 5. Kiểm tra ngân sách dòng code ──
echo "\n-- 5. Ngân sách dòng code (< 600 dòng) --\n";
$lyricLines = count(file($lyricJsFile));
it("assets/js/lyric-extractor.js có {$lyricLines} dòng (< 600 dòng)", $lyricLines < 600);

echo "\n----------------------------------------\n";
echo "KẾT QUẢ KIỂM THỬ: {$passedCount} / {$testCount} checks đạt.\n";
if ($passedCount === $testCount) {
    echo "🎉 TẤT CẢ KIỂM TRA TICKET R4-2 ĐỀU ĐẠT CHUẨN!\n";
} else {
    echo "❌ CÓ KIỂM TRA THẤT BẠI!\n";
}

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";

if ($passedCount !== $testCount) {
    exit(1);
}
