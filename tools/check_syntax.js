#!/usr/bin/env node
/**
 * tools/check_syntax.js
 * 
 * Quét và kiểm tra cú pháp toàn bộ file JavaScript trong SheetApp2:
 * Chạy `node --check <file>` trên từng file .js (ngoài vendor & node_modules).
 * 
 * Cách dùng:
 *   node tools/check_syntax.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Danh sách các thư mục cần quét
const scanDirs = [
  'assets/js',
  'editor',
  'manager',
  'members',
  'learn',
  'live-band',
  'tools',
  'e2e'
];

// Các mẫu/đường dẫn cần bỏ qua
const excludePatterns = [
  path.normalize('assets/vendor/'),
  path.normalize('node_modules/'),
  path.normalize('.git/'),
  path.normalize('dashboard/'),
  path.normalize('.ua/')
];

function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(rootDir, fullPath);

    // Kiểm tra xem có bị exclude không
    const isExcluded = excludePatterns.some(pat => relPath.includes(pat));
    if (isExcluded) continue;

    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js') && !file.endsWith('.min.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

let allJsFiles = [];
for (const relDir of scanDirs) {
  allJsFiles = allJsFiles.concat(getAllJsFiles(path.join(rootDir, relDir)));
}

// Bổ sung file ở root nếu có
const rootJsFiles = fs.readdirSync(rootDir)
  .filter(f => f.endsWith('.js') && fs.statSync(path.join(rootDir, f)).isFile())
  .map(f => path.join(rootDir, f));
allJsFiles = allJsFiles.concat(rootJsFiles);

// Sắp xếp và loại trừ trùng lặp
allJsFiles = Array.from(new Set(allJsFiles)).sort();

console.log(`Kiểm tra cú pháp JavaScript (node --check) trên ${allJsFiles.length} file...`);

let errorsCount = 0;
const errorDetails = [];

for (const filePath of allJsFiles) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const res = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8'
  });

  if (res.status !== 0) {
    errorsCount++;
    const errMsg = (res.stderr || res.stdout || '').trim();
    errorDetails.push({ file: relPath, message: errMsg });
    console.error(`  ❌ Lỗi cú pháp tại: ${relPath}`);
    console.error(`     ↳ ${errMsg.split('\n')[0]}`);
  }
}

if (errorsCount > 0) {
  console.error(`\nKẾT QUẢ: Phát hiện ${errorsCount} file có lỗi cú pháp JavaScript.`);
  process.exit(1);
} else {
  console.log(`PASS (${allJsFiles.length} files JS cú pháp hợp lệ)`);
  process.exit(0);
}
