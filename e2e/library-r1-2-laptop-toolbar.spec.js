// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Ticket R1-2: Laptop Toolbar 48px & 9 Core Groups Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Toolbar height is 48px and all 9 core groups are visible on laptop viewport', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // 1. Check toolbar height is 48px
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();
    const box = await toolbar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.round(box.height)).toBe(48);
    }

    // 2. Check 9 laptop core groups exist and are visible
    // Group 1: Left group (Menu, Song Info, Popover)
    await expect(page.locator('#toolbar-left-group')).toBeVisible();
    await expect(page.locator('#btn-open-sidebar')).toBeVisible();
    await expect(page.locator('#song-info')).toBeVisible();
    await expect(page.locator('#btn-song-info-popover')).toBeVisible();

    // Group 2: Transpose Pill
    const transposePill = page.locator('.transpose-pill');
    await expect(transposePill).toBeVisible();
    await expect(page.locator('#btn-transpose-down')).toBeVisible();
    await expect(page.locator('#transpose-display')).toBeVisible();
    await expect(page.locator('#btn-transpose-up')).toBeVisible();
    await expect(page.locator('#btn-transpose-reset')).toBeVisible();

    // Group 3: Chord Set Pill
    await expect(page.locator('#chord-set-bar')).toBeVisible();
    await expect(page.locator('#chord-set-selector')).toBeVisible();

    // Group 4: Tempo Pill
    const tempoPill = page.locator('#btn-toolbar-tempo');
    await expect(tempoPill).toBeVisible();
    await expect(page.locator('#toolbar-tempo-val')).toBeVisible();

    // Group 5: View Switch Segmented
    const viewSwitch = page.locator('#view-switch');
    await expect(viewSwitch).toBeVisible();
    await expect(page.locator('#btn-view-sheet')).toBeVisible();
    await expect(page.locator('#btn-view-lyrics')).toBeVisible();

    // Group 6: Chord Edit Pill
    await expect(page.locator('#btn-add-chord-mode-bar')).toBeVisible();

    // Group 7: Fullscreen / Biểu Diễn with explicit label
    const fullscreenBtn = page.locator('#btn-fullscreen');
    await expect(fullscreenBtn).toBeVisible();
    await expect(fullscreenBtn).toContainText('Biểu Diễn');

    // Group 8: Navigation arrows
    await expect(page.locator('#nav-arrows')).toBeVisible();
    await expect(page.locator('#btn-prev-song')).toBeVisible();
    await expect(page.locator('#btn-next-song')).toBeVisible();

    // Group 9: More options menu
    await expect(page.locator('#more-options-group')).toBeVisible();
    await expect(page.locator('#btn-more-options')).toBeVisible();
  });

  test('Segmented view switch toggles between score sheet and lyrics view', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const btnSheet = page.locator('#btn-view-sheet');
    const btnLyrics = page.locator('#btn-view-lyrics');
    const lyricContainer = page.locator('#lyric-view-container');

    // Default state: Sheet view active
    await expect(btnSheet).toHaveClass(/active/);
    await expect(btnLyrics).not.toHaveClass(/active/);
    await expect(lyricContainer).toHaveClass(/hidden/);

    // Switch to Lyrics view
    await btnLyrics.click();
    await expect(btnLyrics).toHaveClass(/active/);
    await expect(btnSheet).not.toHaveClass(/active/);
    await expect(lyricContainer).not.toHaveClass(/hidden/);

    // Switch back to Sheet view
    await btnSheet.click();
    await expect(btnSheet).toHaveClass(/active/);
    await expect(btnLyrics).not.toHaveClass(/active/);
    await expect(lyricContainer).toHaveClass(/hidden/);
  });
});
