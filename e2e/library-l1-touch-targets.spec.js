// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-touch-targets-44px.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-4 (ROADMAP 4):
 * Nút cảm ứng ≥ 44x44px cho mọi điều khiển chính:
 * tông, capo, zoom, bộ hợp âm, preset Aa, Band toggle, ⚡, ◀ ▶, chip nhảy nhanh, ⭐, sidebar tabs
 * ở 3 kích thước màn hình: 1180x820, 820x1180, 390x844.
 */

test.describe('L1-4 · Nút cảm ứng ≥ 44x44px (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. iPad ngang (1180x820): Mọi nút điều khiển chính trên thanh công cụ và sidebar ≥ 44x44px', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Không tràn thanh công cụ
    const toolbar = page.locator('#toolbar');
    const scrollWidth = await toolbar.evaluate(el => el.scrollWidth);
    const clientWidth = await toolbar.evaluate(el => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Kiểm tra các nút chính trên thanh công cụ
    const controls = [
      '#btn-open-sidebar',
      '#song-info',
      '#btn-song-info-popover',
      '#btn-transpose-down',
      '#btn-transpose-up',
      '#capo-select',
      '#chord-set-selector',
      '#btn-chord-preset',
      '#btn-view-lyrics',
      '#btn-fullscreen',
      '#btn-prev-song',
      '#btn-next-song',
      '#btn-more-options'
    ];

    for (const sel of controls) {
      const loc = page.locator(sel);
      if (await loc.isVisible()) {
        const box = await loc.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width, `${sel} width < 44px (was ${box.width})`).toBeGreaterThanOrEqual(43.5);
          expect(box.height, `${sel} height < 44px (was ${box.height})`).toBeGreaterThanOrEqual(43.5);
        }
      }
    }

    // Mở sidebar để kiểm tra chip nhảy nhanh và sao yêu thích
    const btnOpenSidebar = page.locator('#btn-open-sidebar');
    await btnOpenSidebar.click();
    await page.waitForTimeout(350);

    // Chip nhảy nhanh
    const quickJumpBtn = page.locator('.quick-jump-btn').first();
    await expect(quickJumpBtn).toBeVisible();
    const qjBox = await quickJumpBtn.boundingBox();
    expect(qjBox).not.toBeNull();
    if (qjBox) {
      expect(qjBox.width).toBeGreaterThanOrEqual(43.5);
      expect(qjBox.height).toBeGreaterThanOrEqual(43.5);
    }

    // Nút yêu thích ⭐
    const favBtn = page.locator('.song-fav-btn').first();
    await expect(favBtn).toBeVisible();
    const favBox = await favBtn.boundingBox();
    expect(favBox).not.toBeNull();
    if (favBox) {
      expect(favBox.width).toBeGreaterThanOrEqual(43.5);
      expect(favBox.height).toBeGreaterThanOrEqual(43.5);
    }

    // Sidebar tab
    const tabBtn = page.locator('.sidebar-tab').first();
    const tabBox = await tabBtn.boundingBox();
    expect(tabBox).not.toBeNull();
    if (tabBox) {
      expect(tabBox.height).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('2. iPad dọc (820x1180): Mọi nút điều khiển hiển thị ≥ 44x44px và không tràn thanh công cụ', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const toolbar = page.locator('#toolbar');
    const scrollWidth = await toolbar.evaluate(el => el.scrollWidth);
    const clientWidth = await toolbar.evaluate(el => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const controls = [
      '#btn-open-sidebar',
      '#song-info',
      '#btn-transpose-down',
      '#btn-transpose-up',
      '#chord-set-selector',
      '#btn-chord-preset',
      '#btn-view-lyrics',
      '#btn-fullscreen',
      '#btn-prev-song',
      '#btn-next-song',
      '#btn-more-options'
    ];

    for (const sel of controls) {
      const loc = page.locator(sel);
      if (await loc.isVisible()) {
        const box = await loc.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width, `${sel} width < 44px (was ${box.width})`).toBeGreaterThanOrEqual(43.5);
          expect(box.height, `${sel} height < 44px (was ${box.height})`).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });

  test('3. Điện thoại (390x844): Mọi nút điều khiển trên 2 hàng ≥ 44x44px và không tràn', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Điện thoại mặc định mở chế độ Band (L-D2) → yêu cầu rõ chế độ bản nhạc để đo nút.
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const toolbar = page.locator('#toolbar');
    const scrollWidth = await toolbar.evaluate(el => el.scrollWidth);
    const clientWidth = await toolbar.evaluate(el => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const mobileControls = [
      '#btn-open-sidebar',
      '#btn-fullscreen',
      '#btn-prev-song',
      '#btn-next-song',
      '#btn-more-options',
      '#btn-transpose-down',
      '#btn-transpose-up',
      '#chord-set-selector',
      '#btn-chord-preset',
      '#btn-view-lyrics'
    ];

    for (const sel of mobileControls) {
      const loc = page.locator(sel);
      if (await loc.isVisible()) {
        const box = await loc.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width, `${sel} mobile width < 44px (was ${box.width})`).toBeGreaterThanOrEqual(43.5);
          expect(box.height, `${sel} mobile height < 44px (was ${box.height})`).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });

});
