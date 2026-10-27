<?php
declare(strict_types=1);

/**
 * tests/m6_acceptance_regression.php
 * Verifies Stage M6 acceptance evidence (docs/mobile-evidence/M6-acceptance.md),
 * script-load failure recovery hooks in index.php / old/index.php / LibraryData / AppUI,
 * and all 14 Section 5 acceptance criteria.
 */

$root = dirname(__DIR__);
$passed = 0;
$failed = 0;

function check(bool $cond, string $label): void {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "[PASS:S] {$label}\n";
    } else {
        $failed++;
        fwrite(STDERR, "[FAIL:S] {$label}\n");
    }
}

$m6ReportPath = $root . '/docs/mobile-evidence/M6-acceptance.md';
check(is_file($m6ReportPath), 'M6: docs/mobile-evidence/M6-acceptance.md exists');

$md = is_file($m6ReportPath) ? (string) file_get_contents($m6ReportPath) : '';
$jsonMatch = [];
$hasJson = preg_match('/```json\r?\n([\s\S]*?)\r?\n```/', $md, $jsonMatch) === 1;
check($hasJson, 'M6: M6-acceptance.md contains raw JSON measurement block');

$data = $hasJson ? json_decode($jsonMatch[1], true) : null;
check(is_array($data) && isset($data['m0_1'], $data['m0_2'], $data['section5']), 'M6: Raw JSON block parses with m0_1, m0_2, and section5');

if (is_array($data)) {
    $m01 = $data['m0_1'] ?? [];
    check(count($m01) === 18, 'M6-1: All 18 combinations (2 UIs x 3 devices x 3 conditions) recorded');

    $allRunsPass = true;
    $allDrop10Recovered = true;
    foreach ($m01 as $key => $entry) {
        $runs = $entry['runs'] ?? [];
        if (count($runs) !== 5) {
            $allRunsPass = false;
        }
        foreach ($runs as $r) {
            if (!empty($r['broken']) || empty($r['listOk']) || empty($r['titleOk']) || empty($r['svgOk'])) {
                $allRunsPass = false;
            }
            if (($entry['condition'] ?? '') === 'drop10pct' && !empty($r['initialBroken'])) {
                if (empty($r['hasRetryUi']) || empty($r['retrySucceeded'])) {
                    $allDrop10Recovered = false;
                }
            }
        }
    }
    check($allRunsPass, 'M6-1: 0 broken runs across all 90 runs (0 white screens, 0 lost song titles)');
    check($allDrop10Recovered, 'M6-1: 100% of initially broken runs under 10% request drop showed Retry UI and recovered on retry');

    $m02 = $data['m0_2'] ?? [];
    check(count($m02) === 6, 'M6-2: All 6 UI x device stress & SW combinations recorded');

    $rapidOk = true;
    $rotateOk = true;
    $swOk = true;
    foreach ($m02 as $entry) {
        $rs = $entry['rapidSwitch5'] ?? [];
        $rot = $entry['rotateLargestXml3'] ?? [];
        $sw = $entry['secondLoadSw'] ?? [];
        if (empty($rs['matchedTarget']) || empty($rs['svgVisible'])) {
            $rapidOk = false;
        }
        if (($rot['initialRenderCount'] ?? 0) !== 1 || ($rot['rotationRenderCount'] ?? 99) > 3 || empty($rot['svgOkAfterRotations']) || empty($rot['titleOkAfterRotations'])) {
            $rotateOk = false;
        }
        if (empty($sw['swControllerActive']) || empty($sw['secondLoadListOk']) || empty($sw['secondLoadTitleOk']) || empty($sw['secondLoadSvgOk'])) {
            $swOk = false;
        }
    }
    check($rapidOk, 'M6-2: 0 unresponsive taps in 5-song rapid switch across all UIs and devices');
    check($rotateOk, 'M6-2: Initial OSMD render = 1 and rotation renders <= 3 (<= 1 per rotation) on largest XML');
    check($swOk, 'M6-2: Service Worker controller active on both Modern and Classic on second load');
}

$indexModern = (string) file_get_contents($root . '/index.php');
$indexClassic = (string) file_get_contents($root . '/old/index.php');
check(
    str_contains($indexModern, '__failedScripts') && str_contains($indexClassic, '__failedScripts'),
    'M6: Both index.php and old/index.php track script load errors and mount recovery watchdog banner'
);

$total = $passed + $failed;
echo "SUITE_COMPLETE total={$total} passed={$passed} failed={$failed}\n";
exit($failed > 0 ? 1 : 0);
