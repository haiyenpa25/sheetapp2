// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-dark-mode.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-5 (ROADMAP 4):
 * Chế độ tối thật (True Dark Mode):
 *  - Bỏ đảo màu 2 lần (không còn filter: invert).
 *  - Tô màu SVG bằng CSS: nốt, khuông, lời màu ngà #E8E2D0 trên nền #0B0B0C, hợp âm hổ phách #FBBF24.
 *
 * Tiêu chí nghiệm thu:
 *  - Độ sáng pixel nền của vùng nhạc < 10%.
 *  - Tương phản hợp âm ≥ 8:1.
 *  - Tương phản lời nhạc / nốt ≥ 8:1.
 *  - Không còn filter: invert trên vùng bản nhạc.
 *  - Chạy đạt 100% trên cả Chromium và WebKit.
 */

test.describe('Ticket L0-5: Chế độ tối thật (True Dark Mode)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Bật chế độ tối: nền #0B0B0C (<10% sáng), không invert, hợp âm #FBBF24 (tương phản ≥8:1)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đợi render hợp âm HD xong
    await expect(page.locator('.cc-custom-chord-text')).toHaveCount(5, { timeout: 15000 });

    // Bật chế độ tối qua nút dark toggle
    await page.evaluate(() => {
      const toggle = document.getElementById('btn-dark-toggle');
      if (toggle) toggle.click();
      else document.body.classList.add('dark-mode');
    });

    // Xác nhận body có class dark-mode
    await expect(page.locator('body')).toHaveClass(/dark-mode/);

    // Đợi overlay hợp âm HD hiển thị đầy đủ trong dark mode
    await expect(page.locator('.cc-custom-chord-text')).toHaveCount(5, { timeout: 15000 });

    // Đo đạc các thông số nghiệm thu bằng evaluate
    const metrics = await page.evaluate(() => {
      const parseRgb = (str) => {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return { r: 0, g: 0, b: 0 };
        return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
      };

      const getLuminance = ({ r, g, b }) => {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      };

      const getContrastRatio = (c1, c2) => {
        const l1 = getLuminance(c1);
        const l2 = getLuminance(c2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const container = document.getElementById('osmd-container');
      const bgComputed = window.getComputedStyle(container).backgroundColor;
      const bgRgb = parseRgb(bgComputed);
      const bgBrightness = (0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b) / 255;

      const containerFilter = window.getComputedStyle(container).filter;
      const svg = container.querySelector('svg');
      const svgFilter = svg ? window.getComputedStyle(svg).filter : 'none';

      // Màu hợp âm đang hiển thị trên màn hình
      const customChord = document.querySelector('.cc-custom-chord-text');
      const osmdChord = Array.from(document.querySelectorAll('#osmd-container svg .osmd-chord-text')).find(t => {
        const s = window.getComputedStyle(t);
        return s.fill !== 'transparent' && s.fill !== 'rgba(0, 0, 0, 0)';
      });
      const chordEl = customChord || osmdChord;
      const chordComputed = chordEl 
        ? (chordEl.tagName.toLowerCase() === 'text' ? window.getComputedStyle(chordEl).fill : window.getComputedStyle(chordEl).color) 
        : 'rgb(0,0,0)';
      const chordRgb = parseRgb(chordComputed);
      const chordContrast = getContrastRatio(chordRgb, bgRgb);

      // Màu lời nhạc
      const allTexts = Array.from(svg ? svg.querySelectorAll('text') : []);
      const lyricEl = allTexts.find(t => !t.classList.contains('osmd-chord-text') && !t.classList.contains('osmd-title-text') && (t.textContent || '').trim().length > 1);
      const lyricComputed = lyricEl ? window.getComputedStyle(lyricEl).fill : 'rgb(0,0,0)';
      const lyricRgb = parseRgb(lyricComputed);
      const lyricContrast = getContrastRatio(lyricRgb, bgRgb);

      return {
        bgBrightness,
        bgRgb,
        hasInvert: containerFilter.includes('invert') || svgFilter.includes('invert'),
        containerFilter,
        svgFilter,
        chordRgb,
        chordContrast,
        lyricRgb,
        lyricContrast
      };
    });

    console.log('Dark mode metrics:', metrics);

    // 1. Pixel nền có độ sáng < 10%
    expect(metrics.bgBrightness).toBeLessThan(0.10);

    // 2. Không còn bất kỳ filter: invert nào
    expect(metrics.hasInvert).toBe(false);

    // 3. Tương phản hợp âm ≥ 8:1 (thực tế ~11.5:1)
    expect(metrics.chordContrast).toBeGreaterThanOrEqual(8.0);

    // 4. Tương phản lời nhạc ≥ 8:1 (thực tế ~14.5:1)
    expect(metrics.lyricContrast).toBeGreaterThanOrEqual(8.0);

    // Chụp ảnh lưu artifact
    await page.screenshot({ path: 'test-results/dark-mode-audit-ipad.png' });
  });

  test('Bộ hợp âm TLH (gốc) cũng hiển thị màu hổ phách #FBBF24 ở chế độ tối', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 35000 });

    // Bật chế độ tối
    await page.evaluate(() => {
      document.body.classList.add('dark-mode');
    });

    // Chuyển sang TLH
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('default');
    });

    await page.waitForTimeout(400);

    // Kiểm tra hợp âm TLH của OSMD có màu hổ phách #FBBF24
    const osmdChordMetrics = await page.evaluate(() => {
      const taggedChords = Array.from(document.querySelectorAll('#osmd-container svg .osmd-chord-text'));
      if (taggedChords.length === 0) return { count: 0, isAmber: false };

      const amberColor = 'rgb(251, 191, 36)';
      const allAmber = taggedChords.every(t => {
        const fill = window.getComputedStyle(t).fill;
        return fill === amberColor;
      });

      return { count: taggedChords.length, isAmber: allAmber };
    });

    console.log('TLH chord metrics in dark mode:', osmdChordMetrics);
    expect(osmdChordMetrics.count).toBeGreaterThan(0);
    expect(osmdChordMetrics.isAmber).toBe(true);
  });

});
