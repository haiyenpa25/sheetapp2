// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E test cho Ticket T15a:
 * Admin mở tab Users trong Manager Portal, đổi vai trò (role) của 1 user fixture,
 * reload lại trang và xác nhận vai trò mới đã được lưu trữ và hiển thị chuẩn xác.
 */

test.describe('Ticket T15a: Quản lý thành viên qua ApiService trong Manager Portal', () => {
  test('Admin mở tab Users, đổi role của user fixture và xác nhận sau khi reload', async ({ page }) => {
    // 1. Tạo session đăng nhập quyền admin
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Điều hướng tới Manager Portal tab Users
    await page.goto('./manager/#tab-users', { waitUntil: 'domcontentloaded' });

    // 3. Đảm bảo tab Thành Viên & Phân Quyền đang active
    const usersTabBtn = page.locator('#mgr-nav-tab-users');
    if (await usersTabBtn.isVisible()) {
      await usersTabBtn.click();
    }

    // 4. Chờ bảng danh sách thành viên nạp xong
    const tbody = page.locator('#mgr-users-tbody');
    await expect(tbody).toBeVisible({ timeout: 15000 });

    // Tìm dòng của user @khach
    const khachRow = tbody.locator('tr').filter({ hasText: '@khach' }).first();
    await expect(khachRow).toBeVisible({ timeout: 10000 });

    // 5. Tìm dropdown chọn vai trò của @khach
    const roleSelect = khachRow.locator('select');
    await expect(roleSelect).toBeVisible();

    const initialRole = await roleSelect.inputValue();
    const targetRole = initialRole === 'viewer' ? 'banhat' : 'viewer';

    console.log(`User @khach: Đổi vai trò từ "${initialRole}" sang "${targetRole}"...`);

    // 6. Đổi vai trò sang targetRole
    await roleSelect.selectOption(targetRole);

    // Chờ toast thông báo xuất hiện
    const toast = page.locator('.mgr-toast');
    await expect(toast).toContainText('Đã cập nhật vai trò', { timeout: 8000 });

    // 7. Reload lại trang và kiểm tra lại
    console.log('Reload lại trang /manager/#tab-users để xác minh tính bền vững...');
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Chờ bảng nạp lại
    const reloadedRow = page.locator('#mgr-users-tbody tr').filter({ hasText: '@khach' }).first();
    await expect(reloadedRow).toBeVisible({ timeout: 15000 });

    const updatedRoleSelect = reloadedRow.locator('select');
    await expect(updatedRoleSelect).toHaveValue(targetRole, { timeout: 10000 });

    const expectedBadgeText = targetRole === 'banhat' ? '🎸 Ban Hát' : '👁️ Viewer';
    await expect(reloadedRow.locator('.mgr-user-role')).toContainText(expectedBadgeText);

    console.log(`✅ Xác nhận thành công: User @khach đã mang vai trò mới "${targetRole}" sau khi reload!`);

    // 8. Dọn dẹp / Khôi phục lại vai trò ban đầu
    if (targetRole !== initialRole) {
      await updatedRoleSelect.selectOption(initialRole);
      await expect(page.locator('.mgr-toast')).toContainText('Đã cập nhật vai trò', { timeout: 8000 });
      console.log(`Đã khôi phục vai trò của @khach về "${initialRole}".`);
    }
  });
});
