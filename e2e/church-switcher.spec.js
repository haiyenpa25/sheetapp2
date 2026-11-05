// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Đa Hội Thánh (cờ MULTI_CHURCH bật trong bản sao cô lập): bộ chọn Hội Thánh ở tab Chương trình của app chính,
 * cả giao diện Modern (/) lẫn Classic (/old/). Admin hệ thống thấy mọi HT; đổi HT → tải lại và nhớ lựa chọn.
 */
async function adminSession(page) {
  const sessionId = require('./helpers/php-session').run(['admin', 'admin']).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);
}

async function ensureTwoChurches(page) {
  await page.goto('./manager/', { waitUntil: 'domcontentloaded' });
  const count = await page.evaluate(async () => {
    const get = async () => (await (await fetch('../api/index.php?route=churches', { credentials: 'same-origin' })).json()).all_churches || [];
    let list = await get();
    if (list.length < 2) {
      await fetch('../api/index.php?route=churches&action=create', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'HT Switcher ' + Date.now() }),
      });
      list = await get();
    }
    return list.length;
  });
  expect(count).toBeGreaterThanOrEqual(2);
}

for (const [label, base] of [['Modern', './'], ['Classic', './old/']]) {
  test(`${label}: bộ chọn Hội Thánh hiện ở tab Chương trình và đổi được`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await adminSession(page);
    await ensureTwoChurches(page);

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.sidebar-tab[data-tab="setlist"]').first().click();
    const select = page.locator('#church-switcher-select');
    await expect(select).toBeVisible({ timeout: 15000 });
    expect(await select.locator('option').count()).toBeGreaterThanOrEqual(2);

    const current = await select.inputValue();
    const values = await select.locator('option').evaluateAll((els) => els.map((e) => e.getAttribute('value')));
    const other = values.find((v) => v !== current);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      select.selectOption(other),
    ]);
    await page.locator('.sidebar-tab[data-tab="setlist"]').first().click();
    await expect(page.locator('#church-switcher-select')).toHaveValue(String(other), { timeout: 15000 });
    expect(await page.evaluate(() => localStorage.getItem('sheetapp_active_church'))).toBe(String(other));

    // WebKit báo lỗi "access control checks" cho request đang bay bị hủy khi trang tải lại (đổi HT): bỏ qua nhiễu đó.
    expect(errors.filter((e) => !/access control checks|Load failed|cancelled/i.test(e))).toEqual([]);
  });
}

test('Khách không thấy bộ chọn Hội Thánh', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(page.locator('#church-switcher-select')).toHaveCount(0);
});
