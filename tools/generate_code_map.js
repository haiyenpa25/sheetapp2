/**
 * Gitnexus Code Map & Dependency Indexer for SheetApp
 * Generates and updates CODE_MAP.md automatically
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function scanDir(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'vendor') {
                scanDir(filePath, fileList);
            }
        } else {
            const relPath = path.relative(rootDir, filePath);
            fileList.push({
                path: relPath,
                size: stat.size,
                mtime: stat.mtime
            });
        }
    });
    return fileList;
}

function analyzePHP() {
    const apiDir = path.join(rootDir, 'api');
    const controllers = [];
    const services = [];

    if (fs.existsSync(path.join(apiDir, 'controllers'))) {
        fs.readdirSync(path.join(apiDir, 'controllers')).forEach(f => {
            if (f.endsWith('.php')) controllers.push(f);
        });
    }

    if (fs.existsSync(path.join(apiDir, 'services'))) {
        fs.readdirSync(path.join(apiDir, 'services')).forEach(f => {
            if (f.endsWith('.php')) services.push(f);
        });
    }

    return { controllers, services };
}

function analyzeJS() {
    const jsDir = path.join(rootDir, 'assets', 'js');
    const modules = [];
    if (fs.existsSync(jsDir)) {
        const files = scanDir(jsDir);
        files.forEach(f => {
            if (f.path.endsWith('.js')) modules.push(f.path);
        });
    }
    return modules;
}

function generateCodeMap() {
    const allFiles = scanDir(rootDir);
    const phpInfo = analyzePHP();
    const jsModules = analyzeJS();

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let content = `# CODE_MAP.md — Gitnexus Codebase Knowledge Graph & Map (SheetApp)

> **GITNEXUS SECOND BRAIN CODE MAP**
> Bản đồ tri thức toàn bộ hệ thống SheetApp. Cập nhật tự động: ${timestamp}
> AI Agent BẮT BUỘC tra cứu sơ đồ phụ thuộc dưới đây trước khi chỉnh sửa file.

---

## 1 · ARCHITECTURE & CALL HIERARCHY OVERVIEW

\`\`\`mermaid
graph TD
    User[Client Browser] -->|HTTP Request| Entry[index.php / Single Page Shell]
    Entry -->|JS Modules| FrontendCore[assets/js/core/ - ApiService, EventBus, Store]
    FrontendCore -->|UI Render & Events| UIComponents[assets/js/ - chord-canvas, setlist-ui, app.js]
    FrontendCore -->|AJAX Fetch| APIFront[api/index.php Router]
    
    APIFront -->|Route Handler| Controllers[api/controllers/*Controller.php]
    Controllers -->|Business Logic| Services[api/services/*Service.php]
    Services -->|PDO Query| DB[(storage/data/sheetapp.sqlite)]
\`\`\`

---

## 2 · BACKEND MAP (PHP MVC & API ROUTES)

### 2.1 Front Controller / Router
- **File:** \`api/index.php\`
- **Nhiệm vụ:** Tiếp nhận request, phân tích parameter \`route\` và \`action\`, gọi Controller phù hợp và trả JSON chuẩn qua \`Response::ok()\`.

### 2.2 Controllers (\`api/controllers/\`)
${phpInfo.controllers.map(c => `- **${c}**: Handler cho route \`${c.replace('Controller.php', '').toLowerCase()}\``).join('\n')}

### 2.3 Services (\`api/services/\`)
${phpInfo.services.map(s => `- **${s}**: Xử lý logic & truy vấn SQLite cho \`${s.replace('Service.php', '')}\``).join('\n')}

---

## 3 · FRONTEND MAP (JAVASCRIPT MODULE DEPENDENCY)

### 3.1 Core Infrastructure (\`assets/js/core/\`)
- \`assets/js/core/ApiService.js\` — Wrapper tập trung cho mọi cuộc gọi \`fetch()\` API.
- \`assets/js/core/EventBus.js\` — Hệ thống Pub/Sub giao tiếp giữa các UI modules.
- \`assets/js/core/Store.js\` — Quản lý trạng thái chung (Current Song, Setlist, User Settings).

### 3.2 Feature Modules
${jsModules.filter(m => !m.includes('/core/')).map(m => `- \`${m}\``).join('\n')}

---

## 4 · DATABASE SCHEMA & STORAGE MAP
- **Main Database:** \`storage/data/sheetapp.sqlite\`
- **Core Tables:**
  - \`songs\` (id, title, artist, key, tempo, content, pdf_path...)
  - \`chord_sets\` (id, song_id, set_name, map_json...) — *Lưu ý: Set 'HD' và 'default' bị khóa xóa*
  - \`setlists\` & \`setlist_items\` (id, name, bpm, beats_per_measure, transpose_override...)
  - \`annotations\` (id, song_id, canvas_data...)

---

## 5 · FILE REGISTRY INDEX (${allFiles.length} files total)
Total indexed files: ${allFiles.length}
`;

    fs.writeFileSync(path.join(rootDir, 'CODE_MAP.md'), content, 'utf8');
    console.log(`[Gitnexus] CODE_MAP.md generated successfully at ${timestamp}`);
}

generateCodeMap();
