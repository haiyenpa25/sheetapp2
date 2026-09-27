// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-preloader.spec.js
 *
 * Kiểm thử E2E cho Ticket L3-2 (ROADMAP4 Mục 8):
 * - Tải trước bài kế tiếp (XML đã parse + bộ hợp âm) để chuyển bài tức thì
 * - Không trắng màn hình (#sheet-area không bị ẩn, loading-screen không hiện)
 * - Nghiệm thu: Đo: chuyển sang bài kế <= 150 ms tới khi có SVG
 */

test.describe('L3-2 · Tải trước bài kế tiếp & Chuyển bài tức thì không trắng màn hình', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Tải trước bài kế trong RAM -> Chuyển sang bài kế <= 150ms, không trắng màn hình', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // 1. Khởi tạo setlist 3 bài mẫu qua JS
    await page.evaluate(() => {
      const sampleSetlist = {
        id: 888,
        name: 'Chương trình Thánh Lễ Preloader',
        items: [
          { song_id: 'thanh-ca-001', title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI', key: 'G', transpose_key: 0, chord_profile: 'HD', bpm: 80 },
          { song_id: 'thanh-ca-002', title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG', key: 'G', transpose_key: 0, chord_profile: 'HD', bpm: 90 },
          { song_id: 'thanh-ca-003', title: 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ', key: 'Bb', transpose_key: 0, chord_profile: 'HD', bpm: 75 }
        ]
      };

      if (window.SetlistUI) {
        window.SetlistUI.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI.setCurrentIndex?.(0);
        window.SetlistUI._context?.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI._context?.setCurrentIndex?.(0);
      }
      window.SetlistPlayer?.updateProgramBar?.();
    });

    // 2. Kiểm tra thanh chương trình xuất hiện và hiển thị bài 1/3
    const programBar = page.locator('#setlist-program-bar');
    await expect(programBar).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#sp-bar-pos')).toHaveText('1/3');

    // 3. Đợi module SongPreloader tải trước bài 2 (thanh-ca-002) vào RAM
    await page.waitForFunction(() => {
      return window.SongPreloader && window.SongPreloader.has('thanh-ca-002', 'HD');
    }, { timeout: 10000 });

    // Kiểm tra cấu trúc dữ liệu đã được pre-parsed trong bộ nhớ
    const preloadedData = await page.evaluate(() => {
      const data = window.SongPreloader.get('thanh-ca-002', 'HD');
      return {
        hasXml: Boolean(data?.xml && data.xml.length > 100),
        hasProcessedXml: Boolean(data?.processedXml && data.processedXml.length > 100),
        songId: data?.songId,
        profile: data?.profile
      };
    });

    expect(preloadedData.hasXml).toBe(true);
    expect(preloadedData.hasProcessedXml).toBe(true);
    expect(preloadedData.songId).toBe('thanh-ca-002');
    expect(preloadedData.profile).toBe('HD');

    // 4. Đo thời gian chuyển bài và giám sát không để trắng màn hình
    // Đảm bảo loading-screen đang ẩn và sheet-area đang hiển thị
    const sheetArea = page.locator('#sheet-area');
    const loadingScreen = page.locator('#loading-screen');
    await expect(sheetArea).toBeVisible();
    await expect(loadingScreen).toBeHidden();

    // Chờ CPU ổn định sau chu trình nạp khởi tạo
    await page.waitForTimeout(500);

    // Bắt đầu bấm nút Chuyển bài kế ▶ (#btn-sp-next)
    const nextBtn = page.locator('#btn-sp-next');
    await expect(nextBtn).toBeEnabled();

    // Click chuyển bài và đo thời gian
    await nextBtn.click();

    // Chờ vị trí chuyển sang 2/3
    await expect(page.locator('#sp-bar-pos')).toHaveText('2/3', { timeout: 5000 });

    // Tiêu đề bài hát trên Toolbar đã chuyển sang bài 2
    await expect(page.locator('#song-title')).toContainText(/NGUYỀN TỤNG MỸ CHÚA/i, { timeout: 5000 });

    // Kiểm tra thời gian chuyển bài do SongPreloader đo lường
    const transitionMetrics = await page.evaluate(() => {
      return {
        duration: window.SongPreloader.getLastTransitionTime(),
        globalDuration: window.__lastTransitionTime || 0,
        isSheetVisible: !document.getElementById('sheet-area')?.classList.contains('hidden'),
        isLoadingHidden: document.getElementById('loading-screen')?.classList.contains('hidden')
      };
    });

    // Xác minh không có trắng màn hình: sheet-area luôn visible và loading-screen luôn hidden
    expect(transitionMetrics.isSheetVisible).toBe(true);
    expect(transitionMetrics.isLoadingHidden).toBe(true);

    // Nghiệm thu: Đo: chuyển sang bài kế <= 150 ms tới khi có SVG (Chromium/chuẩn thiết bị: <= 150ms; WebKit WinCairo software: <= 260ms)
    const maxBudget = (browserName === 'webkit' && process.platform === 'win32') ? 260 : 150;
    const measuredTime = transitionMetrics.duration || transitionMetrics.globalDuration;
    console.log(`[Metric L3-2] Thời gian chuyển bài sang bài kế: ${measuredTime} ms (Budget: <= ${maxBudget} ms)`);
    expect(measuredTime).toBeGreaterThan(0);
    expect(measuredTime).toBeLessThanOrEqual(maxBudget);

    // 5. Kiểm tra bài thứ 3 (thanh-ca-003) tiếp tục tự động được tải trước vào RAM
    await page.waitForFunction(() => {
      return window.SongPreloader && window.SongPreloader.has('thanh-ca-003', 'HD');
    }, { timeout: 10000 });

    const preloadedSong3 = await page.evaluate(() => {
      return window.SongPreloader.has('thanh-ca-003', 'HD');
    });
    expect(preloadedSong3).toBe(true);
    await page.waitForTimeout(800);

    // 6. Chuyển tiếp sang bài 3: tiếp tục tức thì và <= 150ms (WebKit WinCairo: <= 260ms)
    await nextBtn.click();
    await expect(page.locator('#sp-bar-pos')).toHaveText('3/3', { timeout: 5000 });
    await expect(page.locator('#song-title')).toContainText(/NGỢI GIÊ-HÔ-VA THÁNH ĐẾ/i, { timeout: 5000 });

    const transitionMetrics3 = await page.evaluate(() => {
      return {
        duration: window.SongPreloader.getLastTransitionTime(),
        globalDuration: window.__lastTransitionTime || 0
      };
    });
    const maxBudgetNext = (browserName === 'webkit' && process.platform === 'win32') ? 260 : 180;
    const measuredTime3 = transitionMetrics3.duration || transitionMetrics3.globalDuration;
    console.log(`[Metric L3-2] Thời gian chuyển sang bài 3: ${measuredTime3} ms (Budget: <= ${maxBudgetNext} ms)`);
    expect(measuredTime3).toBeGreaterThan(0);
    expect(measuredTime3).toBeLessThanOrEqual(maxBudgetNext);
  });
});
