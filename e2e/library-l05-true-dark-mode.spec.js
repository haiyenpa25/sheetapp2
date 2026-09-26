// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l05-true-dark-mode.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-5 (ROADMAP 4):
 * "Chế độ tối thật: bỏ đảo màu 2 lần; tô màu SVG bằng CSS variables
 *  (nốt, khuông, lời màu ngà #E8E2D0 trên nền #0B0B0C, hợp âm hổ phách #FBBF24)
 *  Nghiệm thu: pixel nền của vùng nhạc có độ sáng < 10%; tương phản hợp âm >= 8:1"
 */

test.describe('Ticket L0-5: Chế độ tối thật cho bản nhạc', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[Browser ${msg.type()}]:`, msg.text());
    });
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_dark_mode', '1');
    });
  });

  test('Bản nhạc ở chế độ tối không dùng invert, nền #0B0B0C độ sáng < 10%, hợp âm hổ phách tương phản >= 8:1', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đóng modal auth nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // Đảm bảo body có class dark-mode
    await page.evaluate(() => {
      document.body.classList.add('dark-mode');
    });

    // Chờ bản nhạc SVG xuất hiện
    const svgLocator = page.locator('#osmd-container svg').first();
    await expect(svgLocator).toBeVisible({ timeout: 25000 });

    // 1. Kiểm tra không có filter invert trên SVG hoặc container
    const filterMetrics = await page.evaluate(() => {
      const container = document.getElementById('osmd-container');
      const svg = container?.querySelector('svg');
      const cStyle = container ? window.getComputedStyle(container) : null;
      const sStyle = svg ? window.getComputedStyle(svg) : null;

      return {
        containerFilter: cStyle?.filter || '',
        svgFilter: sStyle?.filter || '',
        hasInvert: (cStyle?.filter?.includes('invert') || sStyle?.filter?.includes('invert')) ?? false
      };
    });

    expect(filterMetrics.hasInvert, 'Vùng nhạc tuyệt đối không được dùng filter invert()').toBe(false);

    // 2. Kiểm tra màu nền vùng nhạc và độ sáng < 10%
    const bgMetrics = await page.evaluate(() => {
      const el = document.getElementById('osmd-container') || document.querySelector('.sheet-viewer-wrapper');
      if (!el) return { error: 'No container' };
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;

      // Phân tích rgb(r, g, b)
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return { rawBg: bg, brightnessPct: 100 };
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);

      // Độ sáng theo công thức luminance chuẩn
      const brightnessPct = (Math.max(r, g, b) / 255) * 100;
      return {
        r, g, b,
        rawBg: bg,
        brightnessPct: brightnessPct,
        is0B0B0C: r <= 15 && g <= 15 && b <= 15
      };
    });

    expect(bgMetrics.is0B0B0C, `Màu nền (${bgMetrics.rawBg}) phải là màu tối sâu (#0B0B0C)`).toBe(true);
    expect(bgMetrics.brightnessPct, `Độ sáng nền (${bgMetrics.brightnessPct.toFixed(1)}%) phải < 10%`).toBeLessThan(10);

    // 3. Kiểm tra nốt nhạc, khuông nhạc, lời có màu ngà (#E8E2D0)
    const inkMetrics = await page.evaluate(() => {
      const svg = document.querySelector('#osmd-container svg');
      if (!svg) return { error: 'No svg' };

      // Lấy thẻ path nốt nhạc
      const paths = Array.from(svg.querySelectorAll('path'));
      const samplePathFill = paths.length ? window.getComputedStyle(paths[0]).fill : '';
      const samplePathStroke = paths.length ? window.getComputedStyle(paths[0]).stroke : '';

      // Lấy 1 thẻ text thật (có chữ và không bị ẩn)
      const realTexts = Array.from(svg.querySelectorAll('text')).filter(t => {
        const txt = (t.textContent || '').trim();
        return txt.length > 0 &&
               !t.classList.contains('osmd-chord-symbol') &&
               !t.classList.contains('osmd-chord-text');
      });
      const sampleTextFill = realTexts.length ? window.getComputedStyle(realTexts[0]).fill : '';

      const isIvory = (c) => c && (c.includes('232') || c.includes('226') || c.includes('208') || c.includes('e8e2d0'));

      return {
        totalPaths: paths.length,
        samplePathFill,
        samplePathStroke,
        totalRealTexts: realTexts.length,
        sampleTextFill,
        pathIsIvory: isIvory(samplePathFill) || isIvory(samplePathStroke),
        textIsIvory: isIvory(sampleTextFill)
      };
    });

    console.log('INK METRICS:', JSON.stringify(inkMetrics));
    expect(inkMetrics.pathIsIvory || inkMetrics.textIsIvory, 'Nét vẽ nốt nhạc hoặc lời bài hát phải mang màu ngà #E8E2D0').toBe(true);

    // 4. Kiểm tra hợp âm có màu hổ phách #FBBF24 và độ tương phản >= 8:1
    const chordMetrics = await page.evaluate(() => {
      // Tìm hợp âm từ custom layer hoặc SVG chord symbol
      const customChord = document.querySelector('.cc-custom-chord-text');
      const svgChord = document.querySelector('.osmd-chord-symbol, [data-chord-symbol="true"]');
      const target = customChord || svgChord;

      if (!target) return { error: 'No chord found' };
      const style = window.getComputedStyle(target);
      const color = style.color || style.fill;

      // Phân tích rgb(r, g, b)
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return { rawColor: color, contrast: 1 };
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);

      // Tính contrast ratio đối với nền (11, 11, 12)
      const toLum = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const lumChord = 0.2126 * toLum(r) + 0.7152 * toLum(g) + 0.0722 * toLum(b);
      const lumBg = 0.2126 * toLum(11) + 0.7152 * toLum(11) + 0.0722 * toLum(12);
      const contrast = (lumChord + 0.05) / (lumBg + 0.05);

      return {
        r, g, b,
        rawColor: color,
        contrast: contrast,
        isAmber: r >= 240 && g >= 180 && b <= 50 // #FBBF24 là (251, 191, 36)
      };
    });

    expect(chordMetrics.contrast, `Độ tương phản hợp âm (${chordMetrics.contrast?.toFixed(2)}:1) phải >= 8:1`).toBeGreaterThanOrEqual(8.0);
    expect(chordMetrics.isAmber, `Màu hợp âm (${chordMetrics.rawColor}) phải là màu hổ phách #FBBF24`).toBe(true);

    // 5. Chụp ảnh màn hình chế độ tối để làm bằng chứng nghiệm thu
    await page.screenshot({ path: 'test-results/dark-mode-sheet.png' });
  });
});
