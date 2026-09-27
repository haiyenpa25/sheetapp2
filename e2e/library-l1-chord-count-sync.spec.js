// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-chord-count-sync.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-3 (ROADMAP 4):
 * Đồng bộ số lượng hợp âm giữa dropdown và thanh thông tin:
 *  1. Chip hợp âm trên thanh thông tin (#si-chord-set-chip) và
 *     số đếm trong dropdown (#chord-set-count) phải luôn khớp số:
 *     - Nếu là fallback: Cả hai đều hiển thị thông điệp "HD chưa có · đang hiện TLH".
 *     - Nếu có hợp âm: Số lượng hợp âm (● N) ở cả 2 nơi phải bằng nhau tuyệt đối.
 *  2. Khi chuyển đổi qua lại giữa HD và TLH, cả hai nơi cập nhật đồng thời.
 */

test.describe('L1-3 · Đồng bộ số lượng hợp âm dropdown và thanh thông tin (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Số đếm hợp âm giữa chip và dropdown khớp nhau khi load bài', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const chip = page.locator('#si-chord-set-chip');
    const badge = page.locator('#chord-set-count');
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(badge).not.toHaveText('', { timeout: 10000 });

    const chipText = (await chip.innerText()).trim();
    const badgeText = (await badge.innerText()).trim();

    if (chipText.includes('HD chưa có')) {
      expect(badgeText).toContain('HD chưa có');
    } else {
      const chipMatch = chipText.match(/●\s*(\d+)/);
      const badgeMatch = badgeText.match(/●\s*(\d+)/);
      expect(chipMatch).not.toBeNull();
      expect(badgeMatch).not.toBeNull();
      expect(chipMatch[1]).toBe(badgeMatch[1]);
    }
  });

  test('2. Chuyển đổi giữa HD và TLH: cả 2 nơi cập nhật đồng bộ', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const chip = page.locator('#si-chord-set-chip');
    const badge = page.locator('#chord-set-count');
    await expect(chip).toBeVisible({ timeout: 10000 });

    // Click chip để chuyển sang TLH (gốc)
    await chip.click();
    await page.waitForTimeout(600);

    const chipTextTLH = (await chip.innerText()).trim();
    const badgeTextTLH = (await badge.innerText()).trim();

    expect(chipTextTLH).toContain('TLH');
    const chipMatchTLH = chipTextTLH.match(/●\s*(\d+)/);
    const badgeMatchTLH = badgeTextTLH.match(/●\s*(\d+)/);
    if (chipMatchTLH && badgeMatchTLH) {
      expect(chipMatchTLH[1]).toBe(badgeMatchTLH[1]);
    }

    // Click lại để quay về HD
    await chip.click();
    await page.waitForTimeout(600);

    const chipTextHD = (await chip.innerText()).trim();
    const badgeTextHD = (await badge.innerText()).trim();

    if (chipTextHD.includes('HD chưa có')) {
      expect(badgeTextHD).toContain('HD chưa có');
    } else {
      const chipMatchHD = chipTextHD.match(/●\s*(\d+)/);
      const badgeMatchHD = badgeTextHD.match(/●\s*(\d+)/);
      expect(chipMatchHD).not.toBeNull();
      expect(badgeMatchHD).not.toBeNull();
      expect(chipMatchHD[1]).toBe(badgeMatchHD[1]);
    }
  });

});
