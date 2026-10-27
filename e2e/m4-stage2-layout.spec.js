const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://127.0.0.1:8922/sheetapp2/';

test.describe('M4-6 · Gig HUD co vừa 360–1024; nút Thoát ở góc trên tách khỏi cụm điều khiển; thêm ◀ ▶ và zoom ở điện thoại', () => {
  test('M4-6 768 portrait HUD & exit fit inside viewport; 390 exit separated at top corner + nav & zoom visible', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-6 nghiệm thu trên WebKit');
    test.setTimeout(60000);

    // 1. 768x1024 dọc
    const ctx768 = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true,
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page768 = await ctx768.newPage();
    await page768.addInitScript(() => {
      if (!Element.prototype.requestFullscreen) Element.prototype.requestFullscreen = async () => {};
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });
    await page768.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page768.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
    await page768.locator('#btn-fullscreen').click();
    await expect(page768.locator('body')).toHaveClass(/sheet-only-mode/);

    const audit768 = await page768.evaluate(() => {
      const hud = document.getElementById('gig-floating-hud').getBoundingClientRect();
      const exit = document.getElementById('btn-gig-exit').getBoundingClientRect();
      return {
        hudLeft: Math.round(hud.left),
        hudRight: Math.round(hud.right),
        exitLeft: Math.round(exit.left),
        exitRight: Math.round(exit.right),
        exitTop: Math.round(exit.top),
      };
    });
    expect(audit768.hudLeft).toBeGreaterThanOrEqual(0);
    expect(audit768.hudRight).toBeLessThanOrEqual(768);
    expect(audit768.exitLeft).toBeGreaterThanOrEqual(0);
    expect(audit768.exitRight).toBeLessThanOrEqual(768);
    await ctx768.close();

    // 2. 390x844 điện thoại
    const ctx390 = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page390 = await ctx390.newPage();
    await page390.addInitScript(() => {
      if (!Element.prototype.requestFullscreen) Element.prototype.requestFullscreen = async () => {};
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });
    await page390.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page390.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
    await page390.locator('#btn-mobile-gig').click();
    await expect(page390.locator('body')).toHaveClass(/sheet-only-mode/);

    const audit390 = await page390.evaluate(() => {
      const isVis = (el) => {
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const hud = document.getElementById('gig-floating-hud');
      const hudRect = hud.getBoundingClientRect();
      const exitEl = document.getElementById('btn-gig-exit');
      const exitRect = exitEl.getBoundingClientRect();

      const otherBtns = Array.from(hud.querySelectorAll('button')).filter(b => b.id !== 'btn-gig-exit' && isVis(b));
      let minDistanceToExit = Infinity;
      for (const b of otherBtns) {
        const r = b.getBoundingClientRect();
        const dx = Math.max(0, r.left - exitRect.right, exitRect.left - r.right);
        const dy = Math.max(0, r.top - exitRect.bottom, exitRect.top - r.bottom);
        const dist = Math.hypot(dx, dy);
        if (dist < minDistanceToExit) minDistanceToExit = dist;
      }

      const scrollTextEl = document.querySelector('#btn-gig-scroll-toggle span');
      return {
        hudLeft: Math.round(hudRect.left),
        hudRight: Math.round(hudRect.right),
        exitTop: Math.round(exitRect.top),
        exitRight: Math.round(exitRect.right),
        minDistanceToExit: Math.round(minDistanceToExit),
        prevVis: isVis(document.getElementById('btn-gig-prev-song')),
        nextVis: isVis(document.getElementById('btn-gig-next-song')),
        zoomOutVis: isVis(document.getElementById('btn-gig-zoom-out')),
        zoomInVis: isVis(document.getElementById('btn-gig-zoom-in')),
        scrollLabelVis: isVis(scrollTextEl),
      };
    });

    expect(audit390.hudLeft).toBeGreaterThanOrEqual(0);
    expect(audit390.hudRight).toBeLessThanOrEqual(390);
    expect(audit390.exitTop).toBeLessThanOrEqual(80);
    expect(audit390.minDistanceToExit).toBeGreaterThanOrEqual(100);
    expect(audit390.prevVis).toBe(true);
    expect(audit390.nextVis).toBe(true);
    expect(audit390.zoomOutVis).toBe(true);
    expect(audit390.zoomInVis).toBe(true);
    expect(audit390.scrollLabelVis).toBe(true);

    await ctx390.close();
  });
});
