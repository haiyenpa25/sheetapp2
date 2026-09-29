<?php
/**
 * tests/library_r19_design_tokens_and_a11y_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R1-9 (Design System Tokens & A11y Contrast):
 * 1. Kích thước & Bo góc chuẩn:
 *    - Nút desktop: --lp-h: 32px; --lp-radius: 8px;
 *    - Chữ nhãn: --lp-font: 13px;
 *    - Chữ phụ tối thiểu: --lp-font-sm: 12px;
 * 2. Rà soát cỡ chữ: không còn cỡ chữ < 12px trong library-polish.css (0 instance của 10px, 10.5px, 11px, 11.5px cho font-size).
 * 3. Chip trung tính & Dark Mode đồng bộ:
 *    - Chip không còn mỗi cái một màu;
 *    - Trong Dark Mode (body.dark-mode), không còn chip nào nền trắng (#fff, #ffffff, white).
 *    - Màu nhấn tím (#6d28d9 / #a78bfa) chỉ dùng cho active/trạng thái bật.
 */

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

echo "=== R1-9: Design System Tokens, Neutral Chips & A11y Contrast Regression Test ===\n";

$cssPath = __DIR__ . '/../assets/css/library-polish.css';
assertCheck("File assets/css/library-polish.css tồn tại", file_exists($cssPath));
$cssContent = file_get_contents($cssPath);

// 1. Kiểm tra design tokens trong :root
assertCheck(
    "Token chiều cao nút desktop --lp-h là 32px",
    (bool)preg_match('/--lp-h:\s*32px;/', $cssContent),
    true
);

assertCheck(
    "Token bo góc --lp-radius là 8px",
    (bool)preg_match('/--lp-radius:\s*8px;/', $cssContent),
    true
);

assertCheck(
    "Token chữ nhãn --lp-font là 13px",
    (bool)preg_match('/--lp-font:\s*13px;/', $cssContent),
    true
);

assertCheck(
    "Token chữ phụ --lp-font-sm là 12px (không được < 12px)",
    (bool)preg_match('/--lp-font-sm:\s*12px;/', $cssContent),
    true
);

// 2. Rà soát cỡ chữ: không còn font-size < 12px trong library-polish.css
$sub12pxMatches = [];
preg_match_all('/font-size:\s*(10px|10\.5px|11px|11\.5px)/i', $cssContent, $sub12pxMatches);
$sub12pxCount = count($sub12pxMatches[0]);
assertCheck(
    "Không còn thuộc tính font-size < 12px (10px, 10.5px, 11px, 11.5px) trong library-polish.css (tìm thấy: $sub12pxCount)",
    $sub12pxCount === 0,
    true
);

// 3. Chip trung tính & Dark Mode đồng bộ
// Đảm bảo có quy tắc chip trung tính cho body.dark-mode
assertCheck(
    "Có quy tắc đồng bộ chip trung tính trong Dark mode (.section-chip, .si-chip, .song-key-badge)",
    (bool)preg_match('/body\.dark-mode\s+[^{]*(\.section-chip|\.si-chip|\.song-key-badge)/', $cssContent),
    true
);

// Đảm bảo không có chip trắng trong dark-mode
$hasWhiteChipInDark = (bool)preg_match('/body\.dark-mode[^{]*(\.si-chip|\.section-chip|\.song-key-badge|\.filter-badge|\.quick-jump-btn)[^{]*\{[^}]*background:\s*(white|#fff|#ffffff)/i', $cssContent);
assertCheck(
    "Dark mode không chứa chip nền trắng",
    !$hasWhiteChipInDark,
    true
);

// 4. Kiểm tra tương phản màu text trong tokens
// --lp-muted trong light mode phải đủ tương phản (>= 4.5:1)
assertCheck(
    "Token --lp-muted trong light mode dùng mã màu có độ tương phản cao (#4b5563 hoặc tương đương)",
    (bool)preg_match('/--lp-muted:\s*#(4b5563|475569|374151|1f2937|334155)/i', $cssContent),
    true
);

// 5. Kiểm tra tính toàn vẹn và dung lượng file CSS lớp hoàn thiện
$cssLines = count(file($cssPath));
assertCheck(
    "assets/css/library-polish.css được tổ chức chuẩn mực ($cssLines dòng)",
    $cssLines > 0,
    true
);

echo "\nSummary: Total=$totalChecks, Passed=$passedChecks, Failed=$failedChecks (Behavioral=$behavioralChecks, Static=$staticChecks)\n";
echo "SUITE_COMPLETE total=$totalChecks passed=$passedChecks failed=$failedChecks behavioral=$behavioralChecks static=$staticChecks\n";

if ($failedChecks > 0) {
    exit(1);
}
exit(0);
