<?php
/**
 * tests/app_shell_navigation_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.1 — App Shell và điều hướng bốn trụ cột:
 * 1. Khung App Shell (app_nav.php, app-shell.css, AppShell.js) tồn tại đầy đủ.
 * 2. 4 Trụ cột cốt lõi được định nghĩa đúng: Thư Viện (/), Biểu Diễn (/live-band/), Tập Luyện (/learn/), Quản Lý (/manager/).
 * 3. Cả 4 trang chính/sub-app đều nhúng App Shell dùng chung.
 * 4. Hỗ trợ bảo toàn ngữ cảnh bài hát (?song=) khi chuyển đổi giữa các trụ cột.
 * 5. Tích hợp Trợ giúp theo ngữ cảnh (Context Help) dẫn đúng phân mục trong /huong-dan/.
 * 6. Auth menu hiển thị an toàn, escape dữ liệu người dùng chống XSS.
 */

declare(strict_types=1);

function check(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== APP SHELL & 4-PILLAR NAVIGATION REGRESSION (TASK 2.1) ===\n";

$root = dirname(__DIR__);

// --- TEST 1: Kiểm tra các file thành phần của App Shell ---
$navPhp = $root . '/includes/app_nav.php';
$shellCss = $root . '/assets/css/app-shell.css';
$shellJs = $root . '/assets/js/core/AppShell.js';

check(file_exists($navPhp), 'File includes/app_nav.php tồn tại');
check(file_exists($shellCss), 'File assets/css/app-shell.css tồn tại');
check(file_exists($shellJs), 'File assets/js/core/AppShell.js tồn tại');

$navContent = file_get_contents($navPhp);
$cssContent = file_get_contents($shellCss);
$jsContent  = file_get_contents($shellJs);

// --- TEST 2: Kiểm tra 4 trụ cột được định nghĩa đầy đủ ---
check(str_contains($navContent, 'pillar-library') || str_contains($navContent, 'data-pillar="library"'), 'Trụ cột 1: Thư Viện & Đọc Sheet được định nghĩa');
check(str_contains($navContent, 'pillar-live') || str_contains($navContent, 'data-pillar="live"'), 'Trụ cột 2: Biểu Diễn (Live) được định nghĩa');
check(str_contains($navContent, 'pillar-learn') || str_contains($navContent, 'data-pillar="learn"'), 'Trụ cột 3: Tập Luyện (Learn) được định nghĩa');
check(str_contains($navContent, 'pillar-manager') || str_contains($navContent, 'data-pillar="manager"'), 'Trụ cột 4: Quản Lý (Studio/Manager) được định nghĩa');

// --- TEST 3: Kiểm tra các trang chính nhúng App Shell ---
$indexPhp    = file_get_contents($root . '/index.php');
$liveBandPhp = file_get_contents($root . '/live-band/index.php');
$learnPhp    = file_get_contents($root . '/learn/index.php');
$managerPhp  = file_get_contents($root . '/manager/index.php');
$editorPhp   = file_get_contents($root . '/editor/index.php');
$guidePhp    = file_get_contents($root . '/huong-dan/index.php');

check(str_contains($indexPhp, 'app_nav.php'), 'index.php nhúng includes/app_nav.php');
check(str_contains($liveBandPhp, 'app_nav.php'), 'live-band/index.php nhúng includes/app_nav.php');
check(str_contains($learnPhp, 'app_nav.php'), 'learn/index.php nhúng includes/app_nav.php');
check(str_contains($managerPhp, 'app_nav.php'), 'manager/index.php nhúng includes/app_nav.php');
check(str_contains($editorPhp, 'app_nav.php'), 'editor/index.php nhúng includes/app_nav.php');
check(str_contains($guidePhp, 'app_nav.php'), 'huong-dan/index.php nhúng includes/app_nav.php');
check(str_contains($editorPhp, 'AppShell.js') && str_contains($editorPhp, 'ModalManager.js'), 'editor/index.php nhúng AppShell.js và ModalManager.js');
check(str_contains($guidePhp, 'AppShell.js') && str_contains($guidePhp, 'ModalManager.js'), 'huong-dan/index.php nhúng AppShell.js và ModalManager.js');

// --- TEST 4: Kiểm tra logic JS bảo toàn bài hát đang mở (?song=) ---
check(str_contains($jsContent, 'updateSongContext') || str_contains($jsContent, 'setSongContext') || str_contains($jsContent, 'syncSongParam'), 'AppShell.js có hàm đồng bộ ngữ cảnh bài hát');
check(str_contains($jsContent, 'getActivePillar'), 'AppShell.js có hàm nhận diện trụ cột active');

// --- TEST 5: Kiểm tra liên kết Trợ giúp theo ngữ cảnh (Context Help) ---
check(str_contains($navContent, 'huong-dan') || str_contains($jsContent, 'huong-dan'), 'App Shell có liên kết/hỗ trợ Context Help tới cẩm nang /huong-dan/');

// --- TEST 6: Kiểm tra an toàn Auth menu (XSS protection) ---
check(str_contains($navContent, 'htmlspecialchars') || str_contains($jsContent, 'SafeHtml'), 'Auth widget trong App Shell được escape an toàn');

echo "\n>>> ALL 6/6 APP SHELL NAVIGATION REGRESSION CHECKS PASSED!\n";
