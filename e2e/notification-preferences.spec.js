// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/notification-preferences.spec.js
 *
 * Kiểm thử E2E cho Epic 4.4:
 * Tùy chọn thông báo đa kênh (Notification Preferences & Deliveries):
 * 1. Đăng nhập người dùng admin/leader
 * 2. Mở Manager -> Mở Modal Hồ Sơ -> Chuyển sang Tab "Tùy Chọn Thông Báo"
 * 3. Kiểm tra ma trận kênh x sự kiện (In-app, Email, Web Push)
 * 4. Cập nhật địa chỉ email và khung giờ yên lặng (Quiet Hours)
 * 5. Bấm Lưu và xác nhận hệ thống cập nhật thành công (Toast phản hồi)
 */

test.describe('Epic 4.4: Tùy Chọn Thông Báo Đa Kênh & Khung Giờ Yên Lặng', () => {
  test('Người dùng có thể xem và lưu tùy chọn thông báo trong Manager', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Tạo session admin
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Mở Manager Portal
    await page.goto('./manager/', { waitUntil: 'domcontentloaded' });

    // 3. Mở Modal Hồ Sơ
    const profileBtn = page.locator('#btn-open-profile');
    await expect(profileBtn).toBeVisible({ timeout: 10000 });
    await profileBtn.click();

    const profileModal = page.locator('#modal-profile');
    await expect(profileModal).toBeVisible({ timeout: 5000 });

    // 4. Chuyển sang Tab "Tùy Chọn Thông Báo"
    const notifsTabBtn = page.locator('#btn-ptab-notifs');
    await expect(notifsTabBtn).toBeVisible();
    await notifsTabBtn.click();

    const notifsTabContent = page.locator('#ptab-notifs');
    await expect(notifsTabContent).toBeVisible();

    // 5. Kiểm tra các trường nhập email & quiet hours
    const emailInput = page.locator('#notif-email');
    const quietStart = page.locator('#notif-quiet-start');
    const quietEnd   = page.locator('#notif-quiet-end');

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(quietStart).toBeVisible();
    await expect(quietEnd).toBeVisible();

    // 6. Kiểm tra ma trận sự kiện tải lên
    const matrixTbody = page.locator('#tbody-notif-matrix');
    await expect(matrixTbody).toBeVisible();
    await expect(matrixTbody.locator('tr').first()).toBeVisible({ timeout: 10000 });

    // Kiểm tra có ít nhất checkbox cho plan.published
    const firstCheckbox = matrixTbody.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    // 7. Cập nhật thông tin & submit form
    await emailInput.fill('e2e-test@sheetapp.local');
    await quietStart.fill('22:00');
    await quietEnd.fill('07:00');

    const submitBtn = page.locator('#form-update-notif-prefs button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 8. Chờ Toast phản hồi lưu thành công
    const toast = page.locator('.app-toast, .mgr-toast, #toast-container');
    await expect(toast.first()).toBeVisible({ timeout: 8000 });

    // 9. Xác nhận console sạch không có lỗi
    expect(consoleErrors).toEqual([]);
  });
});
