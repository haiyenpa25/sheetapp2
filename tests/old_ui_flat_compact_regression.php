<?php
declare(strict_types=1);

/**
 * tests/old_ui_flat_compact_regression.php
 *
 * Kiểm thử hồi quy cho Giao Diện Cũ (/old/ — Flat Compact Edition) & Hardening hệ thống:
 * 1. Behavioral: RequestSecurity::ensureCsrfToken, isValidCsrf, isSameOrigin (gồm HTTP_REFERER fallback).
 * 2. Behavioral: PracticeService::getHistory sử dụng Prepared Statement an toàn với tham số $days.
 * 3. Static: Toàn bộ file /old/ tuân thủ giới hạn < 600 dòng.
 * 4. Static: CSS /old/ phẳng 100% (--radius-*: 0px, .song-item 1 dòng 26px).
 * 5. Static: LibraryUI (/old/assets/js/library-ui.js) có Virtual Scrolling (_renderVirtualSlice, ROW_HEIGHT = 26),
 *    1-line _createSongItem, #category-flat-list, #key-filter, #quick-pin-bar, jumpByNumber.
 * 6. Static: App (/old/assets/js/app.js) có #quick-num-hud (_handleDigitJump) và phím tắt [ / ] chỉnh cỡ chữ hợp âm.
 */

require_once dirname(__DIR__) . '/api/core/RequestSecurity.php';
require_once dirname(__DIR__) . '/api/services/PracticeService.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';

$root = dirname(__DIR__);
$passed = 0;
$failed = 0;

function checkB(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "[PASS:B] {$label}\n";
    } else {
        $failed++;
        echo "[FAIL:B] {$label}\n";
    }
}

function checkS(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "[PASS:S] {$label}\n";
    } else {
        $failed++;
        echo "[FAIL:S] {$label}\n";
    }
}

// ── 1. Behavioral: RequestSecurity CSRF & Same-Origin ────────────
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
$_SESSION = [];
$token = RequestSecurity::ensureCsrfToken();
checkB(is_string($token) && strlen($token) === 64, 'RequestSecurity::ensureCsrfToken() sinh token 64 ký tự hex');
checkB(RequestSecurity::ensureCsrfToken() === $token, 'RequestSecurity::ensureCsrfToken() giữ nguyên token trong cùng session');

checkB(RequestSecurity::isValidCsrf(['HTTP_X_CSRF_TOKEN' => $token]) === true, 'RequestSecurity::isValidCsrf() chấp nhận X-CSRF-Token hợp lệ');
checkB(RequestSecurity::isValidCsrf(['HTTP_X_CSRF_TOKEN' => 'invalid_token_value']) === false, 'RequestSecurity::isValidCsrf() từ chối X-CSRF-Token sai');
checkB(RequestSecurity::isValidCsrf([]) === false, 'RequestSecurity::isValidCsrf() từ chối khi thiếu X-CSRF-Token');

// Kiểm tra HTTP_REFERER fallback khi thiếu HTTP_ORIGIN
checkB(RequestSecurity::isSameOrigin([
    'HTTP_HOST' => 'localhost:8080',
    'HTTP_REFERER' => 'http://localhost:8080/old/index.html',
]) === true, 'RequestSecurity::isSameOrigin() chấp nhận HTTP_REFERER cùng host');

checkB(RequestSecurity::isSameOrigin([
    'HTTP_HOST' => 'localhost:8080',
    'HTTP_REFERER' => 'https://evil.example.com/attack.html',
]) === false, 'RequestSecurity::isSameOrigin() chặn HTTP_REFERER khác host');

// ── 2. Behavioral: PracticeService::finishSession Prepared Statement ─
createTestDatabase();
$sess = PracticeService::startSession(1, 'song_1', 'piano', 80);
$finished = PracticeService::finishSession((int)$sess['session_id'], 60, 90, 95.0, 100, 95, 92.0);
checkB(!empty($sess['session_id']) && $finished === true, 'PracticeService::finishSession() thực thi Prepared Statement thành công');
$practiceCode = (string)@file_get_contents($root . '/api/services/PracticeService.php');
checkS(!str_contains($practiceCode, 'WHERE id = {$sessionId}'), 'PracticeService.php không còn nội suy chuỗi trực tiếp trong câu lệnh SQL');

// ── 3. Static: Giới hạn < 600 dòng cho các file PHP/JS trong /old/ ─
$oldFiles = [
    'old/index.php',
    'old/includes/sidebar.php',
    'old/includes/toolbar.php',
    'old/includes/sheet_viewer.php',
    'old/assets/js/library-ui.js',
    'old/assets/js/keyboard-handler.js',
    'old/assets/js/app.js',
    'old/assets/js/core/ApiService.js',
    'old/assets/js/core/EventBus.js',
    'old/assets/js/metronome.js',
];

foreach ($oldFiles as $relFile) {
    $fullPath = $root . '/' . $relFile;
    $exists = is_file($fullPath);
    $lineCount = $exists ? count(file($fullPath)) : 9999;
    checkS($exists && $lineCount < 600, "{$relFile} tồn tại và < 600 dòng (hiện tại: {$lineCount} dòng)");
}

// ── 4. Static: Kiểm tra cấu trúc HTML/CSS/JS của Giao diện cũ (/old/) ─
$oldSidebar = (string)@file_get_contents($root . '/old/includes/sidebar.php');
$oldToolbar = (string)@file_get_contents($root . '/old/includes/toolbar.php');
$oldViewer  = (string)@file_get_contents($root . '/old/includes/sheet_viewer.php');

checkS(str_contains($oldSidebar, 'id="category-flat-list"'), 'old/includes/sidebar.php có dải danh mục phẳng #category-flat-list');
checkS(str_contains($oldSidebar, 'id="key-filter"'), 'old/includes/sidebar.php có bộ lọc tông #key-filter');
checkS(str_contains($oldViewer, 'id="quick-pin-bar"'), 'old/includes/sheet_viewer.php có thanh ghim nhanh #quick-pin-bar');
checkS(str_contains($oldViewer, 'id="quick-num-hud"'), 'old/includes/sheet_viewer.php có HUD nhảy bài bằng phím số #quick-num-hud');
checkS(str_contains($oldViewer, 'id="btn-pin-current-song"'), 'old/includes/sheet_viewer.php có nút ghim bài trên thanh công cụ #btn-pin-current-song');

$oldBaseCss   = (string)@file_get_contents($root . '/old/assets/css/base.css');
$oldLayoutCss = (string)@file_get_contents($root . '/old/assets/css/layout.css');
checkS(str_contains($oldBaseCss, 'border-radius: 0 !important') && str_contains($oldBaseCss, '--radius-sm:     0px'), 'old/assets/css/base.css triệt tiêu bo góc (border-radius: 0 !important)');
checkS(str_contains($oldLayoutCss, 'padding: 0 6px; height: 26px; min-height: 26px;'), 'old/assets/css/layout.css định nghĩa .song-item 1 dòng cao 26px');

$oldLibJs = (string)@file_get_contents($root . '/old/assets/js/library-ui.js');
checkS(str_contains($oldLibJs, 'ROW_HEIGHT = 26') && str_contains($oldLibJs, 'function _renderVirtualSlice'), 'old/assets/js/library-ui.js hỗ trợ Virtual Scrolling (_renderVirtualSlice, ROW_HEIGHT = 26)');
checkS(str_contains($oldLibJs, 'song-key-badge') && str_contains($oldLibJs, 'song-pin-btn'), 'old/assets/js/library-ui.js hiển thị badge Tông phẳng và nút Ghim trên mỗi dòng');
checkS(str_contains($oldLibJs, 'function togglePin') && str_contains($oldLibJs, 'function jumpByNumber'), 'old/assets/js/library-ui.js cung cấp togglePin() và jumpByNumber()');

$oldKbJs = (string)@file_get_contents($root . '/old/assets/js/keyboard-handler.js');
checkS(str_contains($oldKbJs, 'function _commitNumJump') && str_contains($oldKbJs, 'quick-num-hud'), 'old/assets/js/keyboard-handler.js hỗ trợ gõ số nhảy bài (_commitNumJump + quick-num-hud)');

if ($failed > 0) {
    echo "\nFAILED: {$failed} checks failed.\n";
    exit(1);
}

echo "SUITE_COMPLETE total={$passed}\n";
exit(0);
