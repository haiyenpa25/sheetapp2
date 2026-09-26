<?php
/**
 * tests/library_l011_key_service_regression.php
 * Regression test for Ticket L0-11:
 * Tên tông thống nhất: một hàm duy nhất KeyService.displayKey(fifths, semis)
 * dùng cho badge, thanh thông tin, chế độ xem chữ và HUD; theo quy tắc tông giáng/thăng.
 *
 * Kiểm tra:
 * 1. File assets/js/core/KeyService.js tồn tại và có cú pháp hợp lệ.
 * 2. Node execution test unit:
 *    - G+1 = Ab
 *    - F+1 = Gb
 *    - Eb-1 = D
 *    - fifths 1 + 1 = Ab
 *    - fifths -1 + 1 = Gb
 *    - fifths -3 - 1 = D
 *    - G-1 = F#
 *    - C+0 = C
 *    - Am+1 = Bbm
 *    - Am-1 = G#m
 * 3. File index.php include core/KeyService.js trước các script phụ thuộc.
 * 4. Các file app-ui.js, song-info-bar.js, lyric-extractor.js, TransposePickerModal.js đều tích hợp KeyService.displayKey.
 */

$testCount = 0;
$passCount = 0;

function it(string $name, callable $fn) {
    global $testCount, $passCount;
    $testCount++;
    try {
        $fn();
        echo "  [PASS] {$name}\n";
        $passCount++;
    } catch (\Throwable $e) {
        echo "  [FAIL] {$name}: {$e->getMessage()}\n";
    }
}

echo "Running Ticket L0-11 KeyService Regression Suite...\n";

$projectDir = realpath(__DIR__ . '/..');
$keyServicePath = $projectDir . '/assets/js/core/KeyService.js';
$indexPath = $projectDir . '/index.php';
$appUiPath = $projectDir . '/assets/js/app-ui.js';
$songInfoBarPath = $projectDir . '/assets/js/song-info-bar.js';
$lyricPath = $projectDir . '/assets/js/lyric-extractor.js';
$modalPath = $projectDir . '/assets/js/modals/TransposePickerModal.js';

it('1. KeyService.js exists and is syntactically valid', function() use ($keyServicePath) {
    if (!file_exists($keyServicePath)) {
        throw new Exception("KeyService.js not found at {$keyServicePath}");
    }
    $cmd = 'node --check ' . escapeshellarg($keyServicePath) . ' 2>&1';
    exec($cmd, $out, $code);
    if ($code !== 0) {
        throw new Exception("KeyService.js has JS syntax errors: " . implode("\n", $out));
    }
});

it('2. KeyService.displayKey passes all core enharmonic rules in Node.js', function() use ($keyServicePath) {
    $jsScript = '
    const KeyService = require(' . json_encode($keyServicePath) . ');
    const tests = [
        { in: ["G", 1], expected: "Ab" },
        { in: ["F", 1], expected: "Gb" },
        { in: ["Eb", -1], expected: "D" },
        { in: [1, 1], expected: "Ab" },
        { in: [-1, 1], expected: "Gb" },
        { in: [-3, -1], expected: "D" },
        { in: ["G", -1], expected: "F#" },
        { in: ["C", 0], expected: "C" },
        { in: ["Ab", 1], expected: "A" },
        { in: ["Bb", -1], expected: "A" },
        { in: ["Am", 1], expected: "Bbm" },
        { in: ["Am", -1], expected: "G#m" },
        { in: ["Dm", 1], expected: "Ebm" },
        { in: [0, 0], expected: "C" },
        { in: [1, 0], expected: "G" },
        { in: [-1, 0], expected: "F" },
        { in: [-3, 0], expected: "Eb" }
    ];
    for (const t of tests) {
        const actual = KeyService.displayKey(t.in[0], t.in[1]);
        if (actual !== t.expected) {
            console.error("FAIL: displayKey(" + JSON.stringify(t.in[0]) + ", " + t.in[1] + ") expected " + t.expected + " but got " + actual);
            process.exit(1);
        }
    }
    console.log("ALL_JS_TESTS_OK");
    ';
    $tempJs = sys_get_temp_dir() . '/test_key_service_' . uniqid() . '.js';
    file_put_contents($tempJs, $jsScript);
    exec('node ' . escapeshellarg($tempJs) . ' 2>&1', $out, $code);
    @unlink($tempJs);
    if ($code !== 0 || !in_array('ALL_JS_TESTS_OK', $out)) {
        throw new Exception("Node JS Unit tests failed: " . implode("\n", $out));
    }
});

it('3. index.php includes core/KeyService.js in core infrastructure', function() use ($indexPath) {
    $content = file_get_contents($indexPath);
    if (!str_contains($content, "jsTag('core/KeyService.js'")) {
        throw new Exception("index.php does not include core/KeyService.js");
    }
});

it('4. app-ui.js uses KeyService.displayKey for both toolbar and Stage HUD', function() use ($appUiPath) {
    $content = file_get_contents($appUiPath);
    if (!str_contains($content, 'KeyService.displayKey')) {
        throw new Exception("app-ui.js does not reference KeyService.displayKey");
    }
    if (!str_contains($content, 'gigKeyEl.textContent = displayKey')) {
        throw new Exception("app-ui.js does not update gigKeyEl with unified displayKey");
    }
});

it('5. song-info-bar.js uses KeyService.displayKey in _calcPracticedKey', function() use ($songInfoBarPath) {
    $content = file_get_contents($songInfoBarPath);
    if (!str_contains($content, 'KeyService?.displayKey') && !str_contains($content, 'KeyService.displayKey')) {
        throw new Exception("song-info-bar.js does not reference KeyService.displayKey");
    }
});

it('6. lyric-extractor.js and TransposePickerModal.js integrate KeyService.displayKey', function() use ($lyricPath, $modalPath) {
    $lyricContent = file_get_contents($lyricPath);
    $modalContent = file_get_contents($modalPath);
    if (!str_contains($lyricContent, 'KeyService?.displayKey')) {
        throw new Exception("lyric-extractor.js does not reference KeyService.displayKey");
    }
    if (!str_contains($modalContent, 'KeyService.displayKey')) {
        throw new Exception("TransposePickerModal.js does not reference KeyService.displayKey");
    }
});

echo "Summary: {$passCount}/{$testCount} tests passed.\n";
echo "\nSUITE_COMPLETE total={$testCount}\n";
if ($passCount !== $testCount) {
    exit(1);
}
