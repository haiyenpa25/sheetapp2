// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l0-window-exports.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-1 (ROADMAP 4):
 * 1. Module window exports: ChordCanvas, HistoryManager, PageNav, AdminUI.
 * 2. Chip hợp âm hiển thị đúng số hợp âm thực tế của bộ HD (5 hợp âm trên thanh-ca-001).
 * 3. Phím C bật chế độ sửa hợp âm khi đăng nhập (banhat/admin) và bị từ chối khi là khách.
 * 4. Bấm ⭐ thì bài xuất hiện trong tab Yêu thích sau reload; "Gần đây" có bài vừa mở.
 */

test.describe('Ticket L0-1: Module Window Exports & Core Integrations', () => {

  test.beforeEach(async ({ page }) => {
    // Không hiện modal chào mừng trong test để không chặn phím
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Các module cốt lõi được gắn vào window và chip hợp âm hiện đúng số', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Chờ OSMD render xong
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const exportsStatus = await page.evaluate(() => {
      return {
        hasChordCanvas: typeof window.ChordCanvas === 'object' && window.ChordCanvas !== null,
        hasHistoryManager: typeof window.HistoryManager === 'object' && window.HistoryManager !== null,
        hasPageNav: typeof window.PageNav === 'object' && window.PageNav !== null,
        hasAdminUI: typeof window.AdminUI === 'object' && window.AdminUI !== null,
      };
    });

    expect(exportsStatus.hasChordCanvas).toBe(true);
    expect(exportsStatus.hasHistoryManager).toBe(true);
    expect(exportsStatus.hasPageNav).toBe(true);
    expect(exportsStatus.hasAdminUI).toBe(true);

    // Kiểm tra chip hợp âm trên toolbar và thanh thông tin: bài 001 có 5 hợp âm bộ HD
    const chordBadge = page.locator('#chord-set-count');
    await expect(chordBadge).toContainText('5 hợp âm', { timeout: 10000 });

    const siChordChip = page.locator('#si-chord-set-chip');
    await expect(siChordChip).toContainText('5', { timeout: 10000 });
  });

  test('Phím C bật chế độ sửa hợp âm khi đăng nhập và chặn khi là khách', async ({ page }) => {
    // 1. Kiểm tra khi là Khách (chưa đăng nhập)
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvgGuest = page.locator('#osmd-container svg').first();
    await expect(osmdSvgGuest).toBeVisible({ timeout: 25000 });

    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    const isEditChordsGuest = await page.evaluate(() => document.body.classList.contains('chord-edit-mode'));
    expect(isEditChordsGuest).toBe(false);

    // 2. Kiểm tra khi đăng nhập tài khoản Nhạc công (banhat)
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat banhat', {
      env: { ...process.env, SHEETAPP_E2E: '1' }
    }).toString().trim();

    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvgAuth = page.locator('#osmd-container svg').first();
    await expect(osmdSvgAuth).toBeVisible({ timeout: 25000 });

    // Focus vào body để nhận sự kiện bàn phím
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Nhấn phím 'c' để kích hoạt chế độ sửa hợp âm
    await page.keyboard.press('c');
    await expect(page.locator('body')).toHaveClass(/chord-edit-mode/, { timeout: 5000 });

    // Nhấn Escape để thoát chế độ sửa hợp âm
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/chord-edit-mode/, { timeout: 5000 });
  });

  test('HistoryManager theo dõi Gần đây và lưu Yêu thích ⭐ qua reload', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đảm bảo sidebar mở
    const sidebar = page.locator('#sidebar');
    if (!await sidebar.isVisible()) {
      await page.click('#btn-sidebar-toggle');
      await expect(sidebar).toBeVisible();
    }

    // 1. Kiểm tra mục Gần đây có bài 001
    const recentSection = page.locator('#recently-viewed-section');
    await expect(recentSection).toBeVisible({ timeout: 10000 });
    const recentItem = recentSection.locator('.recent-item[data-id="thanh-ca-001"]');
    await expect(recentItem).toBeVisible();

    // 2. Đánh dấu Yêu thích ⭐ cho bài 001
    const songItem001 = page.locator('#song-list .song-item[data-id="thanh-ca-001"]');
    await expect(songItem001).toBeVisible();
    const favBtn = songItem001.locator('.song-fav-btn');
    await expect(favBtn).toBeVisible();

    // Nếu chưa fav thì click
    const initialText = await favBtn.innerText();
    if (initialText.includes('☆')) {
      await favBtn.click();
      await expect(favBtn).toHaveText('★', { timeout: 3000 });
    }

    // 3. Reload trang để xác thực lưu trữ localStorage bền vững
    await page.reload({ waitUntil: 'domcontentloaded' });
    const osmdSvgReload = page.locator('#osmd-container svg').first();
    await expect(osmdSvgReload).toBeVisible({ timeout: 25000 });

    // Mở lại sidebar nếu bị auto-close khi bài nạp xong
    const sidebarAfterReload = page.locator('#sidebar');
    if (!await sidebarAfterReload.isVisible()) {
      await page.click('#btn-sidebar-toggle');
      await expect(sidebarAfterReload).toBeVisible();
    }

    // Mở tab Yêu thích trong sidebar
    const favsTab = page.locator('#sidebar-tab-favs');
    await expect(favsTab).toBeVisible();
    await favsTab.click();

    // Bài 001 phải nằm trong danh sách yêu thích
    const favSongItem = page.locator('#song-list .song-item[data-id="thanh-ca-001"]');
    await expect(favSongItem).toBeVisible({ timeout: 5000 });

    // Dọn dẹp: Bỏ fav bài 001 để tránh rác
    const unFavBtn = favSongItem.locator('.song-fav-btn');
    await unFavBtn.click();
    await expect(unFavBtn).toHaveText('☆', { timeout: 3000 });
  });

});
