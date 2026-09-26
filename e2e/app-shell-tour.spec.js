// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E test cho Ticket T19: App Shell toàn diện trên mọi phân hệ
 *
 * Kiểm tra chuyến tham quan App Shell qua tất cả các trang:
 * 1. Thư viện (/)
 * 2. Biểu diễn (/live-band/)
 * 3. Tập luyện (/learn/)
 * 4. Quản lý (/manager/)
 * 5. Hướng dẫn (/huong-dan/)
 * 6. Visual Editor (/editor/)
 *
 * Tiêu chí nghiệm thu:
 * - Mọi trang đều có #app-shell-navbar visible và các thành phần cốt lõi.
 * - Có sẵn window.AppShell và window.ModalManager.
 * - Console sạch sẽ (0 fatal JS error/exception).
 * - Riêng Projector (/projector.php) cố ý KHÔNG có App Shell để phục vụ hiển thị màn hình lớn sạch.
 */

test.describe('Ticket T19: App Shell Tour & Integration Across All Surfaces', () => {
  const surfaces = [
    { name: 'Thư Viện', url: './', expectedPillar: 'library' },
    { name: 'Biểu Diễn (Live Band)', url: './live-band/', expectedPillar: 'live' },
    { name: 'Tập Luyện (Learn Studio)', url: './learn/?song=thanh-ca-090', expectedPillar: 'learn' },
    { name: 'Quản Lý (Manager)', url: './manager/', expectedPillar: 'manager' },
    { name: 'Hướng Dẫn (Documentation)', url: './huong-dan/', expectedPillar: 'guide' },
    { name: 'Biên Tập Nốt (Visual Editor)', url: './editor/', expectedPillar: 'editor' },
  ];

  for (const surface of surfaces) {
    test(`Trang ${surface.name} (${surface.url}) có App Shell navbar và console sạch`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          // Bỏ qua cảnh báo audio context chưa được bấm chuột
          if (msg.text().includes('AudioContext') || msg.text().includes('user gesture') || msg.text().includes('favicon')) return;
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      await page.goto(surface.url, { waitUntil: 'domcontentloaded' });

      // 1. Kiểm tra #app-shell-navbar hiện diện và hiển thị
      const nav = page.locator('#app-shell-navbar');
      await expect(nav).toBeVisible({ timeout: 10000 });

      // 2. Kiểm tra các tab trụ cột cốt lõi
      await expect(page.locator('#pillar-library')).toBeAttached();
      await expect(page.locator('#pillar-live')).toBeAttached();
      await expect(page.locator('#pillar-learn')).toBeAttached();
      await expect(page.locator('#pillar-manager')).toBeAttached();

      // 3. Kiểm tra Nút trợ giúp Context Help
      const helpBtn = page.locator('#shell-context-help-btn');
      await expect(helpBtn).toBeAttached();

      // 4. Kiểm tra đối tượng window.AppShell và window.ModalManager
      const hasCoreGlobals = await page.evaluate(() => {
        return {
          hasAppShell: typeof window.AppShell !== 'undefined',
          hasModalManager: typeof window.ModalManager !== 'undefined',
        };
      });

      expect(hasCoreGlobals.hasAppShell).toBe(true);
      expect(hasCoreGlobals.hasModalManager).toBe(true);

      // 5. Console không có lỗi JS
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  test('Projector (/projector.php) cố ý KHÔNG có App Shell', async ({ page }) => {
    await page.goto('./projector.php', { waitUntil: 'domcontentloaded' });
    const nav = page.locator('#app-shell-navbar');
    await expect(nav).toHaveCount(0);
  });
});
