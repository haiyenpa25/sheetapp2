const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires explicit isolated Apache URL');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} number 1 opens Tôn Vinh 1 and an unnumbered catalog cannot open Thánh ca 1`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 844 });
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    const expected = await page.evaluate(() => LibraryUI.getSongs().find(song => Number(song.category_id) === 2 && Number(song.httlvnId) === 1).id);
    await page.evaluate(() => EventBus.on('song:loaded', ({ song }) => { window.__numberLoaded = song.id; }));
    const sidebar = page.locator('#sidebar');
    const openSidebar = async () => {
      if ((await sidebar.getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
      await expect.poll(async () => Math.round((await sidebar.boundingBox()).x)).toBe(0);
    };
    await openSidebar();
    await expect(page.locator('[data-id="thanh-ca-001"] .song-item-num')).toHaveText('TC 001');
    await page.selectOption('#category-filter', 'Tôn Vinh Chúa Hằng Hữu');
    if (classic) {
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.type('1'); await page.keyboard.press('Enter');
    } else {
      await page.locator('#btn-quick-numpad').click();
      await expect(page.locator('#modal-quick-numpad')).toBeVisible();
      await page.locator('.btn-numpad-key[data-digit="1"]').click();
      await expect(page.locator('#numpad-song-match')).toContainText('TV 001');
      await page.locator('#btn-numpad-open').click();
    }
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('song'))).toBe(expected);
    await expect.poll(() => page.evaluate(() => window.__numberLoaded)).toBe(expected);
    await openSidebar();
    await page.selectOption('#category-filter', 'NS Trương Văn Xê');
    if (classic) {
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.type('1'); await page.keyboard.press('Enter');
    } else {
      await expect(page.locator('#btn-quick-numpad')).toBeHidden();
      await page.evaluate(() => QuickNumpadModal.open());
      await expect(page.locator('#modal-quick-numpad')).toBeHidden();
    }
    expect(await page.evaluate(() => new URL(location.href).searchParams.get('song'))).toBe(expected);
    await expect(page.locator('.toast')).toContainText('chưa có số');
  });
}
