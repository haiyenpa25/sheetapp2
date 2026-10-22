const { test, expect, request: api } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL, isolated = process.env.SHEETAPP_TV_ISOLATED_ROOT;
test.skip(!base || !isolated, 'Requires explicit isolated Apache installation');
test('Song update rejects unmanaged XML and FTS never extracts lyrics from an unmanaged file', async () => {
  expect(fs.existsSync(path.join(isolated, '.roadmap6-isolated'))).toBe(true);
  for (const source of [path.resolve(__dirname, '..'), 'C:/xampp/htdocs/sheetapp2']) expect(fs.realpathSync(isolated)).not.toBe(fs.realpathSync(source));
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname.replace(/\/$/, '')).toBe('/' + path.basename(isolated));
  const token = `tv43-${Date.now()}`, relative = `test-results/${token}.xml`;
  const target = path.join(isolated, relative);
  const php = code => execFileSync((process.env.SHEETAPP_PHP_BINARY || 'php'), [], { cwd: isolated, input: '<?php ' + code,
    env: { ...process.env, DB_PATH: path.join(isolated, 'storage/data/app.sqlite'), TV43_ID: token, TV43_PATH: relative }, encoding: 'utf8' }).trim();
  const sid = require('./helpers/php-session').run(['admin'], { cwd: isolated, env: { ...process.env, SHEETAPP_E2E: '1' }, encoding: 'utf8' }).trim();
  const client = await api.newContext({ extraHTTPHeaders: { Cookie: `PHPSESSID=${sid}`, Origin: new URL(base).origin } });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '<?xml version="1.0"?><score-partwise><part><measure><note><lyric><text>Forbiddenoutsideprobe</text></lyric></note></measure></part></score-partwise>', { flag: 'wx' });
  try {
    php("require 'api/services/SongService.php'; DB::run(\"INSERT INTO songs(id,title,xmlPath,lyrics_text,category_id) VALUES(?,'TV43 fixture','storage/Thanh ca/missing.xml','Originalsafeprobe',1)\",[getenv('TV43_ID')]); SongService::syncSongFts(getenv('TV43_ID'));");
    const snapshot = () => php("require 'api/core/DB.php'; echo json_encode([DB::run('SELECT title,xmlPath,lyrics_text FROM songs WHERE id=?',[getenv('TV43_ID')])->fetch(),DB::run('SELECT * FROM songs_fts WHERE song_id=?',[getenv('TV43_ID')])->fetchAll()]);");
    const original = snapshot();
    for (const xmlPath of ['../../api/core/Config.php', relative, '']) {
      const response = await client.put(`${base}/api/index.php?route=songs&id=${token}`, { data: { xmlPath, title: 'Must not change' } });
      expect.soft(response.status(), await response.text()).toBe(400);
      expect.soft((await response.json()).success).toBe(false);
      expect.soft(snapshot()).toBe(original);
    }
    const lyrics = php("require 'api/services/SongService.php'; DB::run(\"UPDATE songs SET xmlPath=?,lyrics_text='' WHERE id=?\",[getenv('TV43_PATH'),getenv('TV43_ID')]); SongSearchHelper::syncSongFts(getenv('TV43_ID'),true); echo json_encode([DB::run('SELECT lyrics_text FROM songs WHERE id=?',[getenv('TV43_ID')])->fetchColumn(),DB::run('SELECT lyrics_text FROM songs_fts WHERE song_id=?',[getenv('TV43_ID')])->fetchColumn()]);");
    expect(lyrics).not.toContain('Forbiddenoutsideprobe');
    expect(JSON.parse(lyrics)).toEqual(['', '']);
  } finally {
    await client.dispose();
    php("if (!is_file('.roadmap6-isolated')) exit(1); require 'api/core/DB.php'; DB::run('DELETE FROM songs_fts WHERE song_id=?',[getenv('TV43_ID')]); DB::run('DELETE FROM songs WHERE id=?',[getenv('TV43_ID')]);");
    fs.unlinkSync(target);
  }
});
