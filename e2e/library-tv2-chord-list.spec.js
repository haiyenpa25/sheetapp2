const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires explicit isolated Apache URL');

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} loads chord-set names only on interaction and shares pending requests`, async ({ page }) => {
    const calls = [];
    await page.route('**/api/index.php?route=chord_sets&action=list&*', async route => {
      calls.push(new URL(route.request().url()).searchParams.get('songId'));
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({ json: { success: true, sets: ['HD', 'default', 'TV2_CUSTOM'] } });
    });
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(calls).toEqual([]);
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');
    await page.locator('#chord-set-selector').evaluate(el => {
      el.dispatchEvent(new Event('focus'));
      el.dispatchEvent(new Event('mousedown'));
    });
    await expect(page.locator('#chord-set-selector option[value="TV2_CUSTOM"]')).toHaveCount(1);
    expect(calls).toEqual(['thanh-ca-001']);
    await page.locator('#chord-set-selector').evaluate(el => el.dispatchEvent(new Event('focus')));
    await page.waitForLoadState('networkidle');
    expect(calls).toHaveLength(1);
    // A forced refresh is used after creating/deleting a set; it must still fetch.
    await page.evaluate(() => window.ChordCanvas.refreshSetDropdown(true));
    expect(calls).toHaveLength(2);
    await page.evaluate(async () => {
      const song = window.LibraryUI.getSongs().find(item => item.id === 'thanh-ca-002');
      await window.SongLoader.load(song);
    });
    await page.waitForLoadState('networkidle');
    expect(calls).toHaveLength(2);
    await expect(page.locator('#chord-set-selector option[value="TV2_CUSTOM"]')).toHaveCount(0);
    await page.locator('#chord-set-selector').evaluate(el => el.dispatchEvent(new Event('focus')));
    await expect(page.locator('#chord-set-selector option[value="TV2_CUSTOM"]')).toHaveCount(1);
    expect(calls.at(-1)).toBe('thanh-ca-002');
  });
}
