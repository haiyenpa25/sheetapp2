<?php
/**
 * tests/modal_a11y_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.2 — Design tokens & Accessibility nền tảng:
 * 1. Design Tokens: Scale z-index chuẩn hóa trong base.css (--z-base đến --z-topmost).
 * 2. Focus & Motion: Focus-visible ring và prefers-reduced-motion media query.
 * 3. Loại bỏ hoàn toàn z-index INT32 MAX (2147483647) trong fab.css, thay bằng --z-fab.
 * 4. Modal z-index trong components.css & manager.css sử dụng --z-modal-bg và --z-modal.
 * 5. ModalManager.js: Quản lý Focus Trap, Focus Restore, WAI-ARIA role/attributes, và Global Escape stack.
 * 6. Tích hợp ModalManager vào toàn bộ 4 trụ cột (index, live-band, learn, manager).
 */

declare(strict_types=1);

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== MODAL & ACCESSIBILITY REGRESSION (TASK 2.2) ===\n";

$root = dirname(__DIR__);

// --- TEST 1: Z-Index Scale trong base.css ---
$baseCss = file_get_contents($root . '/assets/css/base.css');
check($baseCss !== false, 'base.css đọc thành công');

$requiredTokens = [
    '--z-base',
    '--z-dropdown',
    '--z-sticky',
    '--z-app-shell',
    '--z-header',
    '--z-sidebar',
    '--z-hud',
    '--z-popup',
    '--z-fab',
    '--z-modal-bg',
    '--z-modal',
    '--z-toast',
    '--z-topmost'
];

foreach ($requiredTokens as $token) {
    check(str_contains($baseCss, $token), "base.css chứa token {$token}");
}

// --- TEST 2: Accessibility tokens & media queries ---
check(str_contains($baseCss, '--focus-ring'), 'base.css định nghĩa token --focus-ring');
check(str_contains($baseCss, ':focus-visible'), 'base.css định nghĩa :focus-visible');
check(str_contains($baseCss, 'prefers-reduced-motion'), 'base.css hỗ trợ media query prefers-reduced-motion');

// --- TEST 3: fab.css không còn INT32 MAX ---
$fabCss = file_get_contents($root . '/assets/css/fab.css');
check($fabCss !== false, 'fab.css đọc thành công');
check(!str_contains($fabCss, '2147483647'), 'fab.css đã xóa bỏ hoàn toàn z-index INT32 MAX 2147483647');
check(str_contains($fabCss, '--z-fab'), 'fab.css sử dụng token --z-fab');

// --- TEST 4: Modal z-index tiêu chuẩn trong components.css & manager.css ---
$compCss = file_get_contents($root . '/assets/css/components.css');
check(str_contains($compCss, '--z-modal-bg'), 'components.css sử dụng --z-modal-bg');
check(str_contains($compCss, '--z-modal'), 'components.css sử dụng --z-modal');

$mgrCss = file_get_contents($root . '/manager/manager.css');
check(str_contains($mgrCss, '--z-modal-bg'), 'manager.css sử dụng --z-modal-bg');
check(str_contains($mgrCss, '--z-modal'), 'manager.css sử dụng --z-modal');

// --- TEST 5: ModalManager.js logic chuẩn WAI-ARIA & Trap ---
$modalJsPath = $root . '/assets/js/core/ModalManager.js';
check(file_exists($modalJsPath), 'File assets/js/core/ModalManager.js tồn tại');
$modalJs = file_get_contents($modalJsPath);

check(str_contains($modalJs, 'trapFocus'), 'ModalManager cài đặt hàm trapFocus');
check(str_contains($modalJs, 'prevFocus') && str_contains($modalJs, 'focus'), 'ModalManager hỗ trợ khôi phục focus (prevFocus) về nút trước khi mở modal');
check(str_contains($modalJs, 'role') && str_contains($modalJs, 'dialog'), 'ModalManager thiết lập role="dialog"');
check(str_contains($modalJs, 'aria-modal'), 'ModalManager thiết lập aria-modal="true"');
check(str_contains($modalJs, 'Escape') || str_contains($modalJs, 'key === \'Escape\''), 'ModalManager xử lý phím Escape có điều phối');
check(str_contains($modalJs, 'modalStack'), 'ModalManager quản lý modal dạng stack nhiều lớp');

// --- TEST 6: Nhúng ModalManager trên cả 4 trụ cột ---
$indexPhp    = file_get_contents($root . '/index.php');
$liveBandPhp = file_get_contents($root . '/live-band/index.php');
$learnPhp    = file_get_contents($root . '/learn/index.php');
$managerPhp  = file_get_contents($root . '/manager/index.php');

check(str_contains($indexPhp, 'ModalManager.js'), 'Trụ cột Thư Viện (index.php) nhúng ModalManager.js');
check(str_contains($liveBandPhp, 'ModalManager.js'), 'Trụ cột Biểu Diễn (live-band/index.php) nhúng ModalManager.js');
check(str_contains($learnPhp, 'ModalManager.js'), 'Trụ cột Tập Luyện (learn/index.php) nhúng ModalManager.js');
check(str_contains($managerPhp, 'ModalManager.js'), 'Trụ cột Quản Lý (manager/index.php) nhúng ModalManager.js');

// --- TEST 7: Markup WAI-ARIA trong includes/modals.php và admin_console.php (Ticket T16) ---
$modalsPhp = file_get_contents($root . '/includes/modals.php');
check($modalsPhp !== false, 'includes/modals.php đọc thành công');

$requiredModalAria = [
    'session-panel'      => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="session-panel-title"'],
    'livesync-modal'     => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="livesync-modal-title"'],
    'mixer-modal'        => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="mixer-modal-title"'],
    'auth-modal'         => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="auth-modal-title"'],
    'add-to-setlist-modal'=> ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="setlist-modal-title"'],
    'transpose-pick-modal'=> ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="transpose-pick-modal-title"'],
    'tempo-pick-modal'   => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="tempo-pick-modal-title"'],
    'help-modal'         => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="help-modal-title"'],
    'pwa-install-modal'  => ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="pwa-install-modal-title"']
];

foreach ($requiredModalAria as $id => $attrs) {
    foreach ($attrs as $attr) {
        check(str_contains($modalsPhp, $attr), "modals.php chứa {$attr} cho modal {$id}");
    }
}

$adminConsolePhp = file_get_contents($root . '/includes/admin_console.php');
check($adminConsolePhp !== false, 'includes/admin_console.php đọc thành công');
check(str_contains($adminConsolePhp, 'role="dialog"'), 'admin_console.php chứa role="dialog"');
check(str_contains($adminConsolePhp, 'aria-modal="true"'), 'admin_console.php chứa aria-modal="true"');
check(str_contains($adminConsolePhp, 'aria-labelledby="admin-modal-title"'), 'admin_console.php chứa aria-labelledby="admin-modal-title"');

// --- TEST 8: Không còn lời gọi ModalManager.registerModal không tồn tại ---
$spaModalJs = file_get_contents($root . '/assets/js/modals/ServicePlanAssignModal.js');
check(!str_contains($spaModalJs, 'registerModal'), 'ServicePlanAssignModal.js không còn gọi registerModal');

// --- TEST 9: Các modal mở/đóng qua ModalManager (Ticket T16) ---
$helpJs = file_get_contents($root . '/assets/js/modals/HelpModal.js');
check(str_contains($helpJs, 'ModalManager.open') && str_contains($helpJs, 'ModalManager.close'), 'HelpModal.js sử dụng ModalManager.open/close');

$tpJs = file_get_contents($root . '/assets/js/modals/TransposePickerModal.js');
check(str_contains($tpJs, 'ModalManager.open') && str_contains($tpJs, 'ModalManager.close'), 'TransposePickerModal.js sử dụng ModalManager.open/close');

$tempoJs = file_get_contents($root . '/assets/js/modals/TempoPickerSheet.js');
check(str_contains($tempoJs, 'ModalManager.open') && str_contains($tempoJs, 'ModalManager.close'), 'TempoPickerSheet.js sử dụng ModalManager.open/close');

$authJs = file_get_contents($root . '/assets/js/auth.js');
check(str_contains($authJs, 'ModalManager.open') && str_contains($authJs, 'ModalManager.close'), 'auth.js sử dụng ModalManager.open/close');

$setlistJs = file_get_contents($root . '/assets/js/setlist-ui.js');
check(str_contains($setlistJs, 'ModalManager.open') && str_contains($setlistJs, 'ModalManager.close'), 'setlist-ui.js sử dụng ModalManager.open/close');

$adminJs = file_get_contents($root . '/assets/js/admin-ui.js');
check(str_contains($adminJs, 'ModalManager.open') && str_contains($adminJs, 'ModalManager.close'), 'admin-ui.js sử dụng ModalManager.open/close');

$importerJs = file_get_contents($root . '/assets/js/importer.js');
check(str_contains($importerJs, 'ModalManager.open') && str_contains($importerJs, 'ModalManager.close'), 'importer.js sử dụng ModalManager.open/close');

$liveJs = file_get_contents($root . '/assets/js/performance/live-session.js');
check(str_contains($liveJs, 'ModalManager.open') && str_contains($liveJs, 'ModalManager.close'), 'live-session.js sử dụng ModalManager.open/close');

$instJs = file_get_contents($root . '/assets/js/instruments.js');
check(str_contains($instJs, 'ModalManager.open') && str_contains($instJs, 'ModalManager.close'), 'instruments.js sử dụng ModalManager.open/close');

check(str_contains($spaModalJs, 'ModalManager.open') && str_contains($spaModalJs, 'ModalManager.close'), 'ServicePlanAssignModal.js sử dụng ModalManager.open/close');

// --- TEST 10: E2E Playwright test modal-a11y.spec.js tồn tại ---
$e2ePath = $root . '/e2e/modal-a11y.spec.js';
check(file_exists($e2ePath), 'e2e/modal-a11y.spec.js tồn tại');
$e2eContent = file_get_contents($e2ePath);
check(str_contains($e2eContent, 'Help Modal'), 'e2e/modal-a11y.spec.js có test Help Modal');
check(str_contains($e2eContent, 'Auth Modal'), 'e2e/modal-a11y.spec.js có test Auth Modal');
check(str_contains($e2eContent, 'Transpose Picker Modal'), 'e2e/modal-a11y.spec.js có test Transpose Picker Modal');

echo "\n>>> ALL 10/10 MODAL & ACCESSIBILITY REGRESSION CHECKS PASSED!\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
