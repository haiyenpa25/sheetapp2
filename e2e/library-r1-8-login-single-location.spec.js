import { test, expect } from '@playwright/test';

test.describe('Ticket R1-8: Single Login Location & Purge Duplicate Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  });

  test('1. Điểm đăng nhập duy nhất trên navbar; toolbar & menu không còn nút trùng', async ({ page }) => {
    // 1.1 Kiểm tra avatar/login trên app-shell-navbar
    const shellLogin = page.locator('#shell-btn-login, #shell-user-menu-btn').first();
    await expect(shellLogin).toBeVisible();

    // 1.2 Nút cũ trên toolbar #btn-toolbar-auth bị ẩn hoàn toàn
    const toolbarAuth = page.locator('#btn-toolbar-auth');
    await expect(toolbarAuth).toBeHidden();

    // 1.3 Menu Công Cụ (⋯) không có nút đăng nhập trùng lặp #btn-menu-auth
    await page.locator('#btn-more-options').click();
    const menu = page.locator('#main-dropdown-menu');
    await expect(menu).toBeVisible();
    await expect(page.locator('#btn-menu-auth')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // 1.4 Click vào nút login trên navbar mở auth-modal
    await shellLogin.click();
    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible();
    await expect(authModal).not.toHaveClass(/hidden/);
    await page.locator('#btn-close-auth').click();
    await expect(authModal).toHaveClass(/hidden/);
  });

  test('2. "Theo người hướng dẫn" có 1 chỗ khởi động chính trong menu ⋯; toolbar mặc định ẩn', async ({ page }) => {
    // 2.1 Toolbar button #btn-follow-leader mặc định ẩn khi không theo
    const toolbarFollowBtn = page.locator('#btn-follow-leader');
    await expect(toolbarFollowBtn).toBeHidden();

    // 2.2 Điểm khởi động chính nằm trong Bảng Công Cụ ⋯
    await page.locator('#btn-more-options').click();
    const menuFollowBtn = page.locator('#btn-menu-follow-leader');
    await expect(menuFollowBtn).toBeVisible();
    await expect(menuFollowBtn).toContainText('Theo người hướng dẫn');

    // 2.3 Bấm mở modal kết nối nhóm
    await menuFollowBtn.click();
    const followModal = page.locator('#follow-leader-modal');
    await expect(followModal).toBeVisible();
    await expect(followModal).not.toHaveClass(/hidden/);
    await page.locator('#btn-close-follow-modal').click();
    await expect(followModal).toHaveClass(/hidden/);
  });

  test('3. Nút ☰ duy nhất trên thanh công cụ; trong sidebar là nút đóng ✕ rõ ràng', async ({ page }) => {
    const btnOpenSidebar = page.locator('#btn-open-sidebar');
    await expect(btnOpenSidebar).toBeVisible();
    await expect(btnOpenSidebar).toHaveAttribute('aria-label', /Mở danh sách bài hát/);

    // Mở sidebar drawer
    await btnOpenSidebar.click();
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    // Nút đóng bên trong sidebar mang icon ✕ và nhãn đóng
    const btnCloseSidebar = page.locator('#btn-toggle-sidebar');
    await expect(btnCloseSidebar).toBeVisible();
    await expect(btnCloseSidebar).toHaveAttribute('aria-label', 'Đóng danh sách bài hát');
    await expect(btnCloseSidebar.locator('svg use')).toHaveAttribute('href', '#icon-x');

    // Bấm đóng sidebar
    await btnCloseSidebar.click();
    await expect(sidebar).toHaveClass(/mobile-hidden/);
  });

  test('4. Chân sidebar đã dọn sạch các nút phụ trùng lặp Học Đàn / Live Band', async ({ page }) => {
    await page.locator('#btn-open-sidebar').click();
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    // Cụm .sidebar-footer-tools và các link mini bị ẩn hoàn toàn (display: none / d-none)
    await expect(page.locator('.sidebar-footer-tools:not(.d-none)')).toHaveCount(0);
    const footerTools = page.locator('.sidebar-footer-tools');
    if (await footerTools.count() > 0) {
      await expect(footerTools).toBeHidden();
      await expect(page.locator('.sidebar-mini-learn')).toBeHidden();
      await expect(page.locator('.sidebar-mini-live')).toBeHidden();
    }
  });
});
