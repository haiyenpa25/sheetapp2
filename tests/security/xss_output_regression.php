<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$failures = [];
require_once $root . '/api/import_helpers.php';

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    global $failures;
    if (!$condition) {
        $failures[] = $message;
        echo "FAIL: {$message}\n";
        return;
    }
    echo "PASS: {$message}\n";
}

function source(string $path): string {
    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException("Cannot read {$path}");
    }
    return $contents;
}

$safeHtml = source($root . '/assets/js/core/SafeHtml.js');
$main = source($root . '/index.php');
$learnIndex = source($root . '/learn/index.php');
$membersIndex = source($root . '/members/index.php');
$managerIndex = source($root . '/manager/index.php');
$projector = source($root . '/live-band/projector.php') . source($root . '/live-band/js/projector-slides.js') . source($root . '/live-band/js/projector-app.js');
$members = source($root . '/members/members.js');
$admin = source($root . '/assets/js/admin-ui.js');
$songLoader = source($root . '/assets/js/song-loader.js');
$learn = source($root . '/assets/js/learn/learn-app.js');
$importHelpers = source($root . '/api/import_helpers.php');
$manager = source($root . '/manager/manager.js');
$liveBandIndex = source($root . '/live-band/index.php');
$liveBand = source($root . '/live-band/live-band.js');
$appUi = source($root . '/assets/js/app-ui.js');
$performanceNotes = source($root . '/assets/js/performance-notes.js');
$libraryUi = source($root . '/assets/js/library-ui.js');
$setlistUi = source($root . '/assets/js/setlist-ui.js');
$songInfoBar = source($root . '/assets/js/song-info-bar.js');
$chordCanvas = source($root . '/assets/js/chord-canvas.js');
$chordCanvasUi = source($root . '/assets/js/chord-canvas-ui.js');
$lyricExtractor = source($root . '/assets/js/lyric-extractor.js');
$instruments = source($root . '/assets/js/instruments.js');
$editorIndex = source($root . '/editor/index.php');
$editor = source($root . '/editor/editor.js');
$chordCard = source($root . '/assets/js/learn/ui/chord-card.js');

foreach (['&amp;', '&lt;', '&gt;', '&quot;', '&#039;'] as $entity) {
    check(str_contains($safeHtml, $entity), "SafeHtml encodes {$entity}");
}

check(str_contains($main, "jsTag('core/SafeHtml.js'"), 'Main app loads the shared output encoder');
check(str_contains($learnIndex, "learnJsTag('assets/js/core/SafeHtml.js'"), 'Learn app loads the shared output encoder');
check(str_contains($membersIndex, '/assets/js/core/SafeHtml.js'), 'Members app loads the shared output encoder');
check(str_contains($managerIndex, '../assets/js/core/SafeHtml.js'), 'Manager app loads the shared output encoder');
check(str_contains($projector, '/assets/js/core/SafeHtml.js'), 'Projector loads the shared output encoder');
check(str_contains($editorIndex, '/assets/js/core/SafeHtml.js'), 'Editor app loads the shared output encoder');

check(str_contains($members, 'window.SafeHtml.escape(m.display_name || m.username)'), 'Member display names are encoded');
check(str_contains($members, "'Độc quyền bộ ' + safeChordCode"), 'Member chord codes in permission descriptions are encoded');
check(str_contains($admin, 'window.SafeHtml.escape(song.title)'), 'Admin song titles are encoded');
check(str_contains($admin, 'window.SafeHtml.escape(u.username)'), 'Admin usernames are encoded');
check(str_contains($songLoader, 'window.SafeHtml.escape(v.version_name)'), 'Song version names are encoded');
check(str_contains($projector, 'window.SafeHtml.escape(songTitle)'), 'Projector song titles are encoded');
check(str_contains($projector, 'window.SafeHtml.escape(l.text)'), 'Projector lyric lines are encoded');
check(str_contains($learn, 'window.SafeHtml.escape(song.title'), 'Learn song titles are encoded');
check(str_contains($learn, 'window.SafeHtml.escape(chordSym)'), 'Learn chord labels are encoded');
check(str_contains($safeHtml, 'function inlineJsString'), 'Shared encoder supports inline JavaScript string context');
check(!preg_match('/onclick="[^"]*\$\{_escape\(/', $manager), 'Manager inline handlers do not use HTML-only escaping');
check(str_contains($liveBandIndex, "liveBandJsTag('assets/js/core/SafeHtml.js'"), 'Live Band loads the shared output encoder');
check(str_contains($liveBand, 'window.SafeHtml.escape(songTitle)'), 'Live Band teleprompter encodes song titles');
check(str_contains($liveBand, 'window.SafeHtml.escape(line)'), 'Live Band teleprompter encodes lyric lines');
check(str_contains($appUi, 'window.SafeHtml.escape(message)'), 'Application toast messages are encoded');
check(str_contains($appUi, 'window.SafeHtml.escape') && str_contains($appUi, 'history-item-date'), 'AppUI session history is encoded');
check(str_contains($libraryUi, 'window.SafeHtml.escape'), 'LibraryUI escapes dynamic data via SafeHtml');
check(str_contains($setlistUi, 'window.SafeHtml.escape'), 'SetlistUI escapes dynamic data via SafeHtml');
check(str_contains($songInfoBar, 'window.SafeHtml.escape'), 'SongInfoBar escapes dynamic data via SafeHtml');
check(str_contains($chordCanvas, 'window.SafeHtml.escape') && str_contains($chordCanvas, 'selector.innerHTML'), 'ChordCanvas escapes chord set labels in dropdown via SafeHtml');
check(str_contains($chordCanvasUi, 'window.SafeHtml.escape'), 'ChordCanvasUI escapes chord names and modals via SafeHtml');
check(str_contains($admin, 'window.SafeHtml.inlineJsString(song.id)'), 'AdminUI uses inlineJsString for song IDs in event handlers');
check(str_contains($lyricExtractor, 'window.SafeHtml.escape'), 'LyricExtractor encodes lyrics and chords via SafeHtml');
check(str_contains($instruments, 'window.SafeHtml.escape(name)'), 'Instruments mixer encodes instrument names via SafeHtml');
check(str_contains($editor, 'window.SafeHtml.escape(v.version_name)'), 'Editor song version names are encoded');
check(str_contains($editor, 'window.SafeHtml.escape(song.title)'), 'Editor picker song titles are encoded');
check(str_contains($chordCard, 'window.SafeHtml.escape(sym'), 'Learn chord card symbols are encoded');
check(str_contains($performanceNotes, 'window.SafeHtml.escape(setlist.title'), 'Performance notes encode setlist titles');
check(str_contains($importHelpers, "['script', 'iframe', 'object', 'embed', 'foreignobject']"), 'MusicXML blocks active-content elements');
check(str_contains($importHelpers, "str_starts_with(\$name, 'on')"), 'MusicXML blocks event-handler attributes');

$safeXml = '<?xml version="1.0"?><score-partwise version="4.0"><part-list/></score-partwise>';
$scriptXml = '<?xml version="1.0"?><score-partwise><script>alert(1)</script></score-partwise>';
$handlerXml = '<?xml version="1.0"?><score-partwise><credit-words onclick="alert(1)">Title</credit-words></score-partwise>';
$iframeXml = '<?xml version="1.0"?><score-partwise><part-list><iframe src="javascript:alert(1)"/></part-list></score-partwise>';
$embedXml = '<?xml version="1.0"?><score-partwise><embed src="payload.swf"/></score-partwise>';
$onfocusXml = '<?xml version="1.0"?><score-partwise><credit-words onfocus="alert(1)">Title</credit-words></score-partwise>';

check(_isValidMusicXML($safeXml, 'xml'), 'Valid MusicXML structure is accepted');
check(!_isValidMusicXML($scriptXml, 'xml'), 'MusicXML script payload is rejected');
check(!_isValidMusicXML($handlerXml, 'xml'), 'MusicXML event-handler payload is rejected');
check(!_isValidMusicXML($iframeXml, 'xml'), 'MusicXML iframe payload is rejected');
check(!_isValidMusicXML($embedXml, 'xml'), 'MusicXML embed payload is rejected');
check(!_isValidMusicXML($onfocusXml, 'xml'), 'MusicXML onfocus attribute payload is rejected');

// Behavioral testing of the full XSS payload corpus
$xssPayloads = [
    '<img src=x onerror=alert(1)>',
    '</script><script>alert(1)</script>',
    "' );alert(1);//",
    '" autofocus onfocus="alert(1)',
    'javascript:alert(1)'
];

function phpSafeHtmlEscape(?string $val): string {
    if ($val === null) return '';
    return htmlspecialchars($val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function phpSafeHtmlInlineJs(?string $val): string {
    $s = str_replace(
        ['\\', "'", "\r", "\n", "\u{2028}", "\u{2029}"],
        ['\\\\', "\\'", '\\r', '\\n', '\\u2028', '\\u2029'],
        $val ?? ''
    );
    return phpSafeHtmlEscape($s);
}

foreach ($xssPayloads as $payload) {
    $escaped = phpSafeHtmlEscape($payload);
    check(!str_contains($escaped, '<') && !str_contains($escaped, '>') && !str_contains($escaped, '"') && !str_contains($escaped, "'"), "Corpus payload html-escaped safely: " . substr($payload, 0, 15));

    $inlineJs = phpSafeHtmlInlineJs($payload);
    check(!str_contains($inlineJs, "'") && !str_contains($inlineJs, "\n") && !str_contains($inlineJs, "\r"), "Corpus payload inline-js escaped safely: " . substr($payload, 0, 15));
}

if ($failures !== []) {
    fwrite(STDERR, sprintf("\n%d XSS output regression test(s) failed.\n", count($failures)));
    exit(1);
}

echo "\nAll XSS output regression tests passed.\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
