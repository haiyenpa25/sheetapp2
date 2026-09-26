// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/leader-role.spec.js
 *
 * Kiểm thử E2E cho Lát 4.0-a (Epic 4.0):
 * 1. Admin truy cập Manager Portal -> tab Users.
 * 2. Mở modal chỉnh sửa user @khach, cập nhật role thành "leader" (👑 Ca Trưởng) và bè hát "T" (Tenor).
 * 3. Xác nhận bảng hiển thị ngay lập tức badge Ca Trưởng và badge Bè T.
 * 4. Reload lại trang, xác nhận role leader và voice_part T được lưu trữ bền vững.
 * 5. Hoàn tất dọn dẹp khôi phục trạng thái ban đầu.
 */

test.describe('Epic 4.0 — Lát 4.0-a: Vai trò Ca Trưởng & Bè trong Manager Portal', () => {
  test('Admin có thể phân quyền Ca Trưởng và gán Bè cho thành viên', async ({ page }) => {
    // 1. Tạo session admin
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Mở tab Users trong Manager Portal
    await page.goto('./manager/#tab-users', { waitUntil: 'domcontentloaded' });

    const usersTabBtn = page.locator('#mgr-nav-tab-users');
    if (await usersTabBtn.isVisible()) {
      await usersTabBtn.click();
    }

    const tbody = page.locator('#mgr-users-tbody');
    await expect(tbody).toBeVisible({ timeout: 15000 });

    // Tìm dòng của user @khach
    const khachRow = tbody.locator('tr').filter({ hasText: '@khach' }).first();
    await expect(khachRow).toBeVisible({ timeout: 10000 });

    // 3. Mở Edit Modal của @khach
    const editBtn = khachRow.locator('button', { hasText: 'Sửa' });
    await editBtn.click();

    const editModal = page.locator('#modal-edit-user');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // Chọn role Ca Trưởng và Bè Tenor (T)
    const roleSelect = page.locator('#edit-user-role');
    await roleSelect.selectOption('leader');

    const voiceSelect = page.locator('#edit-user-voice-part');
    await voiceSelect.selectOption('T');

    // Lưu thay đổi
    const saveBtn = editModal.locator('button[type="submit"]');
    await saveBtn.click();

    // 4. Chờ modal đóng và toast xuất hiện
    await expect(editModal).toBeHidden({ timeout: 5000 });
    const toast = page.locator('.mgr-toast');
    await expect(toast).toContainText('Đã cập nhật', { timeout: 8000 });

    // 5. Kiểm tra hiển thị badge Ca Trưởng và Bè T
    await expect(khachRow).toContainText('Ca Trưởng', { timeout: 5000 });
    await expect(khachRow).toContainText('Bè T', { timeout: 5000 });

    // 6. Reload trang để xác minh tính bền vững
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadedKhachRow = page.locator('#mgr-users-tbody tr').filter({ hasText: '@khach' }).first();
    await expect(reloadedKhachRow).toBeVisible({ timeout: 10000 });
    await expect(reloadedKhachRow).toContainText('Ca Trưởng', { timeout: 5000 });
    await expect(reloadedKhachRow).toContainText('Bè T', { timeout: 5000 });

    // 7. Dọn dẹp: Khôi phục @khach về viewer và không bè
    const cleanupEditBtn = reloadedKhachRow.locator('button', { hasText: 'Sửa' });
    await cleanupEditBtn.click();
    await expect(editModal).toBeVisible({ timeout: 5000 });
    await roleSelect.selectOption('viewer');
    await voiceSelect.selectOption('');
    await saveBtn.click();
    await expect(editModal).toBeHidden({ timeout: 5000 });
  });
});
