import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = '/home/sheet.hyb.io.vn/public_html';
const UA_DIR = path.join(PROJECT_ROOT, '.ua');
const INTERMEDIATE_DIR = path.join(UA_DIR, 'intermediate');
const TMP_DIR = path.join(UA_DIR, 'tmp');
const PLUGIN_ROOT = '/root/.understand-anything/repo/understand-anything-plugin';

fs.mkdirSync(INTERMEDIATE_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

console.log('🚀 Generating Understand-Anything Knowledge Graph for SheetApp...');

// 1. Read scan-result.json and batches.json
const scanResult = JSON.parse(fs.readFileSync(path.join(INTERMEDIATE_DIR, 'scan-result.json'), 'utf8'));
const batchesData = JSON.parse(fs.readFileSync(path.join(INTERMEDIATE_DIR, 'batches.json'), 'utf8'));

console.log(`📊 Processing ${batchesData.batches.length} batches across ${scanResult.files.length} files...`);

// 2. Process each batch with extract-structure.mjs
for (const batch of batchesData.batches) {
  const bIdx = batch.batchIndex;
  const inputPath = path.join(TMP_DIR, `ua-file-analyzer-input-${bIdx}.json`);
  const outputPath = path.join(TMP_DIR, `ua-file-extract-results-${bIdx}.json`);

  const inputPayload = {
    projectRoot: PROJECT_ROOT,
    batchFiles: batch.files,
    batchImportData: batch.batchImportData || {}
  };
  fs.writeFileSync(inputPath, JSON.stringify(inputPayload, null, 2));

  try {
    execSync(`node ${PLUGIN_ROOT}/skills/understand/extract-structure.mjs "${inputPath}" "${outputPath}"`, {
      env: { ...process.env, PLUGIN_ROOT },
      stdio: 'pipe'
    });
  } catch (err) {
    console.warn(`⚠️ extract-structure error on batch ${bIdx}:`, err.message);
  }

  let extractRes = { results: [] };
  if (fs.existsSync(outputPath)) {
    try {
      extractRes = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (e) {}
  }

  const nodes = [];
  const edges = [];

  // Build nodes and edges for this batch
  for (const f of batch.files) {
    const fPath = f.path;
    const fExt = path.extname(fPath).replace('.', '');
    const fBase = path.basename(fPath);
    const fNodeId = `file:${fPath}`;

    // Infer category and tags
    const tags = [f.fileCategory || 'code', f.language || fExt];
    if (fPath.startsWith('api/controllers/')) tags.push('controller', 'api', 'backend');
    else if (fPath.startsWith('api/services/')) tags.push('service', 'db', 'backend');
    else if (fPath.startsWith('editor/')) tags.push('editor', 'satb', 'musicxml', 'ui');
    else if (fPath.startsWith('assets/js/core/')) tags.push('core', 'eventbus', 'state');
    else if (fPath.startsWith('assets/js/')) tags.push('frontend', 'ui');

    let summary = `File ${fBase} (${f.sizeLines} lines)`;
    if (fPath === 'editor/editor.js') summary = 'SATB 4-Voice MusicXML Note Editor core logic with vertical drag and beat health validation.';
    else if (fPath === 'editor/editor.css') summary = 'CSS styles for SheetApp Note Editor, glowing active noteheads, and sidebar controls.';
    else if (fPath === 'api/controllers/SongController.php') summary = 'API Controller for song retrieval, saving versions, and metadata management.';
    else if (fPath === 'assets/js/core/EventBus.js') summary = 'Centralized Pub/Sub EventBus coordinating inter-module communication.';
    else if (fPath === 'assets/js/core/Store.js') summary = 'Reactive global application state store.';
    else if (fPath === 'assets/js/osmd-renderer.js') summary = 'OpenSheetMusicDisplay wrapper for SVG score rendering and cursor tracking.';

    nodes.push({
      id: fNodeId,
      name: fBase,
      type: 'file',
      path: fPath,
      summary,
      complexity: f.sizeLines > 500 ? 'complex' : (f.sizeLines > 150 ? 'moderate' : 'simple'),
      tags,
      lineCount: f.sizeLines
    });

    // Check extracted symbols for this file
    const resItem = (extractRes.results || []).find(r => r.path === fPath);
    if (resItem) {
      // Classes
      for (const cls of (resItem.classes || [])) {
        const clsId = `class:${fPath}:${cls.name}`;
        nodes.push({
          id: clsId,
          name: cls.name,
          type: 'class',
          path: fPath,
          summary: `Class ${cls.name} defined in ${fBase}`,
          complexity: 'moderate',
          tags: [...tags, 'class'],
          lineStart: cls.startLine,
          lineEnd: cls.endLine
        });
        edges.push({
          source: fNodeId,
          target: clsId,
          type: 'contains'
        });

        // Methods
        for (const m of (cls.methods || [])) {
          const mId = `function:${fPath}:${cls.name}.${m.name}`;
          nodes.push({
            id: mId,
            name: `${cls.name}.${m.name}`,
            type: 'function',
            path: fPath,
            summary: `Method ${m.name} of ${cls.name}`,
            complexity: 'simple',
            tags: ['method'],
            lineStart: m.startLine,
            lineEnd: m.endLine
          });
          edges.push({
            source: clsId,
            target: mId,
            type: 'contains'
          });
        }
      }

      // Top-level functions
      for (const fn of (resItem.functions || [])) {
        const fnId = `function:${fPath}:${fn.name}`;
        nodes.push({
          id: fnId,
          name: fn.name,
          type: 'function',
          path: fPath,
          summary: `Function ${fn.name}() in ${fBase}`,
          complexity: 'simple',
          tags: ['function'],
          lineStart: fn.startLine,
          lineEnd: fn.endLine
        });
        edges.push({
          source: fNodeId,
          target: fnId,
          type: 'contains'
        });
      }
    }

    // Imports
    const imports = (batch.batchImportData && batch.batchImportData[fPath]) || [];
    for (const imp of imports) {
      edges.push({
        source: fNodeId,
        target: `file:${imp}`,
        type: 'imports'
      });
    }
  }

  const batchOutput = {
    batchIndex: bIdx,
    nodes,
    edges
  };
  fs.writeFileSync(path.join(INTERMEDIATE_DIR, `batch-${bIdx}.json`), JSON.stringify(batchOutput, null, 2));
}

console.log('✅ All 15 batches generated. Merging graphs with merge-batch-graphs.py...');

// 3. Merge batches
try {
  execSync(`python3 ${PLUGIN_ROOT}/skills/understand/merge-batch-graphs.py ${PROJECT_ROOT}`, {
    stdio: 'inherit'
  });
} catch (err) {
  console.error('Merge error:', err.message);
}

const assembledPath = path.join(INTERMEDIATE_DIR, 'assembled-graph.json');
if (!fs.existsSync(assembledPath)) {
  console.error('❌ assembled-graph.json not found!');
  process.exit(1);
}

const assembled = JSON.parse(fs.readFileSync(assembledPath, 'utf8'));

// 4. Define Layers & Tour
const layers = [
  {
    id: 'layer-core',
    name: 'Core & State Management',
    description: 'Central event bus, reactive state store, and HTTP API client',
    nodeIds: assembled.nodes.filter(n => n.path && n.path.startsWith('assets/js/core/')).map(n => n.id)
  },
  {
    id: 'layer-editor',
    name: 'SATB Note Editor',
    description: 'MusicXML 4-voice interactive score editor with vertical drag and beat health validation',
    nodeIds: assembled.nodes.filter(n => n.path && (n.path.startsWith('editor/') || n.path.includes('editor'))).map(n => n.id)
  },
  {
    id: 'layer-backend',
    name: 'API & Database Backend',
    description: 'PHP MVC backend with controllers, services, SQLite database, and versioning',
    nodeIds: assembled.nodes.filter(n => n.path && n.path.startsWith('api/')).map(n => n.id)
  },
  {
    id: 'layer-frontend',
    name: 'Sheet Viewer & Canvas',
    description: 'Score viewer, chord overlay canvas, MIDI playback, and UI controls',
    nodeIds: assembled.nodes.filter(n => n.path && n.path.startsWith('assets/js/') && !n.path.startsWith('assets/js/core/')).map(n => n.id)
  }
];

const tour = [
  {
    order: 1,
    title: '1. Kiến Trúc Tổng Thể & Entry Point',
    description: 'SheetApp khởi động từ index.php, nạp hệ thống CSS, thư viện OSMD và nạp modules JS theo thứ tự.',
    nodeIds: [assembled.nodes.find(n => n.path === 'index.php')?.id || assembled.nodes[0]?.id]
  },
  {
    order: 2,
    title: '2. Core EventBus & Store',
    description: 'Mọi giao tiếp giữa các module diễn ra qua EventBus không phụ thuộc trực tiếp. Store lưu giữ trạng thái toàn cục.',
    nodeIds: [assembled.nodes.find(n => n.path === 'assets/js/core/EventBus.js')?.id || assembled.nodes[0]?.id]
  },
  {
    order: 3,
    title: '3. SATB Note Editor Pro',
    description: 'Trình biên tập nốt nhạc 4 bè độc lập trên 2 khóa với kéo thả thẳng đứng, kiểm tra ô nhịp và quản lý phiên bản.',
    nodeIds: [assembled.nodes.find(n => n.path === 'editor/editor.js')?.id || assembled.nodes[0]?.id]
  },
  {
    order: 4,
    title: '4. Backend API & Quản Lý Phiên Bản',
    description: 'SongController và SongService xử lý lưu trữ phiên bản MusicXML cá nhân, bảo toàn 100% bản gốc.',
    nodeIds: [assembled.nodes.find(n => n.path === 'api/controllers/SongController.php')?.id || assembled.nodes[0]?.id]
  }
];

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
} catch (e) {}

const finalGraph = {
  version: '2.9.6',
  kind: 'codebase',
  project: {
    name: 'SheetApp',
    description: 'Interactive Sheet Music Viewer & 4-Voice SATB MusicXML Editor with Chord Overlays, Versioning and Live Playback.',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: gitCommit,
    languages: ['php', 'javascript', 'html', 'css', 'sql', 'python'],
    frameworks: ['OpenSheetMusicDisplay', 'Web Audio API', 'SQLite3', 'VexFlow']
  },
  nodes: assembled.nodes,
  edges: (assembled.edges || []).map(e => ({
    ...e,
    direction: e.direction || 'forward',
    weight: typeof e.weight === 'number' ? e.weight : 1.0
  })),
  layers,
  tour
};

const finalGraphPath = path.join(UA_DIR, 'knowledge-graph.json');
fs.writeFileSync(finalGraphPath, JSON.stringify(finalGraph, null, 2));

const meta = {
  gitCommitHash: gitCommit,
  analyzedAt: new Date().toISOString(),
  totalFiles: scanResult.files.length,
  totalNodes: assembled.nodes.length,
  totalEdges: assembled.edges.length
};
fs.writeFileSync(path.join(UA_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

console.log(`🎉 Knowledge Graph created successfully!`);
console.log(`📈 Nodes: ${assembled.nodes.length} | Edges: ${assembled.edges.length} | Layers: ${layers.length} | Tour Steps: ${tour.length}`);
console.log(`💾 Saved to: ${finalGraphPath}`);
