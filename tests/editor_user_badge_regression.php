<?php
/**
 * tests/editor_user_badge_regression.php
 *
 * Lỗi gốc (2026-11-05): includes/app_nav.php gán lại $currentUser thành MẢNG người dùng khi đã đăng nhập.
 * editor/index.php và editor/partials/modals.php cũng dùng tên $currentUser (chuỗi) cho htmlspecialchars()
 * nên người đã đăng nhập mở /editor/ bị TypeError, trang bị cắt cụt dù mã HTTP vẫn 200.
 * Quy ước: các trang nhúng app_nav.php phải dùng biến riêng ($editorUserName) cho tên hiển thị.
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$total = 0;
$failed = 0;
function check(bool $ok, string $name): void {
    global $total, $failed;
    $total++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:S] ' : '[FAIL:S] ') . $name . "\n";
}

/** Bỏ comment để chỉ kiểm mã thật. */
function codeOnly(string $php): string {
    $out = '';
    foreach (token_get_all($php) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
}

$appNav = codeOnly((string)file_get_contents($root . '/includes/app_nav.php'));
check((bool)preg_match('/\$currentUser\s*=\s*(Auth::user\(\)|\[|\$_SESSION)/', $appNav),
    'app_nav.php gán $currentUser là mảng người dùng (lý do các trang không được dùng tên này cho chuỗi)');

$files = array_merge([$root . '/editor/index.php'], glob($root . '/editor/partials/*.php') ?: []);
foreach ($files as $file) {
    $code = codeOnly((string)file_get_contents($file));
    $rel = substr($file, strlen($root) + 1);
    check(!str_contains($code, '$currentUser'), "$rel không dùng \$currentUser (trùng biến với app_nav.php)");
}

$index = codeOnly((string)file_get_contents($root . '/editor/index.php'));
check((bool)preg_match('/\$editorUserName\s*=\s*Auth::username\(\)/', $index), 'editor/index.php khai báo $editorUserName từ Auth::username()');
check(str_contains(codeOnly((string)file_get_contents($root . '/editor/partials/modals.php')), 'htmlspecialchars($editorUserName)'),
    'editor/partials/modals.php hiển thị tên tài khoản qua $editorUserName');

echo "SUITE_COMPLETE total=$total passed=" . ($total - $failed) . " failed=$failed\n";
exit($failed ? 1 : 0);
