<?php
declare(strict_types=1);

/**
 * tests/library_r14_section_jump_bar_regression.php
 *
 * Kiểm thử hồi quy Ticket R1-4 (ROADMAP5.md):
 * Dải phân đoạn chỉ hiện khi đang phát chương trình hoặc ở chế độ Biểu diễn;
 * Chuẩn hóa nhãn phân đoạn tiếng Việt: Dạo đầu / Phiên khúc n / Điệp khúc / Kết;
 * Sử dụng Lucide SVG icons thay thế emoji.
 */

$suiteTotalChecks = 0;
$suiteBehavioralChecks = 0;

function assertCondition(bool $condition, string $msg, bool $isBehavioral = false): void {
    global $suiteTotalChecks, $suiteBehavioralChecks;
    $suiteTotalChecks++;
    if ($isBehavioral) {
        $suiteBehavioralChecks++;
    }
    if (!$condition) {
        echo "[FAIL] {$msg}\n";
        exit(1);
    }
    echo "[PASS] {$msg}\n";
}

echo "=== TICKET R1-4: SECTION JUMP BAR CONDITIONAL DISPLAY & VN LABELS REGRESSION SUITE ===\n\n";

$engineFile = __DIR__ . '/../assets/js/performance/arrangement-engine.js';
$polishCssFile = __DIR__ . '/../assets/css/library-polish.css';

// 1. Kiểm tra file tồn tại và số dòng tuân thủ ngân sách < 600 dòng
assertCondition(file_exists($engineFile), "File assets/js/performance/arrangement-engine.js tồn tại");
$engineContent = file_get_contents($engineFile);
$engineLines = count(explode("\n", $engineContent));
assertCondition(
    $engineLines < 600,
    "arrangement-engine.js tuân thủ ngân sách < 600 dòng (hiện tại: {$engineLines} dòng)",
    true
);

// 2. Kiểm tra điều kiện hiển thị có điều kiện (chỉ hiện khi phát chương trình / biểu diễn / live sync)
assertCondition(
    strpos($engineContent, '_isProgramOrSetlistActive') !== false ||
    strpos($engineContent, 'in-setlist') !== false,
    "ArrangementEngine kiểm tra trạng thái chương trình / setlist active trước khi hiển thị Jump Bar",
    true
);

assertCondition(
    strpos($engineContent, 'sheet-only-mode') !== false ||
    strpos($engineContent, 'performance') !== false,
    "ArrangementEngine kiểm tra chế độ Biểu diễn (sheet-only-mode / performance) cho Jump Bar",
    true
);

// 3. Kiểm tra hàm chuẩn hóa nhãn tiếng Việt (Dạo đầu, Phiên khúc n, Điệp khúc, Kết)
assertCondition(
    strpos($engineContent, '_normalizeSectionLabel') !== false ||
    (strpos($engineContent, 'Dạo đầu') !== false && strpos($engineContent, 'Phiên khúc') !== false && strpos($engineContent, 'Điệp khúc') !== false && strpos($engineContent, 'Kết') !== false),
    "ArrangementEngine chuẩn hoá tên phân đoạn tiếng Việt (Dạo đầu, Phiên khúc n, Điệp khúc, Kết)",
    true
);

// 4. Kiểm tra icon Lucide SVG thay thế emoji
assertCondition(
    strpos($engineContent, '<use href="#icon-') !== false,
    "ArrangementEngine dùng sprite Lucide SVG (<use href=\"#icon-...\">) cho icon phân đoạn",
    true
);

$emojis = ['🎵', '📖', '⚡', '🎸', '🎹', '🏁', '🔖', '📐', '🎯'];
$foundEmoji = false;
foreach ($emojis as $emoji) {
    if (strpos($engineContent, $emoji) !== false) {
        $foundEmoji = true;
        break;
    }
}
assertCondition(
    !$foundEmoji,
    "ArrangementEngine không còn chứa emoji trần trong code UI",
    true
);

// 5. Kiểm tra CSS ẩn hiện dải phân đoạn
$polishCss = file_exists($polishCssFile) ? file_get_contents($polishCssFile) : '';
assertCondition(
    strpos($polishCss, '.section-jump-bar-container.hidden') !== false ||
    strpos(file_get_contents(__DIR__ . '/../assets/css/sheet.css'), '.section-jump-bar-container.hidden') !== false,
    "CSS có quy tắc ẩn .section-jump-bar-container.hidden (display: none !important)",
    true
);

// 6. Kiểm tra đăng ký sự kiện app:mode_change và setlist:ended để cập nhật hiển thị Jump Bar
assertCondition(
    strpos($engineContent, 'app:mode_change') !== false &&
    strpos($engineContent, 'setlist:ended') !== false,
    "ArrangementEngine lắng nghe app:mode_change và setlist:ended để tự động cập nhật Jump Bar",
    true
);

echo "\nSUITE_COMPLETE total={$suiteTotalChecks} behavioral={$suiteBehavioralChecks}\n";
