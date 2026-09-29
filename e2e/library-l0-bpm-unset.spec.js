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
    // Ticket L6-2 (ROADMAP4): thanh-ca-001 nằm trong Top 100 bài hay dùng đã được seed
    // tempo thật (92 bpm) qua tools/manage_tempos.php --seed-top-100, không còn "chưa có
    // tempo" nữa. Dùng thanh-ca-150 (ngoài Top 100, vẫn chưa có tempo thật) để giữ đúng
    // ý nghĩa gốc của test này.
    await page.goto('./?song=thanh-ca-150', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Ticket R1-3 (ROADMAP5): #si-tempo-chip sống trong #song-info-strip, nay bị ẩn
    // vĩnh viễn (display:none!important, xem library-polish.css) -- thông tin Tempo
    // chuyển vào popover ⓘ (#si-pop-tempo).
    await page.locator('#btn-song-info-popover').click();
    const popTempo = page.locator('#si-pop-tempo');
    await expect(popTempo).toBeVisible();

    const chipText = await popTempo.innerText();
    expect(chipText).toContain('♩ —');
    expect(chipText).not.toContain('104');
  });

  test('2. Bấm vào chip "♩ —" mở được modal đặt Tempo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Ticket R1-3 (ROADMAP5): mở popover ⓘ rồi bấm vào dòng Tempo (#si-pop-tempo) --
    // xem ghi chú ở test 1. Hành động click-để-mở-TempoPick được khôi phục lại trên
    // chính dòng này trong song-info-bar.js (init()).
    await page.locator('#btn-song-info-popover').click();
    const popTempo = page.locator('#si-pop-tempo');
    await expect(popTempo).toBeVisible();
    await popTempo.click();

    // Modal tempo hiển thị
    const tempoModal = page.locator('#tempo-pick-modal');
    await expect(tempoModal).toBeVisible();

    // Giá trị hiển thị trong modal mặc định không phải 104
    const tempoVal = page.locator('#tempo-modal-val');
    await expect(tempoVal).not.toHaveText('104');
  });

});
