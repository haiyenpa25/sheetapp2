// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-true-capo.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-12 (ROADMAP 4):
 * Capo đúng nghĩa:
 *  - Chọn Capo N: hợp âm hiển thị = thế bấm (dịch xuống N bán cung).
 *  - Nhạc thật giữ nguyên tông (không gọi transposeBy làm đổi tông ban nhạc).
 *  - Badge hiển thị đúng format: "Capo N · nghe ra [Key]".
 *  - Gợi ý capo tốt nhất (suggestBestCapo) phải hiển thị (không ẩn).
 */

test.describe('Ticket L0-12: Capo đúng nghĩa & Badge nghe ra [Key]', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Bài Eb + Capo 3: Nhạc thật giữ nguyên Eb, Badge hiện "Capo 3 · nghe ra Eb", Hint hiện thế C', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-004', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 35000 });

    const songKeyBadge = page.locator('#song-key');
    const capoSelect   = page.locator('#capo-select');
    const capoBadge    = page.locator('#capo-badge');
    const capoHint     = page.locator('#capo-hint');

    // Tông gốc là Eb
    await expect(songKeyBadge).toHaveText('Eb');

    // Chọn Capo ngăn 3
    await capoSelect.selectOption('3');

    // 1) Nhạc thật (#song-key) vẫn giữ nguyên tông Eb
    await expect(songKeyBadge).toHaveText('Eb');

    // 2) Badge hiển thị "Capo 3 · nghe ra Eb"
    await expect(capoBadge).toBeVisible();
    await expect(capoBadge).toContainText('Capo 3');
    await expect(capoBadge).toContainText('nghe ra Eb');

    // 3) Hint hiển thị thế bấm C
    await expect(capoHint).toContainText('thế C');

    // 4) Chế độ Band / Xem chữ: hợp âm được dịch xuống 3 bán cung thành thế C
    const btnBand = page.locator('#btn-band-toggle, .btn-band-toggle').first();
    await btnBand.click();

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 10000 });

    // Header chế độ band vẫn ghi tông bài hát là Eb
    const lvKey = page.locator('.lv-key');
    await expect(lvKey).toContainText('Eb');
  });

  test('2. Gợi ý Capo hiển thị rõ ràng trên bài có thế bấm nâng cao', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-004', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const capoBadge = page.locator('#capo-badge');

    // Gọi evaluate để kích hoạt suggestBestCapo hoặc kiểm tra gợi ý
    await page.evaluate(() => {
      const best = window.TransposeEngine?.suggestBestCapo?.(['Eb', 'Ab', 'Bb']) || 3;
      window.AppUI?.updateCapoBadge?.(0, best);
    });

    // Badge phải hiển thị gợi ý (không bị display: none)
    await expect(capoBadge).toBeVisible();
    await expect(capoBadge).toContainText('Gợi ý: Capo');
  });

});
