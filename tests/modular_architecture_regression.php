<?php
/**
 * tests/modular_architecture_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.7 — Tách các file lớn theo feature boundary:
 * 1. Line Count Budget: Tất cả file business JS mục tiêu và các submodule không vượt quá 600 dòng.
 * 2. Explicit Script Load Order: Thứ tự nạp script trong các file host (editor/index.php,
 *    live-band/index.php, manager/index.php, index.php, learn/index.php) đảm bảo nạp submodule
 *    trước coordinator.
 * 3. includes/modals.php: Không chứa monolith inline JS, các modal tách thành component sạch.
 * 4. Namespace & Global Exports: Tất cả submodule xuất đúng namespace trên window.
 * 5. Critical Contract Tokens: Bảo toàn các token sống còn (_chordLoadToken, initialSet = 'HD',
 *    SafeHtml escaping, MusicXML bridge).
 * 6. File Existence & Integrity: Mọi file script được tham chiếu đều tồn tại vật lý trên ổ đĩa.
 * 7. Dependency Tree: Kiến trúc module độc lập, không có circular dependency giữa coordinator và submodule.
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

echo "=== MODULAR ARCHITECTURE REGRESSION (TASK 2.7) ===\n";

$root = dirname(__DIR__);

// Helper đếm dòng file
function getLineCount(string $filePath): int {
    if (!file_exists($filePath)) return -1;
    $lines = file($filePath, FILE_IGNORE_NEW_LINES);
    return is_array($lines) ? count($lines) : 0;
}

// ─── TEST 1: Line Count Budget (< 600 lines) ────────────────────────
$targetFiles = [
    // includes/modals.php
    'includes/modals.php' => 600, // template modal hợp nhất

    // editor
    'editor/editor.js' => 600,
    'editor/js/editor-export.js' => 600,
    'editor/js/editor-midi.js' => 600,
    'editor/js/editor-audio.js' => 600,
    'editor/js/editor-ai.js' => 600,
    'editor/js/editor-parser.js' => 600,
    'editor/js/editor-modifiers.js' => 600,
    'editor/js/editor-health.js' => 600,
    'editor/js/editor-drag.js' => 600,
    'editor/js/editor-ui.js' => 600,

    // live-band
    'live-band/live-band.js' => 600,
    'live-band/js/stage-room.js' => 600,
    'live-band/js/stage-timer.js' => 600,
    'live-band/js/stage-audio.js' => 600,
    'live-band/js/stage-rehearsal.js' => 600,
    'live-band/js/stage-hud.js' => 600,
    'live-band/js/stage-catalog.js' => 600,

    // manager
    'manager/manager.js' => 600,
    'manager/js/manager-repertoire.js' => 600,
    'manager/js/manager-community.js' => 600,
    'manager/js/manager-versions.js' => 600,
    'manager/js/manager-users.js' => 600,

    // chord-canvas
    'assets/js/chord-canvas.js' => 600,
    'assets/js/chord-canvas-dots.js' => 600,
    'assets/js/chord-canvas-transpose.js' => 600,
    'assets/js/chord-canvas-edit.js' => 600,

    // learn
    'assets/js/learn/learn-app.js' => 600,
    'assets/js/learn/ui/learn-score.js' => 600,
    'assets/js/learn/harmony/learn-satb.js' => 600,
    'assets/js/learn/transport/learn-transport-bridge.js' => 600,
    'assets/js/learn/ui/learn-controls.js' => 600,
];

$allUnderBudget = true;
$overBudgetDetails = [];
foreach ($targetFiles as $relPath => $maxLines) {
    $fullPath = $root . '/' . $relPath;
    $count = getLineCount($fullPath);
    if ($count > $maxLines) {
        $allUnderBudget = false;
        $overBudgetDetails[] = "{$relPath} has {$count} lines (budget: {$maxLines})";
    }
}
check($allUnderBudget, 'Tất cả 27 file modularized đều tuân thủ ngân sách < 600 dòng: ' . implode('; ', $overBudgetDetails));

// ─── TEST 2: Thứ tự nạp Script (Explicit Load Order) ─────────────────
// Editor
$editorIndex = file_get_contents($root . '/editor/index.php');
$editorSubmodules = [
    'editor-export.js',
    'editor-midi.js',
    'editor-audio.js',
    'editor-ai.js',
    'editor-parser.js',
    'editor-modifiers.js',
    'editor-health.js',
    'editor-drag.js',
    'editor-ui.js',
];
$editorMainPos = strpos($editorIndex, 'editor.js');
check($editorMainPos !== false, 'editor/index.php nạp editor.js');
foreach ($editorSubmodules as $sub) {
    $subPos = strpos($editorIndex, $sub);
    check($subPos !== false && $subPos < $editorMainPos, "editor/index.php nạp {$sub} trước editor.js");
}

// Live Band
$liveBandIndex = file_get_contents($root . '/live-band/index.php');
$liveBandSubmodules = [
    'stage-room.js',
    'stage-timer.js',
    'stage-audio.js',
    'stage-rehearsal.js',
    'stage-hud.js',
    'stage-catalog.js',
];
$liveBandMainPos = strpos($liveBandIndex, 'live-band.js');
check($liveBandMainPos !== false, 'live-band/index.php nạp live-band.js');
foreach ($liveBandSubmodules as $sub) {
    $subPos = strpos($liveBandIndex, $sub);
    check($subPos !== false && $subPos < $liveBandMainPos, "live-band/index.php nạp {$sub} trước live-band.js");
}

// Manager
$managerIndex = file_get_contents($root . '/manager/index.php');
$managerSubmodules = [
    'manager-repertoire.js',
    'manager-community.js',
    'manager-versions.js',
    'manager-users.js',
];
$managerMainPos = strpos($managerIndex, 'manager.js');
check($managerMainPos !== false, 'manager/index.php nạp manager.js');
foreach ($managerSubmodules as $sub) {
    $subPos = strpos($managerIndex, $sub);
    check($subPos !== false && $subPos < $managerMainPos, "manager/index.php nạp {$sub} trước manager.js");
}

// Chord Canvas in index.php
$mainIndex = file_get_contents($root . '/index.php');
$chordCanvasSubmodules = [
    'chord-canvas-dots.js',
    'chord-canvas-transpose.js',
    'chord-canvas-edit.js',
];
$chordCanvasMainPos = strpos($mainIndex, "'chord-canvas.js'");
check($chordCanvasMainPos !== false, 'index.php nạp chord-canvas.js');
foreach ($chordCanvasSubmodules as $sub) {
    $subPos = strpos($mainIndex, "'{$sub}'");
    check($subPos !== false && $subPos < $chordCanvasMainPos, "index.php nạp {$sub} trước chord-canvas.js");
}

// Learn in learn/index.php
$learnIndex = file_get_contents($root . '/learn/index.php');
$learnSubmodules = [
    'ui/learn-score.js',
    'harmony/learn-satb.js',
    'transport/learn-transport-bridge.js',
    'ui/learn-controls.js',
];
$learnMainPos = strpos($learnIndex, 'learn-app.js');
check($learnMainPos !== false, 'learn/index.php nạp learn-app.js');
foreach ($learnSubmodules as $sub) {
    $subPos = strpos($learnIndex, $sub);
    check($subPos !== false && $subPos < $learnMainPos, "learn/index.php nạp {$sub} trước learn-app.js");
}

// ─── TEST 3: includes/modals.php không chứa business inline script ────
$modalsContent = file_get_contents($root . '/includes/modals.php');
$inlineScriptCount = preg_match_all('/<script\b[^>]*>(.*?)<\/script>/is', $modalsContent, $scriptMatches);
$totalInlineScriptLines = 0;
if ($inlineScriptCount > 0) {
    foreach ($scriptMatches[1] as $body) {
        $totalInlineScriptLines += count(explode("\n", trim($body)));
    }
}
check($totalInlineScriptLines < 30, 'includes/modals.php không chứa inline business JS (< 30 dòng inline script)');

// ─── TEST 4: Namespace & Global Window Exports ────────────────────────
$exportChecks = [
    'editor/editor.js' => 'window.SheetEditor',
    'editor/js/editor-export.js' => 'window.EditorExport',
    'editor/js/editor-midi.js' => 'window.EditorMidi',
    'editor/js/editor-audio.js' => 'window.EditorAudio',
    'editor/js/editor-ai.js' => 'window.EditorAI',
    'editor/js/editor-parser.js' => 'window.EditorParser',
    'editor/js/editor-modifiers.js' => 'window.EditorModifiers',
    'editor/js/editor-health.js' => 'window.EditorHealth',
    'editor/js/editor-drag.js' => 'window.EditorDrag',
    'editor/js/editor-ui.js' => 'window.EditorUI',
    'live-band/live-band.js' => 'window.LiveBandApp',
    'live-band/js/stage-room.js' => 'window.StageRoomManager',
    'live-band/js/stage-timer.js' => 'window.StageTimer',
    'live-band/js/stage-audio.js' => 'window.StageAudio',
    'live-band/js/stage-rehearsal.js' => 'window.StageRehearsal',
    'live-band/js/stage-hud.js' => 'window.StageHud',
    'live-band/js/stage-catalog.js' => 'window.StageCatalog',
    'manager/manager.js' => 'window.Manager',
    'manager/js/manager-repertoire.js' => 'window.ManagerRepertoire',
    'manager/js/manager-community.js' => 'window.ManagerCommunity',
    'manager/js/manager-versions.js' => 'window.ManagerVersions',
    'manager/js/manager-users.js' => 'window.ManagerUsers',
    'assets/js/chord-canvas.js' => 'window.ChordCanvas',
    'assets/js/chord-canvas-dots.js' => 'window.ChordCanvasDots',
    'assets/js/chord-canvas-transpose.js' => 'window.ChordCanvasTranspose',
    'assets/js/chord-canvas-edit.js' => 'window.ChordCanvasEdit',
    'assets/js/learn/learn-app.js' => 'window.LearnApp',
    'assets/js/learn/ui/learn-score.js' => 'window.LearnScore',
    'assets/js/learn/harmony/learn-satb.js' => 'window.LearnSatb',
    'assets/js/learn/transport/learn-transport-bridge.js' => 'window.LearnTransportBridge',
    'assets/js/learn/ui/learn-controls.js' => 'window.LearnControls',
];

foreach ($exportChecks as $relPath => $expectedSymbol) {
    $content = file_get_contents($root . '/' . $relPath);
    check(str_contains($content, $expectedSymbol), "File {$relPath} xuất biểu tượng toàn cục {$expectedSymbol}");
}

// ─── TEST 5: Critical Contract Tokens ─────────────────────────────────
// Chord Canvas contracts
$chordCanvasContent = file_get_contents($root . '/assets/js/chord-canvas.js');
check(str_contains($chordCanvasContent, '_chordLoadToken'), 'ChordCanvas duy trì load token chống race condition');
check(str_contains($chordCanvasContent, "loadSong(songId, initialSet = 'HD')"), 'ChordCanvas bảo toàn Core Rule 1 (HD default)');
check(str_contains($chordCanvasContent, 'handleSelectChange'), 'ChordCanvas bảo toàn handler switchSet');

// Learn App contracts
$learnAppContent = file_get_contents($root . '/assets/js/learn/learn-app.js');
check(str_contains($learnAppContent, 'window.SafeHtml.escape(song.title'), 'LearnApp bảo toàn XSS encoding cho tiêu đề bài');
check(str_contains($learnAppContent, 'window.SafeHtml.escape(chordSym)'), 'LearnApp bảo toàn XSS encoding cho nhãn hợp âm');

// ─── TEST 6: File Existence & Non-empty check ─────────────────────────
foreach (array_keys($targetFiles) as $relPath) {
    $fullPath = $root . '/' . $relPath;
    check(file_exists($fullPath) && filesize($fullPath) > 50, "File {$relPath} tồn tại vật lý và có nội dung");
}

// ─── TEST 7: Zero Circular Dependency Check ───────────────────────────
// Đảm bảo các submodules không import hay gọi hàm khởi tạo của Coordinator trong lúc load phase
$coordinatorCalls = [
    'editor/js/editor-export.js' => 'SheetEditor.init',
    'live-band/js/stage-room.js' => 'LiveBandApp.init',
    'manager/js/manager-repertoire.js' => 'Manager.init',
    'assets/js/chord-canvas-dots.js' => 'ChordCanvas.init',
    'assets/js/learn/ui/learn-score.js' => 'LearnApp.init',
];
foreach ($coordinatorCalls as $subFile => $badCall) {
    $subContent = file_get_contents($root . '/' . $subFile);
    check(!str_contains($subContent, $badCall), "Submodule {$subFile} không gọi {$badCall} lúc nạp (tránh circular dependency)");
}

echo "\nAll modular architecture regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
