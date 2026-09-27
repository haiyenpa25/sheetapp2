// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l011-unified-key-display.spec.js
 * E2E tests for Ticket L0-11:
 * Tên tông thống nhất: một hàm duy nhất KeyService.displayKey(fifths, semis)
 * dùng cho badge, thanh thông tin, chế độ xem chữ và HUD; theo quy tắc tông giáng/thăng.
 *
 * Kiểm tra:
 * 1. Bài 001 (tông G): ban đầu hiển thị G ở 3 vị trí (badge, song-info-bar, gig-hud).
 * 2. Transpose +1 -> G+1 hiển thị "Ab" (không phải G#) ở cả 4 vị trí (badge, song-info, gig-hud, lyric view).
 * 3. Bài 002 (tông F): transpose +1 -> hiển thị "Gb" (không phải F#).
 * 4. Bài 003 (tông Eb): transpose -1 -> hiển thị "D".
 */

test.describe('L0-11: Unified Key Display (KeyService)', () => {
  test.setTimeout(60000);

  test('Song 001 (G) transposed +1 shows Ab across Toolbar, SongInfoBar, Stage HUD, and Lyric View', async ({ page }) => {
    await page.goto('/sheetapp2/?song=thanh-ca-001');
    await page.waitForSelector('#sheet-area svg', { timeout: 25000 });

    const songKey = page.locator('#song-key');
    const siToneChip = page.locator('#si-tone-chip');
    const gigHudKey = page.locator('#gig-hud-key');

    // Tông gốc G
    await expect(songKey).toHaveText('G');
    await expect(gigHudKey).toHaveText('G');
    await expect(siToneChip).toContainText('G');

    // Thực hiện dịch giọng +1
    await page.evaluate(() => {
      if (window.App && typeof window.App.transpose === 'function') {
        window.App.transpose(1);
      } else if (window.Store) {
        window.Store.set('currentTranspose', 1);
        const curSong = window.Store.get('currentSong');
        window.AppUI?.updateSongInfo?.(curSong, 1);
        window.SongInfoBar?.updateTranspose?.(1);
      }
    });

    // Chờ UI cập nhật sau transpose
    await page.waitForTimeout(500);

    // 1. Toolbar key badge
    await expect(songKey).toHaveText('Ab');

    // 2. Stage HUD key
    await expect(gigHudKey).toHaveText('Ab');

    // 3. SongInfoBar chip
    await expect(siToneChip).toContainText('Tập: Ab');

    // 4. Mở Chế độ xem chữ (Lyric View)
    await page.evaluate(() => {
      const xml = window.App?.getOriginalXml?.() || '';
      window.LyricExtractor?.render?.('lyric-view-container', xml, 1);
      document.getElementById('lyric-view-container')?.classList.remove('hidden');
    });

    const lvKey = page.locator('.lv-key');
    if (await lvKey.count() > 0) {
      await expect(lvKey).toContainText('Ab');
    }
  });

  test('Song 007 (F) + 1 shows Gb, Song 004 (Eb) - 1 shows D', async ({ page }) => {
    // 1. Song 007 (F)
    await page.goto('/sheetapp2/?song=thanh-ca-007');
    await page.waitForSelector('#sheet-area svg', { timeout: 25000 });

    const songKey = page.locator('#song-key');
    const siToneChip = page.locator('#si-tone-chip');
    const gigHudKey = page.locator('#gig-hud-key');

    await expect(songKey).toHaveText('F');

    // Transpose +1
    await page.evaluate(() => {
      if (window.App && typeof window.App.transpose === 'function') {
        window.App.transpose(1);
      } else if (window.Store) {
        window.Store.set('currentTranspose', 1);
        const curSong = window.Store.get('currentSong');
        window.AppUI?.updateSongInfo?.(curSong, 1);
        window.SongInfoBar?.updateTranspose?.(1);
      }
    });

    await page.waitForTimeout(500);
    await expect(songKey).toHaveText('Gb');
    await expect(gigHudKey).toHaveText('Gb');
    await expect(siToneChip).toContainText('Tập: Gb');

    // 2. Song 004 (Eb)
    await page.goto('/sheetapp2/?song=thanh-ca-004');
    await page.waitForSelector('#sheet-area svg', { timeout: 25000 });

    await expect(songKey).toHaveText('Eb');

    // Transpose -1
    await page.evaluate(() => {
      if (window.App && typeof window.App.transpose === 'function') {
        window.App.transpose(-1);
      } else if (window.Store) {
        window.Store.set('currentTranspose', -1);
        const curSong = window.Store.get('currentSong');
        window.AppUI?.updateSongInfo?.(curSong, -1);
        window.SongInfoBar?.updateTranspose?.(-1);
      }
    });

    await page.waitForTimeout(500);
    await expect(songKey).toHaveText('D');
    await expect(gigHudKey).toHaveText('D');
    await expect(siToneChip).toContainText('Tập: D');
  });
});
