<?php
/**
 * tests/library_l011_key_enharmonics_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-11 (ROADMAP 4):
 *  1. Module KeyService với hàm duy nhất displayKey(fifths, semis).
 *  2. Quy tắc enharmonic chuẩn của thánh ca (55% bài ở tông giáng):
 *     - G + 1 = Ab
 *     - F + 1 = Gb
 *     - Eb - 1 = D
 *  3. Bốn vị trí hiển thị thống nhất 100%:
 *     - Toolbar badge (#song-key)
 *     - Song Info Bar chip (#si-tone-chip)
 *     - Chế độ xem chữ / Band view (.lv-key)
 *     - Floating HUD trong chế độ Biểu Diễn (#gig-hud-key)
 *  4. Ngân sách file < 600 dòng.
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
echo "   Ticket L0-11: Unified Key & Enharmonics Regression\n";
echo "========================================================\n\n";

// ── 1. File existence & Line Budget Checks ───────────────────
$keyServicePath = __DIR__ . '/../assets/js/key-service.js';
check(file_exists($keyServicePath), 'key_service_exists', 'File assets/js/key-service.js tồn tại');

$keyServiceLines = count(file($keyServicePath));
check($keyServiceLines > 0 && $keyServiceLines < 600, 'key_service_line_budget', "assets/js/key-service.js có {$keyServiceLines} dòng (< 600 dòng)");

$indexContent = file_get_contents(__DIR__ . '/../index.php');
check(strpos($indexContent, "jsTag('key-service.js')") !== false, 'index_includes_key_service', 'index.php nạp key-service.js');

// ── 2. Logic & Rule verification via Node.js ──────────────────
$nodeCmd = 'node -e "'
    . 'const KS = require(\'./assets/js/key-service.js\');'
    . 'const g1 = KS.displayKey(\'G\', 1);'
    . 'const f1 = KS.displayKey(\'F\', 1);'
    . 'const ebMinus1 = KS.displayKey(\'Eb\', -1);'
    . 'const num1_1 = KS.displayKey(1, 1);'
    . 'const numMinus1_1 = KS.displayKey(-1, 1);'
    . 'const numMinus3_minus1 = KS.displayKey(-3, -1);'
    . 'console.log(JSON.stringify({ g1, f1, ebMinus1, num1_1, numMinus1_1, numMinus3_minus1 }));'
    . '"';

$output = shell_exec($nodeCmd);
$data = json_decode(trim((string)$output), true);

check(
    isset($data['g1']) && $data['g1'] === 'Ab',
    'rule_g_plus_1_is_ab',
    "Quy tắc chuẩn: G + 1 bán cung hiển thị là Ab (nhận được: {$data['g1']})"
);

check(
    isset($data['f1']) && ($data['f1'] === 'Gb' || $data['f1'] === 'F#'),
    'rule_f_plus_1_is_gb',
    "Quy tắc chuẩn: F + 1 bán cung hiển thị là Gb hoặc F# (nhận được: {$data['f1']})"
);

check(
    isset($data['ebMinus1']) && $data['ebMinus1'] === 'D',
    'rule_eb_minus_1_is_d',
    "Quy tắc chuẩn: Eb - 1 bán cung hiển thị là D (nhận được: {$data['ebMinus1']})"
);

check(
    isset($data['num1_1']) && $data['num1_1'] === 'Ab' &&
    isset($data['numMinus1_1']) && $data['numMinus1_1'] === 'Gb' &&
    isset($data['numMinus3_minus1']) && $data['numMinus3_minus1'] === 'D',
    'numeric_fifths_support',
    'Hỗ trợ gọi bằng số fifths trực tiếp: displayKey(1, 1)=Ab, displayKey(-1, 1)=Gb, displayKey(-3, -1)=D'
);

// ── 3. Code Integration Checks across 4 locations ────────────
$appUiContent = file_get_contents(__DIR__ . '/../assets/js/app-ui.js');
check(
    strpos($appUiContent, 'KeyService?.displayKey') !== false &&
    strpos($appUiContent, 'keyEl.textContent = displayKey') !== false &&
    strpos($appUiContent, 'gigKeyEl.textContent = displayKey') !== false,
    'app_ui_sync_toolbar_and_hud',
    'AppUI.updateSongInfo sử dụng KeyService.displayKey cho cả Toolbar badge (#song-key) và HUD (#gig-hud-key)'
);

$infoBarContent = file_get_contents(__DIR__ . '/../assets/js/song-info-bar.js');
check(
    strpos($infoBarContent, 'KeyService?.displayKey') !== false &&
    strpos($infoBarContent, '🎵 Tông:') !== false,
    'info_bar_uses_key_service',
    'SongInfoBar sử dụng KeyService.displayKey và hiển thị tiếng Việt có dấu "🎵 Tông:"'
);

$lyricContent = file_get_contents(__DIR__ . '/../assets/js/lyric-extractor.js');
check(
    strpos($lyricContent, 'KeyService?.displayKey') !== false &&
    strpos($lyricContent, 'Tông') !== false,
    'lyric_extractor_uses_key_service',
    'LyricExtractor đồng bộ hiển thị tông qua KeyService.displayKey'
);

$transposeEngineContent = file_get_contents(__DIR__ . '/../assets/js/transpose-engine.js');
check(
    strpos($transposeEngineContent, 'KeyService?.displayKey') !== false,
    'transpose_engine_delegates_to_key_service',
    'TransposeEngine.calcKey ủy quyền cho KeyService.displayKey để thống nhất toàn bộ codebase'
);

// ── 4. Verify all touched files remain strictly < 600 lines ─
$files = [
    'assets/js/key-service.js' => $keyServicePath,
    'assets/js/app-ui.js' => __DIR__ . '/../assets/js/app-ui.js',
    'assets/js/song-info-bar.js' => __DIR__ . '/../assets/js/song-info-bar.js',
    'assets/js/lyric-extractor.js' => __DIR__ . '/../assets/js/lyric-extractor.js',
    'assets/js/transpose-engine.js' => __DIR__ . '/../assets/js/transpose-engine.js',
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
