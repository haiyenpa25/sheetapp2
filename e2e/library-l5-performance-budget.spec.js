// @ts-check
const { test, expect } = require('@playwright/test');
const { collectLibraryLoad, throttle4G } = require('./helpers/library-load-metrics');

/** ROADMAP6 TV2-1: strict network budgets, measured through first visible SVG
 * and network idle. Cold browser cache; Chromium 4G = 1.6 Mbps down / 750 kbps
 * up / 150 ms latency. No CPU throttling; localhost server may already be warm.
 * The initial-load budget remains RED until TV2-2 through TV2-4 reaches these limits.
 */
const BUDGETS = {
  INITIAL_RENDER_MS: 2500,
  SONG_SWITCH_MS: 1800,
  RENDER_COUNT: 1,
  NETWORK_REQUESTS: 4,
  TRANSPOSE_MS: 300,
  INITIAL_SCRIPTS: 40,
  INITIAL_REQUESTS: 60,
  INITIAL_BYTES: 1500000,
};

test.describe('L5-9 · Ngân Sách Hiệu Năng Trong CI (Performance Budget Quality Gate)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  for (const classic of [false, true]) {
    test(`1. [Budget B1 & B6] ${classic ? 'Classic' : 'Modern'} cold 4G load stays within network budgets`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', '4G CDP measurements require Chromium');
      test.setTimeout(90000);
      await page.setViewportSize({ width: 390, height: 844 });
      await throttle4G(page);
      const finish = collectLibraryLoad(page);
      const started = Date.now();
      await page.goto(`${classic ? 'old/' : './'}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 60000 });
      const metrics = await finish(Date.now() - started);
      console.log('[TV2 INITIAL LOAD]', JSON.stringify(metrics));
      expect.soft(metrics.failures, 'Every network transfer must be measurable').toEqual([]);
      expect.soft(metrics.scripts).toBeLessThanOrEqual(BUDGETS.INITIAL_SCRIPTS);
      expect.soft(metrics.requests).toBeLessThanOrEqual(BUDGETS.INITIAL_REQUESTS);
      expect.soft(metrics.transferBytes).toBeLessThanOrEqual(BUDGETS.INITIAL_BYTES);
      expect.soft(metrics.firstSvgMs).toBeLessThanOrEqual(BUDGETS.INITIAL_RENDER_MS);
    });
  }

  test('2. [Budget B2, B3, B4] Chuyển bài tiếp theo: thời gian ≤ 1800ms, renderCount === 1, network requests ≤ 4', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // ── Nạp bài 1 ban đầu ──
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });
    const svg1 = page.locator('#osmd-container svg').first();
    await expect(svg1).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(500);

    // Gắn theo dõi số lần render OSMD qua API chính thức của Ticket L5-1
    await page.evaluate(() => {
      window.OSMDRenderer?.resetRenderCount?.();
    });

    // Theo dõi network requests khi đổi bài
    const switchRequests = [];
    const requestListener = (req) => {
      const url = req.url();
      if (url.endsWith('.js') || url.endsWith('.css') || url.includes('/fonts/') || url.includes('favicon')) {
        return;
      }
      switchRequests.push({ url, method: req.method() });
    };
    page.on('request', requestListener);

    // ── Đo thời gian chuyển sang bài 2 ──
    const switchStartTime = Date.now();
    await page.evaluate(async () => {
      const song2 = {
        id: 'thanh-ca-002',
        title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
        xmlPath: 'storage/Thanh ca/002 NGUYỀN TỤNG MỸ CHÚA LINH NĂNG.xml',
      };
      await window.SongLoader.load(song2);
    });

    // Chờ tiêu đề bài hát cập nhật sang bài 2
    await expect(page.locator('#song-title')).toContainText('NGUYỀN TỤNG MỸ CHÚA LINH NĂNG', { timeout: 10000 });
    const svg2 = page.locator('#osmd-container svg').first();
    await expect(svg2).toBeVisible({ timeout: 10000 });
    const switchDuration = Date.now() - switchStartTime;

    page.off('request', requestListener);

    // ── Kiểm tra Ngân sách B2: Thời gian chuyển bài ──
    console.log(`[PERF BUDGET] Song Switch Time: ${switchDuration}ms (Ngân sách ≤ ${BUDGETS.SONG_SWITCH_MS}ms)`);
    expect(
      switchDuration,
      `Thời gian đổi bài (${switchDuration}ms) vượt quá ngân sách ${BUDGETS.SONG_SWITCH_MS}ms`
    ).toBeLessThanOrEqual(BUDGETS.SONG_SWITCH_MS);

    // ── Kiểm tra Ngân sách B3: Số lần gọi render OSMD ──
    const renderCount = await page.evaluate(() => window.OSMDRenderer?.getRenderCount?.() || 0);
    console.log(`[PERF BUDGET] OSMD Render Count: ${renderCount} (Ngân sách === ${BUDGETS.RENDER_COUNT})`);
    expect(
      renderCount,
      `Số lần render OSMD khi đổi bài (${renderCount}) không đạt chuẩn Single-Render === ${BUDGETS.RENDER_COUNT}`
    ).toBe(BUDGETS.RENDER_COUNT);

    // ── Kiểm tra Ngân sách B4: Số network requests khi đổi bài ──
    console.log(`[PERF BUDGET] Network Requests on Switch: ${switchRequests.length} (Ngân sách ≤ ${BUDGETS.NETWORK_REQUESTS})`);
    expect(
      switchRequests.length,
      `Số request mạng (${switchRequests.length}) vượt quá ngân sách ${BUDGETS.NETWORK_REQUESTS} requests: ${JSON.stringify(switchRequests)}`
    ).toBeLessThanOrEqual(BUDGETS.NETWORK_REQUESTS);
  });

  test('3. [Budget B5] Dịch tông tức thời (Instant Transpose): thời gian phản hồi ≤ 300ms', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnTransposeUp = page.locator('#btn-transpose-up');
    await expect(btnTransposeUp).toBeEnabled();

    // Ngân sách dịch tông: 300ms cho Chromium; WebKit trên Windows chạy phần mềm giả lập nên cho phép tối đa 1000ms
    const maxTransposeBudget = testInfo.project.name === 'webkit' ? 1000 : BUDGETS.TRANSPOSE_MS;

    // Đo thời gian thực hiện dịch tông 1 bước
    const transposeStartTime = Date.now();
    await btnTransposeUp.click();

    // Hiển thị số nửa cung đổi sang +1
    const transposeDisplay = page.locator('#transpose-display');
    await expect(transposeDisplay).toHaveText('+1', { timeout: maxTransposeBudget });
    const transposeDuration = Date.now() - transposeStartTime;

    console.log(`[PERF BUDGET] Instant Transpose Duration: ${transposeDuration}ms (Ngân sách ≤ ${maxTransposeBudget}ms)`);
    expect(
      transposeDuration,
      `Thời gian dịch tông (${transposeDuration}ms) vượt quá ngân sách ${maxTransposeBudget}ms`
    ).toBeLessThanOrEqual(maxTransposeBudget);
  });

});
