const { test, expect } = require('@playwright/test');
const path = require('path');
test.beforeEach(async ({ page }) => {
  await page.setContent('<button id="btn-play-audio">Play</button><button id="btn-stop-audio">Stop</button>');
  await page.evaluate(() => {
    window.audioTrace = { constructors: 0, plays: 0, stops: 0, resumes: [] };
    const context = { state: 'suspended', sampleRate: 22050, destination: {},
      resume() { audioTrace.resumes.push(navigator.userActivation.isActive); this.state = 'running'; return Promise.resolve(); },
      createBuffer() { return {}; }, createBufferSource() { return { connect() {}, start() {}, stop() {} }; },
    };
    window.Audio = class { play() { return Promise.resolve(); } };
    window.Tone = { getContext: () => ({ rawContext: context, state: context.state }),
      getDestination: () => ({ volume: {} }), start: async () => {},
    };
    window.libraries = new Promise(resolve => { window.releaseLibraries = resolve; });
    window.ScriptLoader = { loadAudioLibraries: () => libraries };
    window.OsmdAudioPlayer = class {
      constructor() { audioTrace.constructors++; }
      loadScore() { return window.scoreGate || Promise.resolve(); }
      async play() { if (window.playGate) await playGate; audioTrace.plays++; }
      stop() { audioTrace.stops++; }
      on() {}
    };
    window.score = { cursor: { hide() {}, reset() {} } };
  });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/audio-player.js') });
  await page.evaluate(() => { SheetAudioPlayer.init(); SheetAudioPlayer.setup(score); });
});

test('Stop while vendors load prevents any score/player startup; resume is synchronous in the click', async ({ page }) => {
  await page.locator('#btn-play-audio').click();
  expect(await page.evaluate(() => audioTrace.resumes)).toEqual([true]);
  await page.locator('#btn-stop-audio').click();
  await page.evaluate(async () => { releaseLibraries(); await libraries; });
  await expect.poll(() => page.evaluate(() => audioTrace.constructors)).toBe(0);
  expect(await page.evaluate(() => SheetAudioPlayer.isPlaying())).toBe(false);
});

test('Double play shares one pending load and a new song cancels the old score', async ({ page }) => {
  await page.evaluate(() => {
    releaseLibraries();
    window.scoreGate = new Promise(resolve => { window.releaseScore = resolve; });
    window.firstPlay = SheetAudioPlayer.play();
    window.secondPlay = SheetAudioPlayer.play();
  });
  await expect.poll(() => page.evaluate(() => audioTrace.constructors)).toBe(1);
  expect(await page.evaluate(() => firstPlay === secondPlay)).toBe(true);
  await page.evaluate(async () => {
    SheetAudioPlayer.setup({ cursor: { hide() {}, reset() {} } });
    releaseScore(); await firstPlay;
  });
  expect(await page.evaluate(() => audioTrace.plays)).toBe(0);
});

test('Stop during an asynchronous native play also stops a late vendor start', async ({ page }) => {
  await page.evaluate(() => {
    releaseLibraries();
    window.playGate = new Promise(resolve => { window.releasePlay = resolve; });
    window.pending = SheetAudioPlayer.play();
  });
  await expect.poll(() => page.evaluate(() => audioTrace.constructors)).toBe(1);
  await page.locator('#btn-stop-audio').click();
  await page.evaluate(async () => { releasePlay(); await pending; });
  expect(await page.evaluate(() => audioTrace.stops)).toBe(1);
  expect(await page.evaluate(() => SheetAudioPlayer.isPlaying())).toBe(false);
});
