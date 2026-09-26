// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/notifications-flow.spec.js
 *
 * Kiểm thử E2E cho Lát 4.0-c (Epic 4.0):
 * Trung tâm thông báo trong ứng dụng (In-app Notification Center):
 * 1. Admin/Leader phát hành (publish) 1 Service Plan có phân công thành viên @banhat.
 * 2. Hệ thống ghi nhận Domain Event & tự động tạo bản ghi notifications (Fan-Out).
 * 3. Thành viên @banhat đăng nhập -> Chuông 🔔 trên App Shell hiển thị badge số lượng chưa đọc.
 * 4. Thành viên click vào chuông -> Dropdown mở ra hiển thị tiêu đề và nội dung thông báo.
 * 5. Thành viên bấm "Đọc tất cả" -> Toàn bộ thông báo được đánh dấu đã đọc, badge chuông biến mất.
 * 6. Tự động dọn dẹp dữ liệu sau khi kết thúc kiểm thử.
 */

test.describe('Epic 4.0 — Lát 4.0-c: Trung tâm thông báo trong ứng dụng (In-app Notifications)', () => {
  let testData = null;

  test.beforeEach(async () => {
    // Chuẩn bị dữ liệu: tạo plan + assign @banhat + publish
    const out = execSync('C:\\xampp\\php\\php.exe tools/setup_e2e_notification.php setup banhat').toString().trim();
    testData = JSON.parse(out);
  });

  test.afterEach(async () => {
    if (testData && testData.plan_id) {
      execSync(`C:\\xampp\\php\\php.exe tools/setup_e2e_notification.php cleanup ${testData.plan_id} ${testData.user_id}`);
    }
  });

  test('Thành viên nhận thông báo khi có Service Plan phát hành và có thể đánh dấu đã đọc', async ({ page }) => {
    // 1. Tạo session đăng nhập cho user @banhat
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat banhat').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Mở ứng dụng (trang chủ)
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // 3. Widget chuông thông báo xuất hiện
    const notifWidget = page.locator('#shell-notif-widget');
    await expect(notifWidget).toBeVisible({ timeout: 10000 });

    const notifBtn = page.locator('#shell-notif-btn');
    await expect(notifBtn).toBeVisible({ timeout: 5000 });

    // 4. Badge thông báo chưa đọc hiển thị
    const notifBadge = page.locator('#shell-notif-badge');
    await expect(notifBadge).toBeVisible({ timeout: 5000 });
    const badgeText = await notifBadge.innerText();
    expect(parseInt(badgeText, 10)).toBeGreaterThanOrEqual(1);

    // 5. Click chuông thông báo để mở dropdown
    await notifBtn.click();
    const dropdown = page.locator('#shell-notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // 6. Kiểm tra nội dung thông báo xuất hiện đúng tên Plan
    const notifList = page.locator('#shell-notif-list');
    await expect(notifList).toBeVisible({ timeout: 5000 });

    const notifItem = notifList.locator('.shell-notif-item').first();
    await expect(notifItem).toBeVisible({ timeout: 5000 });
    await expect(notifItem).toHaveClass(/unread/);
    await expect(notifItem).toContainText('Chương trình Phụng vụ đã phát hành');
    await expect(notifItem).toContainText(testData.plan_title);

    // 7. Click nút "Đọc tất cả"
    const markAllBtn = page.locator('#shell-notif-mark-all');
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();

    // 8. Xác nhận item không còn class unread và badge biến mất
    await expect(notifItem).not.toHaveClass(/unread/);
    await expect(notifBadge).toBeHidden({ timeout: 5000 });
  });
});
