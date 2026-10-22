const { test, expect } = require('@playwright/test');
const sessions = require('./helpers/php-session');

async function signedContext(browser, baseURL) {
  const context = await browser.newContext();
  const sid = sessions.run(['admin']).toString().trim();
  await context.addCookies([{name:'PHPSESSID', value:sid, url:baseURL}]);
  return context;
}

test('FIX-03/04: pending A save survives loading and editing B without 409', async ({browser, baseURL}) => {
  test.setTimeout(90000);
  const context = await signedContext(browser, baseURL);
  const page = await context.newPage();
  const conflicts = [];
  page.on('response', response => { if(response.status() === 409) conflicts.push(response.url()); });
  await page.goto(baseURL+'?song=thanh-ca-001&v=sheet');
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({timeout:30000});
  const result = await page.evaluate(async () => {
    const songs = await Promise.all(['thanh-ca-001','thanh-ca-002'].map(id => ApiService.songs.get(id)));
    const name = 'FIXRACE'+Date.now();
    try {
      for (const song of songs) await ApiService.chordSets.save(song.id,name,[{measureIdx:0,noteIdx:0,chord:'C'}]);
      await SongLoader.load(songs[0],0,name,{instant:false});
      ChordCanvas.setCustomChords({'0_0':'Dm'});
      ChordCanvasEdit.scheduleSave(1500);
      await SongLoader.load(songs[1],0,name,{instant:false});
      ChordCanvas.setCustomChords({'0_0':'Em'});
      ChordCanvasEdit.scheduleSave(1500);
      await ChordCanvasEdit.flushSave();
      return await Promise.all(songs.map(song => ApiService.chordSets.load(song.id,name)));
    } finally {
      for (const song of songs) await ApiService.chordSets.delete(song.id,name).catch(error => console.warn('Fixture cleanup:',error.message));
    }
  });
  expect(result[0].chords).toEqual([{measureIdx:0,noteIdx:0,chord:'Dm'}]);
  expect(result[1].chords).toEqual([{measureIdx:0,noteIdx:0,chord:'Em'}]);
  expect(conflicts).toEqual([]);
  await context.close();
});

test('FIX-05: two browser contexts follow host song over the real live transport', async ({browser, baseURL}) => {
  test.setTimeout(90000);
  const hostContext = await signedContext(browser, baseURL);
  const followerContext = await browser.newContext();
  const host = await hostContext.newPage(), follower = await followerContext.newPage();
  await Promise.all([host.goto(baseURL+'?song=thanh-ca-001&v=sheet'), follower.goto(baseURL+'?song=thanh-ca-001&v=sheet')]);
  for (const page of [host,follower]) await expect(page.locator('#osmd-container svg').first()).toBeVisible({timeout:30000});
  const room = 'FIX'+Math.random().toString(36).slice(2,9).toUpperCase();
  try {
    await host.evaluate(code => FollowLeader.startHost(code),room);
    expect(await host.evaluate(() => LiveSession.isHost())).toBe(true);
    await follower.evaluate(code => FollowLeader.join(code),room);
    await host.evaluate(async () => { const song=await ApiService.songs.get('thanh-ca-002'); await SongLoader.load(song); });
    await expect.poll(() => follower.evaluate(() => App.getCurrentSongId()),{timeout:15000}).toBe('thanh-ca-002');
    await expect(follower.locator('#osmd-container svg').first()).toBeVisible();
    expect(await follower.evaluate(() => Store.get('currentSong').xmlPath)).toBe(await host.evaluate(() => Store.get('currentSong').xmlPath));
  } finally {
    await host.evaluate(() => FollowLeader.leave());
    await follower.evaluate(() => FollowLeader.leave());
    await hostContext.close(); await followerContext.close();
  }
});

for (const classic of [false,true]) {
  test(`FIX-24 rapid song load preserves B after delayed A XML: ${classic?'Classic':'Modern'}`, async ({browser,baseURL}) => {
    test.setTimeout(90000);
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.goto(baseURL+(classic?'old/':'')+'?song=thanh-ca-001&v=sheet');
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({timeout:30000});
    const songs=await page.evaluate(async()=>Promise.all(['thanh-ca-003','thanh-ca-002'].map(id=>ApiService.songs.get(id))));
    let delayed;
    await page.route('**/storage/**',route=>{
      const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
      if(pathname.endsWith('/'+songs[0].xmlPath)) delayed=route;
      else return route.continue();
    });
    await page.evaluate(song=>{window.__fixLoadA=SongLoader.load(song);},songs[0]);
    await expect.poll(()=>Boolean(delayed),{timeout:10000}).toBe(true);
    await page.evaluate(song=>SongLoader.load(song),songs[1]);
    const currentXml=await page.evaluate(()=>OSMDRenderer.getCurrentXml());
    await delayed.continue().catch(()=>{}); // Modern may abort the superseded request.
    await page.evaluate(()=>window.__fixLoadA);
    expect(await page.evaluate(()=>App.getCurrentSongId())).toBe(songs[1].id);
    expect(await page.evaluate(()=>OSMDRenderer.getCurrentXml())).toBe(currentXml);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await context.close();
  });
}
