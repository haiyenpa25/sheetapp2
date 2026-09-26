<?php
/**
 * tools/generate_code_map.php
 * Gitnexus Code Map & Dependency Indexer for SheetApp (PHP CLI implementation)
 * Generates and updates CODE_MAP.md automatically
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

$rootDir = dirname(__DIR__);

function scanDirRecursive(string $dir, string $rootDir, array &$fileList = []): void {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        if (str_starts_with($item, '.') || $item === 'node_modules' || $item === 'vendor') continue;

        $fullPath = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($fullPath)) {
            scanDirRecursive($fullPath, $rootDir, $fileList);
        } else {
            $relPath = str_replace('\\', '/', substr($fullPath, strlen($rootDir) + 1));
            $fileList[] = [
                'path' => $relPath,
                'size' => filesize($fullPath),
                'mtime' => filemtime($fullPath)
            ];
        }
    }
}

$allFiles = [];
scanDirRecursive($rootDir, $rootDir, $allFiles);

// Analyze PHP
$controllers = [];
$services = [];

$ctrlDir = $rootDir . '/api/controllers';
if (is_dir($ctrlDir)) {
    foreach (scandir($ctrlDir) as $f) {
        if (str_ends_with($f, '.php')) $controllers[] = $f;
    }
    sort($controllers);
}

$svcDir = $rootDir . '/api/services';
if (is_dir($svcDir)) {
    foreach (scandir($svcDir) as $f) {
        if (str_ends_with($f, '.php')) $services[] = $f;
    }
    sort($services);
}

// Analyze JS
$jsModules = [];
foreach ($allFiles as $file) {
    if (str_ends_with($file['path'], '.js')) {
        $jsModules[] = $file['path'];
    }
}
sort($jsModules);

$now = date('Y-m-d H:i:s');
$totalFiles = count($allFiles);

$ctrlList = implode("\n", array_map(function($c) {
    $route = strtolower(str_replace('Controller.php', '', $c));
    return "- **{$c}**: Handler cho route `{$route}`";
}, $controllers));

$svcList = implode("\n", array_map(function($s) {
    $domain = str_replace('Service.php', '', $s);
    return "- **{$s}**: Xử lý logic & truy vấn SQLite cho `{$domain}`";
}, $services));

$coreJs = [];
$featureJs = [];

foreach ($jsModules as $mod) {
    if (str_contains($mod, 'assets/js/core/')) {
        $coreJs[] = "- `{$mod}`";
    } else {
        $featureJs[] = "- `{$mod}`";
    }
}

$coreJsList = implode("\n", $coreJs);
$featureJsList = implode("\n", $featureJs);

$markdown = <<<MD
# CODE_MAP.md — Gitnexus Codebase Knowledge Graph & Map (SheetApp)

> **GITNEXUS SECOND BRAIN CODE MAP**
> Bản đồ tri thức toàn bộ hệ thống SheetApp. Cập nhật tự động: {$now}
> AI Agent BẮT BUỘC tra cứu sơ đồ phụ thuộc dưới đây trước khi chỉnh sửa file.

---

## 1 · ARCHITECTURE & CALL HIERARCHY OVERVIEW

```mermaid
graph TD
    User[Client Browser] -->|HTTP Request| Entry[index.php / Single Page Shell]
    Entry -->|JS Modules| FrontendCore[assets/js/core/ - ApiService, EventBus, Store, ModeManager]
    FrontendCore -->|UI Render & Events| UIComponents[assets/js/ - chord-canvas, setlist-ui, app.js]
    FrontendCore -->|AJAX Fetch| APIFront[api/index.php Router]
    
    APIFront -->|Route Handler| Controllers[api/controllers/*Controller.php]
    Controllers -->|Business Logic| Services[api/services/*Service.php]
    Services -->|PDO Query| DB[(storage/data/sheetapp.sqlite)]
```

---

## 2 · BACKEND MAP (PHP MVC & API ROUTES)

### 2.1 Front Controller / Router
- **File:** `api/index.php`
- **Nhiệm vụ:** Tiếp nhận request, phân tích parameter `route` và `action`, gọi Controller phù hợp và trả JSON chuẩn qua `Response::ok()`.

### 2.2 Controllers (`api/controllers/`)
{$ctrlList}

### 2.3 Services (`api/services/`)
{$svcList}

---

## 3 · FRONTEND MAP (JAVASCRIPT MODULE DEPENDENCY)

### 3.1 Core Infrastructure (`assets/js/core/`)
{$coreJsList}

### 3.2 Feature Modules & Submodules
{$featureJsList}

---

## 4 · DATABASE SCHEMA & STORAGE MAP
- **Main Database:** `storage/data/sheetapp.sqlite` (or `data/database.sqlite`)
- **Core Tables:**
  - `songs` (id, title, artist, key, tempo, content, pdf_path...)
  - `chord_sets` (id, song_id, set_name, map_json...) — *Lưu ý: Set 'HD' và 'default' bị khóa xóa*
  - `setlists` (id, title, scheduled_date, service_time, theme, description, status, leader_user_id...)
  - `setlist_items` (id, setlist_id, song_id, chord_profile, transpose_key, tempo_bpm, beats_per_measure, item_type, custom_title, leader_notes, duration_minutes...)
  - `service_plan_assignments` (id, setlist_id, user_id, role, notes, status, confirmed_at...)
  - `song_usage_history` (id, song_id, setlist_id, service_date, chord_profile, transpose_key...)
  - `annotations` (id, song_id, canvas_data...)

---

## 5 · FILE REGISTRY INDEX ({$totalFiles} files total)
Total indexed files: {$totalFiles}
MD;

file_put_contents($rootDir . '/CODE_MAP.md', $markdown);
echo "CODE_MAP.md generated successfully with {$totalFiles} files indexed at {$now}\n";
