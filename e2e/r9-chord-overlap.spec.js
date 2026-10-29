// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * R9 / P4-3 (RULE.md §3): hợp âm HD và chấm "+" trên bản nhạc không chồng lấn, chữ ≥ 12px, nằm trong vùng bản nhạc.
 * Bộ HD và phiên đăng nhập hoaidinh (chord_code=HD) được giả lập bằng cách chặn request trong trình duyệt,
 * KHÔNG ghi gì vào CSDL.
 */
const SONG_ID = 'ton-vinh-chua-hang-huu--051-voi-ca-trai-tim';
const ZOOMS = [50, 100, 150, 200];
const MIN_CHORD_FONT_PX = 12;
const CHORDS = ['Am', 'F', 'C', 'G7', 'Dm7', 'Bb/D', 'Em', 'Fmaj7'];

test.describe('R9 P4-3: hợp âm HD không chồng chấm +', () => {
  test('mọi mức zoom: không chồng lấn, chữ >= 12px, nằm trong bản nhạc', async ({ page }) => {
    const fake = [];
    for (let m = 0; m < 12; m++) for (let n = 0; n < 4; n += 2) fake.push({ measureIdx: m, noteIdx: n, chord: CHORDS[(m * 2 + n / 2) % CHORDS.length] });

    await page.route('**/api/index.php?route=auth*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: { success: true, loggedIn: true, username: 'hoaidinh', role: 'banhat', display_name: 'Hoài Dinh', chord_code: 'HD' } });
    });
    await page.route('**/api/index.php?route=chord_sets*', (route) => {
      const url = route.request().url();
      if (route.request().method() !== 'GET') return route.abort();
      if (url.includes('action=list')) return route.fulfill({ json: { success: true, sets: ['default', 'HD'] } });
      if (url.includes('action=load') && /name=HD/i.test(url)) return route.fulfill({ json: { success: true, chords: fake, checksum: 'r9-fake' } });
      return route.continue();
    });

    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

    await page.goto(`./?song=${SONG_ID}`);
    await page.waitForSelector('#osmd-container svg', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('.cc-custom-chord-text').length > 0, null, { timeout: 15000 });
    await page.evaluate(() => window.ChordCanvas.setAddMode(true));
    await page.waitForFunction(() => document.querySelectorAll('.cc-dot-btn').length > 0, null, { timeout: 10000 });

    for (const zoom of ZOOMS) {
      await page.evaluate((z) => window.App.setZoom(z), zoom);
      await page.waitForTimeout(1800);
      const m = await page.evaluate((minFont) => {
        const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const area = document.getElementById('osmd-container').getBoundingClientRect();
        const texts = [...document.querySelectorAll('.cc-custom-chord-text')];
        const allDots = [...document.querySelectorAll('.cc-dot-btn')];
        const dots = allDots.filter((d) => getComputedStyle(d).visibility !== 'hidden');
        const tb = texts.map(box), db = dots.map(box);
        const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        let textText = 0, textDot = 0;
        for (let i = 0; i < tb.length; i++) {
          for (let j = i + 1; j < tb.length; j++) if (hit(tb[i], tb[j])) textText++;
          for (const d of db) if (hit(tb[i], d)) textDot++;
        }
        const small = texts.filter((t) => parseFloat(getComputedStyle(t).fontSize) < minFont).length;
        const outside = tb.filter((r) => r.left < area.left - 1 || r.right > area.right + 1).length;
        return { texts: texts.length, dots: dots.length, hiddenDots: allDots.length - dots.length, textText, textDot, small, outside };
      }, MIN_CHORD_FONT_PX);

      await page.screenshot({ path: `docs/fix-evidence/r9/screenshots/p4-3b-zoom-${zoom}.png` });
      console.log(`zoom ${zoom}%: ${JSON.stringify(m)}`);
      expect.soft(m.texts, `zoom ${zoom}: phải có hợp âm`).toBeGreaterThan(0);
      expect.soft(m.textText, `zoom ${zoom}: hợp âm chồng hợp âm`).toBe(0);
      expect.soft(m.textDot, `zoom ${zoom}: hợp âm chồng chấm +`).toBe(0);
      expect.soft(m.small, `zoom ${zoom}: chữ hợp âm < ${MIN_CHORD_FONT_PX}px`).toBe(0);
      expect.soft(m.outside, `zoom ${zoom}: hợp âm ngoài vùng bản nhạc`).toBe(0);
    }
    expect(errors, 'không có lỗi JS').toEqual([]);
  });
});
