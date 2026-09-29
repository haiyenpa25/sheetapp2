// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-toolbar-responsive.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-4 (ROADMAP 4):
 * Thanh công cụ không tràn: dưới 1.300px, thu các nút phụ vào ⋮.
 * Luôn hiện các nút:
 *  - Tên bài
 *  - Tông (transpose)
 *  - Bộ hợp âm (chord set)
 *  - Band/Nhạc (toggle view)
 *  - ⚡ (gig mode)
 *  - ⋮ (menu công cụ)
 *  - ◀ ▶ (khi phát setlist)
 *
 * Tiêu chí nghiệm thu:
 *  - Ở 1180×820, 820×1180, 390×844: toolbar.scrollWidth <= toolbar.clientWidth.
 *  - ⚡, ◀ ▶ và ⋮ nằm trọn vẹn trong khung nhìn.
 *  - Nút Band/Nhạc hoạt động 1 chạm chuyển đổi qua lại giữa bản nhạc và lời nhạc.
 */

test.describe('Ticket L0-4: Thanh công cụ không tràn dưới 1300px', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  const VIEWPORTS = [
    { name: 'iPad ngang', width: 1180, height: 820 },
    { name: 'iPad dọc', width: 820, height: 1180 },
    { name: 'Mobile', width: 390, height: 844 },
  ];

  for (const vp of VIEWPORTS) {
    test(`Thanh công cụ không tràn trên ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

      const toolbar = page.locator('#toolbar');
      await expect(toolbar).toBeVisible({ timeout: 25000 });

      // Đợi render ổn định
      await page.waitForTimeout(400);

      // 1. Kiểm tra không tràn (scrollWidth <= clientWidth)
      const noOverflow = await page.evaluate(() => {
        const tb = document.getElementById('toolbar');
        if (!tb) return false;
        return tb.scrollWidth <= tb.clientWidth;
      });
      expect(noOverflow).toBe(true);

      // 2. Kiểm tra các nút bắt buộc nằm trọn trong khung nhìn
      const visibilityInfo = await page.evaluate(() => {
        const isInsideViewport = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
        };

        const gig = document.getElementById('btn-fullscreen');
        const more = document.getElementById('btn-more-options');
        const nav = document.getElementById('nav-arrows');
        // #btn-band-toggle bị ẩn (aria-hidden) từ Ticket R1-2 -- thay bằng công tắc 2 nút
        // #view-switch (#btn-view-sheet / #btn-view-lyrics) hiện tại đang hiển thị thật.
        const toggleView = document.getElementById('view-switch');
        const songTitle = document.getElementById('song-title');
        const chordSel = document.getElementById('chord-set-selector');
        const trans = document.querySelector('.transpose-pill');

        return {
          gig: isInsideViewport(gig),
          more: isInsideViewport(more),
          nav: isInsideViewport(nav),
          toggleView: isInsideViewport(toggleView),
          songTitle: isInsideViewport(songTitle),
          chordSel: isInsideViewport(chordSel),
          trans: isInsideViewport(trans),
        };
      });

      console.log(`${vp.name} visibility:`, visibilityInfo);
      expect(visibilityInfo.songTitle).toBe(true);
      expect(visibilityInfo.trans).toBe(true);
      expect(visibilityInfo.chordSel).toBe(true);
      expect(visibilityInfo.toggleView).toBe(true);
      expect(visibilityInfo.gig).toBe(true);
      expect(visibilityInfo.nav).toBe(true);
      expect(visibilityInfo.more).toBe(true);

      // 3. Các nút phụ (zoom pill, scroll pill) phải được thu gọn / ẩn khỏi toolbar chính
      const secondaryHidden = await page.evaluate(() => {
        const zoomPill = document.querySelector('.zoom-pill');
        const scrollPill = document.querySelector('.scroll-pill');
        const isHidden = (el) => {
          if (!el) return true;
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null;
        };
        return {
          zoomHidden: isHidden(zoomPill),
          scrollHidden: isHidden(scrollPill),
        };
      });

      expect(secondaryHidden.zoomHidden).toBe(true);
      expect(secondaryHidden.scrollHidden).toBe(true);
    });
  }

  test('Công tắc Bản nhạc / Lời & Hợp âm chuyển đổi 1 chạm giữa 2 chế độ', async ({ page }) => {
    // Ticket R1-2 (ROADMAP5) thay nút đơn #btn-band-toggle (đổi chữ Band<->Nhạc) bằng
    // công tắc 2 nút độc lập #btn-view-sheet / #btn-view-lyrics (mỗi nút tự bật/tắt
    // class active riêng, không đổi chữ) -- #btn-band-toggle vẫn còn trong DOM nhưng
    // ẩn hẳn (chỉ nhận click ủy quyền từ 2 nút mới, xem toolbar-controller.js).
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const btnSheet = page.locator('#btn-view-sheet');
    const btnLyrics = page.locator('#btn-view-lyrics');
    await expect(btnSheet).toBeVisible({ timeout: 25000 });
    await expect(btnLyrics).toBeVisible();

    const osmdContainer = page.locator('#osmd-container');
    const lyricContainer = page.locator('#lyric-view-container');

    await expect(osmdContainer).toBeVisible();
    await expect(lyricContainer).toHaveClass(/hidden/);
    await expect(btnSheet).toHaveClass(/active/);
    await expect(btnLyrics).not.toHaveClass(/active/);

    // Chạm "Lời & Hợp âm" -> chuyển sang chế độ Band
    await btnLyrics.click();

    await expect(lyricContainer).not.toHaveClass(/hidden/, { timeout: 10000 });
    await expect(btnLyrics).toHaveClass(/active/);
    await expect(btnSheet).not.toHaveClass(/active/);

    // Chạm lại "Bản nhạc" -> quay lại bản nhạc
    await btnSheet.click();

    await expect(lyricContainer).toHaveClass(/hidden/, { timeout: 10000 });
    await expect(btnSheet).toHaveClass(/active/);
    await expect(btnLyrics).not.toHaveClass(/active/);
  });

});
