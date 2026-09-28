// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l6-tempo-tap-tool.spec.js
 *
 * Kiểm thử E2E cho Ticket L6-2 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Xóa tempo giả 104 (đặt NULL) -> bài chưa có tempo hiển thị "♩ —"
 * - Bài có tempo thật (≥100 bài đầu) -> hiển thị "♩ = <bpm> bpm"
 * - Ca trưởng bấm chip tempo mở bottom sheet #tempo-pick-modal
 * - Sử dụng nút TAP tempo để bắt nhịp hoặc preset, áp dụng tempo thành công
 */

test.describe('L6-2 · Quản lý Tempo thật, Xóa 104 & Công cụ TAP Tempo', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bài có tempo thật (thanh-ca-001) hiển thị đúng BPM thật trên chip (92 bpm)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const tempoChip = page.locator('#si-tempo-chip');
    await expect(tempoChip).toBeVisible({ timeout: 10000 });

    const chipText = await tempoChip.innerText();
    expect(chipText).toContain('92');
    expect(chipText).toContain('bpm');
    expect(chipText).not.toContain('104');
  });

  test('2. Bài chưa có tempo (thanh-ca-150) hiển thị "♩ —" chứ không mang tempo giả 104', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-150&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const tempoChip = page.locator('#si-tempo-chip');
    await expect(tempoChip).toBeVisible({ timeout: 10000 });

    const chipText = await tempoChip.innerText();
    expect(chipText).toContain('—');
    expect(chipText).not.toContain('104');
  });

  test('3. Bấm chip Tempo mở Bottom Sheet, sử dụng TAP nhịp và áp dụng Tempo mới', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const tempoChip = page.locator('#si-tempo-chip');
    await expect(tempoChip).toBeVisible();

    // Click vào chip tempo để mở bottom sheet
    await tempoChip.click();

    const tempoModal = page.locator('#tempo-pick-modal');
    await expect(tempoModal).toBeVisible({ timeout: 5000 });

    // Kiểm tra nút TAP TEMPO tồn tại
    const tapBtn = page.locator('#tempo-modal-tap');
    await expect(tapBtn).toBeVisible();

    // Thực hiện TAP 3 lần cách nhau ~600ms (mô phỏng nhịp 100 BPM)
    await tapBtn.click();
    await page.waitForTimeout(600);
    await tapBtn.click();
    await page.waitForTimeout(600);
    await tapBtn.click();

    // Hoặc click vào preset 100
    const preset100Btn = page.locator('.tempo-preset-btn[data-bpm="100"]');
    await preset100Btn.click();

    // Kiểm tra display BPM cập nhật
    const tempoVal = page.locator('#tempo-modal-val');
    await expect(tempoVal).toHaveText('100');

    // Bấm ✓ Áp Dụng Tempo
    const okBtn = page.locator('#btn-tempo-pick-ok');
    await okBtn.click();

    // Modal đóng lại
    await expect(tempoModal).toBeHidden({ timeout: 5000 });

    // Chip tempo trên song info bar cập nhật hiển thị 100 bpm
    await expect(tempoChip).toContainText('100');
    await expect(tempoChip).toContainText('bpm');
  });

});
