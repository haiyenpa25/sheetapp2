// @ts-check
// e2e/m5-shared-core.spec.js — Stage M5 E2E verification for shared cores & feature parity
const { test, expect, devices } = require('@playwright/test');

const BASE_URL = (process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost:8922/sheetapp2/').replace(/\/+$/, '');

for (const ui of [
  { name: 'Modern', path: '/' },
  { name: 'Classic', path: '/old/' },
]) {
  test(`M5 (${ui.name}): shared cores loaded and Song Pin + Chord Highlight parity works on mobile`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M5 nghiệm thu trên iPhone 13 WebKit');
    test.setTimeout(40000);

    const context = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL + '/',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    try {
      await page.goto(`${BASE_URL}${ui.path}?song=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () =>
          Boolean(
            window.AppRules &&
              window.SongLoaderCore &&
              window.OSMDRenderCore &&
              window.LibraryData &&
              window.ChordCanvasCore &&
              window.LibraryUI &&
              window.ChordCanvas
          ),
        null,
        { timeout: 15000 }
      );

      const coreStats = await page.evaluate(() => ({
        minTranspose: window.AppRules.MIN_TRANSPOSE,
        maxTranspose: window.AppRules.MAX_TRANSPOSE,
        clampLow: window.AppRules.clampTranspose(-24),
        clampHigh: window.AppRules.clampTranspose(24),
        hasSongLoaderCore: typeof window.SongLoaderCore.loadXml === 'function',
        hasOSMDRenderCore: typeof window.OSMDRenderCore.enqueueRender === 'function',
        hasLibraryData: typeof window.LibraryData.resolveSong === 'function',
        hasChordCanvasCore: typeof window.ChordCanvasCore.loadChordSet === 'function',
        hasTogglePin: typeof window.LibraryUI.togglePin === 'function',
        hasToggleHighlight: typeof window.ChordCanvas.toggleHighlight === 'function',
      }));

      expect(coreStats.minTranspose).toBe(-12);
      expect(coreStats.maxTranspose).toBe(12);
      expect(coreStats.clampLow).toBe(-12);
      expect(coreStats.clampHigh).toBe(12);
      expect(coreStats.hasSongLoaderCore).toBe(true);
      expect(coreStats.hasOSMDRenderCore).toBe(true);
      expect(coreStats.hasLibraryData).toBe(true);
      expect(coreStats.hasChordCanvasCore).toBe(true);
      expect(coreStats.hasTogglePin).toBe(true);
      expect(coreStats.hasToggleHighlight).toBe(true);

      // Test Song Pin parity
      const pinResult = await page.evaluate(async () => {
        if (!window.LibraryUI.getSongs || window.LibraryUI.getSongs().length === 0) {
          await window.LibraryUI.loadSongs();
        }
        const firstId = window.LibraryUI.getSongs()[0]?.id || '1';
        window.LibraryUI.togglePin(firstId);
        const bar = document.getElementById('quick-pin-bar');
        const pinnedAfterAdd = window.LibraryUI.isPinned(firstId);
        const barVisible = bar ? !bar.classList.contains('hidden') : false;
        window.LibraryUI.togglePin(firstId);
        const pinnedAfterRemove = window.LibraryUI.isPinned(firstId);
        return { pinnedAfterAdd, barVisible, pinnedAfterRemove };
      });
      expect(pinResult.pinnedAfterAdd).toBe(true);
      expect(pinResult.barVisible).toBe(true);
      expect(pinResult.pinnedAfterRemove).toBe(false);

      // Test Chord Highlight parity
      const highlightResult = await page.evaluate(() => {
        window.ChordCanvas.setHighlightMode(false);
        window.ChordCanvas.toggleHighlight();
        const afterFirst = window.ChordCanvas.isHighlightMode();
        const btn =
          document.getElementById('btn-menu-chord-highlight') ||
          document.getElementById('btn-chord-highlight');
        const btnActive = btn ? btn.classList.contains('active') : false;
        window.ChordCanvas.toggleHighlight();
        const afterSecond = window.ChordCanvas.isHighlightMode();
        return { afterFirst, btnActive, afterSecond };
      });
      expect(highlightResult.afterFirst).toBe(true);
      expect(highlightResult.btnActive).toBe(true);
      expect(highlightResult.afterSecond).toBe(false);
    } finally {
      await context.close();
    }
  });
}
