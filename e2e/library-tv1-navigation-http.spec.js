const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires explicit isolated Apache URL');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} booted toolbar and keyboard navigate the displayed list`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 844 });
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await page.evaluate(() => {
      window.navigationLoads = [];
      EventBus.on('song:loaded', ({ song }) => window.navigationLoads.push(song.id));
      LibraryUI.render(['thanh-ca-001', 'thanh-ca-903'].map(id => LibraryUI.getSongs().find(song => song.id === id)));
    });
    await page.locator('#btn-next-song').click();
    await expect(page).toHaveURL(/song=thanh-ca-903(?:&|$)/);
    // TC 903 has 89 measures: verify the destination immediately, then allow its OSMD render to finish.
    await expect.poll(() => page.evaluate(() => window.navigationLoads), { timeout: 15000 }).toEqual(['thanh-ca-903']);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press(classic ? 'ArrowUp' : 'Shift+ArrowUp');
    await expect(page).toHaveURL(/song=thanh-ca-001(?:&|$)/);
    await expect.poll(() => page.evaluate(() => window.navigationLoads), { timeout: 15000 }).toEqual(['thanh-ca-903', 'thanh-ca-001']);
    await page.locator('#btn-prev-song').click();
    expect(await page.evaluate(() => new URL(location.href).searchParams.get('song'))).toBe('thanh-ca-001');
    expect(await page.evaluate(() => window.navigationLoads)).toHaveLength(2);
  });
}
