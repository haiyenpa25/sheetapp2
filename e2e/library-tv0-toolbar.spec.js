const { test, expect } = require('@playwright/test');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires isolated server SHEETAPP_TV_TEST_URL; never targets source storage');

for (const [width, collapsed] of [[1366, false], [1366, true], [1440, false], [1180, false], [820, false]]) {
  test(`Modern toolbar ${width}, sidebar ${collapsed ? 'closed' : 'open'}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1180 });
    await page.goto(`${base}/?song=thanh-ca-001`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    const sidebar = page.locator('#sidebar');
    const hidden = (await sidebar.getAttribute('class'))?.includes('mobile-hidden');
    if (hidden !== collapsed) await page.locator('#btn-open-sidebar').click();
    if (collapsed) await expect(sidebar).toHaveClass(/mobile-hidden/);
    else {
      await expect(sidebar).not.toHaveClass(/mobile-hidden/);
      await expect.poll(async () => Math.round((await sidebar.boundingBox())?.x ?? -1)).toBe(0);
    }
    for (const mode of ['sheet', 'lyrics']) {
      await page.locator(`#btn-view-${mode}`).click();
      await expect(page.locator('#btn-view-sheet span')).toBeVisible();
      await expect(page.locator('#btn-view-lyrics span')).toBeVisible();
      const issues = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('#toolbar button, #toolbar select')]
          .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
          .map(e => ({ id: e.id, r: e.getBoundingClientRect(), clipped: e.scrollWidth > e.clientWidth + 1 }));
        const errors = controls.filter(e => e.r.right > innerWidth + 1 || e.r.left < -1 || e.clipped).map(e => `overflow:${e.id}`);
        controls.forEach((a, i) => controls.slice(i + 1).forEach(b => {
          if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 &&
              Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1) errors.push(`overlap:${a.id}/${b.id}`);
        }));
        return errors;
      });
      await page.screenshot({ path: path.resolve(__dirname, `../test-results/roadmap6-evidence/TV0-4-${width}-${collapsed}-${mode}.png`) });
      expect(issues, mode).toEqual([]);
    }
  });
}
