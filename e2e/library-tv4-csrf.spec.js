const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL, isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
test('CSRF flag rejects missing tokens and browser ApiService still saves chords', async ({ page, context }) => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const config = path.join(isolated, 'storage/config/features.json');
  const original = fs.existsSync(config) ? fs.readFileSync(config) : null;
  const name = `TV44_${Date.now()}`, song = 'thanh-ca-001';
  const sid = require('./helpers/php-session').run(['admin'], { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  await context.addCookies([{ name: 'PHPSESSID', value: sid, url: base + '/' }]);
  try {
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(config, JSON.stringify({ ...(original ? JSON.parse(original) : {}), csrf_enforce: true }));
    await page.goto(`${base}/?song=${song}&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    const endpoint = `${base}/api/index.php?route=songs&action=save_xml`;
    for (const headers of [{}, { Origin: new URL(base).origin }, { Origin: new URL(base).origin, 'X-CSRF-Token': 'incorrect' }]) {
      const response = await context.request.post(endpoint, { headers, data: {} });
      expect(response.status(), await response.text()).toBe(403);
    }
    const result = await page.evaluate(async ({ song, name }) => ApiService.chordSets.save(song, name, { '0_0': 'C' }), { song, name });
    expect(result.success).toBe(true);
    const saved = await page.evaluate(async ({ song, name }) => ApiService.chordSets.load(song, name), { song, name });
    expect(JSON.stringify(saved)).toContain('"0_0":"C"');
  } finally {
    if (original) fs.writeFileSync(config, original); else if (fs.existsSync(config)) fs.unlinkSync(config);
    execFileSync((process.env.SHEETAPP_PHP_BINARY || 'php'), [], { cwd: isolated, input: "<?php if(!is_file('.roadmap6-isolated'))exit(1); require 'api/core/DB.php'; DB::run('DELETE FROM user_chord_sets WHERE set_name=?',[getenv('TV44_NAME')]);", env: { ...process.env, DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), TV44_NAME: name } });
    const file = path.join(isolated, 'storage/data/chord_sets', song, name + '.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
