// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-default-chordset-hd.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-2 (ROADMAP 4):
 * Bộ hợp âm mặc định là "HD" (Hướng Dẫn), không phải "Bản Gốc":
 *  1. Khi vào bài (kể cả lần đầu tiên mở):
 *     - Dropdown chọn bộ hợp âm mặc định là "HD".
 *     - Tuyệt đối không chọn "Bản Gốc" (default) làm mặc định.
 *  2. Chuyển bài:
 *     - Khi chuyển từ bài A sang bài B, bộ hợp âm được giữ ở "HD".
 *     - Không có trường hợp nào dropdown tự chuyển về "Bản Gốc" trừ khi người dùng chủ động chọn.
 */

test.describe('L1-2 · Bộ hợp âm mặc định là HD (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Mở bài lần đầu: dropdown chọn bộ hợp âm là HD', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const selector = page.locator('#chord-set-selector');
    await expect(selector).toBeVisible();

    const selectedValue = await selector.inputValue();
    expect(selectedValue).toBe('HD');

    const currentSet = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(currentSet).toBe('HD');
  });

  test('2. Chuyển sang bài khác: dropdown vẫn giữ bộ hợp âm là HD', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đổi bài bằng Shift + ArrowDown
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(1000);

    // Chờ render xong bài mới
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const selector = page.locator('#chord-set-selector');
    const selectedValue = await selector.inputValue();
    expect(selectedValue).toBe('HD');

    const currentSet = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(currentSet).toBe('HD');
  });

  test('3. Mở trực tiếp bài khác qua URL param: vẫn chọn HD', async ({ page }) => {
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const selector = page.locator('#chord-set-selector');
    const selectedValue = await selector.inputValue();
    expect(selectedValue).toBe('HD');

    const currentSet = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(currentSet).toBe('HD');
  });

});
