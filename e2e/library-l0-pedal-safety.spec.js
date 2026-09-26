// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-pedal-safety.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-8 (ROADMAP 4):
 * Bàn đạp an toàn:
 *  - Ở chế độ Đọc và Sân khấu, ↑/↓ và PageUp/PageDown = lật trang / cuộn trang.
 *  - Không bao giờ nhảy bài giữa lúc đang chơi khi đạp bàn đạp (bấm ↓).
 *  - Đổi bài bằng phím tắt chỉ kích hoạt khi nhấn tổ hợp Shift + ↑/↓.
 *  - Tốc độ tự cuộn mặc định là 1×.
 *
 * Nghiệm thu:
 *  - E2E: bấm ↓ 3 lần, bài không đổi, trang cuộn xuống.
 *  - Bấm Shift+↓: đổi sang bài tiếp theo.
 *  - Tốc độ cuộn mặc định = 1×.
 */

test.describe('Ticket L0-8: Bàn đạp an toàn & Tốc độ cuộn mặc định 1×', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Bấm ↓ 3 lần: bài không đổi, trang cuộn xuống', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const wrapper = page.locator('.sheet-viewer-wrapper');
    await expect(wrapper).toBeVisible();

    // Lấy vị trí scroll ban đầu
    const initialScrollTop = await wrapper.evaluate(el => el.scrollTop);
    expect(initialScrollTop).toBe(0);

    // Bấm phím ArrowDown 3 lần (như khi đạp bàn đạp cuộn trang)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(600);

    // Xác nhận bài hát KHÔNG bị đổi (vẫn là bài 001)
    const currentUrl = await page.evaluate(() => window.location.href);
    expect(currentUrl).toContain('song=thanh-ca-001');

    // Xác nhận trang đã được cuộn xuống
    const finalScrollTop = await wrapper.evaluate(el => el.scrollTop);
    expect(finalScrollTop).toBeGreaterThan(0);
  });

  test('2. Nhấn Shift+ArrowDown: đổi sang bài tiếp theo', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Nhấn tổ hợp Shift + ArrowDown
    await page.keyboard.press('Shift+ArrowDown');

    // Chờ bài hát đổi sang bài tiếp theo (thanh-ca-002)
    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('song') === 'thanh-ca-002';
    }, { timeout: 10000 });

    expect(await page.evaluate(() => new URL(window.location.href).searchParams.get('song'))).toBe('thanh-ca-002');
  });

  test('3. Tốc độ tự cuộn mặc định là 1×', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const scrollSpeedSelect = page.locator('#scroll-speed');
    const defaultSpeed = await scrollSpeedSelect.inputValue();
    expect(defaultSpeed).toBe('1');
  });

});
