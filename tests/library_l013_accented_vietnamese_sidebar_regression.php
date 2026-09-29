<?php
/**
 * tests/library_l013_accented_vietnamese_sidebar_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-13 (ROADMAP 4):
 *  1. Tiếng Việt có dấu ở toàn bộ sidebar:
 *     - Thay các chuỗi không dấu ("Kho Nhac", "Tim bai hat…", "Tao Setlist Moi"…).
 *     - Thay "Tone:" -> "Tông:".
 *  2. Grep không còn chuỗi tiếng Việt không dấu trong UI string sidebar.
 *  3. Ngân sách file < 600 dòng.
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
echo "   Ticket L0-13: Accented Vietnamese Sidebar Regression\n";
echo "========================================================\n\n";

$sidebarContent = file_get_contents(__DIR__ . '/../includes/sidebar.php');

$unaccentedForbidden = [
    'Kho Nhac',
    'Tim bai hat',
    'Bai hat yeu thich',
    'Tim theo Loi',
    'Ban Quan Tri',
    'Tao Setlist Moi',
    'Nhay nhanh',
    'Chua co bai hat nao',
    'Nhan "Them Bai Hat"',
    'Chua co Setlist nao',
    'Chi Quan tri moi co the tao',
    'title="Quay lai"',
    '>Phat<',
    'Go tim bai hat',
];

foreach ($unaccentedForbidden as $badStr) {
    check(
        stripos($sidebarContent, $badStr) === false,
        'no_unaccented_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $badStr),
        "Sidebar không còn chứa chuỗi không dấu: '{$badStr}'"
    );
}

$accentedRequired = [
    'Kho Nhạc',
    'Tìm bài hát...',
    'Bài hát yêu thích',
    'Tìm theo lời bài hát',
    'Ban Quản Trị',
    'Tạo Setlist Mới',
    'Nhảy nhanh:',
    'Chưa có bài hát nào',
    'Chưa có Setlist nào',
    'Chỉ Quản trị mới có thể tạo',
    'title="Quay lại"',
    '>Phát<',
    'Gõ tìm bài hát để thêm...',
];

foreach ($accentedRequired as $goodStr) {
    $matched = strpos($sidebarContent, $goodStr) !== false;
    if (!$matched && $goodStr === 'Tạo Setlist Mới') {
        $matched = strpos($sidebarContent, 'Tạo Chương Trình Mới') !== false;
    }
    if (!$matched && $goodStr === 'Chưa có Setlist nào') {
        $matched = strpos($sidebarContent, 'Chưa có chương trình nào') !== false;
    }
    check(
        $matched,
        'has_accented_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $goodStr),
        "Sidebar chứa chuỗi tiếng Việt chuẩn có dấu: '{$goodStr}'"
    );
}

// ── Kiểm tra "Tone:" đã được đổi sang "Tông:" trong UI ──────────
$songInfoBar = file_get_contents(__DIR__ . '/../assets/js/song-info-bar.js');
check(
    strpos($songInfoBar, '🎵 Tone:') === false && strpos($songInfoBar, '🎵 Tông:') !== false,
    'song_info_bar_uses_tong',
    'song-info-bar.js đã đổi "Tone:" thành "Tông:"'
);

// ── Ngân sách file < 600 dòng ────────────────────────────────
$files = [
    'includes/sidebar.php' => __DIR__ . '/../includes/sidebar.php',
    'assets/js/library-ui.js' => __DIR__ . '/../assets/js/library-ui.js',
    'assets/js/song-info-bar.js' => __DIR__ . '/../assets/js/song-info-bar.js',
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
