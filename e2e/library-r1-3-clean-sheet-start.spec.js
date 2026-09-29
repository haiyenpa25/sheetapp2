// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Ticket R1-3: Clean Sheet Start & Chip Strip Relocation Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Song info chip strip is hidden and music score starts at y <= 100px', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // 1. #song-info-strip is hidden from viewport
    const strip = page.locator('#song-info-strip');
    await expect(strip).toBeHidden();

    // 2. Toolbar height is 48px
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();
    const tbBox = await toolbar.boundingBox();
    expect(tbBox).not.toBeNull();
    if (tbBox) {
      expect(Math.round(tbBox.height)).toBe(48);
    }

    // 3. Sheet viewer wrapper / container starts right below toolbar (y <= 100px)
    const viewer = page.locator('#sheet-viewer-wrapper');
    await expect(viewer).toBeVisible();
    const vBox = await viewer.boundingBox();
    expect(vBox).not.toBeNull();
    if (vBox) {
      expect(vBox.y).toBeLessThanOrEqual(100);
    }

    // 4. Popover ⓘ opens and contains song details
    const btnPopover = page.locator('#btn-song-info-popover');
    await expect(btnPopover).toBeVisible();
    await btnPopover.click();

    const popover = page.locator('#song-info-popover');
    await expect(popover).toBeVisible();
    await expect(page.locator('#si-pop-title')).not.toHaveText('--');
    await expect(page.locator('#si-pop-key')).not.toHaveText('--');
    await expect(page.locator('#si-pop-usage')).toBeVisible();

    // Close popover
    await page.locator('#btn-close-song-info-popover').click();
    await expect(popover).toBeHidden();
  });
});
