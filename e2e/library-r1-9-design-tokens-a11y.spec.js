// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/**
 * e2e/library-r1-9-design-tokens-a11y.spec.js
 *
 * Kiểm thử E2E cho Ticket R1-9 (Design System Tokens & A11y Contrast):
 * 1. Axe-core scan: 0 vi phạm mức serious/critical ở cả 2 chế độ Sáng và Tối.
 * 2. Kích thước & typography:
 *    - Nút trên desktop đạt chiều cao 32px (--lp-h).
 *    - Bo góc nút 8px (--lp-radius).
 *    - Toàn bộ chữ phụ (secondary text) đạt cỡ chữ >= 12px.
 * 3. Chip trung tính & Dark Mode:
 *    - Không có chip trắng trong dark-mode.
 *    - Section chips, song key badges, quick-jump-btns sử dụng tông màu trung tính và độ tương phản cao.
 */

test.describe('R1-9 · Design System Tokens, Neutral Chips & A11y Contrast', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Axe-core scan trong Chế độ Sáng (Light Mode): 0 vi phạm serious/critical', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const axeResults = await new AxeBuilder({ page })
      .include(['#main', '#toolbar', '#section-jump-bar-container', '.sidebar'])
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    if (seriousOrCritical.length > 0) {
      console.error('Light Mode Axe violations:', JSON.stringify(seriousOrCritical, null, 2));
    }

    expect(seriousOrCritical).toHaveLength(0);
  });

  test('2. Axe-core scan trong Chế độ Tối (Dark Mode): 0 vi phạm serious/critical', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kích hoạt Dark Mode
    await page.evaluate(() => {
      document.body.classList.add('dark-mode');
    });

    const axeResults = await new AxeBuilder({ page })
      .include(['#main', '#toolbar', '#section-jump-bar-container', '.sidebar'])
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    if (seriousOrCritical.length > 0) {
      console.error('Dark Mode Axe violations:', JSON.stringify(seriousOrCritical, null, 2));
    }

    expect(seriousOrCritical).toHaveLength(0);
  });

  test('3. Kích thước điều khiển & Bo góc (Button height 32px desktop, radius 8px)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const buttonDimensions = await page.evaluate(() => {
      const pill = document.querySelector('.unified-toolbar .band-pill');
      if (!pill) return null;
      const cs = window.getComputedStyle(pill);
      return {
        height: parseFloat(cs.height),
        borderRadius: parseFloat(cs.borderRadius),
      };
    });

    expect(buttonDimensions).not.toBeNull();
    if (buttonDimensions) {
      expect(buttonDimensions.height).toBe(32);
      expect(buttonDimensions.borderRadius).toBe(8);
    }
  });

  test('4. Typography audit: Mọi chữ phụ đạt cỡ chữ >= 12px', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const fontSizes = await page.evaluate(() => {
      const getFontSize = (selector) => {
        const el = document.querySelector(selector);
        return el ? parseFloat(window.getComputedStyle(el).fontSize) : null;
      };

      return {
        songKeyBadge: getFontSize('.unified-toolbar .song-key-badge'),
        songItemNum: getFontSize('.song-item-num'),
        quickJumpLabel: getFontSize('.quick-jump-label'),
        quickJumpBtn: getFontSize('.quick-jump-btn'),
        toolsHeader: getFontSize('#main-dropdown-menu .menu-section-header'),
      };
    });

    // Mọi chữ phụ phải >= 12px
    if (fontSizes.songKeyBadge !== null) {
      expect(fontSizes.songKeyBadge).toBeGreaterThanOrEqual(12);
    }
    if (fontSizes.songItemNum !== null) {
      expect(fontSizes.songItemNum).toBeGreaterThanOrEqual(12);
    }
    if (fontSizes.quickJumpLabel !== null) {
      expect(fontSizes.quickJumpLabel).toBeGreaterThanOrEqual(12);
    }
    if (fontSizes.quickJumpBtn !== null) {
      expect(fontSizes.quickJumpBtn).toBeGreaterThanOrEqual(12);
    }
    if (fontSizes.toolsHeader !== null) {
      expect(fontSizes.toolsHeader).toBeGreaterThanOrEqual(12);
    }
  });

  test('5. Chip trung tính & Không còn chip trắng trong Dark Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kích hoạt Dark Mode
    await page.evaluate(() => {
      document.body.classList.add('dark-mode');
    });

    const darkChipColors = await page.evaluate(() => {
      const checkBg = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return cs.backgroundColor;
      };

      return {
        songKeyBadge: checkBg('.unified-toolbar .song-key-badge'),
        quickJumpBtn: checkBg('.quick-jump-btn'),
      };
    });

    // Không phần tử nào có màu nền trắng hoàn toàn (rgb(255, 255, 255))
    if (darkChipColors.songKeyBadge) {
      expect(darkChipColors.songKeyBadge).not.toBe('rgb(255, 255, 255)');
    }
    if (darkChipColors.quickJumpBtn) {
      expect(darkChipColors.quickJumpBtn).not.toBe('rgb(255, 255, 255)');
    }
  });

});
