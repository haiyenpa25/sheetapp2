const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL, isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
test('XML save and restore allow the owner/admin and reject another user without modifying files', async ({ request }) => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const clients = {}, files = [];
  const token = `tv42-${Date.now()}`;
  const xml = title => `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list><part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part></score-partwise>`;
  const before = xml('before'), backup = xml('backup'), after = xml('after');
  try {
    for (const user of ['admin', 'banhat']) {
      const sid = execFileSync('C:/xampp/php/php.exe', ['tools/create_test_session.php', user], { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
      clients[user] = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid}`, Origin: new URL(base).origin } });
      const directory = path.join(isolated, 'storage/users', user);
      fs.mkdirSync(directory, { recursive: true });
      for (const [suffix, content] of [['.xml', before], ['.xml.bak', backup]]) {
        const file = path.join(directory, token + suffix); fs.writeFileSync(file, content, { flag: 'wx' }); files.push(file);
      }
    }
    const relative = user => `storage/users/${user}/${token}.xml`;
    const post = (client, action, user) => client.post(`${base}/api/index.php?route=songs&action=${action}`, { data: { filepath: relative(user), xml: after } });
    for (const action of ['save_xml', 'restore_xml']) {
      const denied = await post(clients.banhat, action, 'admin');
      expect(denied.status(), await denied.text()).toBe(403);
      expect(fs.readFileSync(path.join(isolated, relative('admin')), 'utf8')).toBe(before);
      expect(fs.readFileSync(path.join(isolated, relative('admin') + '.bak'), 'utf8')).toBe(backup);
    }
    expect((await post(request, 'save_xml', 'admin')).status()).toBe(403);
    expect((await post(clients.banhat, 'save_xml', 'banhat')).status()).toBe(200);
    expect(fs.readFileSync(path.join(isolated, relative('banhat')), 'utf8')).toBe(after);
    expect((await post(clients.banhat, 'restore_xml', 'banhat')).status()).toBe(200);
    expect(fs.readFileSync(path.join(isolated, relative('banhat')), 'utf8')).toBe(before);
    expect((await post(clients.admin, 'save_xml', 'banhat')).status()).toBe(200);
    expect(fs.readFileSync(path.join(isolated, relative('banhat')), 'utf8')).toBe(after);
    expect((await post(clients.admin, 'restore_xml', 'banhat')).status()).toBe(200);
    expect(fs.readFileSync(path.join(isolated, relative('banhat')), 'utf8')).toBe(before);
  } finally {
    await Promise.all(Object.values(clients).map(client => client.dispose()));
    for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
