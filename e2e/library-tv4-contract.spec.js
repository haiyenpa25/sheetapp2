const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL, isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
for (const wrapped of [false, true]) test(`ApiService songs.list returns an array for ${wrapped ? 'canonical' : 'legacy'} responses`, async ({ page }) => {
  await page.setContent('<main></main>');
  await page.evaluate(wrapped => {
    const data = [{ id: 'adapter-probe', title: 'Adapter probe' }];
    window.fetch = async () => ({ ok: true, json: async () => wrapped ? { success: true, data } : data });
  }, wrapped);
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/core/ApiService.js') });
  expect(await page.evaluate(() => ApiService.songs.list())).toEqual([{ id: 'adapter-probe', title: 'Adapter probe' }]);
});
test('All songs read branches return success/data and write errors use proper HTTP codes without SQL details', async ({ request }) => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const sid = require('./helpers/php-session').run(['admin'], { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  const client = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid}`, Origin: new URL(base).origin } });
  const endpoint = `${base}/api/index.php?route=songs`, id = `tv46-${Date.now()}`;
  try {
    for (const query of ['', '&action=get&id=thanh-ca-001', '&action=taxonomy', '&action=search&q=Chua', '&action=get_versions&song_id=thanh-ca-001', '&lyric_search=Chua']) {
      const response = await request.get(endpoint + query);
      expect(response.status()).toBe(200);
      expect.soft(await response.json(), query || 'cached list').toHaveProperty('success', true);
      expect.soft(await response.json(), query || 'cached list').toHaveProperty('data');
    }
    expect.soft(await (await client.get(endpoint)).json()).toHaveProperty('data');
    const missing = await client.put(`${endpoint}&id=${id}`, { data: { title: 'Missing' } });
    expect.soft(missing.status(), await missing.text()).toBe(404);
    const data = { id, title: 'Contract fixture', category_id: 1, lyrics_text: 'Contractsafeprobe' };
    const created = await client.post(endpoint, { data });
    expect(created.status(), await created.text()).toBe(200);
    expect.soft(await created.json()).toHaveProperty('data');
    const duplicate = await client.post(endpoint, { data });
    expect.soft(duplicate.status(), await duplicate.text()).toBe(400);
    expect.soft(await duplicate.text()).not.toMatch(/SQLSTATE|PDOException|UNIQUE constraint/i);
    const updated = await client.put(`${endpoint}&id=${id}`, { data: { title: 'Updated contract fixture' } });
    expect(updated.status()).toBe(200); expect.soft(await updated.json()).toHaveProperty('data');
    const deleted = await client.delete(`${endpoint}&id=${id}`);
    expect(deleted.status()).toBe(200); expect.soft(await deleted.json()).toHaveProperty('data');
  } finally {
    await client.dispose();
    execFileSync((process.env.SHEETAPP_PHP_BINARY || 'php'), [], { cwd: isolated, input: "<?php if(!is_file('.roadmap6-isolated'))exit(1); require 'api/services/SongService.php'; DB::run('DELETE FROM songs_fts WHERE song_id=?',[getenv('TV46_ID')]); DB::run('DELETE FROM songs WHERE id=?',[getenv('TV46_ID')]); SongService::invalidateCache();", env: { ...process.env, DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), TV46_ID: id } });
  }
});
