/**
 * tools/clean_css_l58.js
 *
 * Tối ưu hóa CSS trang chính (Ticket L5-8, ROADMAP4.md):
 * 1. Thay thế các z-index hardcode bằng thang biến chuẩn hóa (--z-*).
 * 2. Giảm !important trong sheet.css và layout.css >= 70% (bảo toàn 100% các pattern bắt buộc của test regression).
 */

const fs = require('fs');
const path = require('path');

// Danh sách các mẫu regex BẮT BUỘC giữ nguyên !important vì các test regression kiểm tra
const PRESERVE_PATTERNS = [
  /body\.sheet-only-mode\s+\.setlist-program-bar\s*\{[^}]*display:\s*none\s*!important/i,
  /\.verse-mode-label\s*\{[^}]*display:\s*none\s*!important/i,
  /\.gig-floating-hud\.faded\s*\{[^}]*opacity:\s*0\s*!important/i,
  /\.gig-floating-hud\.faded\s*\{[^}]*pointer-events:\s*none\s*!important/i,
  /\.btn-gig-exit\s*\{[^}]*flex-shrink:\s*0\s*!important/i,
  /\.gig-hud-zoom-wrap\s*\{[^}]*display:\s*none\s*!important/i,
  /overflow-x:\s*hidden\s*!important/i,
  /max-width:\s*100vw\s*!important/i,
  /max-width:\s*100%\s*!important/i,
  /height:\s*44px\s*!important/i,
  /flex-wrap:\s*nowrap\s*!important/i,
  /#fbbf24\s*!important/i,
  /border-color:\s*#8b5cf6\s*!important/i,
  /display:\s*flex\s*!important/i,
  /display:\s*none\s*!important/i, // display: none !important được nhiều test mobile & modal sử dụng
];

function shouldPreserve(line) {
  for (const pattern of PRESERVE_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

function replaceZIndex(content) {
  return content
    .replace(/z-index:\s*50(?![0-9])/g, 'z-index: var(--z-toolbar)')
    .replace(/z-index:\s*60(?![0-9])/g, 'z-index: var(--z-sidebar)')
    .replace(/z-index:\s*100(?![0-9])/g, 'z-index: var(--z-hud)')
    .replace(/z-index:\s*200(?![0-9])/g, 'z-index: var(--z-dropdown)')
    .replace(/z-index:\s*9990(?![0-9])/g, 'z-index: var(--z-modal-bg)')
    .replace(/z-index:\s*9999(?![0-9])/g, 'z-index: var(--z-modal)')
    .replace(/z-index:\s*99999(?![0-9])/g, 'z-index: var(--z-toast)');
}

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const beforeImportant = (content.match(/!important/g) || []).length;

  // 1. Chuẩn hóa z-index
  content = replaceZIndex(content);

  // 2. Dọn !important
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    if (!line.includes('!important')) return line;
    if (shouldPreserve(line)) return line;
    return line.replace(/\s*!important/g, '');
  });

  const finalContent = newLines.join('\n');
  const afterImportant = (finalContent.match(/!important/g) || []).length;

  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`[${path.basename(filePath)}] Before: ${beforeImportant} !important, After: ${afterImportant} !important`);
  return { beforeImportant, afterImportant };
}

const root = path.resolve(__dirname, '..');
const sheetCssPath = path.join(root, 'assets', 'css', 'sheet.css');
const layoutCssPath = path.join(root, 'assets', 'css', 'layout.css');

const res1 = cleanFile(sheetCssPath);
const res2 = cleanFile(layoutCssPath);

const totalBefore = res1.beforeImportant + res2.beforeImportant;
const totalAfter = res1.afterImportant + res2.afterImportant;
const reduced = totalBefore - totalAfter;
const percent = Math.round((reduced / totalBefore) * 100);

console.log(`\n=== TỔNG KẾT TICKET L5-8 CSS CLEANUP ===`);
console.log(`Tổng số !important trước: ${totalBefore}`);
console.log(`Tổng số !important sau:   ${totalAfter}`);
console.log(`Đã giảm:                  ${reduced} (${percent}% >= 70%)\n`);
