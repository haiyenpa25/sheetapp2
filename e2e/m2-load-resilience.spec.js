// @ts-check
/**
 * e2e/m2-load-resilience.spec.js
 * Kiểm thử E2E Giai đoạn M2 (M2-4, M2-5):
 * - M2-4: XML trả 500 → tên bài vẫn đúng, có panel lỗi tại chỗ (Thử lại, Xem lời), không gọi showWelcome;
 *         chord_sets lỗi → bản nhạc vẫn hiện (hợp âm TLH theo Core Rule 1).
 * - M2-5: Deep link ?song=: bài không có trong danh sách thì gọi ApiService.songs.get;
 *         danh sách lỗi thì hiện "Không tải được danh sách · Thử lại", không phải "Không tìm thấy bài hát".
 */
const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost:8922/sheetapp2/';

const DEVICES = [
  { id: 'pixel7', project: 'chromium', descriptor: devices['Pixel 7'] },
  { id: 'iphone13', project: 'webkit', descriptor: devices['iPhone 13'] },
  {
    id: 'ipadmini',
    project: 'webkit',
    descriptor: {
      ...devices['iPad Mini'],
      viewport: { width: 768, height: 1024 },
    },
  },
];

const UIS = [
  { id: 'modern', path: './' },
  { id: 'classic', path: 'old/' },
];

test.describe('M2-4 · Tên bài gán ngay, panel lỗi tại chỗ (Thử lại, Xem lời), và Promise.allSettled cho chord_sets', () => {
  for (const dev of DEVICES) {
    for (const ui of UIS) {
      test(`M2-4 load error panel & chord_sets resilience: ${dev.id} - ${ui.id}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chỉ chạy ${dev.id} trên ${dev.project}`);
        test.setTimeout(40000);

        const context = await browser.newContext({
          ...dev.descriptor,
          baseURL: BASE_URL,
          serviceWorkers: 'block',
        });
        const page = await context.newPage();

        await page.addInitScript(() => {
          try {
            sessionStorage.setItem('sheetapp_guest_chosen', '1');
            localStorage.setItem('sheetapp_guest_toast_shown', '1');
          } catch (_) {}
        });

        let failXml = true;
        await page.route('**/*', async (route) => {
          const url = route.request().url();
          if (failXml && /\.xml(\?|$)/i.test(url)) {
            await route.fulfill({
              status: 500,
              contentType: 'text/plain; charset=utf-8',
              body: 'XML 500 error',
            });
            return;
          }
          await route.continue();
        });

        await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.locator('#song-list .song-item').first().waitFor({ state: 'attached', timeout: 10000 });

        await page.evaluate(() => {
          const first = document.querySelector('#song-list .song-item');
          const id = first?.getAttribute('data-id') || 'thanh-ca-001';
          window.LibraryUI?.selectSong?.(id);
        });

        const errorPanel = page.locator('#sheet-load-error');
        await expect(errorPanel).toBeVisible({ timeout: 6000 });
        await expect(errorPanel.locator('#btn-sheet-retry')).toContainText('Thử lại');
        await expect(errorPanel.locator('#btn-sheet-view-lyric')).toContainText('Xem lời');

        const titleText = ((await page.locator('#song-title').textContent()) || '').trim();
        expect(titleText).not.toBe('Chọn bài hát để bắt đầu');
        expect(titleText.length).toBeGreaterThan(0);

        // Bấm Thử lại khi XML hết lỗi và chord_sets trả 500 → bản nhạc vẫn hiện
        failXml = false;
        await page.route('**/api/index.php*route=chord_sets*', async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ error: 'chord_sets 500' }),
          });
        });

        await errorPanel.locator('#btn-sheet-retry').click();
        await expect(errorPanel).toBeHidden({ timeout: 12000 });

        await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
        const svgDrawn = await page.evaluate(() => {
          const svg = document.querySelector('#osmd-container svg');
          return Boolean(svg && Number(svg.getAttribute('width')) > 0 && svg.children.length > 0);
        });
        expect(svgDrawn).toBe(true);

        await context.close();
      });
    }
  }
});

test.describe('M2-5 · Deep link ?song= gọi ApiService.songs.get khi ngoài danh sách; danh sách lỗi hiện Không tải được danh sách · Thử lại', () => {
  for (const dev of DEVICES) {
    for (const ui of UIS) {
      test(`M2-5 deep link & list error message: ${dev.id} - ${ui.id}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chỉ chạy ${dev.id} trên ${dev.project}`);
        test.setTimeout(40000);

        const context = await browser.newContext({
          ...dev.descriptor,
          baseURL: BASE_URL,
          serviceWorkers: 'block',
        });
        const page = await context.newPage();

        await page.addInitScript(() => {
          try {
            sessionStorage.setItem('sheetapp_guest_chosen', '1');
            localStorage.setItem('sheetapp_guest_toast_shown', '1');
          } catch (_) {}
        });

        let mode = 'fail_list';
        let getSongCalled = 0;

        await page.route('**/api/index.php*route=songs*', async (route) => {
          const url = route.request().url();
          if (url.includes('action=get')) {
            getSongCalled++;
            await route.continue();
            return;
          }
          if (mode === 'fail_list') {
            await route.fulfill({
              status: 500,
              contentType: 'application/json; charset=utf-8',
              body: JSON.stringify({ error: 'Database unavailable' }),
            });
            return;
          }
          if (mode === 'partial_list') {
            const resp = await route.fetch();
            const json = await resp.json();
            const items = Array.isArray(json) ? json : (json?.data || []);
            const firstPageOnly = items.slice(0, 5);
            await route.fulfill({
              status: 200,
              contentType: 'application/json; charset=utf-8',
              body: JSON.stringify({ success: true, data: firstPageOnly }),
            });
            return;
          }
          await route.continue();
        });

        // 1. Chặn songs.list → hiện "Không tải được danh sách · Thử lại", không phải "Không tìm thấy bài hát"
        await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const songList = page.locator('#song-list');
        await expect(songList).toContainText('Không tải được danh sách · Thử lại', { timeout: 10000 });
        const listText = (await songList.textContent()) || '';
        expect(listText).not.toContain('Không tìm thấy bài hát');

        // 2. Mở ?song= bài ngoài trang đầu (thanh-ca-100 không nằm trong 5 bài đầu) → gọi ApiService.songs.get và hiện bài
        mode = 'partial_list';
        await page.goto(BASE_URL + ui.path + '?song=thanh-ca-100', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

        expect(getSongCalled).toBeGreaterThan(0);
        const titleText = ((await page.locator('#song-title').textContent()) || '').trim();
        expect(titleText).not.toBe('Chọn bài hát để bắt đầu');
        expect(titleText.length).toBeGreaterThan(0);

        await context.close();
      });
    }
  }
});