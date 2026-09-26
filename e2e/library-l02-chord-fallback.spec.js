// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l02-chord-fallback.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-2 (ROADMAP 4):
 * 1. Bài thanh-ca-002 (HD rỗng 0 hợp âm, XML có 33 hợp âm):
 *    - Chip hợp âm hiện "HD chưa có · đang hiện TLH"
 *    - Bản nhạc không bị chèn CSS ẩn, hiển thị đầy đủ ≥ 20 hợp âm TLH.
 * 2. Bài thanh-ca-001 (HD có 3 hợp âm, XML có 17 hợp âm, tỉ lệ < 30% - Quyết định L-D1):
 *    - Chip hợp âm hiện "HD còn thiếu — xem TLH"
 *    - Bấm 1 chạm vào chip -> chuyển sang TLH (gốc) đầy đủ.
 * 3. Đảm bảo trạng thái getChordStatus phản ánh chính xác fallback và sparse.
 */

test.describe('Ticket L0-2: Dự phòng HD rỗng → TLH (Core Rule 1) & Quyết định L-D1', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Browser ${msg.type()}]:`, msg.text());
      }
    });
    page.on('pageerror', err => console.log(`[Browser PageError]:`, err.message));

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Bài 002: Tự động fallback sang TLH khi HD rỗng (Core Rule 1)', async ({ page }) => {
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    // Đóng modal auth nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // Chờ bản nhạc SVG xuất hiện
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // Chip hợp âm phải hiện: "HD chưa có · đang hiện TLH"
    const chip002 = page.locator('#si-chord-set-chip');
    await expect(chip002).toBeVisible({ timeout: 10000 });
    await expect(chip002).toContainText('HD chưa có · đang hiện TLH');
    await expect(chip002).toHaveClass(/si-chord-fallback/);

    // Kiểm tra trạng thái từ ChordCanvas
    const status002 = await page.evaluate(() => window.ChordCanvas?.getChordStatus?.());
    expect(status002?.isFallback, 'Bài 002 phải có cờ isFallback = true').toBe(true);
    expect(status002?.customCount, 'Bộ HD của bài 002 phải có 0 hợp âm').toBe(0);
    expect(status002?.xmlCount, 'XML bài 002 phải có hợp âm').toBeGreaterThanOrEqual(20);

    // Kiểm tra bản nhạc không bị ẩn hợp âm: style cc-custom-style phải rỗng
    const customStyleContent = await page.evaluate(() => {
      const el = document.getElementById('cc-custom-style');
      return el ? el.textContent.trim() : '';
    });
    expect(customStyleContent, 'Style ẩn hợp âm MusicXML phải rỗng khi fallback').toBe('');

    // Inspect chordSymbolContainers
    const chordContainerInfo = await page.evaluate(() => {
      const osmd = window.OSMDRenderer?.getInstance?.();
      const ml = osmd?.graphic?.measureList;
      if (!ml) return { error: 'no ml' };
      const samples = [];
      for (const m of ml) {
        for (const s of m) {
          for (const se of s.staffEntries || []) {
            if (se.chordSymbolContainers && se.chordSymbolContainers.length > 0) {
              for (const csc of se.chordSymbolContainers) {
                samples.push({
                  keys: Object.keys(csc),
                  labelKeys: csc.graphicalLabel ? Object.keys(csc.graphicalLabel) : null,
                  svgKeys: csc.graphicalLabel?.svgElement ? Object.keys(csc.graphicalLabel.svgElement) : null,
                  svgTag: csc.graphicalLabel?.svgElement?.tagName,
                  svgClass: csc.graphicalLabel?.svgElement?.getAttribute('class'),
                  labelString: csc.graphicalLabel?.LabelString || csc.graphicalLabel?.labelString || csc.chordSymbolText
                });
                if (samples.length >= 3) break;
              }
            }
            if (samples.length >= 3) break;
          }
          if (samples.length >= 3) break;
        }
        if (samples.length >= 3) break;
      }
      return { totalSamples: samples.length, samples };
    });
    console.log('ChordContainerInfo:', JSON.stringify(chordContainerInfo, null, 2));
  });

  test('Bài 001: HD thưa (<30%) hiển thị cảnh báo theo Quyết định L-D1', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // Chip hợp âm phải hiện: "HD còn thiếu — xem TLH"
    const chip001 = page.locator('#si-chord-set-chip');
    await expect(chip001).toBeVisible({ timeout: 10000 });
    await expect(chip001).toContainText('HD còn thiếu — xem TLH');
    await expect(chip001).toHaveClass(/si-chord-sparse/);

    const status001 = await page.evaluate(() => window.ChordCanvas?.getChordStatus?.());
    expect(status001?.isSparse, 'Bài 001 phải có cờ isSparse = true').toBe(true);

    // Bấm 1 chạm vào chip để đổi sang TLH (gốc)
    await chip001.click();

    // Sau khi click: bộ chuyển sang TLH (gốc)
    await expect(chip001).toContainText('TLH (gốc)');
    const currentSetAfterClick = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(currentSetAfterClick, 'Sau khi click chip sparse, phải chuyển sang set default').toBe('default');
  });
});
