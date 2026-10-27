const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://127.0.0.1:8922/sheetapp2/';

test.describe('M4-6 Â· Gig HUD co vá»«a 360â€“1024; nÃºt ThoÃ¡t á»Ÿ gÃ³c trÃªn tÃ¡ch khá»i cá»¥m Ä‘iá»u khiá»ƒn; thÃªm â—€ â–¶ vÃ  zoom á»Ÿ Ä‘iá»‡n thoáº¡i', () => {
  test('M4-6 768 portrait HUD & exit fit inside viewport; 390 exit separated at top corner + nav & zoom visible', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-6 nghiá»‡m thu trÃªn WebKit');
    test.setTimeout(60000);

    // 1. 768x1024 dá»c
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

    // 2. 390x844 Ä‘iá»‡n thoáº¡i
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

test.describe('M4-7 Â· VÃ¹ng cháº¡m láº­t trang mÃ©p trÃ¡i/pháº£i trÃªn báº£n nháº¡c (cáº£ hai giao diá»‡n), khÃ´ng xung Ä‘á»™t cháº¡m vÃ o ná»‘t (dÃ¹ng PointerTap)', () => {
  test('M4-7 Modern & Classic: tap note in middle does not turn page; tap right edge turns to next page', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-7 nghiá»‡m thu trÃªn WebKit');
    test.setTimeout(60000);

    for (const uiPath of ['?song=thanh-ca-001&v=sheet', 'old/?song=thanh-ca-001']) {
      const context = await browser.newContext({
        viewport: { width: 768, height: 500 },
        isMobile: true,
        hasTouch: true,
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });

      await page.goto(BASE_URL + uiPath, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.evaluate(() => window.PageNav?.computePages?.());

      const beforeTapNote = await page.evaluate(() => ({
        page: window.PageNav?.getCurrentPage?.() || 1,
        total: window.PageNav?.getTotalPages?.() || 1,
        scrollTop: document.querySelector('.sheet-viewer-wrapper')?.scrollTop || 0,
      }));
      expect(beforeTapNote.total, `${uiPath} should have >= 2 pages`).toBeGreaterThanOrEqual(2);

      // Cháº¡m ná»‘t nháº¡c á»Ÿ giá»¯a mÃ n hÃ¬nh -> khÃ´ng Ä‘Æ°á»£c láº­t trang
      const noteBox = await page.evaluate(() => {
        const notes = Array.from(document.querySelectorAll('#osmd-container svg .vf-stavenote, #osmd-container svg path'));
        const midNote = notes.find(el => {
          const r = el.getBoundingClientRect();
          return r.left > 200 && r.right < 560 && r.top > 120 && r.bottom < 400 && r.width > 2 && r.height > 2;
        });
        if (!midNote) return { x: 384, y: 250 };
        const r = midNote.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      });
      await page.touchscreen.tap(noteBox.x, noteBox.y);
      await page.waitForTimeout(150);

      const afterTapNote = await page.evaluate(() => ({
        page: window.PageNav?.getCurrentPage?.() || 1,
        scrollTop: document.querySelector('.sheet-viewer-wrapper')?.scrollTop || 0,
      }));
      expect(afterTapNote.page, `${uiPath} tap note should stay on page 1`).toBe(1);
      expect(afterTapNote.scrollTop, `${uiPath} tap note should not scroll`).toBe(0);

      // Cháº¡m mÃ©p pháº£i (#edge-tap-next) -> sang trang 2
      const nextEdge = page.locator('#edge-tap-next');
      await expect(nextEdge, `${uiPath} #edge-tap-next visible`).toBeVisible();
      await nextEdge.tap();
      await page.waitForTimeout(150);

      const afterRightEdge = await page.evaluate(() => ({
        page: window.PageNav?.getCurrentPage?.() || 1,
        scrollTop: document.querySelector('.sheet-viewer-wrapper')?.scrollTop || 0,
      }));
      expect(afterRightEdge.page, `${uiPath} tap right edge should advance to page 2`).toBe(2);
      expect(afterRightEdge.scrollTop, `${uiPath} tap right edge should scroll down`).toBeGreaterThan(0);

      await context.close();
    }
  });
});
