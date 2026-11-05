// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Kho bài riêng của Hội Thánh: admin HT (vai trò hệ thống leader) tự thêm bài vào danh mục riêng của HT mình,
 * bài đó chỉ thành viên HT thấy; người HT khác và khách không thấy. Bài chung vẫn thấy hết.
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

test('Admin HT thêm bài vào kho riêng; chỉ HT đó thấy', async ({ browser }) => {
  const abbr = 'k' + Date.now().toString(36).slice(-6);
  const errors = [];

  // 1. Admin hệ thống tạo HT + danh mục riêng
  const sysCtx = await browser.newContext();
  await sessionFor(sysCtx, 'admin');
  const sys = await sysCtx.newPage();
  await sys.goto('./manager/', { waitUntil: 'domcontentloaded' });
  const setup = await sys.evaluate(async (a) => {
    const made = await window.ApiService.churches.create('HT Kho ' + a, a);
    const cat = await window.ApiService.categories.create({ name: 'Riêng ' + a, church_id: made.church.id });
    return { churchId: made.church.id, catId: cat.id, catName: 'Riêng ' + a };
  }, abbr);
  expect(setup.catId).toBeGreaterThan(0);

  // 2. Admin HT mở tab Hội Thánh → Thêm bài (XML) vào danh mục riêng
  const adminCtx = await browser.newContext();
  await sessionFor(adminCtx, `admin.${abbr}`);
  const page = await adminCtx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./manager/#tab-churches', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#church-cat-list li', { hasText: setup.catName })).toBeVisible({ timeout: 15000 });
  await page.locator('#church-cat-list li', { hasText: setup.catName }).getByRole('button', { name: /Thêm bài/ }).click();
  await expect(page.locator('#modal-upload-song')).toBeVisible();
  // Người không phải admin hệ thống chỉ thấy danh mục riêng của HT mình trong ô chọn
  const options = await page.locator('#upload-song-cat-select option').allTextContents();
  expect(options.length).toBe(1);
  expect(options[0]).toContain(setup.catName);

  await page.setInputFiles('#upload-song-files', SAMPLE_XML);
  const title = 'Bài riêng ' + abbr;
  const titleInput = page.locator('.up-in-title').first();
  await expect(titleInput).toBeVisible({ timeout: 15000 });
  await titleInput.fill(title);
  await page.click('#btn-upload-song-submit');
  await expect(page.locator('#upload-song-results')).toContainText('→ ' + title, { timeout: 30000 });

  // 3. Ai thấy bài?
  const visible = async (ctx) => {
    const p = await ctx.newPage();
    await p.goto('./', { waitUntil: 'domcontentloaded' });
    return p.evaluate(async (t) => {
      const list = await (await fetch('api/index.php?route=songs', { credentials: 'same-origin' })).json();
      return (Array.isArray(list) ? list : list.data || []).some((s) => s.title === t);
    }, title);
  };
  expect(await visible(adminCtx)).toBe(true);     // admin HT
  expect(await visible(sysCtx)).toBe(true);       // admin hệ thống
  const otherCtx = await browser.newContext();    // thành viên HT mặc định
  await sessionFor(otherCtx, 'banhat');
  expect(await visible(otherCtx)).toBe(false);
  const guestCtx = await browser.newContext();    // khách
  expect(await visible(guestCtx)).toBe(false);

  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
  for (const c of [sysCtx, adminCtx, otherCtx, guestCtx]) await c.close();
});
