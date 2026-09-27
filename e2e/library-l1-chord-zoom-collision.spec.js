// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('L1-1 · Hợp âm co giãn theo zoom & chống va chạm (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Tỉ lệ chiều cao hợp âm / lời >= 1.3 ở các mức zoom 70%, 100%, 150%', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const zoomLevels = [70, 100, 150];

    for (const zoom of zoomLevels) {
      await page.evaluate(z => window.App?.setZoom?.(z), zoom);
      await page.waitForTimeout(800);

      const metrics = await page.evaluate(() => {
        const svg = document.querySelector('#osmd-container svg');
        if (!svg) return null;

        // Lyrics texts trong SVG (các text của lời bài hát)
        const lyrics = Array.from(svg.querySelectorAll('g.vf-text text'))
          .filter(t => {
            const txt = t.textContent ? t.textContent.trim() : '';
            return txt.length > 0 && !t.classList.contains('osmd-chord-text') && !t.classList.contains('osmd-title-text');
          })
          .map(t => t.getBoundingClientRect().height)
          .filter(h => h > 0);

        // Chords texts trong SVG
        const chords = Array.from(svg.querySelectorAll('.osmd-chord-text, text[font-family*="OSMDChordFont"]'))
          .map(t => t.getBoundingClientRect().height)
          .filter(h => h > 0);

        const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const avgLyric = avg(lyrics);
        const avgChord = avg(chords);

        return {
          lyricCount: lyrics.length,
          avgLyric,
          chordCount: chords.length,
          avgChord,
          ratio: avgLyric > 0 ? (avgChord / avgLyric) : 0
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics.chordCount).toBeGreaterThan(0);
      expect(metrics.avgChord).toBeGreaterThan(0);
      if (metrics.lyricCount > 0 && metrics.avgLyric > 0) {
        expect(metrics.ratio).toBeGreaterThanOrEqual(1.30);
      }
    }
  });

  test('Chống va chạm: Không có 2 hộp hợp âm nào giao nhau', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra ở zoom 100%
    await page.evaluate(() => window.App?.setZoom?.(100));
    await page.waitForTimeout(800);

    const collisionCount = await page.evaluate(() => {
      const svg = document.querySelector('#osmd-container svg');
      if (!svg) return -1;

      const chords = Array.from(svg.querySelectorAll('.osmd-chord-text, text[font-family*="OSMDChordFont"]'))
        .filter(t => t.textContent && t.textContent.trim().length > 0);

      let overlaps = 0;
      for (let i = 0; i < chords.length; i++) {
        const rectA = chords[i].getBoundingClientRect();
        if (rectA.width === 0 || rectA.height === 0) continue;

        for (let j = i + 1; j < chords.length; j++) {
          const rectB = chords[j].getBoundingClientRect();
          if (rectB.width === 0 || rectB.height === 0) continue;

          // Cùng một hàng (khoảng cách Y < 25px)
          const sameRow = Math.abs(rectA.top - rectB.top) < 25;
          if (sameRow) {
            // Kiểm tra giao nhau theo chiều ngang X
            const overlapX = Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left);
            if (overlapX > 0) {
              overlaps++;
            }
          }
        }
      }
      return overlaps;
    });

    expect(collisionCount).toBe(0);
  });

  test('Hợp âm custom (bộ HD) co giãn theo zoom và không va chạm', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đổi set sang HD
    await page.evaluate(async () => {
      if (window.ChordCanvas?.switchSet) {
        await window.ChordCanvas.switchSet('HD');
      }
    });
    await page.waitForTimeout(600);

    for (const zoom of [70, 100, 150]) {
      await page.evaluate(z => window.App?.setZoom?.(z), zoom);
      await page.waitForTimeout(800);

      const res = await page.evaluate(() => {
        const badges = Array.from(document.querySelectorAll('.cc-custom-chord-text'))
          .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);

        if (badges.length === 0) return { badges: 0, overlaps: 0 };

        let overlaps = 0;
        for (let i = 0; i < badges.length; i++) {
          const rA = badges[i].getBoundingClientRect();
          for (let j = i + 1; j < badges.length; j++) {
            const rB = badges[j].getBoundingClientRect();
            // Cùng hàng
            if (Math.abs(rA.top - rB.top) < 25) {
              const overlapX = Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left);
              if (overlapX > 0) {
                overlaps++;
              }
            }
          }
        }

        return { badges: badges.length, overlaps };
      });

      expect(res.overlaps).toBe(0);
    }
  });

});
