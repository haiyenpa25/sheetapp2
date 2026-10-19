const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires an explicit isolated Apache URL');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} reading creates no AudioContext and audio vendors wait for playback`, async ({ page }) => {
    const vendors = [], warnings = [];
    page.on('request', req => { if (/\/(Tone\.js|OsmdAudioPlayer\.min\.js)/.test(req.url())) vendors.push(req.url()); });
    page.on('console', msg => { if (/AudioContext/i.test(msg.text()) && msg.type() === 'warning') warnings.push(msg.text()); });
    await page.addInitScript(() => {
      window.audioCreations = [];
      const Native = window.AudioContext;
      window.AudioContext = new Proxy(Native, { construct(target, args) {
        window.audioCreations.push({ gesture: navigator.userActivation.isActive });
        return Reflect.construct(target, args);
      } });
    });
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => audioCreations)).toEqual([]);
    expect(vendors).toEqual([]);
    expect(warnings).toEqual([]);
    // Opening a reading control must not prewarm audio, either.
    await page.locator('#btn-transpose-up').click();
    expect(await page.evaluate(() => audioCreations)).toEqual([]);
  });
  test(`${classic ? 'Classic' : 'Modern'} first playback loads real vendors and supports stop and timbre changes`, async ({ page }) => {
    test.setTimeout(45000);
    const errors = [], vendors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => { if (/\/(Tone\.js|OsmdAudioPlayer\.min\.js)/.test(req.url())) vendors.push(req.url()); });
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    if (!classic) await page.locator('#btn-more-options').click();
    await page.locator('#btn-play-audio').click();
    await expect.poll(() => page.evaluate(() => SheetAudioPlayer.isPlaying()), { timeout: 30000 }).toBe(true);
    expect(vendors.filter(url => url.includes('/Tone.js'))).toHaveLength(1);
    expect(vendors.filter(url => url.includes('/OsmdAudioPlayer.min.js'))).toHaveLength(1);
    expect(await page.evaluate(() => Tone.getContext().rawContext.state)).toBe('running');
    await page.evaluate(() => {
      SheetAudioPlayer.setTimbre('organ');
      SheetAudioPlayer.setTimbre('choir');
      SheetAudioPlayer.setVoice('alto');
      SheetAudioPlayer.applyPlaybackMode();
      SheetAudioPlayer.stop();
    });
    expect(await page.evaluate(() => SheetAudioPlayer.isPlaying())).toBe(false);
    expect(errors).toEqual([]);
  });
}
