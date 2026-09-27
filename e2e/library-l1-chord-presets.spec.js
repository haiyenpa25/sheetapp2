// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-chord-presets.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-2 (ROADMAP 4):
 * 3 preset hiển thị hợp âm (nút Aa):
 *  - Chuẩn (Standard)
 *  - Sân khấu lớn (Stage: 1.6x, đậm)
 *  - Tương phản cao (High Contrast: chữ hổ phách, nền pill tối)
 * Lưu theo thiết bị (localStorage: sheetapp_chord_preset) và giữ nguyên sau reload.
 */

test.describe('L1-2 · 3 Preset hiển thị hợp âm nút Aa (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.removeItem('sheetapp_chord_preset');
    });
  });

  test('1. Mặc định là preset Chuẩn, nút Aa hiển thị trên thanh công cụ', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnPreset = page.locator('#btn-chord-preset');
    await expect(btnPreset).toBeVisible();

    const label = page.locator('#chord-preset-label');
    await expect(label).toHaveText('Chuẩn');

    const currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('standard');

    const prefs = await page.evaluate(() => window.DisplaySettings?.getChordPrefs?.());
    expect(prefs.size).toBe(2.85);
  });

  test('2. Chuyển sang preset Sân khấu lớn: cỡ chữ >= 4.5, giữ nguyên sau reload', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnPreset = page.locator('#btn-chord-preset');
    await btnPreset.click();
    await page.waitForTimeout(600);

    // Kiểm tra đã đổi sang Sân khấu
    const label = page.locator('#chord-preset-label');
    await expect(label).toHaveText('Sân khấu');

    let currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('stage');

    let prefs = await page.evaluate(() => window.DisplaySettings?.getChordPrefs?.());
    expect(prefs.size).toBeGreaterThanOrEqual(4.5);

    // Kiểm tra DOM có class chord-preset-stage
    const hasStageClass = await page.evaluate(() => document.body.classList.contains('chord-preset-stage'));
    expect(hasStageClass).toBe(true);

    // Reload lại trang
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra còn nguyên sau reload
    await expect(label).toHaveText('Sân khấu');
    currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('stage');
    prefs = await page.evaluate(() => window.DisplaySettings?.getChordPrefs?.());
    expect(prefs.size).toBeGreaterThanOrEqual(4.5);
  });

  test('3. Chuyển sang preset Tương phản cao: màu hổ phách #fbbf24, giữ nguyên sau reload', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnPreset = page.locator('#btn-chord-preset');
    // Click lần 1: standard -> stage
    await btnPreset.click();
    await page.waitForTimeout(300);
    // Click lần 2: stage -> high_contrast
    await btnPreset.click();
    await page.waitForTimeout(600);

    const label = page.locator('#chord-preset-label');
    await expect(label).toHaveText('Tương phản');

    let currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('high_contrast');

    let prefs = await page.evaluate(() => window.DisplaySettings?.getChordPrefs?.());
    expect(prefs.color.toLowerCase()).toBe('#fbbf24');

    const hasHcClass = await page.evaluate(() => document.body.classList.contains('chord-preset-high-contrast'));
    expect(hasHcClass).toBe(true);

    // Reload lại trang
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Còn nguyên sau reload
    await expect(label).toHaveText('Tương phản');
    currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('high_contrast');
    prefs = await page.evaluate(() => window.DisplaySettings?.getChordPrefs?.());
    expect(prefs.color.toLowerCase()).toBe('#fbbf24');
  });

  test('4. Vòng lặp preset (cycle): Chuẩn -> Sân khấu -> Tương phản -> Chuẩn', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnPreset = page.locator('#btn-chord-preset');
    const label = page.locator('#chord-preset-label');

    // standard -> stage
    await btnPreset.click();
    await expect(label).toHaveText('Sân khấu');

    // stage -> high_contrast
    await btnPreset.click();
    await expect(label).toHaveText('Tương phản');

    // high_contrast -> standard
    await btnPreset.click();
    await expect(label).toHaveText('Chuẩn');

    const currentPreset = await page.evaluate(() => window.DisplaySettings?.getChordPreset?.());
    expect(currentPreset).toBe('standard');
  });

});
