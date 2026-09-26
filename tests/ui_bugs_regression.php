<?php
/**
 * ui_bugs_regression.php
 *
 * Kiểm thử tự động hồi quy nhóm lỗi giao diện UI F6–F11 (Task 1.7 - Giai đoạn 1)
 *
 * Tiêu chí kiểm tra:
 * 1. F6: Giới hạn dịch giọng app.js đồng bộ ±12 nửa cung với modals.php (không còn bị chặn ở ±8)
 * 2. F6/F12: Capo select đồng bộ chính xác trong dải [0, 7], ngoài dải đặt về 0 an toàn
 * 3. F7: App.toggleSidebar tồn tại và kết nối tới ToolbarController.toggleSidebar; toolbar và Gig HUD gọi đúng
 * 4. F8: AppUI được gán vào window.AppUI để các toast độc lập (AdminUI, DisplaySettings) hiển thị được
 * 5. F9: Khi xoay màn hình (orientationchange) hoặc đổi kích thước (resize), tỷ lệ zoom được khóa bảo toàn
 * 6. F10: Phím tắt không bị kẹt khi focus nút bấm (blur button); hỗ trợ đầy đủ phím [, ], S theo hợp đồng
 * 7. F11: Chế độ Biểu Diễn (Gig mode) tích hợp Wake Lock API chống tắt màn hình và Fullscreen API
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$failures = [];
$totalTests = 0;

function assertCondition(bool $cond, string $msg, array &$failures, int &$totalTests): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    $totalTests++;
    if (!$cond) {
        $failures[] = $msg;
        echo "  ❌ FAIL: {$msg}\n";
    } else {
        echo "  ✅ PASS: {$msg}\n";
    }
}

echo "=== Kiểm thử Hồi quy Nhóm Lỗi UI F6–F11 (Task 1.7) ===\n";

$appJs = file_get_contents($root . '/assets/js/app.js');
$appUiJs = file_get_contents($root . '/assets/js/app-ui.js');
$tbJs = file_get_contents($root . '/assets/js/toolbar-controller.js');
$khJs = file_get_contents($root . '/assets/js/keyboard-handler.js');
$modalsPhp = file_get_contents($root . '/includes/modals.php');
$toolbarPhp = file_get_contents($root . '/includes/toolbar.php');
$sheetViewerPhp = file_get_contents($root . '/includes/sheet_viewer.php');

// 1. F6: Dịch giọng đồng bộ ±12 nửa cung
assertCondition(
    strpos($appJs, 'Math.abs(newVal) > 12') !== false &&
    strpos($appJs, 'Math.abs(num) > 12') !== false &&
    strpos($appJs, 'Math.abs(newVal) > 8') === false &&
    strpos($modalsPhp, 'min="-12" max="12"') !== false,
    "F6: App.js và Modals đồng bộ dải dịch giọng ±12 nửa cung (loại bỏ giới hạn ±8)",
    $failures,
    $totalTests
);

// 2. F6/F12: Capo select đồng bộ
assertCondition(
    strpos($appUiJs, 'currentTranspose >= 0 && currentTranspose <= 7') !== false &&
    strpos($tbJs, "Store.set('capoLevel', newCapo)") !== false,
    "F6/F12: Capo select đồng bộ dải hợp lệ 0-7, bảo toàn quy ước kẹp capo và transpose",
    $failures,
    $totalTests
);

// 3. F7: App.toggleSidebar và ToolbarController.toggleSidebar
assertCondition(
    strpos($tbJs, 'function toggleSidebar()') !== false &&
    strpos($tbJs, 'return { init, toggleSidebar };') !== false &&
    strpos($appJs, 'toggleSidebar:') !== false &&
    strpos($toolbarPhp, 'onclick="App?.toggleSidebar?.()"') !== false &&
    strpos($sheetViewerPhp, 'onclick="App?.toggleSidebar?.()"') !== false,
    "F7: App.toggleSidebar và ToolbarController.toggleSidebar kết nối đầy đủ từ toolbar và Gig HUD",
    $failures,
    $totalTests
);

// 4. F8: AppUI gắn vào window
assertCondition(
    strpos($appUiJs, 'window.AppUI = AppUI;') !== false,
    "F8: AppUI được gắn tường minh vào window.AppUI (đảm bảo toast của admin-ui và display-settings hiển thị)",
    $failures,
    $totalTests
);

// 5. F9: Bảo toàn khóa zoom khi xoay hoặc resize
$resizeHasLockCheck = (bool)preg_match('/wDelta > 100[\s\S]*?sheetapp_zoom_locked[\s\S]*?render/i', $tbJs);
$orientHasLockCheck = (bool)preg_match('/orientationchange[\s\S]*?sheetapp_zoom_locked[\s\S]*?render/i', $tbJs);
assertCondition(
    $resizeHasLockCheck && $orientHasLockCheck,
    "F9: ToolbarController kiểm tra khóa zoom 'sheetapp_zoom_locked' khi resize và khi orientationchange",
    $failures,
    $totalTests
);

// 6. F10: Hợp đồng phím tắt & không bị kẹt khi focus nút bấm
$khHasBlur = strpos($khJs, "if (tag === 'button')") !== false && strpos($khJs, "document.activeElement.blur()") !== false;
$khHasSquareBrackets = strpos($khJs, "case '[':") !== false && strpos($khJs, "case ']':") !== false;
$khHasSKey = strpos($khJs, "case 's': case 'S':") !== false;
assertCondition(
    $khHasBlur && $khHasSquareBrackets && $khHasSKey,
    "F10: Keyboard handler tự động blur button khi ấn phím tắt; hỗ trợ đầy đủ phím [, ], và S",
    $failures,
    $totalTests
);

// 7. F11: Wake Lock & Fullscreen API trong Gig Mode
$hasWakeLockReq = strpos($appUiJs, "navigator.wakeLock.request('screen')") !== false;
$hasWakeLockRel = strpos($appUiJs, "_releaseWakeLock()") !== false;
$hasFullscreen = strpos($appUiJs, "requestFullscreen") !== false && strpos($appUiJs, "exitFullscreen") !== false;
$hasVisibilityReacquire = strpos($appUiJs, "visibilitychange") !== false;
assertCondition(
    $hasWakeLockReq && $hasWakeLockRel && $hasFullscreen && $hasVisibilityReacquire,
    "F11: Gig mode tích hợp đầy đủ Wake Lock API (giữ sáng màn hình) và Fullscreen API khi biểu diễn",
    $failures,
    $totalTests
);

echo "\n--------------------------------------------------------\n";
echo "Kết quả: " . ($totalTests - count($failures)) . "/{$totalTests} kiểm tra đạt chuẩn.\n";

if (!empty($failures)) {
    echo "❌ CÓ LỖI HỒI QUY UI F6-F11:\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}

echo "✅ TẤT CẢ KIỂM TRA HỒI QUY UI F6–F11 ĐÃ ĐẠT (PASS 100%)\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
exit(0);
