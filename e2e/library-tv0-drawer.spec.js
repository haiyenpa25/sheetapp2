const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires isolated server');
test('390 drawer exposes the final result without the bottom action bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?song=thanh-ca-001&v=sheet`);
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  await page.locator('#btn-open-sidebar').click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/mobile-hidden/);
  await expect(page.locator('#mobile-thumb-bar')).toBeHidden();
  await page.locator('.song-list-container').evaluate(wrap => { wrap.scrollTop = wrap.scrollHeight; });
  await expect.poll(() => page.locator('#song-list .song-item').last().getAttribute('data-id')).not.toBe('thanh-ca-001');
  const last = page.locator('#song-list .song-item').last();
  await expect(last).toBeInViewport();
  const id = await last.getAttribute('data-id');
  await last.tap();
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('song'))).toBe(id);
});
