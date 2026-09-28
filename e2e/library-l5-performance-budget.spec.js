// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-performance-budget.spec.js
 *
 * Kiểm thử Nghiệm thu Ticket L5-9 (ROADMAP 4 Mục 8):
 * Ngân sách hiệu năng trong CI (Performance Budget CI Quality Gate)
 *
 * Các chỉ số ngân sách bắt buộc (Strict Performance Budget Limits):
 * - BUDGET_INITIAL_RENDER_MS: ≤ 4500 ms (Thời gian hiện bản nhạc lần đầu)
 * - BUDGET_SONG_SWITCH_MS:    ≤ 1800 ms (Thời gian chuyển bài tiếp theo)
 * - BUDGET_RENDER_COUNT:      === 1 (Số lần gọi render OSMD khi đổi bài)
 * - BUDGET_NETWORK_REQUESTS:  ≤ 4 (Số request mạng khi đổi bài)
 * - BUDGET_TRANSPOSE_MS:      ≤ 300 ms (Thời gian dịch tông tức thời)
 * - BUDGET_INITIAL_SCRIPTS:   ≤ 100 (chỉ chặn nạp trùng/phình bất thường; ngân sách ≤ 30 cũ
 *                             đã bị bỏ vì đạt được bằng cách gỡ module chức năng)
 */

const BUDGETS = {
  INITIAL_RENDER_MS: 4500,
  SONG_SWITCH_MS: 1800,
  RENDER_COUNT: 1,
  NETWORK_REQUESTS: 4,
  TRANSPOSE_MS: 300,
  INITIAL_SCRIPTS: 100,
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

  test('1. [Budget B1 & B6] Thời gian hiện bản nhạc lần đầu ≤ 4500ms và số script không phình bất thường', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const startTime = Date.now();
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đo số script tag ban đầu
    const scriptCount = await page.locator('script').count();
    console.log(`[PERF BUDGET] Initial Scripts Count: ${scriptCount} (Ngân sách ≤ ${BUDGETS.INITIAL_SCRIPTS})`);
    expect(
      scriptCount,
      `Số lượng script nạp ban đầu (${scriptCount}) vượt quá ngân sách ${BUDGETS.INITIAL_SCRIPTS}`
    ).toBeLessThanOrEqual(BUDGETS.INITIAL_SCRIPTS);

    // Chờ bản nhạc SVG đầu tiên hiển thị
    const svg = page.locator('#osmd-container svg').first();
    await expect(svg).toBeVisible({ timeout: BUDGETS.INITIAL_RENDER_MS });
    const initialRenderDuration = Date.now() - startTime;

    console.log(`[PERF BUDGET] Initial Song Render Time: ${initialRenderDuration}ms (Ngân sách ≤ ${BUDGETS.INITIAL_RENDER_MS}ms)`);
    expect(
      initialRenderDuration,
      `Thời gian render bản nhạc đầu tiên (${initialRenderDuration}ms) vượt quá ngân sách ${BUDGETS.INITIAL_RENDER_MS}ms`
    ).toBeLessThanOrEqual(BUDGETS.INITIAL_RENDER_MS);
  });

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

  test('3. [Budget B5] Dịch tông tức thời (Instant Transpose): thời gian phản hồi ≤ 300ms', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnTransposeUp = page.locator('#btn-transpose-up');
    await expect(btnTransposeUp).toBeEnabled();

    // Đo thời gian thực hiện dịch tông 1 bước
    const transposeStartTime = Date.now();
    await btnTransposeUp.click();

    // Hiển thị số nửa cung đổi sang +1
    const transposeDisplay = page.locator('#transpose-display');
    await expect(transposeDisplay).toHaveText('+1', { timeout: BUDGETS.TRANSPOSE_MS });
    const transposeDuration = Date.now() - transposeStartTime;

    console.log(`[PERF BUDGET] Instant Transpose Duration: ${transposeDuration}ms (Ngân sách ≤ ${BUDGETS.TRANSPOSE_MS}ms)`);
    expect(
      transposeDuration,
      `Thời gian dịch tông (${transposeDuration}ms) vượt quá ngân sách ${BUDGETS.TRANSPOSE_MS}ms`
    ).toBeLessThanOrEqual(BUDGETS.TRANSPOSE_MS);
  });

});
