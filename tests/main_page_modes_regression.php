<?php
/**
 * tests/main_page_modes_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.6 — Đơn giản hóa trang chính theo mode:
 * 1. ModeManager: Định nghĩa 3 canonical modes (view, edit_chords, performance),
 *    quản lý data-app-mode, sheet-only-mode, chord-edit-mode, toggle và reset.
 * 2. Phím tắt chuẩn hóa: C (toggle chords), F (toggle performance), Escape (reset về view mode).
 * 3. Giao diện Biểu Diễn (Performance): Ẩn thanh công cụ, sidebar, page-bar và nút trợ năng FAB (#fab-wrap).
 * 4. Modal Overlays Consolidation: Số lượng modal overlays trên trang chính <= 6 (chính xác 6 modals).
 * 5. Hợp nhất Setlist Modal: #create-setlist-modal được tích hợp liền mạch bên trong #add-to-setlist-modal.
 * 6. Bottom Sheet & Banner: #tempo-pick-modal chuyển thành .bottom-sheet, #pwa-install-modal chuyển thành .pwa-install-banner.
 * 7. Bảo toàn hợp đồng dịch giọng: #transpose-pick-custom bảo toàn dải min="-12" max="12".
 */

declare(strict_types=1);

function check(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== MAIN PAGE MODES & MODAL CONSOLIDATION REGRESSION (TASK 2.6) ===\n";

$root = dirname(__DIR__);

// --- TEST 1: ModeManager.js tồn tại và cài đặt đầy đủ 3 canonical modes ---
$modeManagerPath = $root . '/assets/js/core/ModeManager.js';
check(file_exists($modeManagerPath), 'File assets/js/core/ModeManager.js tồn tại');
$modeManagerJs = file_get_contents($modeManagerPath);

check(str_contains($modeManagerJs, "VIEW: 'view'"), 'ModeManager định nghĩa mode VIEW');
check(str_contains($modeManagerJs, "EDIT_CHORDS: 'edit_chords'"), 'ModeManager định nghĩa mode EDIT_CHORDS');
check(str_contains($modeManagerJs, "PERFORMANCE: 'performance'"), 'ModeManager định nghĩa mode PERFORMANCE');
check(str_contains($modeManagerJs, 'togglePerformance'), 'ModeManager có hàm togglePerformance');
check(str_contains($modeManagerJs, 'toggleEditChords'), 'ModeManager có hàm toggleEditChords');
check(str_contains($modeManagerJs, 'resetToView'), 'ModeManager có hàm resetToView');
check(str_contains($modeManagerJs, 'dataset.appMode'), 'ModeManager đồng bộ thuộc tính data-app-mode trên body');
check(str_contains($modeManagerJs, 'sheet-only-mode'), 'ModeManager kích hoạt sheet-only-mode khi ở chế độ Biểu Diễn');
check(str_contains($modeManagerJs, 'chord-edit-mode'), 'ModeManager kích hoạt chord-edit-mode khi ở chế độ Sửa Hợp Âm');

// --- TEST 2: Phím tắt bàn phím tích hợp ModeManager trong keyboard-handler.js ---
$keyboardPath = $root . '/assets/js/keyboard-handler.js';
check(file_exists($keyboardPath), 'File keyboard-handler.js tồn tại');
$keyboardJs = file_get_contents($keyboardPath);

check(str_contains($keyboardJs, 'ModeManager.toggleEditChords'), 'Phím C được điều hướng qua ModeManager.toggleEditChords');
check(str_contains($keyboardJs, 'ModeManager.togglePerformance'), 'Phím F được điều hướng qua ModeManager.togglePerformance');
check(str_contains($keyboardJs, 'ModeManager.resetToView'), 'Phím Escape được điều hướng qua ModeManager.resetToView');

// --- TEST 3: Giấu FAB và chrome trong Performance / Sheet-Only Mode ---
$layoutCss = file_get_contents($root . '/assets/css/layout.css');
check(str_contains($layoutCss, 'body.sheet-only-mode #fab-wrap'), 'layout.css ẩn #fab-wrap trong chế độ sheet-only-mode');
check(str_contains($modeManagerJs, 'fabWrap.classList.toggle'), 'ModeManager.js đồng bộ ẩn nút FAB khi chuyển sang performance mode');

// --- TEST 4: Tích hợp ModeManager.js vào trang chính index.php ---
$indexPhp = file_get_contents($root . '/index.php');
check(str_contains($indexPhp, 'core/ModeManager.js'), 'index.php nạp ModeManager.js');

// --- TEST 5: Giới hạn số lượng Modal Overlays trên trang chính <= 6 ---
$modalsPhp = file_get_contents($root . '/includes/modals.php');
preg_match_all('/<div\s+[^>]*class=["\'][^"\']*modal-overlay[^"\']*["\'][^>]*>/i', $modalsPhp, $overlayMatches);
$overlayCount = count($overlayMatches[0]);

check($overlayCount <= 6, "Số lượng modal-overlay trên trang chính là {$overlayCount} (mục tiêu <= 6)");
check($overlayCount === 6, "Chính xác 6 modal-overlay cốt lõi được giữ lại trên trang chính");

// Kiểm tra 6 modal overlays cốt lõi
$requiredOverlayIds = [
    'livesync-modal',
    'mixer-modal',
    'auth-modal',
    'add-to-setlist-modal',
    'transpose-pick-modal',
    'help-modal'
];
foreach ($requiredOverlayIds as $id) {
    $hasOverlay = (preg_match('/<div[^>]*id="' . $id . '"[^>]*class="[^"]*modal-overlay/i', $modalsPhp) === 1)
               || (preg_match('/<div[^>]*class="[^"]*modal-overlay[^"]*"[^>]*id="' . $id . '"/i', $modalsPhp) === 1);
    check($hasOverlay, "Modal #{$id} tồn tại đúng chuẩn modal-overlay");
}

// --- TEST 6: Hợp nhất Setlist Modal & Bottom Sheet / Banner ---
check(str_contains($modalsPhp, 'id="create-setlist-modal"'), '#create-setlist-modal tồn tại bên trong cấu trúc');
check(preg_match('/id="create-setlist-modal"[^>]*class="[^"]*modal-overlay/i', $modalsPhp) === 0, '#create-setlist-modal không còn là modal-overlay độc lập mà đã được gộp');

check(str_contains($modalsPhp, 'id="tempo-pick-modal"'), '#tempo-pick-modal tồn tại');
check(preg_match('/id="tempo-pick-modal"[^>]*class="[^"]*bottom-sheet/i', $modalsPhp) === 1, '#tempo-pick-modal là modern .bottom-sheet');

check(str_contains($modalsPhp, 'id="pwa-install-modal"'), '#pwa-install-modal tồn tại');
check(preg_match('/id="pwa-install-modal"[^>]*class="[^"]*pwa-install-banner/i', $modalsPhp) === 1, '#pwa-install-modal là .pwa-install-banner không che khuất màn hình');

$componentsCss = file_get_contents($root . '/assets/css/components.css');
check(str_contains($componentsCss, '.bottom-sheet'), 'components.css có định nghĩa class .bottom-sheet');
check(str_contains($componentsCss, '.pwa-install-banner'), 'components.css có định nghĩa class .pwa-install-banner');

// --- TEST 7: Hợp đồng và hồi quy các tính năng dịch giọng & setlist UI ---
check(str_contains($modalsPhp, 'min="-12" max="12"'), 'Hợp đồng dịch giọng min="-12" max="12" trong transpose-pick-custom được bảo toàn');
$setlistUiJs = file_get_contents($root . '/assets/js/setlist-ui.js');
check(str_contains($setlistUiJs, 'btn-toggle-inline-create-setlist'), 'setlist-ui.js kết nối nút tạo setlist nội tuyến');

echo "\n>>> ALL 7/7 MAIN PAGE MODES & MODAL CONSOLIDATION REGRESSION CHECKS PASSED!\n";
