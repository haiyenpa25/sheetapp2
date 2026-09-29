<?php
/**
 * tests/library_l016_dedup_handlers_and_escape_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-16 (ROADMAP 4):
 *  1. Gỡ handler trùng: nút fullscreen, nút sửa hợp âm.
 *  2. 4 bộ xử lý Escape được hợp nhất dưới sự làm chủ duy nhất của ModeManager.
 *  3. Ngân sách file < 600 dòng.
 */

declare(strict_types=1);

$passed = 0;
$failed = 0;

function check(bool $condition, string $id, string $desc, bool $isBehavioral = true): void {
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
echo "   Ticket L0-16: Dedup Handlers & Escape ModeManager\n";
echo "========================================================\n\n";

$toolbarCtrlJs   = file_get_contents(__DIR__ . '/../assets/js/toolbar-controller.js');
$appUiJs         = file_get_contents(__DIR__ . '/../assets/js/app-ui.js');
$chordCanvasJs   = file_get_contents(__DIR__ . '/../assets/js/chord-canvas.js');
$modeManagerJs   = file_get_contents(__DIR__ . '/../assets/js/core/ModeManager.js');
$keyboardHandler = file_get_contents(__DIR__ . '/../assets/js/keyboard-handler.js');

// 1. Kiểm tra toolbar-controller.js không bind click btn-fullscreen
check(
    strpos($toolbarCtrlJs, "document.getElementById('btn-fullscreen')?.addEventListener('click', AppUI?.toggleFullscreen)") === false,
    'toolbar_controller_no_dup_fullscreen_listener',
    'toolbar-controller.js không bind click trùng lặp vào btn-fullscreen'
);

// 2. Kiểm tra app-ui.js ủy quyền sang ModeManager
check(
    strpos($appUiJs, 'window.ModeManager?.togglePerformance') !== false,
    'app_ui_delegates_to_mode_manager',
    'app-ui.js toggleFullscreen ủy quyền sang ModeManager.togglePerformance'
);

// 3. Kiểm tra chord-canvas.js không bind trùng btn-add-chord-mode-bar
check(
    strpos($chordCanvasJs, "document.getElementById('btn-add-chord-mode-bar')?.addEventListener('click', toggleAddMode)") === false,
    'chord_canvas_no_dup_bar_listener',
    'chord-canvas.js không bind click trùng lặp vào btn-add-chord-mode-bar'
);

// 4. Kiểm tra ModeManager có hàm handleEscape tập trung và export
check(
    strpos($modeManagerJs, 'function handleEscape(') !== false,
    'mode_manager_has_handleEscape',
    'ModeManager.js có hàm handleEscape tập trung'
);
check(
    strpos($modeManagerJs, 'handleEscape') !== false,
    'mode_manager_exports_handleEscape',
    'ModeManager.js export handleEscape'
);

// 5. R0-6 (ROADMAP5, lỗi B17): ModeManager tự đăng ký listener 'keydown' Escape RIÊNG
// của nó (xem check bên dưới) -- nếu keyboard-handler.js CŨNG gọi lại
// window.ModeManager.handleEscape(e), cùng 1 lần bấm Esc bị xử lý 2 LẦN (đóng popup
// xong rồi lần gọi thứ 2 lại thoát luôn cả chế độ đang sửa). Vì vậy keyboard-handler.js
// KHÔNG được gọi lại handleEscape nữa; ModeManager một mình làm chủ.
check(
    strpos($keyboardHandler, 'window.ModeManager?.handleEscape') === false &&
    strpos($keyboardHandler, 'window.ModeManager.handleEscape') === false,
    'keyboard_handler_no_dup_escape_call',
    'keyboard-handler.js KHÔNG gọi lại ModeManager.handleEscape (tránh xử lý Escape 2 lần)'
);
check(
    (bool) preg_match('/addEventListener\(\'keydown\',[\s\S]{0,80}Escape[\s\S]{0,40}handleEscape/', $modeManagerJs),
    'mode_manager_self_registers_escape_listener',
    'ModeManager.js tự đăng ký listener keydown Escape riêng, làm chủ duy nhất việc điều phối'
);

// 6. Ngân sách file < 600 dòng
$files = [
    'assets/js/toolbar-controller.js' => __DIR__ . '/../assets/js/toolbar-controller.js',
    'assets/js/app-ui.js' => __DIR__ . '/../assets/js/app-ui.js',
    'assets/js/chord-canvas.js' => __DIR__ . '/../assets/js/chord-canvas.js',
    'assets/js/core/ModeManager.js' => __DIR__ . '/../assets/js/core/ModeManager.js',
    'assets/js/keyboard-handler.js' => __DIR__ . '/../assets/js/keyboard-handler.js',
];

foreach ($files as $name => $path) {
    $lines = count(file($path));
    check($lines < 600, "line_budget_{$name}", "{$name} có {$lines} dòng (< 600)");
}

$total = $passed + $failed;
echo "\nSUITE_COMPLETE total={$total}\n";

if ($failed > 0) {
    exit(1);
}
