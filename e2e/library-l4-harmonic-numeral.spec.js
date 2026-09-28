// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-harmonic-numeral.spec.js
 *
 * Nghiệm thu Ticket L4-7 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Tuỳ chọn hiển thị hợp âm dạng số La Mã / Nashville (I–IV–V / 1–4–5).
 * 2. Đổi nhanh bằng nút #btn-chord-notation trên toolbar.
 * 3. Đổi nhanh bằng phím tắt 'N'.
 * 4. Chế độ Band hiển thị hợp âm quy đổi tương ứng (Standard → Roman → Nashville → Standard).
 * 5. Bảo toàn thiết lập qua reload trang (localStorage 'sheetapp_chord_notation').
 */

test.describe('L4-7: Harmonic Numeral (Roman & Nashville Chords I–IV–V / 1–4–5)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Chuyển đổi ký hiệu hợp âm Chuẩn ↔ Số La Mã ↔ Nashville và bảo toàn qua reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    // Đảm bảo trạng thái ban đầu là Standard
    await page.evaluate(() => {
      localStorage.removeItem('sheetapp_chord_notation');
      window.HarmonicNumeral?.setNotationStyle?.('standard', false);
    });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    const notationBtn = page.locator('#btn-chord-notation');
    await expect(notationBtn).toBeVisible({ timeout: 5000 });

    // 1. Trạng thái ban đầu: Standard (hợp âm chữ C, G, Am...)
    const initialLabel = page.locator('#chord-notation-label');
    await expect(initialLabel).toHaveText('C');
    await expect(notationBtn).not.toHaveClass(/active/);

    const firstChordEl = lyricContainer.locator('.lv-chord[data-chord]').first();
    await expect(firstChordEl).toBeVisible({ timeout: 5000 });
    const standardChord = (await firstChordEl.getAttribute('data-chord')) || '';
    expect(standardChord.length).toBeGreaterThan(0);
    // Hợp âm chữ ban đầu phải bắt đầu bằng chữ cái nốt nhạc A-G
    expect(standardChord).toMatch(/^[A-G]/);

    // 2. Click nút đổi sang Số La Mã (Roman Numerals)
    await notationBtn.click();
    await expect(initialLabel).toHaveText('I-V');
    await expect(notationBtn).toHaveClass(/active/);

    // Hợp âm trên Band view phải đổi thành số La Mã (I, ii, iii, IV, V, vi, vii°)
    await expect(async () => {
      const romanChord = await firstChordEl.getAttribute('data-chord');
      expect(romanChord).toMatch(/^(b?[I|V|i|v]+|#?[I|V|i|v]+)/);
    }).toPass({ timeout: 5000 });

    // 3. Click tiếp sang Nashville Numbers
    await notationBtn.click();
    await expect(initialLabel).toHaveText('1-5');
    await expect(notationBtn).toHaveClass(/active/);

    // Hợp âm trên Band view phải đổi thành số Nashville (1, 2m, 3m, 4, 5, 6m, 7dim)
    await expect(async () => {
      const nashChord = await firstChordEl.getAttribute('data-chord');
      expect(nashChord).toMatch(/^(b?[1-7]|#?[1-7])/);
    }).toPass({ timeout: 5000 });

    // 4. Click lần thứ ba quay về Standard
    await notationBtn.click();
    await expect(initialLabel).toHaveText('C');
    await expect(notationBtn).not.toHaveClass(/active/);
    await expect(async () => {
      const restoredChord = await firstChordEl.getAttribute('data-chord');
      expect(restoredChord).toBe(standardChord);
    }).toPass({ timeout: 5000 });

    // 5. Thử chuyển đổi bằng phím tắt 'N'
    await page.keyboard.press('n');
    await expect(initialLabel).toHaveText('I-V');
    await expect(notationBtn).toHaveClass(/active/);

    // 6. Kiểm tra lưu trữ và bảo toàn qua reload trang
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    const reloadedBtn = page.locator('#btn-chord-notation');
    const reloadedLabel = page.locator('#chord-notation-label');
    await expect(reloadedBtn).toBeVisible({ timeout: 5000 });
    await expect(reloadedLabel).toHaveText('I-V');
    await expect(reloadedBtn).toHaveClass(/active/);

    const reloadedChordEl = lyricContainer.locator('.lv-chord[data-chord]').first();
    await expect(async () => {
      const reloadedChord = await reloadedChordEl.getAttribute('data-chord');
      expect(reloadedChord).toMatch(/^(b?[I|V|i|v]+|#?[I|V|i|v]+)/);
    }).toPass({ timeout: 5000 });
  });

});
