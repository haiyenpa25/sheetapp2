const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
const isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires an explicitly isolated installation');
test.beforeAll(() => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(path.resolve(__dirname, '..')));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
});

test('fresh release serves every category and its scores, and blocks private data', async ({ request }) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(isolated, 'storage/seed/library.manifest.json'), 'utf8'));
  const categories = await (await request.get(`${base}/api/index.php?route=categories`)).json();
  expect(categories).toHaveLength(manifest.counts.categories);
  for (const expected of manifest.categories) {
    const category = categories.find(item => item.slug === expected.slug);
    expect(category).toBeTruthy();
    const response = await request.get(`${base}/api/index.php?route=songs&action=search&category_id=${category.id}&limit=200`);
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.total).toBe(expected.songs);
    const songs = payload.data;
    expect(songs.length).toBeGreaterThan(0);
    const score = await request.get(`${base}/${songs[0].xmlPath}`);
    expect(score.ok()).toBe(true);
    expect(await score.text()).toMatch(/<score-partwise/);
  }
  for (const file of ['storage/data/app.sqlite', 'storage/seed/library.sqlite', 'storage/data/annotations/.instruments.json']) {
    expect((await request.get(`${base}/${file}`)).status()).toBe(403);
  }
});

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} loads a special hymn from the release without runtime errors`, async ({ page, request }) => {
    const categories = await (await request.get(`${base}/api/index.php?route=categories`)).json();
    const id = categories.find(item => item.slug === 'biet-thanh-ca').id;
    const payload = await (await request.get(`${base}/api/index.php?route=songs&action=search&category_id=${id}&limit=1`)).json();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=${payload.data[0].id}&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Nhạc cụ', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
