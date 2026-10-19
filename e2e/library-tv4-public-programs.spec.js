const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
const isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
let fixture, member;
function php(code, extra = {}) {
  return execFileSync('C:/xampp/php/php.exe', [], { cwd: isolated, input: '<?php ' + code,
    env: { ...process.env, DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), SHEETAPP_DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), ...extra }, encoding: 'utf8' }).trim();
}
test.beforeAll(async () => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  fixture = JSON.parse(php("require 'api/core/DB.php'; require 'tests/fixtures/tv41_setlists.php'; echo json_encode(seedTv41Setlists(DB::get()));"));
  const sid = execFileSync('C:/xampp/php/php.exe', ['tools/create_test_session.php', 'banhat'], { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  member = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid}` } });
});
test.afterAll(async () => {
  await member?.dispose();
  if (!fixture) return;
  php("if (!is_file('.roadmap6-isolated')) exit(1); require 'api/core/DB.php'; $pdo=DB::get(); $pdo->beginTransaction(); foreach(['song_usage_history','service_plan_assignments','setlist_items'] as $table) $pdo->prepare(\"DELETE FROM $table WHERE setlist_id IN (?,?,?)\")->execute(json_decode(getenv('TV41_IDS'),true)); $pdo->prepare('DELETE FROM setlists WHERE id IN (?,?,?)')->execute(json_decode(getenv('TV41_IDS'),true)); $pdo->commit();", { TV41_IDS: JSON.stringify([fixture.draft, fixture.published, fixture.completed]) });
});
test('Guest API omits nonpublic programs and personnel; offline aliases require login', async ({ request }) => {
  const endpoint = `${base}/api/index.php?route=setlists`;
  const list = await (await request.get(endpoint)).json();
  expect(list.data.filter(plan => plan.title.startsWith(fixture.token)).map(plan => plan.id)).toEqual([fixture.published]);
  const detail = await (await request.get(`${endpoint}&id=${fixture.published}`)).json();
  expect(detail.data).not.toHaveProperty('assignments');
  for (const key of ['created_by', 'leader_user_id', 'creator_name', 'leader_name', 'description']) expect(detail.data).not.toHaveProperty(key);
  expect(JSON.stringify(detail)).not.toContain('PRIVATE-');
  expect(detail.data.items[0]).toMatchObject({ chord_profile: 'HD', transpose_key: 2, bpm: 88, beats_per_measure: 3 });
  for (const id of [fixture.draft, fixture.completed, 999999]) expect((await request.get(`${endpoint}&id=${id}`)).status()).toBe(404);
  for (const action of ['offline_package', 'manifest']) expect((await request.get(`${endpoint}&action=${action}&id=${fixture.published}`)).status()).toBe(401);
  const history = await (await request.get(`${endpoint}&action=song_usage&song_id=${encodeURIComponent(fixture.song)}`)).json();
  expect(history.data.history.filter(item => [fixture.draft, fixture.published, fixture.completed].includes(item.setlist_id)).map(item => item.setlist_id)).toEqual([fixture.published]);
  expect(history.data.total_used).toBe(history.data.history.length);
});
test('Authenticated member retains draft assignments and offline package', async () => {
  const endpoint = `${base}/api/index.php?route=setlists&id=${fixture.draft}`;
  const detail = await (await member.get(endpoint)).json();
  expect(detail.data.status).toBe('draft');
  expect(detail.data.assignments).toHaveLength(1);
  expect(detail.data.assignments[0]).toHaveProperty('username');
  const response = await member.get(`${endpoint}&action=offline_package`);
  expect(response.status()).toBe(200);
  expect((await response.json()).data.setlist.id).toBe(fixture.draft);
  const booklet = await member.get(`${base}/print/service-booklet.php?setlist_id=${fixture.draft}`);
  expect(booklet.status()).toBe(200);
  expect(await booklet.text()).toContain(fixture.token + '-draft');
  expect(await booklet.text()).toContain(fixture.token + '-PRIVATE-NOTE');
});
test('Guest printed booklet cannot reveal draft or assignment notes', async ({ request }) => {
  const draft = await request.get(`${base}/print/service-booklet.php?setlist_id=${fixture.draft}`);
  expect(draft.status()).toBe(404);
  expect(await draft.text()).not.toContain(fixture.token);
  const published = await request.get(`${base}/print/service-booklet.php?setlist_id=${fixture.published}`);
  expect(published.status()).toBe(200);
  expect(await published.text()).toContain(fixture.token + '-published');
  expect(await published.text()).not.toContain('PRIVATE-');
});
for (const classic of [false, true]) test(`${classic ? 'Classic' : 'Modern'} guest can open a published program without personnel data`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 844 });
  await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  const sidebar = page.locator('#sidebar');
  if ((await sidebar.getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
  await page.locator('.sidebar-tab[data-tab="setlist"]').click();
  const published = page.locator('#setlist-list .song-item').filter({ hasText: fixture.token + '-published' });
  await expect(published).toBeVisible();
  await expect(page.locator('#setlist-list')).not.toContainText(fixture.token + '-draft');
  await published.click();
  await expect(page.locator('#setlist-detail-title')).toContainText(fixture.token + '-published');
  await expect(page.locator('#setlist-detail')).not.toContainText('PRIVATE-');
  expect(errors).toEqual([]);
});
