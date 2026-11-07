// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin HT quản lý kho riêng: sửa tên bài, rồi chuyển sang công khai (có hộp xác nhận bản quyền).
 * Trước khi công khai khách không thấy bài; sau khi công khai khách thấy và bài rời kho riêng.
 */
const SAMPLE_XML = (() => {
  const dir = path.resolve(__dirname, '..', 'storage', 'Thanh ca');
  const first = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith('.xml'));
  return path.join(dir, first);
})();

async function sessionFor(context, username) {
  const sid = require('./helpers/php-session').run([username]).toString().trim();
  await context.addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
}

test('Admin HT sửa rồi công khai bài riêng; khách chỉ thấy sau khi công khai', async ({ browser }) => {
  const abbr = 'p' + Date.now().toString(36).slice(-6);
  const errors = [];

  const sysCtx = await browser.newContext();
  await sessionFor(sysCtx, 'admin');
  const sys = await sysCtx.newPage();
  await sys.goto('./manager/', { waitUntil: 'domcontentloaded' });
  const setup = await sys.evaluate(async (a) => {
    const made = await window.ApiService.churches.create('HT Công khai ' + a, a);
    const cat = await window.ApiService.categories.create({ name: 'Riêng ' + a, church_id: made.church.id });
    return { catName: 'Riêng ' + a, catId: cat.id };
  }, abbr);

  const adminCtx = await browser.newContext();
  await sessionFor(adminCtx, `admin.${abbr}`);
  const page = await adminCtx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('./manager/#tab-churches', { waitUntil: 'domcontentloaded' });

  const catRow = page.locator('#church-cat-list li', { hasText: setup.catName });
  await expect(catRow).toBeVisible({ timeout: 15000 });
  await catRow.getByRole('button', { name: /Thêm bài/ }).click();
  await page.setInputFiles('#upload-song-files', SAMPLE_XML);
  const title = 'Bài chờ công khai ' + abbr;
  await expect(page.locator('.up-in-title').first()).toBeVisible({ timeout: 15000 });
  await page.locator('.up-in-title').first().fill(title);
  await page.click('#btn-upload-song-submit');
  await expect(page.locator('#upload-song-results')).toContainText('→ ' + title, { timeout: 30000 });

  const guestSees = async (t) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('./', { waitUntil: 'domcontentloaded' });
    const seen = await p.evaluate(async (x) => {
      const list = await (await fetch('api/index.php?route=songs', { credentials: 'same-origin' })).json();
      return (Array.isArray(list) ? list : list.data || []).some((s) => s.title === x);
    }, t);
    await ctx.close();
    return seen;
  };

  // Quản lý bài: mở danh sách, sửa tên
  await page.goto('./manager/#tab-churches', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const cat = page.locator('#church-cat-list li', { hasText: setup.catName });
  await cat.getByRole('button', { name: /Quản lý bài/ }).click();
  const row = cat.locator('.mgr-church-song').first();
  await expect(row).toContainText(title, { timeout: 15000 });
  await row.getByRole('button', { name: /Sửa/ }).click();
  const newTitle = title + ' (đã sửa)';
  await cat.locator('[data-f="title"]').fill(newTitle);
  await cat.getByRole('button', { name: 'Lưu' }).click();
  await expect(cat.locator('.mgr-church-song').first()).toContainText(newTitle, { timeout: 15000 });
  expect(await guestSees(newTitle)).toBe(false);

  // Công khai (hộp xác nhận bản quyền được chấp nhận bởi handler dialog)
  await cat.locator('.mgr-church-song').first().getByRole('button', { name: /Công khai/ }).click();
  await expect(cat.locator('.mgr-church-songs')).toContainText('Chưa có bài', { timeout: 15000 });
  expect(await guestSees(newTitle)).toBe(true);

  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
  await sysCtx.close();
  await adminCtx.close();
});
