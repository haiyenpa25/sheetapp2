// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Quản lý Hội Thánh trong tab Thành viên (cờ MULTI_CHURCH bật trong bản sao cô lập):
 * tạo HT kèm 3 tài khoản → cột "Hội Thánh" hiện chip → gán thêm HT cho một tài khoản → xóa HT (tài khoản còn).
 */
test('Tạo HT kèm tài khoản, thấy cột Hội Thánh, gán/gỡ, xóa HT', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const sessionId = require('./helpers/php-session').run(['admin', 'admin']).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);

  const abbr = 'e' + Date.now().toString(36).slice(-6);
  const churchName = 'HT Thử ' + abbr;

  await page.goto('./manager/', { waitUntil: 'domcontentloaded' });
  await page.click('#mgr-adv-toggle');
  await page.click('button[data-tab="tab-churches"]');
  await expect(page.locator('#church-create-box')).toBeVisible();

  // 1. Tạo HT kèm 3 tài khoản
  await page.fill('#church-new-name', churchName);
  await page.fill('#church-new-abbr', abbr);
  await page.click('#btn-church-create');
  await expect(page.locator('#church-new-accounts')).toBeVisible();
  const accountsText = await page.locator('#church-new-accounts-text').textContent();
  for (const prefix of ['banhat', 'bannhac', 'admin']) expect(accountsText).toContain(`${prefix}.${abbr}`);
  await expect(page.locator('#church-select option', { hasText: churchName })).toHaveCount(1);

  // 2. Cột Hội Thánh ở tab Thành viên
  await page.click('button[data-tab="tab-users"]');
  await expect(page.locator('#mgr-users-table th.col-churches')).toBeVisible();
  const adminRow = page.locator('#mgr-users-tbody tr', { hasText: `@admin.${abbr}` });
  await expect(adminRow.locator('.mgr-chip')).toContainText(churchName);
  await expect(adminRow.locator('.mgr-chip')).toContainText('★');

  // 3. Gán thêm một HT cho banhat.<abbr>, rồi gỡ
  const memberRow = page.locator('#mgr-users-tbody tr', { hasText: `@banhat.${abbr}` });
  await memberRow.getByRole('button', { name: /HT/ }).click();
  await expect(page.locator('#modal-user-churches')).toBeVisible();
  await expect(page.locator('#uc-list li')).toHaveCount(1);
  await page.selectOption('#uc-church-select', { label: 'Hội Thánh mặc định' });
  await page.click('#btn-uc-add');
  await expect(page.locator('#uc-list li')).toHaveCount(2);
  await page.locator('#uc-list li', { hasText: 'Hội Thánh mặc định' }).locator('button').click();
  await expect(page.locator('#uc-list li')).toHaveCount(1);
  await page.click('#modal-user-churches .mgr-modal-close');

  // 4. Xóa HT: tài khoản còn, không còn HT
  await page.click('button[data-tab="tab-churches"]');
  const value = await page.locator('#church-select option', { hasText: churchName }).getAttribute('value');
  await page.selectOption('#church-select', value);
  await expect(page.locator('#btn-church-delete')).toBeVisible();
  let dialogMessage = '';
  page.once('dialog', async (d) => { dialogMessage = d.message(); await d.accept(); });
  await page.click('#btn-church-delete');
  await expect(page.locator('#church-select option', { hasText: churchName })).toHaveCount(0);
  expect(dialogMessage).toContain('giữ nguyên');

  await page.click('button[data-tab="tab-users"]');
  const survivor = page.locator('#mgr-users-tbody tr', { hasText: `@banhat.${abbr}` });
  await expect(survivor).toBeVisible();
  await expect(survivor.locator('.mgr-chip')).toHaveCount(0);

  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
});
