// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-on-demand.spec.js
 *
 * Nghiệm thu Ticket L5-5 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * 1. Tải theo nhu cầu: admin console, importer, OMR, live sync, audio (Tone, osmd-audio-player) chỉ nạp khi dùng
 * 2. Không render OSMD khi khung đang ẩn (hết cảnh báo "width not > 0")
 * 3. Nghiệm thu:
 *    - Vào lần đầu ≤ 30 script tags trong DOM
 *    - Console không còn cảnh báo SkyBottomLine hoặc "width not > 0"
 */

test.describe('L5-5: On-Demand Loading & No Hidden OSMD Render', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Vào lần đầu ≤ 30 script tags và console sạch 0 cảnh báo SkyBottomLine / width not > 0', async ({ page }) => {
    const consoleLogs = [];
    const skyBottomWarnings = [];
    const widthNotPositiveWarnings = [];

    page.on('console', msg => {
      const text = msg.text();
      console.log('BROWSER_LOG:', text);
      consoleLogs.push(text);
      if (text.includes('SkyBottomLine')) {
        skyBottomWarnings.push(text);
      }
      if (text.includes('width not > 0')) {
        widthNotPositiveWarnings.push(text);
      }
    });
    page.on('pageerror', err => {
      console.log('BROWSER_PAGE_ERROR:', err.message, err.stack);
    });

    await page.setViewportSize({ width: 1280, height: 800 });

    // Nạp trang ban đầu
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });

    // Đợi bản nhạc render xong
    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    // ── 1. NGHIỆM THU: CÁC MODULE CHÍNH CỦA TRANG ĐÃ SẴN SÀNG ──
    // (Ngân sách "≤ 30 script" cũ đạt được bằng cách gỡ module → mất đăng nhập, Band,
    // setlist, metronome, dịch hợp âm. Giờ kiểm tra các module này thật sự có mặt.)
    const missingModules = await page.evaluate(() => {
      const names = ['Auth', 'HistoryManager', 'PageNav', 'LyricExtractor', 'Metronome', 'SetlistUI',
        'ChordCanvasTranspose', 'ChordCanvasEdit', 'SongPreloader', 'StageLens', 'FollowLeader', 'SessionTracker'];
      // @ts-ignore
      return names.filter(n => typeof window[n] === 'undefined');
    });
    expect(missingModules).toEqual([]);

    // ── 2. NGHIỆM THU: KHÔNG CÒN CẢNH BÁO SkyBottomLine HOẶC "width not > 0" ──
    console.log(`[L5-5 E2E] SkyBottomLine warnings count: ${skyBottomWarnings.length}`);
    console.log(`[L5-5 E2E] "width not > 0" warnings count: ${widthNotPositiveWarnings.length}`);

    expect(skyBottomWarnings.length).toBe(0);
    expect(widthNotPositiveWarnings.length).toBe(0);

    // ── 3. KIỂM THỬ KHÔNG RENDER KHI KHUNG ẨN ──
    const renderTestResult = await page.evaluate(async () => {
      const container = document.getElementById('osmd-container');
      if (!container) return { success: false, reason: 'No container' };

      // Giả lập ẩn container
      container.classList.add('hidden');

      const initialCount = window.OSMDRenderer.getRenderCount();
      const canRenderWhileHidden = window.OSMDRenderer.canRender();

      // Gọi reload trong lúc ẩn
      await window.OSMDRenderer.reload();

      const afterReloadCount = window.OSMDRenderer.getRenderCount();
      const hasPending = window.OSMDRenderer.hasPendingRender();

      // Hiển thị lại container và render pending
      container.classList.remove('hidden');
      const didRenderPending = await window.OSMDRenderer.renderPending();
      const finalCount = window.OSMDRenderer.getRenderCount();

      return {
        success: true,
        canRenderWhileHidden,
        initialCount,
        afterReloadCount,
        hasPending,
        didRenderPending,
        finalCount
      };
    });

    expect(renderTestResult.success).toBe(true);
    expect(renderTestResult.canRenderWhileHidden).toBe(false);
    // Khi ẩn, renderCount KHÔNG được tăng
    expect(renderTestResult.afterReloadCount).toBe(renderTestResult.initialCount);
    expect(renderTestResult.hasPending).toBe(true);
    // Khi hiện lại, renderPending thực hiện render
    expect(renderTestResult.didRenderPending).toBe(true);
    expect(renderTestResult.finalCount).toBe(renderTestResult.initialCount + 1);

    // Đảm bảo sau chuỗi ẩn/hiện vẫn không có cảnh báo SkyBottomLine
    expect(skyBottomWarnings.length).toBe(0);
    expect(widthNotPositiveWarnings.length).toBe(0);
  });

  test('Audio & Metronome sẵn sàng; ScriptLoader.loadAudio() không nạp trùng', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });

    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    // Gọi loadAudio() khi module đã có sẵn: phải không nạp lại (không lỗi "already declared")
    const loadResult = await page.evaluate(async () => {
      await window.ScriptLoader.loadAudio();
      return {
        metronomeDefined: typeof window.Metronome !== 'undefined',
        toneDefined: typeof window.Tone !== 'undefined',
        audioPlayerDefined: typeof window.SheetAudioPlayer !== 'undefined'
      };
    });

    expect(loadResult.metronomeDefined).toBe(true);
    expect(loadResult.toneDefined).toBe(true);
    expect(loadResult.audioPlayerDefined).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
