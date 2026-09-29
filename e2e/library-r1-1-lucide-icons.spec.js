// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Ticket R1-1: Lucide SVG Icons & Emoji Purge Verification', () => {
  test('Lucide SVG sprite is loaded and icons render correctly without broken symbols', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });

    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // 1. Sprite must be present in DOM
    const sprite = page.locator('#lucide-sprite');
    await expect(sprite).toBeAttached();

    // 2. Toolbar buttons have svg.icon elements
    const sidebarToggleIcon = page.locator('#btn-open-sidebar svg.icon');
    await expect(sidebarToggleIcon).toBeVisible();

    const useElements = await page.locator('svg.icon use').all();
    expect(useElements.length).toBeGreaterThan(10);

    // 3. Check that referenced symbols exist in #lucide-sprite
    const validSymbols = await page.evaluate(() => {
      const symbols = document.querySelectorAll('#lucide-sprite symbol');
      return Array.from(symbols).map(s => '#' + s.id);
    });

    expect(validSymbols).toContain('#icon-menu');
    expect(validSymbols).toContain('#icon-music');
    expect(validSymbols).toContain('#icon-settings');

    const invalidUses = await page.evaluate((validList) => {
      const uses = Array.from(document.querySelectorAll('svg.icon use'));
      const broken = [];
      for (const u of uses) {
        const href = u.getAttribute('href') || u.getAttribute('xlink:href');
        if (href && href.startsWith('#') && !validList.includes(href)) {
          broken.push(href);
        }
      }
      return broken;
    }, validSymbols);

    expect(invalidUses).toEqual([]);

    // 4. Verify template containers in DOM do not contain loose emojis from the purge list
    const unallowedEmojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const sidebarText = await page.locator('#sidebar').innerText().catch(() => '');
    const cleanSidebarText = sidebarText.replace(/[⭐★☆♩]/g, '');
    const matches = Array.from(cleanSidebarText.matchAll(new RegExp(unallowedEmojiRegex, 'gu'))).map(m => m[0]);
    expect(matches).toEqual([]);
  });
});
