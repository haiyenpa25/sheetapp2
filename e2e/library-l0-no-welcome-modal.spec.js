// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-no-welcome-modal.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-9 (ROADMAP 4):
 * Bỏ modal chào mừng / đăng nhập mỗi phiên (Quyết định L-D4):
 *  - Mặc định người dùng vào như khách (Guest).
 *  - Không tự động hiện pop-up modal chào mừng che màn hình khi mở tab mới.
 *  - Mở tab mới với `?song=` thấy nhạc ngay, không có modal.
 *  - Đăng nhập chỉ từ nút tài khoản trên thanh App Shell/Toolbar.
 *
 * Nghiệm thu:
 *  - Mở trang không có sessionStorage preset → thấy nhạc ngay, modal ẩn hoàn toàn.
 *  - Bấm nút tài khoản `#btn-toolbar-auth` → modal auth hiển thị đúng mong đợi.
 */

test.describe('Ticket L0-9: Bỏ modal chào mừng mỗi phiên (Vào thẳng chế độ Khách)', () => {

  test('1. Mở tab mới với ?song=thanh-ca-001: thấy nhạc ngay, KHÔNG có modal chào mừng', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });

    // Mở trang hoàn toàn sạch sẽ, không có bất kỳ sessionStorage hay localStorage preset nào
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Bản nhạc hiển thị ngay
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Đợi thêm 1 giây để đảm bảo không có bất kỳ setTimeout nào tự ý bật modal lên
    await page.waitForTimeout(1000);

    // Modal đăng nhập / chào mừng phải ẩn hoàn toàn
    const authModal = page.locator('#auth-modal');
    await expect(authModal).toHaveClass(/hidden/);

    // Kiểm tra không có backdrop modal nào che màn hình
    const isModalVisible = await authModal.isVisible();
    expect(isModalVisible).toBe(false);
  });

  test('2. Đăng nhập chỉ mở khi người dùng chủ động bấm nút tài khoản trên thanh Toolbar', async ({ page }) => {
    // Trên desktop ≥ 1300px, nút auth nằm trực tiếp trên Toolbar
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const authModal = page.locator('#auth-modal');
    await expect(authModal).toHaveClass(/hidden/);

    // Ticket R1-8 (ROADMAP5): #btn-toolbar-auth trên Toolbar bị ẩn vĩnh viễn
    // (class="btn-toolbar-user d-none" aria-hidden="true" tabindex="-1") -- nút Đăng
    // Nhập chuyển hẳn vào thanh điều hướng App Shell (#shell-btn-login), xem AppShell.js.
    const btnToolbarAuth = page.locator('#shell-btn-login');
    await expect(btnToolbarAuth).toBeVisible();
    await btnToolbarAuth.click();

    // Modal auth xuất hiện
    await expect(authModal).not.toHaveClass(/hidden/);
    await expect(authModal).toBeVisible();

    // Bấm nút đóng modal
    const btnClose = page.locator('#btn-close-auth');
    await btnClose.click();
    await expect(authModal).toHaveClass(/hidden/);
  });

});
