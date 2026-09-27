// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-bpm-unset.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-15 (ROADMAP 4):
 *  - Bài hát có tempo mặc định 104 từ XML được coi là "chưa có tempo", chip hiện "♩ —".
 *  - Bấm vào chip mở được modal chọn tempo.
 */

test.describe('Ticket L0-15: BPM Unset 104 -> "♩ —"', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Bài thanh-ca-001 (XML tempo 104) hiển thị "♩ —" trên thanh thông tin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const tempoChip = page.locator('#si-tempo-chip');
    await expect(tempoChip).toBeVisible();

    // Chip không được hiển thị 104, mà phải hiển thị "♩ —"
    const chipText = await tempoChip.innerText();
    expect(chipText).toContain('♩ —');
    expect(chipText).not.toContain('104');
  });

  test('2. Bấm vào chip "♩ —" mở được modal đặt Tempo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const tempoChip = page.locator('#si-tempo-chip');
    await tempoChip.click();

    // Modal tempo hiển thị
    const tempoModal = page.locator('#tempo-pick-modal');
    await expect(tempoModal).toBeVisible();

    // Giá trị hiển thị trong modal mặc định không phải 104
    const tempoVal = page.locator('#tempo-modal-val');
    await expect(tempoVal).not.toHaveText('104');
  });

});
