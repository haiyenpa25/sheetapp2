// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-core-restore.spec.js
 *
 * Hồi quy cho đợt khôi phục 2026-09-28 (chỉ đọc — không ghi DB):
 * 1. Các module chính được nạp; nút Đăng nhập mở modal.
 * 2. Dịch giọng đổi CHỮ HỢP ÂM (không chỉ nốt/hoá biểu) — TLH và HD overlay.
 * 3. Mở bài với tông tập (luồng Setlist) cho hợp âm đúng tông.
 * 4. Chọn "Một khổ" chỉ hiện đúng khổ đã chọn.
 * 5. Chế độ Band có nội dung.
 * 6. Điện thoại: không ẩn lời của hàng nhạc đầu; hợp âm đầu không bị gắn nhầm class tiêu đề.
 * 7. Thanh công cụ: ⚡, ◀ ▶, ⋮ luôn nằm trong màn hình.
 */

const CHORD_SELECTOR = '.cc-custom-chord-text, #osmd-container svg text[data-chord-text], #osmd-container svg text.osmd-chord-text';

async function blockWrites(page) {
  await page.route('**/api/**', route => {
    const m = route.request().method();
    if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: 403, body: '{"success":false}' });
    return route.continue();
  });
}

async function openSong(page, query) {
  await blockWrites(page);
  await page.goto('./' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#osmd-container svg', { state: 'attached', timeout: 25000 });
  await page.waitForTimeout(1500);
}

/** Chữ hợp âm đang hiển thị (overlay HD hoặc hợp âm SVG không bị ẩn). */
async function visibleChords(page) {
  return page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => {
    if (e.classList.contains('cc-custom-chord-text')) return e.offsetParent !== null;
    const f = getComputedStyle(e).fill;
    return f && f !== 'transparent' && f !== 'rgba(0, 0, 0, 0)';
  }).map(e => e.textContent.trim()).filter(Boolean), CHORD_SELECTOR);
}

async function verseMarks(page) {
  return page.evaluate(() => [...document.querySelectorAll('#osmd-container svg text')]
    .filter(t => /^\d\.\S/.test(t.textContent.trim()) && getComputedStyle(t).display !== 'none')
    .map(t => t.textContent.trim().slice(0, 2)));
}

test.describe('Khôi phục lõi trang Thư viện', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_role_hint_shown', '1');
      localStorage.removeItem('sheetapp_instrument_role');
      localStorage.removeItem('sheetapp_verse_mode');
    });
  });

  test('1. Module chính có mặt, không lỗi console, nút Đăng nhập mở modal', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSong(page, '?song=thanh-ca-002');

    const missing = await page.evaluate(() => ['Auth', 'HistoryManager', 'PageNav', 'LyricExtractor', 'Metronome',
      'SetlistUI', 'ChordCanvasTranspose', 'SongPreloader', 'StageLens', 'SessionTracker', 'AppShell']
      // @ts-ignore
      .filter(n => typeof window[n] === 'undefined'));
    expect(missing).toEqual([]);

    // Lần đầu mở không có modal vai trò chặn màn hình
    await expect(page.locator('#modal-stage-lens')).toHaveCount(0);

    await page.locator('#shell-btn-login, #btn-toolbar-auth').first().click();
    await expect(page.locator('#auth-modal')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('2. Dịch +1 đổi chữ hợp âm TLH: G Em D7 → Ab Fm Eb7', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openSong(page, '?song=thanh-ca-002');
    const before = (await visibleChords(page)).slice(0, 3);
    expect(before).toEqual(['G', 'Em', 'D7']);

    // @ts-ignore
    await page.evaluate(() => window.App.transposeBy(1));
    await expect.poll(async () => (await visibleChords(page)).slice(0, 3), { timeout: 8000 })
      .toEqual(['Ab', 'Fm', 'Eb7']);
  });

  test('3. Mở bài với tông tập +2 (luồng Setlist) → hợp âm ở tông A', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openSong(page, '?song=thanh-ca-001');
    await page.evaluate(() => {
      // @ts-ignore
      const s = (window.LibraryUI.getSongs() || []).find(x => x.id === 'thanh-ca-002');
      // @ts-ignore
      return window.App.loadSongWithProfile(s, 'HD', 2);
    });
    await expect.poll(async () => (await visibleChords(page)).slice(0, 3), { timeout: 10000 })
      .toEqual(['A', 'F#m', 'E7']);
  });

  test('4. Hợp âm HD (overlay) cũng dịch: bài 001 G Am F → A Bm G, và nằm ngay trên khuông', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openSong(page, '?song=thanh-ca-001');
    const overlay = () => page.evaluate(() => [...document.querySelectorAll('.cc-custom-chord-text')]
      .filter(e => e.offsetParent !== null).map(e => e.textContent.trim()));
    expect((await overlay()).slice(0, 3)).toEqual(['G', 'Am', 'F']);

    // Mép dưới chữ hợp âm nằm trên dòng kẻ trên cùng và không đè dòng tác giả
    const geom = await page.evaluate(() => {
      const badge = document.querySelector('.cc-custom-chord-text')?.getBoundingClientRect();
      const staffTop = [...document.querySelectorAll('#osmd-container svg path')].map(p => p.getBoundingClientRect())
        .filter(r => r.width > 100 && r.height < 3).map(r => r.top).sort((a, b) => a - b)[0];
      const composer = [...document.querySelectorAll('#osmd-container svg text')].find(t => /Wesley/.test(t.textContent))?.getBoundingClientRect();
      return { bottom: badge?.bottom, staffTop, composerBottom: composer?.bottom };
    });
    expect(geom.bottom).toBeLessThanOrEqual(geom.staffTop);
    expect(geom.staffTop - geom.bottom).toBeLessThan(40);
    if (geom.composerBottom) expect(geom.bottom - 30).toBeGreaterThanOrEqual(geom.composerBottom - 2);

    // @ts-ignore
    await page.evaluate(() => window.App.transposeBy(2));
    await expect.poll(async () => (await overlay()).slice(0, 3), { timeout: 8000 }).toEqual(['A', 'Bm', 'G']);
  });

  test('5. Chọn "Một khổ" → khổ 3 chỉ hiện khổ 3 (bài 002 có 5 khổ)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openSong(page, '?song=thanh-ca-002');
    expect(await verseMarks(page)).toEqual(['1.', '2.', '3.', '4.', '5.']);
    await page.evaluate(() => {
      // @ts-ignore
      window.VerseManager.setMode('single');
      // @ts-ignore
      window.VerseManager.setVerse(3);
    });
    await expect.poll(() => verseMarks(page), { timeout: 8000 }).toEqual(['3.']);
  });

  test('6. Chế độ Band có lời và hợp âm', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openSong(page, '?song=thanh-ca-001');
    // #btn-band-toggle/#btn-toggle-view bị thay bằng công tắc 2 nút #btn-view-sheet /
    // #btn-view-lyrics kể từ Ticket R1-2 (ROADMAP5); nút cũ vẫn còn trong DOM nhưng ẩn
    // (không dùng .first() với cả 2 vì thứ tự DOM không đảm bảo chọn đúng nút mới).
    await page.locator('#btn-view-lyrics').click();
    await expect.poll(() => page.evaluate(() => (document.getElementById('lyric-view-container')?.innerText || '').length),
      { timeout: 6000 }).toBeGreaterThan(200);
    // Mỗi âm tiết là một phần tử riêng (hợp âm đặt trên âm tiết) nên kiểm tra từng từ.
    const text = await page.locator('#lyric-view-container').innerText();
    expect(text).toMatch(/Cúi/);
    expect(text).toMatch(/Vua/);
    expect(text).toMatch(/\bAm\b/);
  });

  test('7. Điện thoại: đủ 5 khổ ở hàng đầu, hợp âm đầu không mang class tiêu đề', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSong(page, '?song=thanh-ca-002&v=sheet');
    expect(await verseMarks(page)).toEqual(['1.', '2.', '3.', '4.', '5.']);
    const titleTagged = await page.evaluate(() =>
      [...document.querySelectorAll('#osmd-container svg text.osmd-title-text')].map(t => t.textContent.trim()));
    // Trên điện thoại OSMD có thể không vẽ tiêu đề; nếu có phần tử mang class tiêu đề
    // thì phải là chữ thật (không phải hợp âm hay dấu "-").
    expect(titleTagged.every(t => t.length >= 3 && !/^[A-G][b#]?m?\d?$/.test(t))).toBe(true);
  });

  for (const vp of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    test(`8. Thanh công cụ ${vp.width}x${vp.height}: ⚡, ◀ ▶, ⋮ nằm trong màn hình`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openSong(page, '?song=thanh-ca-001');
      const out = await page.evaluate(() => ['btn-fullscreen', 'btn-prev-song', 'btn-next-song', 'btn-more-options']
        .filter(id => {
          const e = document.getElementById(id);
          if (!e || e.offsetParent === null) return true;
          const r = e.getBoundingClientRect();
          return r.left < 0 || r.right > window.innerWidth + 0.5;
        }));
      expect(out).toEqual([]);
    });
  }
});
