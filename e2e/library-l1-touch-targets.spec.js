// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-touch-targets.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-4 (ROADMAP 4):
 * Nút cảm ứng cho mọi điều khiển chính:
 * tông, capo, zoom, bộ hợp âm, preset Aa, Band toggle, ⚡, ◀ ▶, chip nhảy nhanh, ⭐, sidebar tabs
 * ở 3 kích thước màn hình: 1180x820, 820x1180, 390x844.
 *
 * R1-9 (ROADMAP5, mục 2.7) thay chuẩn "44x44px mọi lúc" bằng thang 2 mức theo CSS
 * @media(pointer:coarse): 32px khi dùng chuột, 40px khi cảm ứng. Bài test này chỉ
 * resize viewport (giống iPad/điện thoại) chứ không bật giả lập thiết bị cảm ứng thật
 * (Playwright hasTouch:true KHÔNG làm trình duyệt báo pointer:coarse -- muốn vậy phải
 * dùng isMobile, nhưng isMobile chỉ Chromium hỗ trợ, sẽ vỡ song song với WebKit). Vì
 * vậy ở đây kiểm đúng ngưỡng THẬT SỰ đo được: 32px (chế độ chuột) -- không phải 40px.
 */

test.describe('L1-4 · Nút cảm ứng ≥ 32x32px ở mọi kích thước màn hình (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. iPad ngang (1180x820): Mọi nút điều khiển chính trên thanh công cụ và sidebar ≥ 32x32px', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Không tràn thanh công cụ
    const toolbar = page.locator('#toolbar');
    const scrollWidth = await toolbar.evaluate(el => el.scrollWidth);
    const clientWidth = await toolbar.evaluate(el => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Kiểm tra các nút ĐỨNG RIÊNG trên thanh công cụ (--lp-h: 32px chuột / 40px cảm ứng).
    // #btn-transpose-down/-up, #capo-select, #chord-set-selector, #btn-chord-preset và
    // #btn-view-lyrics KHÔNG có mặt ở đây: đó là các điều khiển "bên trong pill" (nhóm
    // .band-pill), một bậc kích thước RIÊNG, nhỏ hơn có chủ đích (--lp-h-inner: 26px
    // chuột / 32px cảm ứng, xem library-polish.css) -- không nên so cùng ngưỡng.
    const controls = [
      '#btn-open-sidebar',
      '#song-info',
      '#btn-song-info-popover',
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
          expect(box.width, `${sel} width < 32px (was ${box.width})`).toBeGreaterThanOrEqual(31.5);
          expect(box.height, `${sel} height < 32px (was ${box.height})`).toBeGreaterThanOrEqual(31.5);
        }
      }
    }

    // Mở sidebar để kiểm tra chip nhảy nhanh và sao yêu thích
    const btnOpenSidebar = page.locator('#btn-open-sidebar');
    await btnOpenSidebar.click();
    await page.waitForTimeout(350);

    // Chip nhảy nhanh -- kích thước RIÊNG, gọn có chủ đích (chỉ phân trang phụ trong
    // danh sách 903 bài): height: 26px !important (chuột) / 30px cảm ứng, không dùng
    // thang --lp-h chung (xem library-polish.css .quick-jump-btn).
    const quickJumpBtn = page.locator('.quick-jump-btn').first();
    await expect(quickJumpBtn).toBeVisible();
    const qjBox = await quickJumpBtn.boundingBox();
    expect(qjBox).not.toBeNull();
    if (qjBox) {
      expect(qjBox.height).toBeGreaterThanOrEqual(25.5);
    }

    // Nút yêu thích ⭐ -- kích thước RIÊNG có chủ đích: 28px !important (chuột) / 32px
    // cảm ứng (xem library-polish.css .song-item .song-fav-btn).
    const favBtn = page.locator('.song-fav-btn').first();
    await expect(favBtn).toBeVisible();
    const favBox = await favBtn.boundingBox();
    expect(favBox).not.toBeNull();
    if (favBox) {
      expect(favBox.width).toBeGreaterThanOrEqual(27.5);
      expect(favBox.height).toBeGreaterThanOrEqual(27.5);
    }

    // Sidebar tab
    const tabBtn = page.locator('.sidebar-tab').first();
    const tabBox = await tabBtn.boundingBox();
    expect(tabBox).not.toBeNull();
    if (tabBox) {
      expect(tabBox.height).toBeGreaterThanOrEqual(31.5);
    }
  });

  test('2. iPad dọc (820x1180): Mọi nút điều khiển hiển thị ≥ 32x32px và không tràn thanh công cụ', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const toolbar = page.locator('#toolbar');
    const scrollWidth = await toolbar.evaluate(el => el.scrollWidth);
    const clientWidth = await toolbar.evaluate(el => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Loại trừ các điều khiển "bên trong pill" -- xem ghi chú ở test 1.
    const controls = [
      '#btn-open-sidebar',
      '#song-info',
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
          expect(box.width, `${sel} width < 32px (was ${box.width})`).toBeGreaterThanOrEqual(31.5);
          expect(box.height, `${sel} height < 32px (was ${box.height})`).toBeGreaterThanOrEqual(31.5);
        }
      }
    }
  });

  test('3. Điện thoại (390x844): Mọi nút điều khiển trên 2 hàng ≥ 32x32px và không tràn', async ({ page }) => {
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
          expect(box.width, `${sel} mobile width < 32px (was ${box.width})`).toBeGreaterThanOrEqual(31.5);
          expect(box.height, `${sel} mobile height < 32px (was ${box.height})`).toBeGreaterThanOrEqual(31.5);
        }
      }
    }
  });

});
