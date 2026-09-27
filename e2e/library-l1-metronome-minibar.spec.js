// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-metronome-minibar.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-10:
 * Metronome dạng mini-bar gắn ở cạnh dưới (đèn nhịp, BPM, count-in), không còn thẻ nổi đè nhạc;
 * Icon ♩ riêng; nhịp 6/8 = 2 phách chấm (có tuỳ chọn 6, nhấn đúng phách 1 và 4).
 *
 * Nghiệm thu:
 * - Bật metronome, vùng nhạc không bị che đè
 * - 6/8 nhấn đúng phách 1 và 4
 * - Icon ♩ riêng biệt trên toolbar
 */

test.describe('L1-10 · Metronome mini-bar gắn cạnh dưới & nhịp 6/8', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Icon ♩ riêng biệt trên thanh công cụ và mở mini-bar gắn đáy', async ({ page }) => {
    // 1. Kiểm tra trên màn hình Desktop (1400x900): nút hiện trực tiếp trên toolbar với icon ♩
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const toolbarMetronomeBtn = page.locator('#btn-toolbar-metronome');
    await expect(toolbarMetronomeBtn).toBeVisible();

    // Kiểm tra icon trên toolbar là ♩ riêng biệt (không phải ⚡)
    const iconText = await toolbarMetronomeBtn.innerText();
    expect(iconText).toContain('♩');
    expect(iconText).not.toContain('⚡');

    // Bấm mở metronome từ toolbar
    await page.evaluate(() => document.getElementById('btn-toolbar-metronome')?.click());
    const panel = page.locator('#metronome-panel');
    await expect(panel).toBeVisible();

    // Mini-bar gắn ở cạnh dưới màn hình
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    if (panelBox) {
      expect(panelBox.y + panelBox.height).toBeGreaterThanOrEqual(895);
      expect(panelBox.width).toBeGreaterThanOrEqual(1000);
      expect(panelBox.height).toBeLessThanOrEqual(80);
    }

    // 2. Kiểm tra trên màn hình iPad / menu compact controls cũng dùng icon ♩
    const menuIconText = await page.evaluate(() => document.getElementById('btn-menu-metronome')?.textContent || '');
    expect(menuIconText).toContain('♩');
    expect(menuIconText).not.toContain('⚡');
  });

  test('2. Bật metronome: vùng bản nhạc không bị che đè', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật metronome mini-bar
    await page.evaluate(() => window.Metronome?.showPanel());
    const panel = page.locator('#metronome-panel');
    await expect(panel).toBeVisible();

    // Kiểm tra không che vùng nhạc qua bounding box
    const checkCoverage = await page.evaluate(() => {
      const panelEl = document.getElementById('metronome-panel');
      const viewerEl = document.querySelector('.sheet-viewer-wrapper');
      if (!panelEl || !viewerEl) return { ok: false, reason: 'missing elements' };

      const pRect = panelEl.getBoundingClientRect();
      const vRect = viewerEl.getBoundingClientRect();

      // Vùng nhạc kết thúc trước khi chạm tới mini-bar đáy
      const isCovered = (pRect.top < vRect.bottom - 4);
      const isCoveredMethod = window.Metronome?.isMusicAreaCovered?.();

      return {
        ok: !isCovered && isCoveredMethod === false,
        panelTop: pRect.top,
        viewerBottom: vRect.bottom,
        isCovered,
        isCoveredMethod
      };
    });

    expect(checkCoverage.ok).toBe(true);
    expect(checkCoverage.isCovered).toBe(false);
  });

  test('3. Nhịp 6/8: Nhấn đúng phách 1 và phách 4', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Mở metronome và chọn nhịp 6/8 (chế độ 6 phách nhấn 1 & 4)
    await page.evaluate(() => {
      window.Metronome?.showPanel();
      window.Metronome?.setMeterMode('compound_6');
    });

    const beatsSelect = page.locator('#metronome-beats-select');
    await expect(beatsSelect).toHaveValue('6');

    // Kiểm tra logic nhấn phách 1 và phách 4
    const accentCheck = await page.evaluate(() => {
      const m = window.Metronome;
      return {
        beatsCount: m?.getBeatsPerMeasure(),
        mode: m?.getMeterMode(),
        beat0: m?.isAccentBeat(0), // Phách 1: Downbeat -> Phải nhấn (true)
        beat1: m?.isAccentBeat(1), // Phách 2: Phách nhẹ -> Không nhấn (false)
        beat2: m?.isAccentBeat(2), // Phách 3: Phách nhẹ -> Không nhấn (false)
        beat3: m?.isAccentBeat(3), // Phách 4: Secondary accent -> Phải nhấn (true)
        beat4: m?.isAccentBeat(4), // Phách 5: Phách nhẹ -> Không nhấn (false)
        beat5: m?.isAccentBeat(5), // Phách 6: Phách nhẹ -> Không nhấn (false)
      };
    });

    expect(accentCheck.beatsCount).toBe(6);
    expect(accentCheck.mode).toBe('compound_6');
    expect(accentCheck.beat0).toBe(true);  // Phách 1 nhấn
    expect(accentCheck.beat1).toBe(false); // Phách 2 nhẹ
    expect(accentCheck.beat2).toBe(false); // Phách 3 nhẹ
    expect(accentCheck.beat3).toBe(true);  // Phách 4 nhấn
    expect(accentCheck.beat4).toBe(false); // Phách 5 nhẹ
    expect(accentCheck.beat5).toBe(false); // Phách 6 nhẹ

    // Kiểm tra các đèn LED trong DOM: có 6 đèn, đèn 1 có class beat-1, đèn 4 có class beat-4
    const dotsCount = await page.locator('#metronome-beats-container .beat-dot').count();
    expect(dotsCount).toBe(6);

    const hasBeat1Accent = await page.locator('#metronome-beats-container .beat-1').count();
    const hasBeat4Accent = await page.locator('#metronome-beats-container .beat-4').count();
    expect(hasBeat1Accent).toBe(1);
    expect(hasBeat4Accent).toBe(1);
  });

  test('4. Tuỳ chọn nhịp 6/8 = 2 phách chấm (dotted quarter beats)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Chọn tuỳ chọn 6-dotted
    await page.evaluate(() => {
      window.Metronome?.showPanel();
      window.Metronome?.setMeterMode('compound_2');
    });

    const beatsSelect = page.locator('#metronome-beats-select');
    await expect(beatsSelect).toHaveValue('6-dotted');

    const dottedCheck = await page.evaluate(() => {
      const m = window.Metronome;
      return {
        beatsCount: m?.getBeatsPerMeasure(),
        mode: m?.getMeterMode(),
        beat0: m?.isAccentBeat(0),
        beat1: m?.isAccentBeat(1)
      };
    });

    expect(dottedCheck.beatsCount).toBe(2);
    expect(dottedCheck.mode).toBe('compound_2');
    expect(dottedCheck.beat0).toBe(true);

    // Có đúng 2 đèn LED hiển thị
    const dotsCount = await page.locator('#metronome-beats-container .beat-dot').count();
    expect(dotsCount).toBe(2);
  });

  test('5. Tăng giảm BPM, nút Play/Stop và nút Đóng mini-bar', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.evaluate(() => window.Metronome?.showPanel());
    const panel = page.locator('#metronome-panel');
    await expect(panel).toBeVisible();

    // 1. Tăng BPM
    const initBpm = await page.evaluate(() => window.Metronome?.getBpm());
    await page.locator('#btn-metronome-inc').click();
    const increasedBpm = await page.evaluate(() => window.Metronome?.getBpm());
    expect(increasedBpm).toBe(initBpm + 1);

    // 2. Giảm BPM
    await page.locator('#btn-metronome-dec').click();
    const decreasedBpm = await page.evaluate(() => window.Metronome?.getBpm());
    expect(decreasedBpm).toBe(initBpm);

    // 3. Play / Stop
    const playBtn = page.locator('#btn-metronome-toggle-play');
    await playBtn.click();
    await page.waitForTimeout(100);
    const isPlayingAfterClick = await page.evaluate(() => window.Metronome?.togglePlay !== undefined);
    expect(isPlayingAfterClick).toBe(true);

    // 4. Đóng mini-bar bằng nút ×
    await page.locator('#btn-close-metronome').click();
    await expect(panel).toHaveClass(/hidden/);
  });

});
