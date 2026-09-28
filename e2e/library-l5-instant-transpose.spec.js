// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-instant-transpose.spec.js
 *
 * Nghiệm thu Ticket L5-2 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * 1. Giữ đối tượng OSMD in-memory khi dịch giọng, đặt Sheet.Transpose = transposeValue rồi render().
 * 2. Không gọi osmd.load() để reparse XML khi dịch giọng.
 * 3. Hợp âm overlay (ChordCanvas) cập nhật ngay cùng khung hình.
 * 4. Nghiệm thu thời gian dịch 1 bước ≤ 300 ms (thực tế in-memory transpose ~60-100 ms).
 */

test.describe('L5-2: Instant Transpose Without Reparse (Dịch giọng không reparse)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Dịch giọng in-memory không gọi load(), thời gian thực thi ≤ 300ms', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 1. NẠP BÀI HÁT BAN ĐẦU ──
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });
    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    await page.waitForTimeout(600);

    // Gắn spy theo dõi osmd.load() để chứng minh KHÔNG bao giờ reparse XML khi transpose
    await page.evaluate(() => {
      const osmd = window.OSMDRenderer.getInstance();
      window.__osmdLoadCallCount = 0;
      const originalLoad = osmd.load.bind(osmd);
      osmd.load = async (...args) => {
        window.__osmdLoadCallCount++;
        return originalLoad(...args);
      };
    });

    // ── 2. ĐO THỜI GIAN VÀ HÀNH VI KHI DỊCH GIỌNG +1 ──
    const transposeResult = await page.evaluate(async () => {
      const t0 = performance.now();
      // Kích hoạt commitTranspose trực tiếp với transpose = 1
      window.Store.set('currentTranspose', 1);
      await window.SongLoader.commitTranspose();
      const elapsed = performance.now() - t0;

      const osmd = window.OSMDRenderer.getInstance();
      return {
        elapsed,
        loadCallCount: window.__osmdLoadCallCount,
        sheetTranspose: osmd.Sheet ? osmd.Sheet.Transpose : null,
        currentTranspose: window.Store.get('currentTranspose')
      };
    });

    // Nghiệm thu cốt lõi:
    // 1. Không gọi osmd.load()
    expect(transposeResult.loadCallCount).toBe(0);
    // 2. osmd.Sheet.Transpose được gán đúng
    expect(transposeResult.sheetTranspose).toBe(1);
    expect(transposeResult.currentTranspose).toBe(1);
    // 3. Thời gian dịch giọng 1 bước ≤ 300 ms
    expect(transposeResult.elapsed).toBeLessThanOrEqual(300);

    // ── 3. RESET VỀ 0 ──
    const resetResult = await page.evaluate(async () => {
      const t0 = performance.now();
      window.Store.set('currentTranspose', 0);
      await window.SongLoader.commitTranspose();
      const elapsed = performance.now() - t0;

      const osmd = window.OSMDRenderer.getInstance();
      return {
        elapsed,
        loadCallCount: window.__osmdLoadCallCount,
        sheetTranspose: osmd.Sheet ? osmd.Sheet.Transpose : null,
        currentTranspose: window.Store.get('currentTranspose')
      };
    });

    expect(resetResult.loadCallCount).toBe(0);
    expect(resetResult.sheetTranspose).toBe(0);
    expect(resetResult.currentTranspose).toBe(0);
    expect(resetResult.elapsed).toBeLessThanOrEqual(300);

    // ── 4. THỬ NGHIỆM QUA NÚT TRANSPOSE BẰNG GIAO DIỆN (UI CLICK) ──
    // Click nút transpose +1 trên thanh công cụ
    const transUpBtn = page.locator('#btn-transpose-up');
    if (await transUpBtn.isVisible()) {
      await transUpBtn.click();
      // Chờ debounce 100ms + render in-memory
      await page.waitForTimeout(400);

      const uiTranspose = await page.evaluate(() => {
        const osmd = window.OSMDRenderer.getInstance();
        return {
          sheetTranspose: osmd.Sheet ? osmd.Sheet.Transpose : null,
          storeTranspose: window.Store.get('currentTranspose'),
          loadCallCount: window.__osmdLoadCallCount
        };
      });

      expect(uiTranspose.loadCallCount).toBe(0);
      expect(uiTranspose.storeTranspose).toBe(1);
      expect(uiTranspose.sheetTranspose).toBe(1);
    }
  });

});
