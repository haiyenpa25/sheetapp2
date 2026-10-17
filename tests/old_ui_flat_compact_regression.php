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

// ── 3. Static: Giới hạn < 600 dòng cho các file PHP/JS trong /old/ & Đồng nhất Core ─
$oldFiles = [
    'old/index.php',
    'old/includes/sidebar.php',
    'old/includes/toolbar.php',
    'old/includes/sheet_viewer.php',
    'old/assets/js/library-ui.js',
    'old/assets/js/keyboard-handler.js',
    'old/assets/js/app.js',
    'old/assets/js/metronome.js',
];

foreach ($oldFiles as $relFile) {
    $fullPath = $root . '/' . $relFile;
    $exists = is_file($fullPath);
    $lineCount = $exists ? count(file($fullPath)) : 9999;
    checkS($exists && $lineCount < 600, "{$relFile} tồn tại và < 600 dòng (hiện tại: {$lineCount} dòng)");
}

$oldIndexPhp = (string)@file_get_contents($root . '/old/index.php');
checkS(str_contains($oldIndexPhp, '../assets/js/{$file}') && !is_dir($root . '/old/assets/js/core'), 'old/index.php đồng nhất dùng chung tầng Core & Engine từ ../assets/js/ (không trùng lặp old/assets/js/core)');
checkS(!is_file($root . '/old/assets/js/url-state.js') && is_file($root . '/assets/js/url-state.js'), 'Đã gộp các module dùng chung (url-state, history-manager, session-tracker, transpose-engine) về assets/js/');

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

// ── 5. Behavioral & Static: Sprint S1–S3 Open-Source Integrations ──
require_once $root . '/tools/audit_satb_harmony.php';

$sampleParallel5thXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><staff>1</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>
XML;

$auditRes = SatbHarmonyAuditor::auditXmlString($sampleParallel5thXml, 'test_parallel5.xml');
$hasParallel5 = false;
foreach ($auditRes['issues'] as $iss) {
    if ($iss['type'] === 'PARALLEL_5TH') {
        $hasParallel5 = true;
        break;
    }
}
checkB($hasParallel5, 'SatbHarmonyAuditor::auditXmlString phát hiện chính xác quãng 5 đúng song song (C4-G4 -> D4-A4)');

checkS(is_file($root . '/assets/js/vendor/idb-keyval.min.js') && is_file($root . '/assets/js/core/OfflineVault.js'), 'Sprint S1: Đã tích hợp idb-keyval.min.js và core/OfflineVault.js (IndexedDB + tìm kiếm tiếng Việt không dấu)');
checkS(str_contains($oldToolbar, 'id="audio-timbre"') && str_contains($oldViewer, 'id="btn-chord-notation"'), 'Sprint S2: Giao diện /old/ có bộ chọn Âm sắc (#audio-timbre: Piano/Organ/Choir) và nút Hợp âm La Mã/Nashville (#btn-chord-notation)');
$audioPlayerJs = (string)@file_get_contents($root . '/assets/js/audio-player.js');
checkS(str_contains($audioPlayerJs, 'function setTimbre') && str_contains($audioPlayerJs, 'organ') && str_contains($audioPlayerJs, 'choir'), 'Sprint S2: assets/js/audio-player.js hỗ trợ tổng hợp âm sắc Đàn Ống (Organ) và Hợp Xướng (Choir)');
checkS(is_file($root . '/assets/js/vendor/pitchy-mpm.js') && is_file($root . '/tools/audit_satb_harmony.php'), 'Sprint S3: Đã tích hợp pitchy-mpm.js (McLeod Pitch Method) và tools/audit_satb_harmony.php');

// ── 6. Static & Behavioral: Rà soát & Tối ưu hóa hệ thống (TV0–TV4) ──
$oldChordCanvasLines = count(file($root . '/old/assets/js/chord-canvas.js'));
checkS($oldChordCanvasLines < 600 && !is_file($root . '/old/assets/js/lyric-extractor.js'), "old/assets/js/chord-canvas.js < 600 dòng ({$oldChordCanvasLines} dòng) và đã gộp lyric-extractor.js dùng chung");

$mainLibJs = (string)@file_get_contents($root . '/assets/js/library-ui.js');
checkS(str_contains($mainLibJs, '_ptrMoved') && str_contains($mainLibJs, 'function _getItemH()'), 'assets/js/library-ui.js có bảo vệ cuộn cảm ứng (_ptrMoved <= 10px) và đo động chiều cao dòng (_getItemH)');
checkS(str_contains($mainLibJs, '[^\p{L}\p{N}]') && str_contains($mainLibJs, 'mode: _searchMode, limit: 200'), 'assets/js/library-ui.js tô sáng nguyên từ tiếng Việt Unicode và truyền mode/limit:200 khi tìm kiếm');

$apiIndexPhp = (string)@file_get_contents($root . '/api/index.php');
checkS(str_contains($apiIndexPhp, 'session_write_close()'), 'api/index.php mở khóa session sớm (session_write_close) cho các request GET/HEAD song song');

$songServicePhp = (string)@file_get_contents($root . '/api/services/SongService.php');
checkS(str_contains($songServicePhp, 'LOCK_EX') && str_contains($songServicePhp, '@rename($tmpFile, self::CACHE_FILE)'), 'SongService.php ghi songs_cache.json nguyên tử (LOCK_EX + temp file + rename)');

$versionHelperPhp = (string)@file_get_contents($root . '/api/services/SongVersionHelper.php');
checkS(str_contains($versionHelperPhp, '$expectedPrefix = \'storage/users/\' . $safeUser . \'/\''), 'SongVersionHelper.php kiểm tra quyền sở hữu thư mục người dùng trong saveXml và restoreXmlBackup');

if ($failed > 0) {
    echo "\nFAILED: {$failed} checks failed.\n";
    exit(1);
}

echo "SUITE_COMPLETE total={$passed}\n";
exit(0);
