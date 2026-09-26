// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/liturgical-usage.spec.js
 *
 * Kiểm thử E2E cho Epic 4.3:
 * Báo cáo lịch sử & tần suất sử dụng bài hát trong phụng vụ (Manager Tab Usage):
 * 1. Đăng nhập admin/leader
 * 2. Mở Manager -> Chuyển sang Tab "Thống Kê Phụng Vụ" (tab-usage)
 * 3. Kiểm tra các thẻ KPI phụng vụ (Tổng số bài đã dùng, Tổng số buổi lễ, Tỉ lệ xoay vòng)
 * 4. Kiểm tra bảng danh sách Top bài hát sử dụng nhiều nhất
 * 5. Xác nhận console sạch không có lỗi JS
 */

test.describe('Epic 4.3: Báo Cáo Lịch Sử & Thống Kê Phụng Vụ', () => {
  test('Admin/Leader xem báo cáo sử dụng bài hát và KPI phụng vụ trong Manager', async ({ page }) => {
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

    // 3. Tab Thống Kê Phụng Vụ có sẵn nút trên thanh navigation
    const usageTabBtn = page.locator('button[data-tab="tab-usage"]');
    await expect(usageTabBtn).toBeVisible({ timeout: 10000 });
    await usageTabBtn.click();

    // 4. Tab Thống Kê Phụng Vụ được kích hoạt
    const usagePane = page.locator('#tab-usage');
    await expect(usagePane).toBeVisible({ timeout: 5000 });

    // 5. Kiểm tra các KPI cards
    const kpiServices = page.locator('#stat-usage-services');
    const kpiPlays    = page.locator('#stat-usage-plays');
    await expect(kpiServices).toBeVisible({ timeout: 10000 });
    await expect(kpiPlays).toBeVisible();

    // 6. Kiểm tra các bảng báo cáo
    const topSongsTbody = page.locator('#tbody-usage-most');
    await expect(topSongsTbody).toBeVisible();

    // 7. Xác nhận console sạch không có lỗi
    expect(consoleErrors).toEqual([]);
  });
});
