const { test, expect } = require('@playwright/test');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
test('chord labels distinguish HD fallback from an empty personal set', async ({ page }) => {
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/core/ChordSetNames.js') });
  expect(await page.evaluate(() => [
    ChordSetNames.describe({ currentSet: 'HD', customCount: 0, xmlCount: 17 }),
    ChordSetNames.describe({ currentSet: 'BH', customCount: 0, xmlCount: 17 }),
    ChordSetNames.describe({ currentSet: 'default', customCount: 0, xmlCount: 17 }),
    ChordSetNames.describe({ currentSet: 'HD', customCount: 5, xmlCount: 17 }),
  ])).toEqual(['HD (chưa có) · đang hiện TLH', 'BH (chưa có)', 'TLH (gốc)', 'HD · 5 hợp âm']);
});

test('Modern selected option, mobile chip, HUD and toast share the full fallback description', async ({ page }) => {
  test.skip(!base, 'Requires isolated server');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.searchParams.get('action') === 'list'
      ? { success: true, sets: ['HD', 'default'] } : { success: true, chords: [] } });
  });
  await page.goto(`${base}/?song=thanh-ca-001&v=sheet`);
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  const label = 'HD (chưa có) · đang hiện TLH';
  await expect(page.locator('#chord-set-selector option:checked')).toHaveText(label);
  await expect(page.locator('#btn-mobile-chordset')).toHaveAttribute('title', label);
  await expect(page.locator('#btn-gig-chordset')).toHaveAttribute('title', label);
  await expect(page.locator('#toast-container .toast')).toContainText(label);
});

test('Classic selected option and toast share the fallback description', async ({ page }) => {
  test.skip(!base, 'Requires isolated server');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.searchParams.get('action') === 'list'
      ? { success: true, sets: ['HD', 'default'] } : { success: true, chords: [] } });
  });
  await page.goto(`${base}/old/?song=thanh-ca-001&v=sheet`);
  const label = 'HD (chưa có) · đang hiện TLH';
  await expect(page.locator('#chord-set-selector option:checked')).toHaveText(label);
  await expect(page.locator('#toast-container .toast')).toHaveCount(1);
  await expect(page.locator('#toast-container .toast')).toContainText(label);
});
