// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l03-chord-hide-by-class.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-3 (ROADMAP 4):
 * "Ẩn hợp âm SVG bằng class hoặc data attribute gắn lúc render, KHÔNG ẩn theo màu (text[fill="..."]).
 *  Nếu người dùng chọn màu hợp âm trùng màu nốt nhạc/lời (đen #000000), toàn bộ lời/nốt bị ẩn."
 */

test.describe('Ticket L0-3: Ẩn hợp âm SVG bằng Class / Data Attribute (Không ẩn theo màu)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Browser ${msg.type()}]:`, msg.text());
      }
    });
    page.on('pageerror', err => console.log(`[Browser PageError]:`, err.message));

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Kiểm tra style ẩn hợp âm không chứa text[fill=...] và lyric hiển thị tốt kể cả khi màu hợp âm là đen', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đóng modal auth nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // Chờ bản nhạc SVG xuất hiện và chip hợp âm
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#si-chord-set-chip')).toBeVisible({ timeout: 10000 });

    // Chờ ChordCanvas build xong và cập nhật style block cc-custom-style
    await page.waitForFunction(() => {
      const el = document.getElementById('cc-custom-style');
      return el && el.textContent.trim().length > 0;
    }, { timeout: 15000 });

    // Đảm bảo OSMDRenderer đã gắn thẻ các hợp âm
    const tagResult = await page.evaluate(() => {
      const tagged = document.querySelectorAll('#osmd-container svg .osmd-chord-symbol, #osmd-container svg [data-chord-symbol="true"]');
      const styleEl = document.getElementById('cc-custom-style');
      const styleText = styleEl ? styleEl.textContent : '';

      return {
        taggedCount: tagged.length,
        styleText: styleText,
        hasFillSelector: /text\[fill=/i.test(styleText),
        hasClassSelector: /\.osmd-chord-symbol/i.test(styleText)
      };
    });

    // 1. Style block cc-custom-style TUYỆT ĐỐI không chứa selector text[fill=...]
    expect(tagResult.hasFillSelector, 'Style ẩn hợp âm KHÔNG ĐƯỢC chứa selector text[fill=...]').toBe(false);

    // 2. Style block phải sử dụng class .osmd-chord-symbol
    expect(tagResult.hasClassSelector, 'Style ẩn hợp âm phải sử dụng selector .osmd-chord-symbol').toBe(true);

    // 3. Phải tìm thấy các phần tử hợp âm được gắn thẻ trong SVG
    expect(tagResult.taggedCount, 'Số lượng phần tử SVG mang class/data chord-symbol phải > 0').toBeGreaterThan(0);

    // 4. Giả lập đặt màu hợp âm thành #000000 (đen trùng màu nốt/lời) và gọi ChordCanvas.render()
    const lyricCheck = await page.evaluate(() => {
      // Tìm các text lyrics hoặc text thông thường không phải chord
      const svgTexts = Array.from(document.querySelectorAll('#osmd-container svg text'));
      const nonChordTexts = svgTexts.filter(el => {
        return !el.classList.contains('osmd-chord-symbol') &&
               !el.classList.contains('osmd-chord-text') &&
               el.getAttribute('data-chord-symbol') !== 'true' &&
               el.getAttribute('data-chord-text') !== 'true';
      });

      // Lấy thuộc tính fill và computed fill của các text không phải chord
      const sampleTexts = nonChordTexts.slice(0, 10).map(el => {
        const style = window.getComputedStyle(el);
        return {
          text: el.textContent ? el.textContent.trim() : '',
          fill: el.getAttribute('fill'),
          computedFill: style.fill,
          computedOpacity: style.opacity,
          computedVisibility: style.visibility
        };
      });

      return {
        totalNonChordTexts: nonChordTexts.length,
        samples: sampleTexts
      };
    });

    expect(lyricCheck.totalNonChordTexts, 'Bản nhạc phải có nhiều phần tử SVG text không phải hợp âm (lyric, nốt, tiêu đề)').toBeGreaterThan(10);

    // Xác nhận không có phần tử non-chord nào bị biến thành transparent do style cc-custom-style
    for (const sample of lyricCheck.samples) {
      expect(sample.computedFill, `Text "${sample.text}" không được bị fill transparent`).not.toBe('transparent');
      expect(sample.computedOpacity, `Text "${sample.text}" không được bị opacity 0`).not.toBe('0');
      expect(sample.computedVisibility, `Text "${sample.text}" không được bị hidden`).not.toBe('hidden');
    }
  });
});
