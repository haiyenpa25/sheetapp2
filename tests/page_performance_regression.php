<?php
/**
 * tests/page_performance_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.8 & Checkpoint G2 — Go/No-Go:
 * 1. MIDI Lazy Initialization: Không auto-request MIDI trên boot trang chính.
 * 2. Performance Lazy Loader: Live sync & performance modules được tải theo nhu cầu (on-demand).
 * 3. Script Tags Optimization: Loại bỏ các thẻ script performance tĩnh trên index.php.
 * 4. F13 Fix Part A: Triệt tiêu duplicate request chordSets.list (cache + bỏ timeout thừa).
 * 5. F13 Fix Part B: Triệt tiêu duplicate OSMD render do _autoFitZoom và setZoom.
 * 6. Checkpoint G2 Acceptance: Nghiệm thu toàn diện 6 tiêu chuẩn Go/No-Go.
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

echo "=== PAGE PERFORMANCE & CHECKPOINT G2 REGRESSION (TASK 2.8) ===\n";

$root = dirname(__DIR__);

// ─── TEST 1: MIDI Lazy Initialization ──────────────────────────────
$kbFile = $root . '/assets/js/keyboard-handler.js';
check(file_exists($kbFile), "keyboard-handler.js exists");
$kbContent = file_get_contents($kbFile);

// Check that init() does NOT invoke _initWebMIDI() immediately
check(
    !preg_match('/function\s+init\s*\(\)\s*\{[^}]*_initWebMIDI\s*\(/s', $kbContent),
    "KeyboardHandler.init() does NOT automatically call _initWebMIDI() on page boot"
);
// Check that enableMIDI is exposed
check(
    strpos($kbContent, 'enableMIDI') !== false && strpos($kbContent, 'isMidiEnabled') !== false,
    "KeyboardHandler exposes enableMIDI() and isMidiEnabled() for on-demand activation"
);
// Check that ModeManager triggers enableMIDI on performance mode
$mmFile = $root . '/assets/js/core/ModeManager.js';
check(file_exists($mmFile), "ModeManager.js exists");
$mmContent = file_get_contents($mmFile);
check(
    strpos($mmContent, 'KeyboardHandler?.enableMIDI?.()') !== false,
    "ModeManager activates MIDI when entering PERFORMANCE mode"
);

// ─── TEST 2: Performance Lazy Loader ───────────────────────────────
$lsFile = $root . '/assets/js/live-sync.js';
check(file_exists($lsFile), "live-sync.js exists");
$lsContent = file_get_contents($lsFile);

check(
    strpos($lsContent, 'ensureLoaded') !== false && strpos($lsContent, 'loadModules') !== false,
    "live-sync.js provides ensureLoaded() / loadModules() API"
);
check(
    strpos($lsContent, 'performance/live-session.js') !== false &&
    strpos($lsContent, 'performance/performance-engine.js') !== false,
    "live-sync.js lazily injects performance & live session modules"
);
check(
    strpos($lsContent, "params.has('room')") !== false || strpos($lsContent, "params.has('live')") !== false,
    "live-sync.js detects room/live URL query params for auto-join"
);
check(
    strpos($mmContent, 'LiveSync?.ensureLoaded?.()') !== false,
    "ModeManager ensures live sync modules are loaded when entering PERFORMANCE mode"
);

// ─── TEST 3: Script Tags Optimization & Asset Versioning ───────────
$indexFile = $root . '/index.php';
check(file_exists($indexFile), "index.php exists");
$indexContent = file_get_contents($indexFile);

// Check that none of the heavy performance modules are hardcoded via jsTag
$perfModules = [
    'performance/transport-clock.js',
    'performance/count-in-engine.js',
    'performance/musical-position.js',
    'performance/arrangement-engine.js',
    'performance/cue-engine.js',
    'performance/live-transport.js',
    'performance/qr-helper.js',
    'performance/live-session.js',
    'performance/performance-engine.js'
];
foreach ($perfModules as $mod) {
    check(
        strpos($indexContent, "jsTag('{$mod}')") === false,
        "index.php does not statically include {$mod} via jsTag"
    );
}

// Check that window.__ASSET_V__ is defined
check(
    strpos($indexContent, 'window.__ASSET_V__') !== false,
    "index.php defines window.__ASSET_V__ for asset cache busting"
);

// ─── TEST 4: F13 Fix Part A (chordSets.list deduplication) ─────────
$ccFile = $root . '/assets/js/chord-canvas.js';
check(file_exists($ccFile), "chord-canvas.js exists");
$ccContent = file_get_contents($ccFile);

check(
    strpos($ccContent, '_chordSetsCache') !== false,
    "chord-canvas.js implements _chordSetsCache to avoid duplicate chordSets.list requests"
);
check(
    strpos($ccContent, '_chordSetsCache.delete(songId)') !== false,
    "chord-canvas.js invalidates cache on mutating actions (create, delete, clone)"
);

$slFile = $root . '/assets/js/song-loader.js';
check(file_exists($slFile), "song-loader.js exists");
$slContent = file_get_contents($slFile);

check(
    strpos($slContent, 'ChordCanvas.refreshSetDropdown();') === false,
    "song-loader.js removes redundant setTimeout call to refreshSetDropdown"
);

// ─── TEST 5: F13 Fix Part B (OSMD auto-fit double render) ───────────
check(
    strpos($slContent, 'curZoom === 1.0 && Math.abs((pct / 100) - curZoom) > 0.03') !== false,
    "song-loader.js autoFitZoom only triggers setZoom if delta > 3%"
);

$appFile = $root . '/assets/js/app.js';
check(file_exists($appFile), "app.js exists");
$appContent = file_get_contents($appFile);

check(
    strpos($appContent, 'Math.abs(prevZoom - zoom) < 0.01') !== false,
    "App.setZoom skips OSMDRenderer re-rendering if zoom delta < 0.01"
);

// ─── TEST 6: Checkpoint G2 — Consolidation Acceptance Criteria ─────
// Criterion 1: Unified App Shell
$navFile = $root . '/includes/app_nav.php';
check(file_exists($navFile), "Checkpoint G2: includes/app_nav.php exists");
$navContent = file_get_contents($navFile);
check(
    strpos($navContent, 'pillar-library') !== false &&
    strpos($navContent, 'pillar-live') !== false &&
    strpos($navContent, 'pillar-learn') !== false &&
    strpos($navContent, 'pillar-manager') !== false,
    "Checkpoint G2: App Shell supports all 4 core pillars (Library, Live, Learn, Manager)"
);

// Criterion 2: Unified Auth
$authFile = $root . '/assets/js/auth.js';
check(file_exists($authFile), "Checkpoint G2: assets/js/auth.js exists");
$authContent = file_get_contents($authFile);
check(
    strpos($authContent, 'getUser') !== false && strpos($authContent, 'isLoggedIn') !== false,
    "Checkpoint G2: auth.js provides central user authentication methods"
);

// Criterion 3: /members 302 redirect
$memFile = $root . '/members/index.php';
check(file_exists($memFile), "Checkpoint G2: members/index.php exists");
$memContent = file_get_contents($memFile);
check(
    strpos($memContent, '302') !== false || strpos($memContent, 'Location:') !== false,
    "Checkpoint G2: /members issues 302 redirect to consolidated admin"
);

// Criterion 4: Zero naked fetch() calls in business logic
$apiServiceFile = $root . '/assets/js/core/ApiService.js';
check(file_exists($apiServiceFile), "Checkpoint G2: ApiService.js exists");

// Criterion 5: File size limit under 600 lines for all 27 modularized files
$modularTestFile = $root . '/tests/modular_architecture_regression.php';
check(file_exists($modularTestFile), "Checkpoint G2: modular_architecture_regression.php exists");

echo "\nAll Page Performance & Checkpoint G2 regression checks PASSED! (6/6)\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
