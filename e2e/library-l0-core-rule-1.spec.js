// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-core-rule-1.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-2 & Quyết định L-D1 (ROADMAP 4):
 * 1. Bài 002 (HD có 0 hợp âm): kích hoạt Core Rule 1 dự phòng sang TLH gốc.
 *    - Chip hiển thị: "HD chưa có · đang hiện TLH".
 *    - Màn hình hiển thị đầy đủ ≥ 20 hợp âm TLH (không còn bị CSS ẩn).
 * 2. Bài 001 (HD có 5 hợp âm, TLH có 17 hợp âm < 30%): tuân theo quyết định L-D1:
 *    - Hiển thị 5 hợp âm HD.
 *    - Chip thanh thông tin hiển thị: "HD còn thiếu (5/17) — xem TLH".
 *    - Bấm 1 chạm vào chip -> chuyển đổi nhanh sang TLH đầy đủ.
 * 3. Quét ngẫu nhiên các bài mẫu: bài nào XML có hợp âm thì màn hình PHẢI hiển thị hợp âm (không được bằng 0).
 */

test.describe('Ticket L0-2: Core Rule 1 — Fallback HD rỗng sang TLH & Quyết định L-D1', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Bài 002 (HD rỗng) tự động fallback sang TLH, hiển thị ≥20 hợp âm và nhãn thông báo', async ({ page }) => {
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra chip toolbar và thanh thông tin
    const chordBadge = page.locator('#chord-set-count');
    await expect(chordBadge).toContainText('HD chưa có · đang hiện TLH', { timeout: 10000 });

    const siChordChip = page.locator('#si-chord-set-chip');
    await expect(siChordChip).toContainText('HD chưa có · đang hiện TLH', { timeout: 10000 });

    // Đếm số hợp âm thực tế nhìn thấy trên bản nhạc (chords có fill = chordColor và không bị transparent)
    const chordStats = await page.evaluate(() => {
      const svg = document.querySelector('#osmd-container svg');
      if (!svg) return { count: 0, chords: [] };

      const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
      const texts = Array.from(svg.querySelectorAll('text'));
      const visibleChords = [];

      texts.forEach(t => {
        const text = t.textContent?.trim();
        if (!text) return;
        const fill = t.getAttribute('fill') || window.getComputedStyle(t).fill;
        if (fill === chordColor || fill === 'rgb(220, 38, 38)') {
          const style = window.getComputedStyle(t);
          const isHidden = style.fill === 'transparent' || style.fill === 'rgba(0, 0, 0, 0)' || style.display === 'none' || style.visibility === 'hidden';
          if (!isHidden) {
            visibleChords.push(text);
          }
        }
      });

      return {
        count: visibleChords.length,
        chords: visibleChords.slice(0, 10)
      };
    });

    console.log(`Bài 002: Đã phát hiện ${chordStats.count} hợp âm hiển thị:`, chordStats.chords);
    expect(chordStats.count).toBeGreaterThanOrEqual(20);
  });

  test('Bài 001 (HD có 5 hợp âm, thưa <30%) hiển thị nhãn L-D1 và đổi 1 chạm sang TLH', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra nhãn L-D1 trên thanh thông tin
    const siChordChip = page.locator('#si-chord-set-chip');
    await expect(siChordChip).toContainText('HD còn thiếu', { timeout: 10000 });
    await expect(siChordChip).toContainText('xem TLH', { timeout: 10000 });

    // Đếm 5 hợp âm HD tùy biến trên màn hình (auto-wait)
    await expect(page.locator('.cc-custom-chord-text')).toHaveCount(5, { timeout: 10000 });

    // Ticket R1-3 (ROADMAP5): #si-chord-set-chip sống trong #song-info-strip, nay bị ẩn
    // vĩnh viễn (display:none!important) nên không click được trực tiếp -- hành động
    // 1-chạm đổi nhanh HD<->TLH được khôi phục trên popover ⓘ (#si-pop-chordset), xem
    // song-info-bar.js (init()). toContainText() ở trên vẫn đọc được text vì nó không
    // đòi hỏi visibility, chỉ click() mới cần.
    await page.locator('#btn-song-info-popover').click();
    const popChordset = page.locator('#si-pop-chordset');
    await expect(popChordset).toBeVisible();
    await popChordset.click();

    // Xác nhận đã chuyển sang TLH (gốc)
    await expect(popChordset).toContainText('TLH (Gốc)', { timeout: 10000 });

    // Kiểm tra số hợp âm TLH xuất hiện trên SVG
    const tlhChordsVisible = await page.evaluate(() => {
      const svg = document.querySelector('#osmd-container svg');
      if (!svg) return 0;
      const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
      const texts = Array.from(svg.querySelectorAll('text'));
      return texts.filter(t => {
        const fill = t.getAttribute('fill') || window.getComputedStyle(t).fill;
        return (fill === chordColor || fill === 'rgb(220, 38, 38)');
      }).length;
    });

    expect(tlhChordsVisible).toBeGreaterThanOrEqual(15);
  });

  test('Quét ngẫu nhiên các bài mẫu: bài nào XML có hợp âm thì màn hình PHẢI hiện hợp âm', async ({ page }) => {
    const sampleSongs = [
      'thanh-ca-002',
      'thanh-ca-003',
      'thanh-ca-004',
      'thanh-ca-005',
      'thanh-ca-006',
      'thanh-ca-007',
      'thanh-ca-008',
      'thanh-ca-009',
      'thanh-ca-010',
      'thanh-ca-015'
    ];

    for (const songId of sampleSongs) {
      await page.goto(`./?song=${songId}`, { waitUntil: 'domcontentloaded' });
      const osmdSvg = page.locator('#osmd-container svg').first();
      await expect(osmdSvg).toBeVisible({ timeout: 25000 });

      const check = await page.evaluate(() => {
        const xml = window.OSMDRenderer?.getCurrentXml?.();
        const hasXmlHarmony = xml ? xml.includes('<harmony') : false;

        const svg = document.querySelector('#osmd-container svg');
        let visibleCount = 0;
        if (svg) {
          const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
          const texts = Array.from(svg.querySelectorAll('text'));
          texts.forEach(el => {
            const fill = el.getAttribute('fill') || window.getComputedStyle(el).fill;
            if (fill === chordColor || fill === 'rgb(220, 38, 38)') {
              const style = window.getComputedStyle(el);
              if (style.fill !== 'transparent' && style.fill !== 'rgba(0, 0, 0, 0)') {
                visibleCount++;
              }
            }
          });
        }
        const customCount = document.querySelectorAll('.cc-custom-chord-text').length;
        const total = visibleCount + customCount;

        return { hasXmlHarmony, total };
      });

      if (check.hasXmlHarmony) {
        expect(check.total, `Bài ${songId} có XML harmony nhưng màn hình hiển thị 0 hợp âm!`).toBeGreaterThan(0);
      }
    }
  });

});
