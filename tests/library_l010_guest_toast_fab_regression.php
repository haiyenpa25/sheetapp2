<?php
/**
 * tests/library_l010_guest_toast_fab_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-10 (ROADMAP 4):
 *  1. Toast "Đang xem dưới quyền Khách" chỉ hiện 1 lần duy nhất trên thiết bị (lưu cờ localStorage).
 *  2. FAB ẩn hoàn toàn khi chưa đăng nhập để không che khuất bản nhạc.
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
echo "   Ticket L0-10: Guest Toast Once & FAB Not Covering\n";
echo "========================================================\n\n";

$root = dirname(__DIR__);

// 1. Kiểm tra logic trong assets/js/auth.js
$authJs = (string)file_get_contents($root . '/assets/js/auth.js');

check(
    strpos($authJs, 'sheetapp_guest_toast_shown') !== false &&
    strpos($authJs, "localStorage.getItem('sheetapp_guest_toast_shown')") !== false,
    'guest_toast_shown_once_via_local_storage',
    'auth.js kiểm tra cờ localStorage "sheetapp_guest_toast_shown" để chỉ hiển thị toast 1 lần'
);

check(
    strpos($authJs, 'fabWrap') !== false &&
    strpos($authJs, "fabWrap.style.display = _currentUser ? '' : 'none'") !== false,
    'fab_wrap_hidden_when_not_logged_in',
    'auth.js ẩn hoàn toàn nút nổi #fab-wrap khi người dùng chưa đăng nhập (viewer)'
);

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
