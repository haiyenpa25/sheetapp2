// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/review-workflow.spec.js
 *
 * Kiểm thử E2E cho Epic 4.2:
 * Quy trình phê duyệt bộ hợp âm & phiên bản MusicXML (Review Workflow):
 * 1. Đăng nhập người dùng admin/leader
 * 2. Mở Manager -> Chuyển sang Tab "Chờ Duyệt" (tab-reviews)
 * 3. Kiểm tra bảng hàng đợi phê duyệt, bộ lọc trạng thái và bộ lọc loại đề xuất
 * 4. Xác nhận modal Visual Diff Inspector (#modal-review-diff) có sẵn trong DOM
 * 5. Xác nhận console sạch không có lỗi JS
 */

test.describe('Epic 4.2: Quy Trình Phê Duyệt & Visual Diff Inspector', () => {
  test('Admin/Leader có thể truy cập hàng đợi phê duyệt và giao diện Visual Diff', async ({ page }) => {
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

    // 3. Tab Chờ Duyệt có sẵn nút trên thanh navigation
    const reviewsTabBtn = page.locator('button[data-tab="tab-reviews"]');
    await expect(reviewsTabBtn).toBeVisible({ timeout: 10000 });
    await reviewsTabBtn.click();

    // 4. Tab Chờ Duyệt được kích hoạt
    const reviewsPane = page.locator('#tab-reviews');
    await expect(reviewsPane).toBeVisible({ timeout: 5000 });

    // 5. Kiểm tra các bộ lọc
    const filterStatus = page.locator('#reviews-filter-status');
    const filterType   = page.locator('#reviews-filter-type');
    const refreshBtn   = page.locator('#btn-refresh-reviews');

    await expect(filterStatus).toBeVisible();
    await expect(filterType).toBeVisible();
    await expect(refreshBtn).toBeVisible();

    // 6. Kiểm tra bảng hàng đợi phê duyệt
    const reviewsTable = page.locator('#mgr-reviews-table');
    await expect(reviewsTable).toBeVisible();

    const tbody = page.locator('#tbody-reviews-queue');
    await expect(tbody).toBeVisible();

    // Chờ spinner biến mất (kết thúc tải dữ liệu từ API)
    await expect(page.locator('#tbody-reviews-queue .mgr-spinner')).toHaveCount(0, { timeout: 10000 });

    // 7. Modal Visual Diff Inspector có mặt và đóng mặc định
    const diffModal = page.locator('#modal-review-diff');
    await expect(diffModal).toHaveCount(1);
    await expect(diffModal).toHaveClass(/hidden/);

    // 8. Xác nhận console sạch không có lỗi
    expect(consoleErrors).toEqual([]);
  });
});
