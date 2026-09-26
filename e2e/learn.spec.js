// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E-02: learn.spec.js
 * 
 * Nghiệm thu Ticket T05:
 * Mở /learn/?song=thanh-ca-090, bài render xong, console sạch, bấm Play không lỗi.
 */

test.describe('E2E-02: Kiểm tra trang Learn Studio và phát bài hát', () => {
  test('Mở /learn/?song=thanh-ca-090, render SVG bản nhạc thành công, console sạch và bấm Play không lỗi', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    // Bắt mọi lỗi console và runtime error
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
          console.error(`[Browser console.error] ${text}`);
        }
      }
    });

    page.on('pageerror', err => {
      const msg = err.message || String(err);
      pageErrors.push(msg);
      console.error(`[Browser pageerror] ${msg}`);
    });

    // 1. Điều hướng tới /learn/?song=thanh-ca-090
    await page.goto('./learn/?song=thanh-ca-090', { waitUntil: 'domcontentloaded' });

    // 2. Chờ bản nhạc SVG xuất hiện trong #learn-score-container
    const scoreSvg = page.locator('#learn-score-container svg').first();
    await expect(scoreSvg).toBeVisible({ timeout: 25000 });

    // 3. Kiểm tra tiêu đề bài hát đã được hiển thị (không còn là "Đang tải bài hát...")
    const songLabel = page.locator('#learn-song-label');
    await expect(songLabel).not.toHaveText('Đang tải bài hát...', { timeout: 10000 });

    // 4. Chờ nút Play sẵn sàng (không còn bị disabled)
    const playBtn = page.locator('#btn-learn-play');
    await expect(playBtn).toBeEnabled({ timeout: 15000 });

    // 5. Bấm nút Play
    await playBtn.click();

    // 6. Chờ 1 giây để audio transport và loop controller vận hành
    await page.waitForTimeout(1000);

    // 7. Nghiệm thu: Console và trang tuyệt đối không có lỗi nào
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
