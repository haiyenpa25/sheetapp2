<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/core/HttpException.php';
require_once dirname(__DIR__) . '/api/services/AnnotationService.php';
$total = 0;
function annotationCheck(bool $ok, string $label, bool $behavioral = true): void {
    global $total;
    ++$total;
    $kind = $behavioral ? 'B' : 'S';
    echo ($ok ? "[PASS:{$kind}] " : "[FAIL:{$kind}] ") . $label . "\n";
    if (!$ok) throw new RuntimeException($label);
}
function annotationReject(callable $call, int $status, string $label): void {
    try { $call(); annotationCheck(false, $label); }
    catch (HttpException $error) { annotationCheck($error->getStatusCode() === $status, $label); }
}
$dir = sys_get_temp_dir() . '/sheetapp-annotations-' . bin2hex(random_bytes(6));
mkdir($dir);
try {
    annotationCheck(method_exists(AnnotationService::class, 'document'), 'versioned document API exists', false);
    $empty = AnnotationService::document('song-a', $dir);
    annotationCheck($empty['annotations'] === [] && is_string($empty['revision']), 'empty document has revision');
    annotationCheck(count(scandir($dir)) === 2, 'reading an unknown song creates no storage files');
    $legacy = [['measureIdx' => 0, 'noteIdx' => 1, 'text' => 'Nhẹ', 'color' => 'blue', 'icon' => '🎹']];
    file_put_contents($dir . '/song-a.json', json_encode($legacy));
    $before = file_get_contents($dir . '/song-a.json');
    $doc = AnnotationService::document('song-a', $dir);
    annotationCheck($doc['annotations'][0]['instrumentId'] === 'general', 'legacy belongs to general');
    annotationCheck($doc['annotations'][0]['text'] === 'Nhẹ' && $doc['annotations'][0]['icon'] === '🎹', 'legacy content preserved');
    annotationCheck(file_get_contents($dir . '/song-a.json') === $before, 'load does not rewrite legacy');
    $notes = $doc['annotations'];
    $notes[] = ['id' => 'drum-one', 'instrumentId' => 'drums', 'measureIdx' => 0, 'noteIdx' => 1, 'staffIdx' => 0, 'beat' => '1/4', 'text' => 'Fill', 'scoreFingerprint' => 'a0123456'];
    $notes[1]['customColor'] = '#E11D48';
    $saved = AnnotationService::saveDocument('song-a', $notes, $doc['revision'], $dir);
    annotationCheck(($saved['annotations'][1]['customColor'] ?? '') === '#e11d48', 'per-note hex color survives save and normalizes case');
    foreach (['red', 'url(evil)', ['#123456'], 123] as $invalidColor) {
        $badColor = $notes; $badColor[1]['customColor'] = $invalidColor;
        annotationReject(fn() => AnnotationService::saveDocument('song-a', $badColor, $saved['revision'], $dir), 422, 'invalid custom note color rejected');
    }
    $colorDoc = AnnotationService::document('song-colors', $dir);
    $plain = $notes; unset($plain[1]['customColor']);
    $colorDoc = AnnotationService::saveDocument('song-colors', $plain, $colorDoc['revision'], $dir);
    annotationCheck(!isset($colorDoc['annotations'][1]['customColor']), 'a default note inherits instrument color without frozen override');
    $plain[1]['customColor'] = '#112233';
    $colorDoc = AnnotationService::saveDocument('song-colors', $plain, $colorDoc['revision'], $dir);
    unset($plain[1]['customColor']);
    $colorDoc = AnnotationService::saveDocument('song-colors', $plain, $colorDoc['revision'], $dir);
    annotationCheck(!isset($colorDoc['annotations'][1]['customColor']), 'reset removes the note color override');
    annotationCheck(count($saved['annotations']) === 2, 'two instruments share an anchor');
    annotationCheck($saved['revision'] !== $doc['revision'], 'save advances revision');
    annotationCheck(AnnotationService::document('song-a', $dir)['annotations'] === $saved['annotations'], 'round trip keeps stable IDs and anchors');
    annotationReject(fn() => AnnotationService::saveDocument('song-a', [], $doc['revision'], $dir), 409, 'stale editor cannot overwrite newer content');
    annotationReject(fn() => AnnotationService::saveDocument('song-a', [], '', $dir), 409, 'unversioned editor cannot overwrite content');
    $bad = $notes; $bad[1]['instrumentId'] = 'unknown';
    annotationReject(fn() => AnnotationService::saveDocument('song-a', $bad, $saved['revision'], $dir), 422, 'unknown instrument rejected');
    $bad = $notes; $bad[1]['measureIdx'] = -1;
    annotationReject(fn() => AnnotationService::saveDocument('song-a', $bad, $saved['revision'], $dir), 422, 'invalid anchor rejected');
    $bad = $notes; $bad[1]['text'] = str_repeat('x', 501);
    annotationReject(fn() => AnnotationService::saveDocument('song-a', $bad, $saved['revision'], $dir), 422, 'overlong text rejected');
    $bad = $notes; $bad[1]['id'] = $notes[0]['id'];
    annotationReject(fn() => AnnotationService::saveDocument('song-a', $bad, $saved['revision'], $dir), 422, 'duplicate ID rejected');
    annotationCheck(AnnotationService::document('song-a', $dir)['revision'] === $saved['revision'], 'rejected writes leave document intact');
    annotationReject(fn() => AnnotationService::document('../escape', $dir), 422, 'ambiguous path rejected');
    $registry = AnnotationService::instruments($dir);
    annotationCheck(count($registry['instruments']) === 6, 'six built in instrument layers');
    annotationCheck(count(array_unique(array_column($registry['instruments'], 'color'))) === 6, 'built in instruments have distinct colors');
    $registry = AnnotationService::saveInstrument('drums', 'Trống', $registry['registryRevision'], $dir, '#c2410c');
    annotationCheck(AnnotationService::instruments($dir)['instruments'][4]['color'] === '#c2410c', 'instrument color persists across reload');
    $colorRevision = $registry['registryRevision'];
    annotationReject(fn() => AnnotationService::saveInstrument('drums', 'Trống', $colorRevision, $dir, 'url(evil)'), 422, 'invalid color rejected');
    annotationReject(fn() => AnnotationService::saveInstrument('drums', 'Trống', 'stale', $dir, '#123456'), 409, 'color update checks registry revision');
    $registry = AnnotationService::saveInstrument('', 'Violin', $registry['registryRevision'], $dir);
    $violin = end($registry['instruments']);
    annotationCheck($violin['name'] === 'Violin' && $violin['id'] !== '', 'admin can add custom instrument');
    $notes[1]['instrumentId'] = $violin['id'];
    $custom = AnnotationService::saveDocument('song-a', $notes, $saved['revision'], $dir);
    annotationCheck($custom['annotations'][1]['instrumentId'] === $violin['id'], 'custom instrument usable on sheet');
    annotationReject(fn() => AnnotationService::saveInstrument('', 'VIOLIN', $registry['registryRevision'], $dir), 422, 'duplicate instrument name rejected');
    annotationReject(fn() => AnnotationService::saveInstrument('', 'Cello', 'stale', $dir), 409, 'registry has conflict protection');
    file_put_contents($dir . '/broken.json', '{broken');
    annotationReject(fn() => AnnotationService::document('broken', $dir), 500, 'corrupt data is not treated as empty');
    annotationCheck(file_get_contents($dir . '/broken.json') === '{broken', 'corrupt source preserved');
    echo "SUITE_COMPLETE total={$total}\n";
} finally {
    foreach (scandir($dir) as $file) {
        if ($file !== '.' && $file !== '..') unlink($dir . '/' . $file);
    }
    rmdir($dir);
}
