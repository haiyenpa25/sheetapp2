const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
const isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires an explicit isolated Apache clone');
test.describe.configure({ mode: 'serial' });
let admin, member, session, backup;
const songId = 'thanh-ca-001';
const endpoint = () => `${base}/api/index.php?route=annotations`;
test.beforeAll(async () => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(path.resolve(__dirname, '..')));
  expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync('C:/xampp/htdocs/sheetapp2'));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const sid = role => execFileSync('C:/xampp/php/php.exe', ['tools/create_test_session.php', role],
    { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  session = sid('admin');
  admin = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${session}`, Origin: new URL(base).origin } });
  member = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid('banhat')}`, Origin: new URL(base).origin } });
  backup = new Map([`${songId}.json`, `${songId}.json.lock`, '.instruments.json', '.instruments.json.lock'].map(name => {
    const file = path.join(isolated, 'storage/data/annotations', name);
    return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
  }));
});
test.afterAll(async () => {
  await admin?.dispose(); await member?.dispose();
  for (const [file, bytes] of backup || []) {
    if (bytes !== null) fs.writeFileSync(file, bytes);
    else if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
async function document() { return (await admin.get(`${endpoint()}&action=load&songId=${songId}`)).json(); }
async function reset() {
  const doc = await document();
  const response = await admin.post(endpoint(), { data: { action: 'save', songId, revision: doc.revision, annotations: [] } });
  expect(response.status()).toBe(200);
}

test('HTTP keeps admin writes, guest/member read access and revision conflicts', async ({ request }) => {
  await reset(); const doc = await document();
  const note = { id: 'http-drum', instrumentId: 'drums', text: 'Fill', measureIdx: 0, noteIdx: 0, staffIdx: 0 };
  const data = { action: 'save', songId, revision: doc.revision, annotations: [note] };
  expect((await request.post(endpoint(), { headers: { Origin: new URL(base).origin }, data })).status()).toBe(403);
  expect((await member.post(endpoint(), { data })).status()).toBe(403);
  const saved = await admin.post(endpoint(), { data }); expect(saved.status()).toBe(200);
  expect((await admin.post(endpoint(), { data })).status()).toBe(409);
  const guest = await (await request.get(`${endpoint()}&action=load&songId=${songId}`)).json();
  expect(guest.annotations).toHaveLength(1);
  expect(guest.annotations[0]).toMatchObject(note);
  expect((await admin.post(endpoint(), { data: { action: 'save', songId, annotations: [] } })).status()).toBe(422);
  const registry = await (await admin.get(`${endpoint()}&action=instruments`)).json();
  const create = { action: 'instrument_save', name: 'Violin HTTP', registryRevision: registry.registryRevision };
  expect((await member.post(endpoint(), { data: create })).status()).toBe(403);
  const added = await admin.post(endpoint(), { data: create }); expect(added.status()).toBe(200);
  expect((await added.json()).instruments.some(item => item.name === create.name)).toBe(true);
  expect((await admin.get(`${endpoint()}&action=load&songId[]=bad`)).status()).toBe(422);
  expect((await admin.post(endpoint(), { data: { action: 'save', songId: [], annotations: [], revision: '' } })).status()).toBe(422);
  const fresh = await document();
  const writes = await Promise.all(['race-a', 'race-b'].map(id => admin.post(endpoint(), { data: {
    action: 'save', songId, revision: fresh.revision, annotations: [{ ...note, id }]
  } })));
  expect(writes.map(response => response.status()).sort()).toEqual([200, 409]);
  expect((await document()).annotations).toHaveLength(1);
});

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} real score saves and reloads instrument notes`, async ({ page, context }) => {
    await reset();
    await context.addCookies([{ name: 'PHPSESSID', value: session, domain: 'localhost', path: '/' }]);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=${songId}&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => Auth.isAdmin())).toBe(true);
    await page.getByRole('button', { name: 'Ghi chú nhạc cụ', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
    await page.getByRole('button', { name: 'Soạn ghi chú', exact: true }).click();
    await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
    await page.locator('.ano-dot-btn').first().click();
    await page.getByLabel('Nội dung ghi chú').fill('Fill trước điệp khúc');
    await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.ano-dot')).toHaveCount(1);
    const doc = await document();
    expect(doc.annotations[0]).toMatchObject({ instrumentId: 'drums', text: 'Fill trước điệp khúc', measureIdx: 0, staffIdx: 0 });
    expect(doc.annotations[0].scoreFingerprint).toMatch(/^[a-f0-9]{8}$/);
    expect(doc.annotations[0].beat).toMatch(/^\d+\/\d+$/);
    await page.reload();
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await expect(page.locator('.ano-dot')).toHaveCount(1);
    await page.getByRole('button', { name: 'Ghi chú nhạc cụ', exact: true }).click();
    await expect(page.locator('[data-annotation-id]')).toContainText('Fill trước điệp khúc');
    for (const width of [1366, 820, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.ano-dot')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
