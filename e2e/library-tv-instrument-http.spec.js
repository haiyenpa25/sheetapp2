const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
const isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires an explicit isolated Apache clone');
test.describe.configure({ mode: 'serial' });
let admin, peer, member, session, backup;
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
  peer = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid('admin')}`, Origin: new URL(base).origin } });
  member = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid('banhat')}`, Origin: new URL(base).origin } });
  backup = new Map([`${songId}.json`, `${songId}.json.lock`, '.instruments.json', '.instruments.json.lock'].map(name => {
    const file = path.join(isolated, 'storage/data/annotations', name);
    return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
  }));
});
test.afterAll(async () => {
  await admin?.dispose(); await peer?.dispose(); await member?.dispose();
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
  const writes = await Promise.all(['race-a', 'race-b'].map((id, index) => (index ? peer : admin).post(endpoint(), { data: {
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
    await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
    await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
    await page.getByLabel('Màu nhạc cụ', { exact: true }).evaluate(input => { input.value = '#0e7490'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.getByRole('button', { name: 'Lưu màu nhạc cụ', exact: true }).click();
    await expect(page.getByLabel('Màu nhạc cụ', { exact: true })).toHaveValue('#0e7490');
    await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
    await expect(page.locator('.ano-dot-btn')).toHaveCount(await page.evaluate(() => AnnotationGeometry.anchors().length));
    await page.locator('.ano-dot-btn').first().click();
    await page.getByLabel('Nội dung ghi chú').fill('Fill trước điệp khúc');
    await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.ano-dot')).toHaveCount(1);
    const doc = await document();
    expect(doc.annotations[0]).toMatchObject({ instrumentId: 'drums', text: 'Fill trước điệp khúc', measureIdx: 0, staffIdx: 0 });
    expect(doc.annotations[0].scoreFingerprint).toMatch(/^[a-f0-9]{8}$/);
    expect(doc.instruments.find(item => item.id === 'drums').color).toBe('#0e7490');
    expect(doc.annotations[0].beat).toMatch(/^\d+\/\d+$/);
    await page.reload();
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await expect(page.locator('.ano-dot')).toHaveCount(1);
    await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
    await expect(page.locator('[data-annotation-id]')).toContainText('Fill trước điệp khúc');
    for (const width of [1366, 820, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.ano-dot')).toHaveCount(1);
      await expect(page.locator('#toolbar #instrument-annotations > button')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test(`${classic ? 'Classic' : 'Modern'} dense notes stay readable at four screen widths`, async ({ page }) => {
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=${songId}&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await page.evaluate(async () => {
      const anchors = AnnotationGeometry.anchors();
      const doc = await ApiService.annotations.load('thanh-ca-001');
      ApiService.annotations.load = async () => ({ ...doc, annotations: anchors.slice(0, 6).map((anchor, index) => ({
        id: `preview-${index}`, instrumentId: index % 2 ? 'guitar' : 'drums', measureIdx: anchor.measureIdx,
        staffIdx: anchor.staffIdx, noteIdx: anchor.noteIdx, beat: anchor.beat,
        text: index % 2 ? 'Rải nhẹ, điệp khúc quạt' : 'Fill vào điệp khúc'
      })) });
      await AnnotationCanvas.loadSong('thanh-ca-001', true);
    });
    for (const width of [1366, 820, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(600);
      await expect(page.locator('.ano-dot')).toHaveCount(6);
      await expect(async () => {
        const collisions = await page.evaluate(() => {
        const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const dots = Array.from(document.querySelectorAll('.ano-dot'));
        const anchors = AnnotationGeometry.anchors(), bounds = document.getElementById('osmd-container').getBoundingClientRect();
        for (const dot of dots) {
          const anchor = anchors.find(a => a.measureIdx === +dot.dataset.measureIdx && a.staffIdx === +dot.dataset.staffIdx && a.noteIdx === +dot.dataset.noteIdx);
          if (dot.getBoundingClientRect().bottom > bounds.top + AnnotationGeometry.chordTop(anchor, bounds) + 1) return [{ misplaced: dot.title }];
          const previous = anchors.filter(a => a.measureIdx === anchor.measureIdx && a.staffIdx < anchor.staffIdx);
          if (previous.some(a => dot.getBoundingClientRect().top < a.el.getBoundingClientRect().bottom)) return [{ wrongStaff: dot.title }];
        }
        const text = Array.from(document.querySelectorAll('#osmd-container svg text,.cc-custom-chord-text')).filter(node => {
          const style = getComputedStyle(node);
          return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)';
        });
        return dots.flatMap((node, index) => {
          const rect = node.getBoundingClientRect();
          const hit = text.find(other => overlap(rect, other.getBoundingClientRect()));
          const dot = dots.slice(index + 1).find(other => overlap(rect, other.getBoundingClientRect()));
          return hit || dot ? [{ note: node.title, obstacle: (hit || dot).textContent, rect: rect.toJSON(), other: (hit || dot).getBoundingClientRect().toJSON() }] : [];
        });
        });
        expect(collisions).toEqual([]);
      }).toPass({ timeout: 5000 });
      await page.screenshot({ path: `test-results/instrument-annotations/${classic ? 'classic' : 'modern'}-${width}.png` });
    }
  });
}
