// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l04-toolbar-overflow.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-4 (ROADMAP 4):
 * "Thanh công cụ không tràn: dưới 1.300px, thu các nút phụ vào ⋮;
 *  luôn hiện các nút: tên bài, tông, bộ hợp âm, Band/Nhạc, ⚡, ⋮"
 *
 * Nghiệm thu:
 * - Ở 1180×820, 820×1180, 390×844:
 *   1. toolbar.scrollWidth <= toolbar.clientWidth (Không bị tràn/cuộn ngang)
 *   2. Nút ⚡ (#btn-fullscreen), ◀ ▶ (#nav-arrows) và ⋮ (#btn-more-options) nằm trong khung nhìn:
 *      0 <= rect.left && rect.right <= viewportWidth
 *   3. Các nút bắt buộc luôn visible:
 *      - Tên bài (#song-title)
 *      - Tông (#song-key hoặc #transpose-display)
 *      - Bộ hợp âm (#chord-set-selector)
 *      - Band/Nhạc (#btn-band-toggle hoặc #btn-toggle-view)
 *      - ⚡ (#btn-fullscreen)
 *      - ⋮ (#btn-more-options)
 *      - ◀ ▶ (#nav-arrows)
 *   4. Bấm Band/Nhạc toggle chuyển đổi giữa chế độ Band và Bản Nhạc
 */

const VIEWPORTS = [
  { width: 1180, height: 820, name: 'iPad Pro ngang / Desktop nhỏ (1180x820)' },
  { width: 820, height: 1180, name: 'iPad dọc / Tablet (820x1180)' },
  { width: 390, height: 844, name: 'Điện thoại di động iPhone (390x844)' },
];

test.describe('Ticket L0-4: Thanh công cụ không tràn dưới 1.300px', () => {
  for (const vp of VIEWPORTS) {
    test(`Viewport ${vp.name}: Không tràn ngang và các nút chính nằm trọn trong khung nhìn`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
      });

      await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

      // Đóng modal auth nếu có
      const closeAuthBtn = page.locator('#btn-close-auth');
      if (await closeAuthBtn.isVisible()) {
        await closeAuthBtn.click();
      }

      const toolbar = page.locator('#toolbar');
      await expect(toolbar).toBeVisible({ timeout: 15000 });

      // 1. Kiểm tra không tràn ngang: scrollWidth <= clientWidth
      const overflowMetrics = await page.evaluate(() => {
        const tb = document.getElementById('toolbar');
        if (!tb) return { error: 'No toolbar' };
        return {
          scrollWidth: tb.scrollWidth,
          clientWidth: tb.clientWidth,
          diff: tb.scrollWidth - tb.clientWidth
        };
      });

      expect(
        overflowMetrics.scrollWidth,
        `Toolbar tại ${vp.width}px bị tràn ngang! scrollWidth (${overflowMetrics.scrollWidth}) > clientWidth (${overflowMetrics.clientWidth})`
      ).toBeLessThanOrEqual(overflowMetrics.clientWidth);

      // 2. Kiểm tra các nút bắt buộc luôn visible
      const songTitle = page.locator('#song-title');
      await expect(songTitle).toBeVisible();

      const songKey = page.locator('#song-key');
      await expect(songKey).toBeVisible();

      const transposeDisplay = page.locator('#transpose-display');
      await expect(transposeDisplay).toBeVisible();

      const chordSelector = page.locator('#chord-set-selector');
      await expect(chordSelector).toBeVisible();

      // Ticket R1-2 (ROADMAP5): #btn-band-toggle bị thay bằng công tắc #view-switch
      const bandToggle = page.locator('#view-switch');
      await expect(bandToggle).toBeVisible();

      const gigBtn = page.locator('#btn-fullscreen');
      await expect(gigBtn).toBeVisible();

      const moreBtn = page.locator('#btn-more-options');
      await expect(moreBtn).toBeVisible();

      const navArrows = page.locator('#nav-arrows');
      await expect(navArrows).toBeVisible();

      // 3. Kiểm tra các nút ⚡, ◀ ▶, ⋮ nằm trọn trong khung nhìn (viewport)
      const positions = await page.evaluate(() => {
        const vpW = window.innerWidth;
        const gig = document.getElementById('btn-fullscreen')?.getBoundingClientRect();
        const more = document.getElementById('btn-more-options')?.getBoundingClientRect();
        const nav = document.getElementById('nav-arrows')?.getBoundingClientRect();

        return {
          viewportWidth: vpW,
          gig: gig ? { left: gig.left, right: gig.right, inView: gig.left >= 0 && gig.right <= vpW } : null,
          more: more ? { left: more.left, right: more.right, inView: more.left >= 0 && more.right <= vpW } : null,
          nav: nav ? { left: nav.left, right: nav.right, inView: nav.left >= 0 && nav.right <= vpW } : null,
        };
      });

      expect(positions.gig?.inView, `Nút ⚡ nằm ngoài khung nhìn: left=${positions.gig?.left}, right=${positions.gig?.right}, vpW=${positions.viewportWidth}`).toBe(true);
      expect(positions.nav?.inView, `Nút ◀ ▶ nằm ngoài khung nhìn: left=${positions.nav?.left}, right=${positions.nav?.right}, vpW=${positions.viewportWidth}`).toBe(true);
      expect(positions.more?.inView, `Nút ⋮ nằm ngoài khung nhìn: left=${positions.more?.left}, right=${positions.more?.right}, vpW=${positions.viewportWidth}`).toBe(true);

      // 4. Kiểm tra các nút phụ đã được thu vào menu ⋮ (ẩn khỏi toolbar chính dưới 1300px)
      const secondaryControls = await page.evaluate(() => {
        const isHidden = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return true;
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden';
        };

        return {
          zoomPillHidden: isHidden('.zoom-pill'),
          scrollPillHidden: isHidden('.scroll-pill'),
          authPillHidden: isHidden('#btn-toolbar-auth')
        };
      });

      expect(secondaryControls.zoomPillHidden, 'Cụm Thu Phóng (.zoom-pill) phải được thu gọn khỏi toolbar dưới 1300px').toBe(true);
      expect(secondaryControls.scrollPillHidden, 'Cụm Cuộn (.scroll-pill) phải được thu gọn khỏi toolbar dưới 1300px').toBe(true);
      expect(secondaryControls.authPillHidden, 'Nút Tài khoản (#btn-toolbar-auth) phải được thu gọn khỏi toolbar dưới 1300px').toBe(true);
    });
  }

  test('Chuyển đổi 1 chạm Band ↔ Nhạc hoạt động mượt mà', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // Ticket R1-2 (ROADMAP5): công tắc 2 nút #btn-view-sheet / #btn-view-lyrics thay
    // cho nút đơn #btn-band-toggle (đổi chữ Band<->Nhạc).
    const btnSheet = page.locator('#btn-view-sheet');
    const btnLyrics = page.locator('#btn-view-lyrics');
    await expect(btnLyrics).toBeVisible({ timeout: 15000 });

    // Ban đầu ở chế độ Bản Nhạc
    await expect(btnSheet).toHaveClass(/active/);

    // Click "Lời & Hợp âm" chuyển sang chế độ Band
    await btnLyrics.click();

    await expect(btnLyrics).toHaveClass(/active/);
    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible();

    // Click lại "Bản nhạc" để trở về
    await btnSheet.click();
    await expect(btnSheet).toHaveClass(/active/);
    await expect(lyricContainer).toBeHidden();
  });
});
