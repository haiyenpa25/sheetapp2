const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
const isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires an explicit isolated Apache installation');

test('Import: managed files remain distinct, immediately searchable and readable over HTTP', async ({ context, request }) => {
  expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(path.resolve(__dirname, '..')));
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  const sid = require('./helpers/php-session').run(['admin'], {
    cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8',
  }).trim();
  await context.addCookies([{ name: 'PHPSESSID', value: sid, url: base + '/' }]);
  const name = `TV0 import ${Date.now()}.xml`;
  const makeXml = lyric => `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>${lyric}</text></lyric></note></measure></part></score-partwise>`;
  const imported = [];
  for (const lyric of ['Uniquelyricprobe', 'Secondlyricprobe']) {
    const xml = makeXml(lyric);
    const response = await context.request.post(`${base}/api/index.php?route=import&type=upload`, {
      headers: { Origin: new URL(base).origin },
      multipart: { file: { name, mimeType: 'application/xml', buffer: Buffer.from(xml) } },
    });
    expect(response.status(), await response.text()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    const song = result.data?.song || result.song;
    expect(song.xmlPath).toMatch(/^storage\/users\/admin\/imported\/[^/]+\.xml$/);
    const asset = await request.get(`${base}/${song.xmlPath}`);
    expect(asset.status()).toBe(200);
    expect(await asset.text()).toBe(xml);
    const search = await (await request.get(`${base}/api/index.php?route=songs&action=search&q=${lyric}`)).json();
    expect(search.data.map(item => item.id)).toContain(song.id);
    imported.push({ song, xml });
  }
  expect(imported[0].song.xmlPath).not.toBe(imported[1].song.xmlPath);
  expect(await (await request.get(`${base}/${imported[0].song.xmlPath}`)).text()).toBe(imported[0].xml);
  const list = await (await request.get(`${base}/api/index.php?route=songs`)).json();
  expect((Array.isArray(list) ? list : list.data).map(song => song.id)).toContain(imported[1].song.id);
  expect((await request.get(`${base}/storage/data/app.sqlite`)).status()).toBe(403);
  const privateName = `tv0-private-${Date.now()}.xml`;
  const privatePath = path.join(isolated, 'storage/users/admin', privateName);
  fs.writeFileSync(privatePath, imported[0].xml, { flag: 'wx' });
  try {
    expect((await request.get(`${base}/storage/users/admin/${privateName}`)).status()).toBe(403);
  } finally { fs.unlinkSync(privatePath); }
});
