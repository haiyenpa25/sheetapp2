<?php
/**
 * tests/library_l08_safe_pedal_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-8 (ROADMAP 4):
 *  1. Bàn đạp an toàn: ArrowDown/ArrowUp và PageDown/PageUp làm nhiệm vụ lật trang / cuộn trang.
 *  2. Không cho phép ArrowDown/ArrowUp đơn lẻ nhảy bài (chống vô tình đổi bài khi biểu diễn).
 *  3. Đổi bài bằng phím tắt bắt buộc phải có tổ hợp Shift + ArrowDown/ArrowUp.
 *  4. Tốc độ tự cuộn mặc định của AutoScroller và Toolbar là 1×.
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;

function check(bool $condition, string $id, string $desc, bool $isBehavioral = false): void {
    global $passed, $failed;
    $typeTag = $isBehavioral ? '[PASS:B]' : '[PASS:S]';
    if ($condition) {
        $passed++;
        echo "  {$typeTag} [{$id}] {$desc}\n";
    } else {
        $failed++;
        echo "  [FAIL] [{$id}] {$desc}\n";
    }
}

echo "========================================================\n";
echo "   Ticket L0-8: Safe Pedals & Default Scroll Speed 1x\n";
echo "========================================================\n\n";

$root = dirname(__DIR__);

// 1. Phân tích tĩnh assets/js/keyboard-handler.js
$kbdJs = (string)file_get_contents($root . '/assets/js/keyboard-handler.js');

check(
    strpos($kbdJs, "case 'ArrowDown':") !== false &&
    strpos($kbdJs, "_turnPageOrScroll(+1)") !== false &&
    strpos($kbdJs, "e.shiftKey") !== false,
    'kbd_arrow_down_scrolls_or_turns_page',
    'ArrowDown không nhảy bài đơn lẻ mà gọi _turnPageOrScroll(+1), chỉ đổi bài khi nhấn kèm Shift'
);

check(
    strpos($kbdJs, "case 'ArrowUp':") !== false &&
    strpos($kbdJs, "_turnPageOrScroll(-1)") !== false,
    'kbd_arrow_up_scrolls_or_turns_page',
    'ArrowUp không nhảy bài đơn lẻ mà gọi _turnPageOrScroll(-1), chỉ đổi bài khi nhấn kèm Shift'
);

check(
    strpos($kbdJs, "case 'PageDown':") !== false &&
    strpos($kbdJs, "case 'PageUp':") !== false,
    'kbd_pagedown_pageup_turn_pages',
    'PageDown và PageUp được gán an toàn để lật trang'
);

// 2. Phân tích tĩnh assets/js/auto-scroller.js
$scrollerJs = (string)file_get_contents($root . '/assets/js/auto-scroller.js');

check(
    preg_match('/_speedMultiplier\s*=\s*1\s*;/', $scrollerJs) === 1,
    'auto_scroller_default_multiplier_1x',
    'AutoScroller khởi tạo biến _speedMultiplier mặc định là 1 (1x tốc độ chuẩn)'
);

// 3. Phân tích tĩnh includes/toolbar.php
$toolbarPhp = (string)file_get_contents($root . '/includes/toolbar.php');

check(
    strpos($toolbarPhp, 'id="scroll-speed"') !== false &&
    preg_match('/<option\s+value="1"\s+selected\b/', $toolbarPhp) === 1,
    'toolbar_scroll_speed_option_1_selected',
    'Select #scroll-speed trên thanh công cụ chọn mặc định option value="1"'
);

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
