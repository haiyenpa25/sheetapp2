const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.use({ isMobile: true });
test.skip(!base, 'Requires isolated server');

for (const classic of [false, true]) {
  for (const width of [390, 820]) {
    test(`${classic ? 'Classic' : 'Modern'} ${width}: native swipe loads zero XML; native tap loads one`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Native touch injection uses Chromium CDP; component cases also target WebKit');
      await page.setViewportSize({ width, height: 1180 });
      await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
      await expect(page.locator('#osmd-container svg').first()).toBeVisible();
      const sidebar = page.locator('#sidebar');
      if ((await sidebar.getAttribute('class'))?.includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
      await expect(sidebar).not.toHaveClass(/mobile-hidden/);
      await expect.poll(async () => Math.round((await sidebar.boundingBox())?.x ?? -1)).toBe(0);
      const target = () => page.evaluate(() => {
        const wrap = document.querySelector('.song-list-container').getBoundingClientRect();
        const row = [...document.querySelectorAll('#song-list .song-item')].find(element => {
          const r = element.getBoundingClientRect();
          return element.dataset.id !== 'thanh-ca-001' && r.top > wrap.top + 80 && r.bottom < wrap.bottom;
        });
        const r = row?.getBoundingClientRect();
        return r ? { id: row.dataset.id, x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
      });
      await expect.poll(target).not.toBeNull();
      const startId = await page.evaluate(() => LibraryUI.getActiveSong()?.id);
      const xml = [];
      page.on('request', request => { if (/\.(?:xml|musicxml|mxl)(?:\?|$)/i.test(request.url())) xml.push(request.url()); });
      const position = await target();
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: position.x, y: position.y }] });
      for (const step of [20, 40, 60]) {
        await page.waitForTimeout(50);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: position.x, y: position.y - step }] });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // A browser deliberately consumes taps during momentum scrolling.
      await page.locator('.song-list-container').evaluate(wrap => new Promise(resolve => {
        let previous = wrap.scrollTop, stable = 0;
        const timer = setInterval(() => {
          stable = Math.abs(previous - wrap.scrollTop) < 1 ? stable + 1 : 0;
          previous = wrap.scrollTop;
          if (stable >= 5) { clearInterval(timer); resolve(); }
        }, 50);
      }));
      expect(await page.evaluate(() => LibraryUI.getActiveSong()?.id)).toBe(startId);
      expect(xml).toHaveLength(0);
      await page.waitForTimeout(500);
      const next = await target();
      await page.locator(`#song-list .song-item[data-id="${next.id}"] .song-item-title`).tap();
      await expect.poll(() => page.evaluate(() => LibraryUI.getActiveSong()?.id)).toBe(next.id);
      await expect.poll(() => xml.length).toBe(1);
      await page.waitForLoadState('networkidle');
      expect(xml).toHaveLength(1);
    });
  }
}
