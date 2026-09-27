// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-setlist-bpm-scroll.spec.js
 * 
 * Nghiệm thu Ticket L3-8 — Metronome & Auto-Scroller lấy BPM của mục Setlist:
 * 1. Khi phát mục setlist có BPM = 72:
 *    - Metronome tự động đặt 72 BPM.
 *    - AutoScroller tự động tính tốc độ cuộn theo 72 BPM.
 * 2. Nút Count-in phát nhịp chuẩn bị với đúng tốc độ 72 BPM.
 * 3. AutoScroller hỗ trợ Tạm dừng (Pause) và Tiếp tục (Resume) mượt mà theo MobileSheets.
 * 4. Luôn cho phép chỉnh tay BPM và hệ số tốc độ cuộn (1x, 2x...).
 */

test.describe('L3-8: Setlist BPM, Count-in & Auto-Scroller', () => {

  test('Mục setlist BPM 72: Metronome 72, AutoScroller 72, Pause/Resume mượt mà', async ({ page }) => {
    // 1. Mở trang chính với viewport rộng (desktop mode)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-list', { timeout: 15000 });

    // 2. Thiết lập mục setlist giả lập với BPM = 72 và phát bằng SetlistPlayer
    await page.evaluate(async () => {
      const mockSetlist = {
        id: 999,
        name: 'Chương Trình Chúa Nhật L3-8',
        items: [
          {
            id: 101,
            setlist_id: 999,
            song_id: 'thanh-ca-001',
            title: 'Bài Ca Cảm Tạ',
            bpm: 72,
            beats_per_measure: 4,
            chord_profile: 'HD',
            transpose_key: 0,
            item_type: 'song'
          }
        ]
      };

      // @ts-ignore
      if (window.SetlistUI) {
        // @ts-ignore
        window.SetlistUI.setCurrentSetlist?.(mockSetlist);
        // @ts-ignore
        window.SetlistUI.setCurrentIndex?.(0);
      }
      // @ts-ignore
      if (window.SetlistPlayer?.playCurrentItem) {
        // @ts-ignore
        await window.SetlistPlayer.playCurrentItem();
      }
    });

    // 3. Chờ bản nhạc render xong
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // 4. Kiểm tra BPM của Metronome
    const metBpm = await page.evaluate(() => {
      // @ts-ignore
      return window.Metronome?.getBpm?.();
    });
    console.log(`[L3-8 E2E] Metronome BPM: ${metBpm}`);
    expect(metBpm).toBe(72);

    // 5. Kiểm tra BPM của AutoScroller
    const scrollBpm = await page.evaluate(() => {
      // @ts-ignore
      return window.AutoScroller?.getBpm?.();
    });
    console.log(`[L3-8 E2E] AutoScroller BPM: ${scrollBpm}`);
    expect(scrollBpm).toBe(72);

    // 6. Mở Metronome Mini-Bar và kiểm tra hiển thị
    await page.evaluate(() => {
      // @ts-ignore
      window.Metronome?.showPanel?.();
    });
    const metronomeBar = page.locator('#metronome-panel');
    await expect(metronomeBar).not.toHaveClass(/hidden/, { timeout: 5000 });

    const bpmDisplay = page.locator('#metronome-bpm-val');
    await expect(bpmDisplay).toContainText('72', { timeout: 5000 });

    // 7. Kiểm tra Count-in kích hoạt với BPM 72
    const countInSuccess = await page.evaluate(() => {
      let passed = false;
      const originalStart = window.CountInEngine?.startCountIn;
      if (window.CountInEngine) {
        // @ts-ignore
        window.CountInEngine.startCountIn = function(opts) {
          if (opts && opts.bpm === 72) {
            passed = true;
          }
          if (originalStart) originalStart.apply(this, arguments);
        };
      }
      const countInBtn = document.getElementById('btn-metronome-count-in');
      countInBtn?.click();
      return passed;
    });
    expect(countInSuccess).toBe(true);

    // 8. Kiểm tra AutoScroller: Play -> Pause -> Resume -> Stop
    const btnAutoScroll = page.locator('#btn-auto-scroll');

    // Kích hoạt cuộn
    await btnAutoScroll.click();
    await expect(btnAutoScroll).toContainText('Tạm Dừng', { timeout: 5000 });

    let isScrolling = await page.evaluate(() => {
      // @ts-ignore
      return window.AutoScroller?.isScrolling?.();
    });
    expect(isScrolling).toBe(true);

    // Tạm dừng cuộn (MobileSheets UX)
    await btnAutoScroll.click();
    await expect(btnAutoScroll).toContainText('Tiếp Tục', { timeout: 5000 });

    let isPaused = await page.evaluate(() => {
      // @ts-ignore
      return window.AutoScroller?.isPaused?.();
    });
    expect(isPaused).toBe(true);

    // Tiếp tục cuộn
    await btnAutoScroll.click();
    await expect(btnAutoScroll).toContainText('Tạm Dừng', { timeout: 5000 });

    // Dừng hẳn
    await page.evaluate(() => {
      // @ts-ignore
      window.AutoScroller?.stop?.();
    });
    await expect(btnAutoScroll).toContainText('Cuộn', { timeout: 5000 });

    // 9. Kiểm tra chỉnh tay BPM
    await page.evaluate(() => {
      // @ts-ignore
      window.AutoScroller?.setBpm?.(96);
    });
    const customBpm = await page.evaluate(() => {
      // @ts-ignore
      return window.AutoScroller?.getBpm?.();
    });
    expect(customBpm).toBe(96);
  });

});
