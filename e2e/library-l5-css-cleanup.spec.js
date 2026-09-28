// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-css-cleanup.spec.js
 *
 * Kiểm thử E2E cho Ticket L5-8 (ROADMAP4 Mục 8):
 * - Dọn CSS trang chính: thang z-index bằng biến, giảm !important >= 70%
 * - Bỏ 24 phần tử giả "legacy ID" trong includes: 0 phần tử giả tồn tại trong DOM
 * - Các thành phần giao diện chính (Toolbar, Sidebar, Sheet Viewer) hoạt động bình thường, layout chuẩn xác
 */

test.describe('L5-8 · Dọn CSS & Loại Bỏ 24 Phần Tử Giả Legacy ID', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Kiểm tra 0 phần tử giả legacy ID nào tồn tại trong DOM trang chính', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const dummyIds = [
      // 9 dummy elements cũ trong sheet_viewer.php
      'page-bar',
      'page-indicator',
      'btn-page-prev',
      'btn-page-next',
      'btn-perf-notes',
      'btn-add-chord-mode',
      'add-chord-hint',
      'btn-add-annotate-mode',
      'add-annotate-hint',
      // 15 dummy elements cũ trong toolbar.php
      'zoom-value-label',
      'btn-chord-highlight',
      'btn-delete-chord-set',
      'btn-clear-all-chords',
      'btn-cancel-add-chord',
      'btn-toggle-view',
      'btn-metronome',
      'audio-playback-mode',
      'btn-compact-settings',
      'btn-create-new-version',
      'btn-menu-open-editor',
      'btn-dark-mode',
      'btn-session-panel',
      'btn-live-sync',
      'live-sync-badge'
    ];

    for (const id of dummyIds) {
      const count = await page.locator('#' + id).count();
      expect(count, `Phần tử giả #${id} tuyệt đối không được tồn tại trong DOM`).toBe(0);
    }
  });

  test('2. Thang z-index bằng biến CSS hoạt động đồng bộ trên :root và các component', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    const zTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        base: style.getPropertyValue('--z-base').trim(),
        toolbar: style.getPropertyValue('--z-toolbar').trim(),
        sidebar: style.getPropertyValue('--z-sidebar').trim(),
        hud: style.getPropertyValue('--z-hud').trim(),
        modal: style.getPropertyValue('--z-modal').trim(),
        topmost: style.getPropertyValue('--z-topmost').trim()
      };
    });

    expect(zTokens.base).toBe('1');
    expect(zTokens.toolbar).toBe('50');
    expect(zTokens.sidebar).toBe('60');
    expect(zTokens.hud).toBe('100');
    expect(zTokens.modal).toBe('1000');
    expect(zTokens.topmost).toBe('9999');
  });

  test('3. Giao diện trang chính hiển thị chuẩn xác, không bị vỡ layout sau khi dọn CSS', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Toolbar chính hiển thị
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();

    // Tên bài hát hiển thị chính xác
    const songTitle = page.locator('#song-title');
    await expect(songTitle).toBeVisible();
    await expect(songTitle).not.toHaveText('Chọn bài hát...');

    // Nút dịch tông và hiển thị tông hoạt động
    const transDisplay = page.locator('#transpose-display');
    await expect(transDisplay).toBeVisible();
    await expect(transDisplay).toHaveText('0');

    // Nút Preset Aa hoạt động bình thường
    const btnChordPreset = page.locator('#btn-chord-preset');
    await expect(btnChordPreset).toBeVisible();
    await btnChordPreset.click();
    await page.waitForTimeout(200);

    // Kiểm tra Sidebar hiển thị trên màn hình desktop
    const sidebar = page.locator('#sidebar');
    const isSidebarClosed = await sidebar.evaluate(el => el.classList.contains('mobile-hidden') || el.classList.contains('hidden') || el.getBoundingClientRect().right <= 0);
    if (isSidebarClosed) {
      await page.locator('#btn-open-sidebar').click();
      await page.waitForTimeout(300);
    }
    await expect(sidebar).toBeVisible();

    // Nút tìm kiếm số nhanh # có mặt trong sidebar
    const btnQuickNumpad = page.locator('#btn-quick-numpad');
    await expect(btnQuickNumpad).toBeVisible();
  });

});
