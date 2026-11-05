// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * S4 đa Hội Thánh (cờ MULTI_CHURCH bật trong bản sao cô lập): tab "Hội Thánh" ở /manager/.
 * Admin thấy danh sách + thành viên + mã mời, tạo HT mới, vào bằng mã mời; console sạch.
 */
test.describe('Tab Hội Thánh trong Quản lý', () => {
  test('Admin quản lý Hội Thánh, tạo HT mới, console sạch', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    const sessionId = require('./helpers/php-session').run(['admin', 'admin']).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);

    await page.goto('./manager/', { waitUntil: 'domcontentloaded' });
    await page.click('#mgr-adv-toggle');
    await page.click('button[data-tab="tab-churches"]');
    await expect(page.locator('#tab-churches')).toBeVisible();

    await expect(page.locator('#church-select option').first()).toBeAttached();
    await expect(page.locator('#church-admin-box')).toBeVisible();
    await expect(page.locator('#church-invite-code')).toHaveText(/^[A-F0-9]{8}$/);
    await expect(page.locator('#church-members-tbody tr').first()).toBeVisible();

    const name = 'HT Test ' + Date.now();
    await page.fill('#church-new-name', name);
    await page.click('#btn-church-create');
    await expect(page.locator('#church-select option', { hasText: name })).toHaveCount(1);

    // Chuyển sang HT mới → mã mời đổi
    const before = await page.locator('#church-invite-code').textContent();
    const value = await page.locator('#church-select option', { hasText: name }).getAttribute('value');
    await page.selectOption('#church-select', value);
    await expect(page.locator('#church-invite-code')).not.toHaveText(before || '');

    // Mã mời sai → báo lỗi, không văng lỗi JS
    await page.fill('#church-join-code', 'ZZZZZZZZ');
    await page.click('#btn-church-join');
    await expect(page.locator('#mgr-toast-container')).toContainText('Mã mời không đúng');

    expect(errors.filter((e) => !/favicon|Failed to load resource/.test(e))).toEqual([]);
  });

  test('Điện thoại: tab không tràn ngang', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const sessionId = require('./helpers/php-session').run(['admin', 'admin']).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);
    await page.goto('./manager/#tab-churches', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#church-admin-box')).toBeVisible();
    // Chỉ kiểm nội dung của tab này (header /manager/ có tràn ~10px sẵn từ trước, tab Thành viên cũng vậy).
    const overflow = await page.evaluate(() => {
      const right = [...document.querySelectorAll('#tab-churches *')]
        .filter((e) => e.offsetParent && !e.closest('.mgr-users-table-wrapper'))
        .reduce((m, e) => Math.max(m, e.getBoundingClientRect().right), 0);
      return right - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
