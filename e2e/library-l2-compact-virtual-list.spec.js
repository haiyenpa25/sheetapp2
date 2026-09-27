// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-compact-virtual-list.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-2 (ROADMAP4 Mục 8):
 * - Dòng danh sách gọn (min-height 36px: số · tên · tông)
 * - Tên bài dài xuống dòng tự nhiên (white-space: normal, word-break: break-word) thay vì bị cắt cụt
 * - Ảo hoá danh sách (Virtual List) với DOM nodes <= 400 (thực tế render ~20-35 items)
 * - Màn hình 1180x820 hiển thị đồng thời >= 16 bài
 * - Cuộn danh sách mượt mà (60fps rAF throttling) và các bài tiếp theo được render liên tục
 */

test.describe('L2-2 · Dòng danh sách gọn 36px & Ảo hoá danh sách (Virtual List)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Chiều cao dòng gọn ~36px và tên bài dài xuống dòng tự nhiên', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const firstItem = page.locator('#song-list .song-item').first();
    await expect(firstItem).toBeVisible();

    // 1. Kiểm tra min-height của .song-item là 36px và chiều cao gọn xấp xỉ 36-44px
    const itemBox = await firstItem.boundingBox();
    expect(itemBox).not.toBeNull();
    if (itemBox) {
      expect(itemBox.height).toBeGreaterThanOrEqual(36);
      expect(itemBox.height).toBeLessThanOrEqual(48);
    }

    // 2. Kiểm tra CSS white-space của .song-item-title là 'normal'
    const titleStyle = await page.evaluate(() => {
      const titleEl = document.querySelector('.song-item .song-item-title');
      if (!titleEl) return null;
      const cs = window.getComputedStyle(titleEl);
      return {
        whiteSpace: cs.whiteSpace,
        wordBreak: cs.wordBreak,
        overflowWrap: cs.overflowWrap || cs.wordWrap
      };
    });

    expect(titleStyle).not.toBeNull();
    expect(titleStyle?.whiteSpace).toBe('normal');
  });

  test('2. Nghiệm thu: Ảo hoá danh sách giữ DOM nodes <= 400 trên toàn bộ kho 903 bài', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const songList = page.locator('#song-list');
    await expect(songList).toBeVisible();

    // Đợi danh sách nạp đầy đủ bài hát qua getSongs()
    await page.waitForFunction(() => {
      return window.LibraryUI && typeof window.LibraryUI.getSongs === 'function' && window.LibraryUI.getSongs().length > 50;
    }, { timeout: 15000 });

    // Kiểm tra số lượng DOM node của các phần tử con trong #song-list
    const domCount = await page.evaluate(() => {
      const container = document.getElementById('song-list');
      if (!container) return 0;
      return container.querySelectorAll('*').length;
    });

    // Virtual list phải đảm bảo DOM node <= 400 (thực tế chỉ render ~25 items * ~6 nodes/item = ~150-200 nodes)
    expect(domCount).toBeLessThanOrEqual(400);

    // Kiểm tra có ít nhất 10 items ban đầu được render
    const itemCountInitial = await page.locator('#song-list .song-item').count();
    expect(itemCountInitial).toBeGreaterThanOrEqual(10);
    expect(itemCountInitial).toBeLessThanOrEqual(50);

    // Cuộn danh sách xuống 1500px trên container có thanh cuộn (.song-list-container hoặc #song-list)
    await page.evaluate(() => {
      const container = document.querySelector('.song-list-container') || document.getElementById('song-list');
      if (container) {
        container.scrollTop = 1500;
        container.dispatchEvent(new Event('scroll'));
      }
    });

    // Chờ rAF cập nhật chunk ảo và kiểm tra spacer trên đã được tạo với chiều cao > 0
    await expect.poll(async () => {
      return page.evaluate(() => {
        const topSpacer = document.querySelector('#song-list .virtual-spacer:first-child');
        return topSpacer ? topSpacer.getBoundingClientRect().height : 0;
      });
    }, { timeout: 6000 }).toBeGreaterThan(0);

    // Sau khi cuộn, DOM node vẫn phải được giới hạn <= 400
    const domCountAfterScroll = await page.evaluate(() => {
      const container = document.getElementById('song-list');
      if (!container) return 0;
      return container.querySelectorAll('*').length;
    });
    expect(domCountAfterScroll).toBeLessThanOrEqual(400);
  });

  test('3. Nghiệm thu: Màn hình 1180x820 hiển thị đồng thời >= 16 bài hát', async ({ page }) => {
    // Đặt viewport theo kích thước yêu cầu nghiệm thu
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const songList = page.locator('#song-list');
    await expect(songList).toBeVisible();

    // Đợi nạp danh sách
    await page.waitForFunction(() => {
      return window.LibraryUI && typeof window.LibraryUI.getSongs === 'function' && window.LibraryUI.getSongs().length > 50;
    }, { timeout: 15000 });

    // Tính số lượng bài hát nằm hoàn toàn hoặc một phần trong khung nhìn của #song-list
    const visibleCount = await page.evaluate(() => {
      const container = document.getElementById('song-list');
      if (!container) return 0;
      const cRect = container.getBoundingClientRect();
      const items = Array.from(container.querySelectorAll('.song-item'));
      return items.filter(it => {
        const r = it.getBoundingClientRect();
        return r.top < cRect.bottom && r.bottom > cRect.top;
      }).length;
    });

    // Màn hình 1180x820 với chiều cao container ~600-650px và dòng 36-38px phải hiển thị >= 16 bài
    expect(visibleCount).toBeGreaterThanOrEqual(16);
  });
});
