const { test, expect, request: api } = require('@playwright/test');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL, isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
test('Category rename refreshes cached songs; deletion transfers songs atomically through both APIs', async ({ request }) => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const token = `tv45-${Date.now()}`;
  const env = { ...process.env, DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), TV45_TOKEN: token };
  const php = code => execFileSync((process.env.SHEETAPP_PHP_BINARY || 'php'), [], { cwd: isolated, input: '<?php ' + code, env, encoding: 'utf8' }).trim();
  const fixture = JSON.parse(php("require 'api/core/DB.php'; $t=getenv('TV45_TOKEN'); $ids=[]; foreach(['source','rollback'] as $kind){ DB::run('INSERT INTO categories(name,slug) VALUES(?,?)',[$t.$kind,$t.$kind]); $ids[$kind]=(int)DB::lastId(); DB::run(\"INSERT INTO songs(id,title,category_id,xmlPath) VALUES(?,?,?,'fixture.xml')\",[$t.$kind,$t.$kind,$ids[$kind]]); } echo json_encode($ids);"));
  const sid = require('./helpers/php-session').run(['admin'], { cwd: isolated, env: { ...env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  const client = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid}`, Origin: new URL(base).origin } });
  const songs = async () => { const data = await (await request.get(`${base}/api/index.php?route=songs`)).json(); return Array.isArray(data) ? data : data.data; };
  try {
    php("require 'api/services/SongService.php'; SongService::invalidateCache();");
    await songs();
    expect((await client.put(`${base}/api/index.php?route=categories&id=${fixture.source}`, { data: { name: token + '-renamed' } })).status()).toBe(200);
    expect((await songs()).find(song => song.id === token + 'source').category).toBe(token + '-renamed');
    const cached = await request.get(`${base}/api/index.php?route=songs`);
    await client.put(`${base}/api/index.php?route=categories&id=${fixture.source}`, { data: { name: token + '-REnamed' } });
    const revalidated = await request.get(`${base}/api/index.php?route=songs`, { headers: { 'If-None-Match': cached.headers().etag } });
    expect.soft(revalidated.status(), 'Same-size category rename must invalidate the old ETag').toBe(200);
    const removed = await client.delete(`${base}/api/index.php?route=categories&id=${fixture.source}`);
    expect.soft(removed.status(), await removed.text()).toBe(200);
    expect.soft((await songs()).find(song => song.id === token + 'source').category_id).toBe(1);
    php(`require 'api/core/DB.php'; DB::get()->exec("CREATE TRIGGER tv45_fail BEFORE DELETE ON categories WHEN OLD.id=${fixture.rollback} BEGIN SELECT RAISE(ABORT,'TV45 rollback'); END");`);
    const rolledBack = await client.post(`${base}/api/index.php?route=manager&action=manage_category`, { data: { sub_action: 'delete', id: fixture.rollback } });
    expect(rolledBack.status()).toBeGreaterThanOrEqual(400);
    expect.soft(Number(php("require 'api/core/DB.php'; echo DB::run('SELECT category_id FROM songs WHERE id=?',[getenv('TV45_TOKEN').'rollback'])->fetchColumn();"))).toBe(fixture.rollback);
    php("require 'api/core/DB.php'; DB::get()->exec('DROP TRIGGER tv45_fail');");
    const moved = await client.post(`${base}/api/index.php?route=manager&action=manage_category`, { data: { sub_action: 'delete', id: fixture.rollback } });
    expect(moved.status(), await moved.text()).toBe(200);
    expect((await songs()).find(song => song.id === token + 'rollback').category_id).toBe(1);
  } finally {
    await client.dispose();
    php("if(!is_file('.roadmap6-isolated'))exit(1); require 'api/services/SongService.php'; DB::get()->exec('DROP TRIGGER IF EXISTS tv45_fail'); foreach(['source','rollback'] as $kind) DB::run('DELETE FROM songs WHERE id=?',[getenv('TV45_TOKEN').$kind]); DB::run('DELETE FROM categories WHERE slug IN (?,?)',[getenv('TV45_TOKEN').'source',getenv('TV45_TOKEN').'rollback']); SongService::invalidateCache();");
  }
});
test('Concurrent cache readers always receive complete JSON documents', async () => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  const cache = path.join(isolated, 'storage/data/songs_cache.json');
  const original = fs.existsSync(cache) ? fs.readFileSync(cache) : null;
  const command = "<?php require 'api/services/SongService.php'; for($i=0;$i<250;$i++){ SongService::writePublicCache([['id'=>'cache-probe','title'=>str_repeat((string)($i%10),100000)]]); usleep(1000); }";
  let child;
  try {
    fs.writeFileSync(cache, JSON.stringify([{ id: 'cache-probe', title: 'initial' }]));
    child = spawn((process.env.SHEETAPP_PHP_BINARY || 'php'), [], { cwd: isolated, stdio: ['pipe', 'pipe', 'pipe'] });
    const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Writer exited ${code}`))); });
    child.stdin.end(command);
    for (let i = 0; i < 2500; i++) {
      expect(JSON.parse(fs.readFileSync(cache, 'utf8'))[0].id).toBe('cache-probe');
      if (i % 20 === 0) await new Promise(resolve => setImmediate(resolve));
    }
    await done;
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    if (original) fs.writeFileSync(cache, original); else if (fs.existsSync(cache)) fs.unlinkSync(cache);
  }
});
