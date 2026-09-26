// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E test cho Ticket T15b:
 * Mở Manager Portal và chuyển qua các tab (Repertoire, Community Chords, Versions, Categories, Users),
 * xác nhận tất cả dữ liệu được tải thành công qua ApiService.manager và console sạch, không có lỗi JS.
 */

test.describe('Ticket T15b: Manager Portal tích hợp toàn diện ApiService', () => {
  test('Mở các tab Manager, tải dữ liệu qua ApiService và console sạch', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // 1. Tạo session admin
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Vào Manager Portal
    await page.goto('./manager/', { waitUntil: 'domcontentloaded' });

    // 3. Tab 1: Kho Bài Hát & Thể Loại (tab-repertoire)
    const repertoireTab = page.locator('#mgr-songs-tbody');
    await expect(repertoireTab).toBeVisible({ timeout: 15000 });
    // Đợi ít nhất 1 bài hát xuất hiện trong tbody
    await expect(page.locator('#mgr-songs-tbody tr').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Tab Repertoire: Danh sách bài hát đã nạp thành công.');

    // 4. Tab 2: Bộ Hợp Âm Cộng Đồng (tab-community)
    await page.click('button[data-tab="tab-community"]');
    const communityGrid = page.locator('#mgr-community-grid');
    await expect(communityGrid).toBeVisible({ timeout: 10000 });
    // Chờ loading biến mất
    await expect(page.locator('#mgr-community-grid .mgr-spinner')).toHaveCount(0, { timeout: 10000 });
    console.log('✅ Tab Community: Bộ hợp âm cộng đồng đã nạp thành công.');

    // 5. Tab 3: Phiên Bản MusicXML Fork (tab-versions)
    await page.click('button[data-tab="tab-versions"]');
    const versionsGrid = page.locator('#mgr-versions-grid');
    await expect(versionsGrid).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#mgr-versions-grid .mgr-spinner')).toHaveCount(0, { timeout: 10000 });
    console.log('✅ Tab Versions: Danh sách bản MusicXML đã nạp thành công.');

    // 6. Tab 4: Quản Lý Thể Loại (tab-categories)
    await page.click('button[data-tab="tab-categories"]');
    const categoriesGrid = page.locator('#mgr-categories-grid');
    await expect(categoriesGrid).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#mgr-categories-grid .cat-card').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Tab Categories: Danh mục thể loại đã nạp thành công.');

    // 7. Tab 5: Thành Viên & Phân Quyền (tab-users)
    await page.click('button[data-tab="tab-users"]');
    const usersTbody = page.locator('#mgr-users-tbody');
    await expect(usersTbody).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#mgr-users-tbody tr').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Tab Users: Danh sách thành viên đã nạp thành công.');

    // 8. Kiểm tra KPI Stats đã nạp số liệu
    const kpiSongs = page.locator('#kpi-total-songs');
    await expect(kpiSongs).not.toHaveText('...', { timeout: 10000 });
    const songsCount = await kpiSongs.textContent();
    expect(Number(songsCount)).toBeGreaterThan(0);
    console.log(`✅ KPI Stats: ${songsCount} bài hát.`);

    // 9. Xác nhận console sạch không có lỗi
    expect(pageErrors, `Page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
    console.log('✅ Toàn bộ console sạch 100%, không phát sinh lỗi.');
  });
});
