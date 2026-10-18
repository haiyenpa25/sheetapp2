// Run the real renderers in a minimal DOM sink; browser coverage lives in E2E.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '../..');
for (const file of ['assets/js/library-ui.js', 'old/assets/js/library-ui.js']) {
  const list = { innerHTML: '', style: {}, classList: { toggle() {} } };
  const context = vm.createContext({ window: {}, document: {
    getElementById: id => id === 'song-list' ? list : null,
  } });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  const payload = '<img src=x onerror=alert(1)>';
  context.window.LibraryUI.render([], { emptyMsg: payload, emptyHint: payload });
  if (list.innerHTML.includes('<img') || !list.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;')) {
    throw new Error(`${file}: empty state did not escape actual payload`);
  }
  process.stdout.write(`PASS ${file}: actual renderer escapes empty state\n`);
}
