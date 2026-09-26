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
        const toggleView = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
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

  test('Nút Band/Nhạc chuyển đổi 1 chạm giữa Bản Nhạc và Chế độ Band', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const toggleBtn = page.locator('#btn-band-toggle, .btn-band-toggle, .btn-toggle-view:not([aria-hidden="true"])').first();
    await expect(toggleBtn).toBeVisible({ timeout: 25000 });
    await expect(toggleBtn).toContainText('Band');

    const osmdContainer = page.locator('#osmd-container');
    const lyricContainer = page.locator('#lyric-view-container');

    await expect(osmdContainer).toBeVisible();
    await expect(lyricContainer).toHaveClass(/hidden/);

    // Chạm vào nút Band -> chuyển sang chế độ Band
    await toggleBtn.click();

    await expect(lyricContainer).not.toHaveClass(/hidden/, { timeout: 10000 });
    await expect(toggleBtn).toContainText('Nhạc');
    await expect(toggleBtn).toHaveClass(/active/);

    // Chạm lại vào nút Nhạc -> quay lại bản nhạc
    await toggleBtn.click();

    await expect(lyricContainer).toHaveClass(/hidden/, { timeout: 10000 });
    await expect(toggleBtn).toContainText('Band');
    await expect(toggleBtn).not.toHaveClass(/active/);
  });

});
