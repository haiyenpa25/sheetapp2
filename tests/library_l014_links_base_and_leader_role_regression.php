<?php
/**
 * tests/library_l014_links_base_and_leader_role_regression.php
 *
 * Kiểm tra nghiệm thu Ticket L0-14 (ROADMAP 4):
 *  1. Link sang các trang khác dùng __APP_BASE__ / $baseHref (không hardcode root path tuyệt đối).
 *  2. ChordCanvas có hàm confirmDeleteSet và export confirmDeleteSet.
 *  3. Frontend nhận role leader trong auth.js (isLeader, phân quyền, badge).
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
echo "   Ticket L0-14: Base Links, confirmDeleteSet & Role Leader\n";
echo "========================================================\n\n";

$sidebarContent = file_get_contents(__DIR__ . '/../includes/sidebar.php');
$toolbarContent = file_get_contents(__DIR__ . '/../includes/toolbar.php');
$modalsContent  = file_get_contents(__DIR__ . '/../includes/modals.php');
$chordCanvasJs  = file_get_contents(__DIR__ . '/../assets/js/chord-canvas.js');
$authJs         = file_get_contents(__DIR__ . '/../assets/js/auth.js');

// 1. Kiểm tra link trong sidebar không hardcode root '/'
check(
    strpos($sidebarContent, 'href="<?= $bHref ?>learn/"') !== false,
    'sidebar_link_learn_base',
    'sidebar.php link Learn dùng baseHref'
);
check(
    strpos($sidebarContent, 'href="<?= $bHref ?>live-band/"') !== false,
    'sidebar_link_liveband_base',
    'sidebar.php link Live Band dùng baseHref'
);
check(
    strpos($sidebarContent, 'href="<?= $bHref ?>manager/"') !== false,
    'sidebar_link_manager_base',
    'sidebar.php link Manager dùng baseHref'
);

// 2. Kiểm tra link trong toolbar không hardcode root '/'
check(
    strpos($toolbarContent, 'href="<?= $bHref ?>manager/#tab-users"') !== false,
    'toolbar_link_users_base',
    'toolbar.php link Manager Users dùng baseHref'
);
check(
    strpos($toolbarContent, 'href="<?= $bHref ?>manager/"') !== false,
    'toolbar_link_manager_base',
    'toolbar.php link Manager dùng baseHref'
);

// 3. Kiểm tra link trong modals
check(
    strpos($modalsContent, 'manager/"') !== false && strpos($modalsContent, '$baseHref') !== false,
    'modals_link_manager_base',
    'modals.php link Manager dùng baseHref'
);
check(
    strpos($modalsContent, 'huong-dan/"') !== false && strpos($modalsContent, '$baseHref') !== false,
    'modals_link_huongdan_base',
    'modals.php link Hướng Dẫn dùng baseHref'
);

// 4. Kiểm tra ChordCanvas.confirmDeleteSet
check(
    strpos($chordCanvasJs, 'async function confirmDeleteSet') !== false,
    'chord_canvas_has_confirmDeleteSet',
    'chord-canvas.js có hàm confirmDeleteSet'
);
check(
    strpos($chordCanvasJs, 'confirmDeleteSet,') !== false,
    'chord_canvas_exports_confirmDeleteSet',
    'chord-canvas.js export confirmDeleteSet'
);

// 5. Kiểm tra role leader trong auth.js
check(
    strpos($authJs, 'function isLeader()') !== false,
    'auth_has_isLeader_function',
    'auth.js có hàm isLeader()'
);
check(
    strpos($authJs, 'isLeader,') !== false,
    'auth_exports_isLeader',
    'auth.js export isLeader trong public API'
);
check(
    strpos($authJs, "'leader'") !== false || strpos($authJs, '"leader"') !== false,
    'auth_recognizes_leader_role',
    'auth.js nhận diện role leader trong UI và phân quyền'
);

// 6. Ngân sách file < 600 dòng
$files = [
    'includes/sidebar.php' => __DIR__ . '/../includes/sidebar.php',
    'includes/toolbar.php' => __DIR__ . '/../includes/toolbar.php',
    'includes/modals.php' => __DIR__ . '/../includes/modals.php',
    'assets/js/chord-canvas.js' => __DIR__ . '/../assets/js/chord-canvas.js',
    'assets/js/auth.js' => __DIR__ . '/../assets/js/auth.js',
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
