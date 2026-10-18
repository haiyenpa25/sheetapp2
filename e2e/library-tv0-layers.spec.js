const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
test('CSS contains no hardcoded z-index >= 3000', () => {
  const violations = [];
  for (const file of fs.readdirSync(path.join(root, 'assets/css')).filter(file => file.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(root, 'assets/css', file), 'utf8');
    for (const match of css.matchAll(/z-index:\s*(\d+)/g)) if (Number(match[1]) >= 3000) violations.push(`${file}: ${match[0]}`);
  }
  expect(violations).toEqual([]);
});

test('modal remains above performance HUD', async ({ page }) => {
  await page.setContent(`<div class="gig-floating-hud" style="position:fixed;inset:30%;">HUD</div>
    <div class="modal-overlay"><div class="modal" role="dialog">Modal</div></div>`);
  for (const css of ['base.css', 'components.css', 'library-polish.css']) await page.addStyleTag({ path: path.join(root, 'assets/css', css) });
  expect(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.modal-overlay'))).toBe(true);
});
