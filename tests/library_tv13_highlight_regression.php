<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/services/SongSearchHelper.php';
$checks = 0;
$failed = 0;
function checkHighlight(bool $ok, string $label): void {
    global $checks, $failed;
    $checks++;
    if (!$ok) $failed++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
}
$snippet = SongSearchHelper::createLyricSnippet('THẮNG ÂN ĐIỂN & an', 'an', 'an') ?? '';
checkHighlight(str_contains($snippet, 'THẮNG') && !str_contains($snippet, 'THẮ<mark>'), 'No highlight inside a Vietnamese word');
checkHighlight(str_contains($snippet, '<mark>ÂN</mark>'), 'Accent-insensitive whole word is highlighted');
checkHighlight(str_contains($snippet, '&amp;'), 'Ampersand remains an intact HTML entity');
$snippet = SongSearchHelper::createLyricSnippet('AN & amp', 'an amp', 'an amp') ?? '';
checkHighlight(!str_contains($snippet, '&<mark>amp</mark>;'), 'Query does not highlight inside an escaped entity');
checkHighlight(str_contains($snippet, '<mark>amp</mark>'), 'Literal amp word is highlighted');
$snippet = SongSearchHelper::createLyricSnippet('<img src=x onerror=alert(1)> yêu thương thế gian', 'yeu thuong', 'yeu thuong') ?? '';
checkHighlight(!str_contains($snippet, '<img') && str_contains($snippet, '&lt;img'), 'Raw HTML is escaped before insertion');
checkHighlight(str_contains($snippet, '<mark>yêu thương</mark>'), 'Multiword phrase keeps its original spelling');
$snippet = SongSearchHelper::createLyricSnippet('Giê-xu Jêsus Jesus', 'Jesus', 'Jesus') ?? '';
checkHighlight(substr_count($snippet, '<mark>') === 3, 'Jesus aliases receive one non-nested mark each');
$snippet = SongSearchHelper::createLyricSnippet('AN an an', 'an an', 'an an') ?? '';
checkHighlight(!str_contains($snippet, '<mark><mark>'), 'Overlapping phrase and token matches do not nest marks');
$snippet = SongSearchHelper::createLyricSnippet("Hát lên hôm nay.\n[ĐK] Ha-lê-lu-gia vinh danh Chúa.", 'ha le lu gia vinh danh', 'ha le lu gia vinh danh') ?? '';
checkHighlight(str_contains($snippet, '<mark>Ha-lê-lu-gia vinh danh</mark>'), 'Snippet selects the matching chorus rather than a partial word in a verse');
echo "SUITE_COMPLETE total={$checks}\n";
exit($failed ? 1 : 0);
