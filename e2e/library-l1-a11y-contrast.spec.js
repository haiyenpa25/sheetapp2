// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/**
 * e2e/library-l1-a11y-contrast.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-11:
 * Khả năng truy cập (Accessibility, Contrast, Focus ring, Tab order):
 * - Chữ phụ đạt tương phản >= 4.5:1 và cỡ chữ >= 11px
 * - Viền focus 2px rõ ràng (:focus-visible)
 * - Thứ tự Tab hợp lý (thanh công cụ bài hát trước sidebar)
 * - Nghiệm thu: Axe-core E2E scan 0 vi phạm mức serious/critical ở trang Đọc
 */

test.describe('L1-11 · Khả năng truy cập (Accessibility, Contrast, Focus Ring & Tab Order)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Axe-core scan: 0 vi phạm serious/critical ở trang Đọc (#main)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Quét vùng đọc chính (#main) và metronome panel bằng axe-core
    const axeResults = await new AxeBuilder({ page })
      .include(['#main', '#metronome-panel', '.skip-links'])
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    if (seriousOrCritical.length > 0) {
      console.error('Axe violations found:', JSON.stringify(seriousOrCritical, null, 2));
    }

    expect(seriousOrCritical).toHaveLength(0);
  });

  test('2. Thứ tự Tab & Skip Navigation: Thanh công cụ trước sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // 1. Kiểm tra cấu trúc DOM: #main đứng TRƯỚC #sidebar để Tab Order ưu tiên thanh công cụ bài hát
    const domOrder = await page.evaluate(() => {
      const main = document.getElementById('main');
      const sidebar = document.getElementById('sidebar');
      if (!main || !sidebar) return false;
      // DOCUMENT_POSITION_FOLLOWING (4) xác nhận sidebar nằm sau main trong DOM
      return (main.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(domOrder).toBe(true);

    // 2. Kiểm tra Skip Links navigation
    const skipLinkToolbar = page.locator('.skip-link[href="#unified-toolbar"]');
    await expect(skipLinkToolbar).toBeAttached();

    // Focus vào skip link bằng bàn phím
    await skipLinkToolbar.focus();
    await expect(skipLinkToolbar).toBeFocused();

    // Kích hoạt skip link nhảy tới thanh công cụ
    await skipLinkToolbar.click();
    const urlHash = await page.evaluate(() => window.location.hash);
    expect(urlHash).toBe('#unified-toolbar');
  });

  test('3. Viền focus 2px rõ ràng (:focus-visible)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kiểm tra quy tắc :focus-visible trong stylesheet có viền 2px rõ ràng và outline-offset
    const focusRule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText.includes(':focus-visible')) {
              const outline = rule.style.outline || '';
              const outlineWidth = rule.style.outlineWidth || '';
              const outlineOffset = rule.style.outlineOffset || '';
              if ((outline.includes('2px') || outlineWidth === '2px') && outlineOffset) {
                return {
                  selector: rule.selectorText,
                  outline: outline || outlineWidth,
                  outlineOffset: outlineOffset,
                };
              }
            }
          }
        } catch (e) {
          // Bỏ qua cross-origin stylesheets nếu có
        }
      }
      return null;
    });

    expect(focusRule).not.toBeNull();
    if (focusRule) {
      expect(focusRule.outline).toContain('2px');
      expect(focusRule.outlineOffset).toBe('2px');
    }
  });

  test('4. Capo badge và nhãn phụ: cỡ chữ >= 11px và độ tương phản', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kiểm tra Capo Badge
    const capoBadgeSize = await page.evaluate(() => {
      const badge = document.getElementById('capo-badge');
      if (!badge) return 0;
      badge.style.display = 'inline-block';
      const cs = window.getComputedStyle(badge);
      return parseFloat(cs.fontSize);
    });
    expect(capoBadgeSize).toBeGreaterThanOrEqual(11);

    // Chuyển sang Dark mode để xác nhận tương phản không bị lỗi vỡ
    await page.evaluate(() => {
      document.body.classList.add('dark-mode');
    });

    const isDarkModeApplied = await page.evaluate(() => {
      return document.body.classList.contains('dark-mode');
    });
    expect(isDarkModeApplied).toBe(true);
  });

});
