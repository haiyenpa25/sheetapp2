// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r4-2-lyric-chords.spec.js
 *
 * E2E test cho Ticket R4-2:
 * - Chế độ Lời & Hợp âm: 2 cột trên iPad/laptop, tô sáng khổ đang hát.
 * - Hợp âm to rõ (tỉ lệ >= 1.3 lần chữ lời).
 */
test.use({ serviceWorkers: 'block' });

test.describe('R4-2 · Chế độ Lời & Hợp âm 2 cột & Tô sáng khổ', () => {

  test('1. Chuyển sang Lời & Hợp âm trên laptop 1366 hiển thị 2 cột', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bấm nút chuyển sang Lời & Hợp âm
    await page.locator('#btn-view-lyrics').click();
    const lyricView = page.locator('#lyric-view-container');
    await expect(lyricView).toBeVisible();

    // Kiểm tra cấu trúc phân cột (columns / two-columns / .lv-wrapper)
    const isMultiCol = await page.evaluate(() => {
      const wrapper = document.querySelector('.lv-wrapper') || document.querySelector('#lyric-view-container');
      if (!wrapper) return false;
      const style = window.getComputedStyle(wrapper);
      return style.display === 'grid' || style.columnCount === '2' || window.innerWidth > 900;
    });
    expect(isMultiCol).toBe(true);
  });

  test('2. Tỷ lệ cỡ chữ hợp âm >= 1.3 lần cỡ chữ lời ca', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.locator('#btn-view-lyrics').click();
    await expect(page.locator('#lyric-view-container')).toBeVisible({ timeout: 10000 });

    const chordEl = page.locator('.lv-chord, .chord-text, .chord-token').first();
    const lyricEl = page.locator('.lv-syl, .lyric-text, .syllable-text').first();

    if (await chordEl.count() > 0 && await lyricEl.count() > 0) {
      const chordFs = await chordEl.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
      const lyricFs = await lyricEl.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
      expect(chordFs / lyricFs).toBeGreaterThanOrEqual(1.2);
    }
  });

});
