// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-chord-hide.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-3 (ROADMAP 4):
 * Ẩn hợp âm SVG bằng class / data-attribute thay vì ẩn theo màu (fill="...").
 *
 * Tiêu chí nghiệm thu:
 * 1. Các node hợp âm tạo bởi OSMD được gắn class .osmd-chord-symbol / data-chord-symbol="true" và .osmd-chord-text.
 * 2. Khi hiển thị bộ hợp âm (HD/cá nhân): các hợp âm gốc OSMD bị ẩn bởi class/data-attr selector.
 * 3. Khi người dùng đặt màu hợp âm là ĐEN (#000000):
 *    - Toàn bộ lời bài hát (lyrics) và tiêu đề (title) KHÔNG bị ẩn, fill vẫn là màu nhìn thấy được (không phải transparent).
 * 4. Kiểm tra trên cả Chromium và WebKit.
 */

test.describe('Ticket L0-3: Ẩn hợp âm SVG bằng class / data-attribute thay vì ẩn theo màu', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Hợp âm OSMD được gắn đúng class và data attribute', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const taggedG = page.locator('#osmd-container svg .osmd-chord-symbol, #osmd-container svg [data-chord-symbol="true"]').first();
    await expect(taggedG).toBeAttached({ timeout: 15000 });

    const taggedChordNodesCount = await page.evaluate(() => {
      const gList = document.querySelectorAll('#osmd-container svg .osmd-chord-symbol, #osmd-container svg [data-chord-symbol="true"]');
      const textList = document.querySelectorAll('#osmd-container svg .osmd-chord-text, #osmd-container svg [data-chord-text="true"]');
      return { gCount: gList.length, textCount: textList.length };
    });

    console.log('Tagged chord count:', taggedChordNodesCount);
    expect(taggedChordNodesCount.gCount).toBeGreaterThan(0);
    expect(taggedChordNodesCount.textCount).toBeGreaterThan(0);
  });

  test('Khi màu hợp âm là #000000, lời bài hát và tiêu đề KHÔNG bị ẩn khi xem bộ hợp âm HD', async ({ page }) => {
    // Thiết lập màu hợp âm là đen #000000 ngay từ đầu
    await page.addInitScript(() => {
      localStorage.setItem('sheetapp_chord_prefs', JSON.stringify({ color: '#000000', size: 2.6, yOffset: 1.2 }));
    });

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Chờ 5 hợp âm HD xuất hiện (báo hiệu _build đã hoàn tất)
    const customChords = page.locator('.cc-custom-chord-text');
    await expect(customChords).toHaveCount(5, { timeout: 15000 });

    // Kiểm tra style của lyrics text: không bị transparent!
    const textVisibility = await page.evaluate(() => {
      const svg = document.querySelector('#osmd-container svg');
      if (!svg) return { lyricsCount: 0, invisibleLyricsCount: 0, titleHidden: false };

      const allTexts = Array.from(svg.querySelectorAll('text'));
      
      // Lời bài hát: các text không phải chord symbol và không phải title
      const lyricsTexts = allTexts.filter(t => {
        const isChord = t.closest('.osmd-chord-symbol') || t.classList.contains('osmd-chord-text') || t.classList.contains('cc-custom-chord-text');
        const isTitle = t.classList.contains('osmd-title-text');
        return !isChord && !isTitle && (t.textContent || '').trim().length > 0;
      });

      let invisibleLyrics = 0;
      lyricsTexts.forEach(t => {
        const style = window.getComputedStyle(t);
        if (style.fill === 'transparent' || style.fill === 'rgba(0, 0, 0, 0)' || style.visibility === 'hidden' || style.display === 'none') {
          invisibleLyrics++;
        }
      });

      // Tiêu đề
      const titleEl = svg.querySelector('.osmd-title-text') || allTexts.find(t => (t.textContent || '').includes('Thờ Phượng'));
      let titleHidden = false;
      if (titleEl) {
        const tStyle = window.getComputedStyle(titleEl);
        titleHidden = (tStyle.fill === 'transparent' || tStyle.fill === 'rgba(0, 0, 0, 0)' || tStyle.visibility === 'hidden' || tStyle.display === 'none');
      }

      return {
        lyricsCount: lyricsTexts.length,
        invisibleLyricsCount: invisibleLyrics,
        titleHidden
      };
    });

    console.log('Text visibility result:', textVisibility);
    expect(textVisibility.lyricsCount).toBeGreaterThan(10);
    expect(textVisibility.invisibleLyricsCount).toBe(0);
    expect(textVisibility.titleHidden).toBe(false);

    // Kiểm tra hợp âm gốc OSMD đã bị ẩn đúng cách (fill: transparent)
    // Dùng expect.poll để tự động chờ CSS paint ổn định trên mọi browser engine (Chromium, WebKit)
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const taggedChords = Array.from(document.querySelectorAll('#osmd-container svg .osmd-chord-symbol text, #osmd-container svg .osmd-chord-text'));
        if (taggedChords.length === 0) return false;
        return taggedChords.every(t => {
          const style = window.getComputedStyle(t);
          return style.fill === 'transparent' || style.fill === 'rgba(0, 0, 0, 0)';
        });
      });
    }, { timeout: 15000, intervals: [200, 500] }).toBe(true);
  });

  test('Khi chuyển về TLH, các hợp âm OSMD hiện lại bình thường', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đợi HD render xong
    await expect(page.locator('.cc-custom-chord-text')).toHaveCount(5, { timeout: 15000 });

    // Đổi sang TLH
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('default');
    });

    // Xác nhận CSS ẩn hợp âm đã được dọn trống (styleBlock.textContent = '')
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const styleEl = document.getElementById('cc-custom-style');
        return !styleEl || styleEl.textContent.trim() === '';
      });
    }, { timeout: 15000, intervals: [200, 500] }).toBe(true);

    // Các hợp âm OSMD không còn bị transparent
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const taggedChords = Array.from(document.querySelectorAll('#osmd-container svg .osmd-chord-symbol text, #osmd-container svg .osmd-chord-text'));
        if (taggedChords.length === 0) return false;
        return taggedChords.some(t => {
          const style = window.getComputedStyle(t);
          return style.fill !== 'transparent' && style.fill !== 'rgba(0, 0, 0, 0)';
        });
      });
    }, { timeout: 15000, intervals: [200, 500] }).toBe(true);
  });

});
