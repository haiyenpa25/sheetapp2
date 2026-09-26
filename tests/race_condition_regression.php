<?php
declare(strict_types=1);

/**
 * tests/race_condition_regression.php
 * 
 * Kiểm thử tự động Task 1.3: Chống Race Condition khi chuyển bài nhanh
 * - Request cũ bị abort/ignore bằng load token & AbortController
 * - Chỉ bài hát cuối cùng được render vào DOM (không render chồng chéo)
 * - Bộ hợp âm không bị trộn lẫn giữa bài cũ và bài mới (token guard trong ChordCanvas)
 * - OSMDRenderer kiểm soát _renderToken chống re-entrant render
 * - Khắc phục F13: Loại bỏ gọi trùng lặp chordSets.list trong loadSong
 */

$root = dirname(__DIR__);

$songLoaderSrc = file_get_contents($root . '/assets/js/song-loader.js') ?: '';
$chordCanvasSrc = file_get_contents($root . '/assets/js/chord-canvas.js') ?: '';
$osmdRendererSrc = file_get_contents($root . '/assets/js/osmd-renderer.js') ?: '';

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
echo "   SheetApp2 — Race Condition & Load Token Regression   \n";
echo "========================================================\n\n";

// 1. SongLoader Load Token & AbortController
$hasLoadToken = str_contains($songLoaderSrc, "let _currentLoadToken = 0;")
    && str_contains($songLoaderSrc, "const loadToken = ++_currentLoadToken;");
check(
    $hasLoadToken,
    'SongLoader sinh loadToken đơn điệu tăng cho mỗi lần gọi load()',
    "hasLoadToken=" . ($hasLoadToken ? 'true' : 'false')
);

$hasAbortController = str_contains($songLoaderSrc, "_currentAbortController.abort()")
    && str_contains($songLoaderSrc, "new AbortController()")
    && str_contains($songLoaderSrc, "signal: abortSignal");
check(
    $hasAbortController,
    'SongLoader hủy (abort) ngay lập tức request fetch XML của bài trước đó khi bài mới được chọn',
    "hasAbortController=" . ($hasAbortController ? 'true' : 'false')
);

$checksTokenAtStages = str_contains($songLoaderSrc, "if (loadToken !== _currentLoadToken) return;")
    && (substr_count($songLoaderSrc, "if (loadToken !== _currentLoadToken) return;") >= 4);
check(
    $checksTokenAtStages,
    'SongLoader kiểm tra loadToken tại mọi điểm dừng bất đồng bộ (sau fetch, sau read text, trước/sau OSMD render)',
    "count=" . substr_count($songLoaderSrc, "if (loadToken !== _currentLoadToken) return;")
);

$ignoresAbortErrors = str_contains($songLoaderSrc, "if (err.name === 'AbortError' || loadToken !== _currentLoadToken)");
check(
    $ignoresAbortErrors,
    'SongLoader bỏ qua âm thầm lỗi AbortError / request cũ mà không hiển thị thông báo lỗi sai',
    "ignoresAbort=" . ($ignoresAbortErrors ? 'true' : 'false')
);

// 2. ChordCanvas Chord Load Token Guard
$hasChordToken = str_contains($chordCanvasSrc, "let _chordLoadToken = 0;")
    && str_contains($chordCanvasSrc, "const token = ++_chordLoadToken;")
    && str_contains($chordCanvasSrc, "if (token !== _chordLoadToken) return;");
check(
    $hasChordToken,
    'ChordCanvas bảo vệ _customChords bằng _chordLoadToken, ngăn hợp âm bài cũ trộn lẫn vào bài mới',
    "hasChordToken=" . ($hasChordToken ? 'true' : 'false')
);

$noDuplicateRefreshInLoadSong = !str_contains($chordCanvasSrc, "setTimeout(_refreshSetDropdown, 300);");
check(
    $noDuplicateRefreshInLoadSong,
    'ChordCanvas.loadSong không còn gọi dư thừa _refreshSetDropdown, tránh gọi 2 lần chordSets.list (Fix F13)',
    "removedDuplicate=" . ($noDuplicateRefreshInLoadSong ? 'true' : 'false')
);

// 3. OSMDRenderer Render Token Guard
$hasRenderToken = str_contains($osmdRendererSrc, "let _renderToken = 0;")
    && str_contains($osmdRendererSrc, "const token = ++_renderToken;")
    && str_contains($osmdRendererSrc, "if (token !== _renderToken) return osmd;");
check(
    $hasRenderToken,
    'OSMDRenderer kiểm soát _renderToken trong cả load() và reload(), ngăn render chồng chéo lên SVG',
    "hasRenderToken=" . ($hasRenderToken ? 'true' : 'false')
);

echo "\n--------------------------------------------------------\n";
echo "Tổng kết kiểm thử Race Condition:\n";
echo "  - Tổng số kiểm tra: {$total}\n";
echo "  - Số kiểm tra thất bại: " . count($failures) . "\n";
if (count($failures) === 0) {
    echo "  - Trạng thái: ✅ TẤT CẢ KIỂM TRA CHỐNG RACE CONDITION ĐỀU ĐẠT (PASS)\n";
    echo "--------------------------------------------------------\n\n";
    echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
    exit(0);
} else {
    echo "  - Trạng thái: ❌ CÓ LỖI XẢY RA\n";
    echo "--------------------------------------------------------\n\n";
    exit(1);
}
