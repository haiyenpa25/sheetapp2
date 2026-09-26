<?php
/**
 * tests/library_l09_no_welcome_modal_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-9 & Quyết định L-D4 (ROADMAP 4):
 *  1. Bỏ modal chào mừng mỗi phiên: mặc định vào như khách.
 *  2. #auth-modal có class "hidden" mặc định trong DOM (không tự bật che màn hình).
 *  3. auth.js không gọi openModal() trong init() hay checkSession() khi vào trang.
 *  4. Đăng nhập chỉ mở khi người dùng chủ động click nút trên AppShell / Toolbar.
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
echo "   Ticket L0-9: No Welcome Modal & Guest Mode Default\n";
echo "========================================================\n\n";

$root = dirname(__DIR__);

// 1. Kiểm tra HTML khởi tạo trong includes/modals.php
$modalsHtml = (string)file_get_contents($root . '/includes/modals.php');

check(
    preg_match('/<div\s+id="auth-modal"\s+class="[^"]*\bhidden\b[^"]*"/', $modalsHtml) === 1,
    'auth_modal_has_hidden_class_by_default',
    '#auth-modal có class "hidden" mặc định trong HTML, không tự động xuất hiện khi load trang'
);

// 2. Kiểm tra logic trong assets/js/auth.js
$authJs = (string)file_get_contents($root . '/assets/js/auth.js');

// Trích xuất thân hàm init() và checkSession() để xác nhận không tự mở modal
preg_match('/function init\s*\(\)\s*\{(.*?)\}/s', $authJs, $initM);
$initBody = $initM[1] ?? '';

check(
    strpos($initBody, 'openModal()') === false &&
    strpos($initBody, 'showModal(') === false &&
    strpos($initBody, '.classList.remove(\'hidden\')') === false,
    'auth_init_does_not_auto_open_modal',
    'Auth.init() không tự ý gọi openModal() hoặc xóa class hidden của auth-modal'
);

preg_match('/function checkSession\s*\(\)\s*\{(.*?)\}/s', $authJs, $checkM);
$checkBody = $checkM[1] ?? '';

check(
    strpos($checkBody, 'openModal()') === false &&
    strpos($checkBody, 'showModal(') === false,
    'auth_check_session_does_not_auto_open_modal',
    'Auth.checkSession() không tự ý mở modal khi người dùng chưa đăng nhập (viewer)'
);

// 3. Kiểm tra nút mở modal trên AppShell và Toolbar
$appShellJs = (string)file_get_contents($root . '/assets/js/core/AppShell.js');

check(
    strpos($appShellJs, 'shell-btn-login') !== false &&
    strpos($appShellJs, 'auth-modal') !== false,
    'app_shell_has_login_button_trigger',
    'AppShell liên kết nút shell-btn-login để mở auth-modal khi người dùng cần đăng nhập'
);

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
