const { test, expect } = require('@playwright/test');
const path = require('path');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} empty search renders payload as text`, async ({ page }) => {
    await page.setContent('<input id="search-input"><div id="song-list"></div>');
    const root = path.resolve(__dirname, '..');
    await page.addScriptTag({ path: path.join(root, 'assets/js/core/SafeHtml.js') });
    await page.addScriptTag({ path: path.join(root, classic ? 'old/assets/js/library-ui.js' : 'assets/js/library-ui.js') });
    for (const payload of ['<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', 'Ân & Chúa < yêu >']) {
      await page.evaluate(value => LibraryUI.render([], { emptyMsg: `Không tìm thấy "${value}"`, emptyHint: value }), payload);
      await expect(page.locator('#song-list p')).toHaveText(`Không tìm thấy "${payload}"`);
      await expect(page.locator('#song-list img, #song-list svg, #song-list script')).toHaveCount(0);
    }
  });
}
