// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-coalesced-requests.spec.js
 *
 * Nghiệm thu Ticket L5-4 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * 1. Gộp request mỗi lần đổi bài:
 *    - song_usage 1 lần (lấy ra khỏi _render)
 *    - sessions 1 lần dùng chung
 *    - Danh sách bộ hợp âm cache
 *    - Tổng ≤4 network request mỗi lần đổi bài
 * 2. Nghiệm thu: Đếm request trong E2E
 */

test.describe('L5-4: Coalesced Requests on Song Switch (≤ 4 requests)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Đếm network requests khi đổi bài: tổng cộng ≤ 4 requests', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));

    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 1. NẠP BÀI BAN ĐẦU ──
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });
    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    await page.waitForTimeout(600);

    // ── 2. LẮNG NGHE REQUEST KHI ĐỔI SANG BÀI 2 ──
    const switchRequests = [];
    const requestListener = (req) => {
      const url = req.url();
      // Lọc các asset tĩnh trình duyệt (font, js bundle, css, favicon)
      if (url.endsWith('.js') || url.endsWith('.css') || url.includes('/fonts/') || url.includes('favicon')) {
        return;
      }
      switchRequests.push({ url, method: req.method() });
    };

    page.on('request', requestListener);

    // Thực hiện đổi sang bài 2
    await page.evaluate(async () => {
      const song2 = {
        id: 'thanh-ca-002',
        title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
        xmlPath: 'storage/Thanh ca/002 NGUYỀN TỤNG MỸ CHÚA LINH NĂNG.xml',
      };
      await window.SongLoader.load(song2);
    });

    await page.waitForTimeout(800);

    // Lọc lại các request phát sinh trong phiên đổi bài 2
    const relevantRequests = switchRequests.filter(r =>
      r.url.includes('api/') || r.url.includes('.xml')
    );

    console.log('L5-4 Requests for Song 2:', relevantRequests.map(r => r.url));

    // Nghiệm thu cốt lõi L5-4: Tổng ≤ 4 request mạng mỗi lần đổi bài!
    expect(relevantRequests.length).toBeLessThanOrEqual(4);

    // Kiểm tra sessions chỉ được gọi tối đa 1 lần
    const sessionRequests = relevantRequests.filter(r => r.url.includes('route=sessions'));
    expect(sessionRequests.length).toBeLessThanOrEqual(1);

    // Kiểm tra song_usage chỉ được gọi tối đa 1 lần
    const usageRequests = relevantRequests.filter(r => r.url.includes('action=song_usage'));
    expect(usageRequests.length).toBeLessThanOrEqual(1);

    // ── 3. TIẾP TỤC ĐỔI SANG BÀI 3 VÀ XÁC NHẬN TIẾP TỤC ≤ 4 REQUESTS ──
    switchRequests.length = 0; // reset

    await page.evaluate(async () => {
      const song3 = {
        id: 'thanh-ca-003',
        title: 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ',
        xmlPath: 'storage/Thanh ca/003 NGỢI GIÊ-HÔ-VA THÁNH ĐẾ.xml',
      };
      await window.SongLoader.load(song3);
    });

    await page.waitForTimeout(800);

    const relevantRequestsSong3 = switchRequests.filter(r =>
      r.url.includes('api/') || r.url.includes('.xml')
    );
    console.log('L5-4 Requests for Song 3:', relevantRequestsSong3.map(r => r.url));

    expect(relevantRequestsSong3.length).toBeLessThanOrEqual(4);

    page.off('request', requestListener);
  });

});
