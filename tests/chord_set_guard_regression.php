<?php
declare(strict_types=1);

/**
 * tests/chord_set_guard_regression.php
 * 
 * Kiểm thử tự động Task 1.5: Sửa chord-set dropdown và bảo vệ HD/TLH (Khắc phục F3)
 * - __create_new_set__ không bao giờ trở thành set active/lưu được (F3)
 * - HD và default/TLH không xóa được (cả Backend lẫn Frontend)
 * - Xóa set cá nhân đang kích hoạt thì fallback quay về HD
 * - Backend chặn ghi file hoặc tạo set với tên pseudo-action bắt đầu bằng '__'
 */

$root = dirname(__DIR__);

require_once $root . '/api/services/ChordSetService.php';

$failures = [];
$total = 0;

function check(bool $condition, string $message, string $details = ''): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures, $total;
    $total++;
    if ($condition) {
        echo "  [PASS] {$message}\n";
    } else {
        $msg = "  [FAIL] {$message}" . ($details ? " -> {$details}" : "");
        echo "{$msg}\n";
        $failures[] = $msg;
    }
}

echo "========================================================\n";
echo "   SheetApp2 — Chord Set Guard Regression Suite (F3)    \n";
echo "========================================================\n\n";

$chordCanvasSrc = file_get_contents($root . '/assets/js/chord-canvas.js') ?: '';
$toolbarSrc     = file_get_contents($root . '/includes/toolbar.php') ?: '';
$chordCtrlSrc   = file_get_contents($root . '/api/controllers/ChordSetController.php') ?: '';

// 1. switchSet chặn tuyệt đối __create_new_set__ và __*
$switchSetGuardsPseudoNames = str_contains($chordCanvasSrc, "name === '__create_new_set__'")
    && str_contains($chordCanvasSrc, "name.startsWith('__')")
    && str_contains($chordCanvasSrc, "sel.value = _currentSet;");
check(
    $switchSetGuardsPseudoNames,
    'ChordCanvas.switchSet chặn tuyệt đối không cho __create_new_set__ hoặc pseudo-names trở thành active set (Fix F3)',
    "switchSetGuards=" . ($switchSetGuardsPseudoNames ? 'true' : 'false')
);

// 2. handleSelectChange xử lý chọn action modal
$hasHandleSelectChange = str_contains($chordCanvasSrc, "function handleSelectChange(val)")
    && str_contains($chordCanvasSrc, "showNewSetModal();")
    && str_contains($chordCanvasSrc, "handleSelectChange,");
check(
    $hasHandleSelectChange,
    'ChordCanvas có hàm handleSelectChange xử lý chuyên biệt các tùy chọn tạo mới/mở cổng mà không kích hoạt switchSet rác',
    "hasHandleSelect=" . ($hasHandleSelectChange ? 'true' : 'false')
);

// 3. Toolbar selector dùng handleSelectChange
$toolbarUsesHandler = str_contains($toolbarSrc, "ChordCanvas.handleSelectChange");
check(
    $toolbarUsesHandler,
    'Toolbar selector liên kết an toàn tới ChordCanvas.handleSelectChange',
    "toolbarUses=" . ($toolbarUsesHandler ? 'true' : 'false')
);

// 4. Backend ChordSetService::saveSet từ chối ghi đè TLH/default và action pseudo-names
$saveRejectsTlh = ChordSetService::saveSet('test_song', 'default', []) === false;
$saveRejectsTlh2 = ChordSetService::saveSet('test_song', 'TLH', []) === false;
$saveRejectsPseudo = ChordSetService::saveSet('test_song', '__create_new_set__', []) === false;
check(
    $saveRejectsTlh && $saveRejectsTlh2 && $saveRejectsPseudo,
    'ChordSetService::saveSet từ chối lưu vào "default", "TLH" và bất kỳ tên nào bắt đầu bằng "__"',
    "tlh=" . ($saveRejectsTlh ? 'ok' : 'fail') . ", pseudo=" . ($saveRejectsPseudo ? 'ok' : 'fail')
);

// 5. Backend ChordSetController từ chối xóa default, TLH, HD
$ctrlRejectsProtectedDeletes = str_contains($chordCtrlSrc, "\$name === 'default' || \$name === 'TLH' || \$name === 'HD'")
    && str_contains($chordCtrlSrc, "Response::forbidden('Bộ hợp âm này được bảo vệ, không thể xóa!');");
check(
    $ctrlRejectsProtectedDeletes,
    'ChordSetController từ chối mọi yêu cầu xóa bộ default, TLH, HD với HTTP 403 Forbidden',
    "ctrlRejects=" . ($ctrlRejectsProtectedDeletes ? 'true' : 'false')
);

// 6. Xóa bộ cá nhân fallback về HD
$fallbackToHd = str_contains($chordCanvasSrc, "if (_currentSet === name) await switchSet('HD');");
check(
    $fallbackToHd,
    'ChordCanvas.deleteSet tự động fallback sang bộ "HD" khi bộ cá nhân đang chọn bị xóa',
    "fallbackToHd=" . ($fallbackToHd ? 'true' : 'false')
);

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Chord Set Guard:\n";
echo "  - Tổng số kiểm tra: {$total}\n";
echo "  - Số kiểm tra thất bại: " . count($failures) . "\n";
if (count($failures) === 0) {
    echo "  - Trạng thái: ✅ TẤT CẢ KIỂM TRA CHORD SET GUARD ĐỀU ĐẠT (PASS)\n";
    echo "--------------------------------------------------------\n\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "  - Trạng thái: ❌ CÓ LỖI XẢY RA\n";
    echo "--------------------------------------------------------\n\n";
    exit(1);
}
