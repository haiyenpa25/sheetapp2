const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

const baseUrl = process.env.SHEETAPP_TEST_URL || 'https://sheet.hyb.io.vn/';
const chromium = process.env.CHROMIUM_PATH || '/usr/local/bin/chromium';

(async () => {
  const browser = await puppeteer.launch({ executablePath: chromium, headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [768, 820, 1024]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width, height: 900, hasTouch: true });
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('route=auth') && request.url().includes('action=me')) {
          return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
            success: true, loggedIn: true, user_id: 999, username: 'audit', role: 'banhat', chord_code: 'TEST'
          }) });
        }
        return request.continue();
      });
      await page.goto(new URL('?song=thanh-ca-001&v=sheet', baseUrl).href, { waitUntil: 'networkidle2' });
      for (const id of ['btn-mobile-edit', 'btn-tablet-view-toggle', 'btn-fullscreen']) {
        const state = await page.$eval(`#${id}`, element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width, disabled: element.disabled,
            display: getComputedStyle(element).display, hidden: element.classList.contains('hidden') };
        });
        assert.ok(state.width >= 44 && state.left >= 0 && state.right <= width && state.display !== 'none' && !state.hidden && !state.disabled,
          `${width}px: ${id} must be visible, enabled, and inside the viewport: ${JSON.stringify(state)}`);
      }
      await page.click('#btn-tablet-view-toggle');
      await page.waitForFunction(() => !document.querySelector('#lyric-view-container').classList.contains('hidden'));
      await page.click('#btn-tablet-view-toggle');
      await page.waitForFunction(() => document.querySelector('#lyric-view-container').classList.contains('hidden'));
      await page.click('#btn-fullscreen');
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await context.close();
      console.log(`PASS: tablet controls and sheet/lyrics/fullscreen transitions at ${width}px`);
    }
    const guest = await browser.createBrowserContext();
    const guestPage = await guest.newPage();
    await guestPage.setViewport({ width: 820, height: 900, hasTouch: true });
    await guestPage.goto(new URL('?song=thanh-ca-001&v=sheet', baseUrl).href, { waitUntil: 'networkidle2' });
    assert.equal(await guestPage.$eval('#btn-mobile-edit', element => element.classList.contains('hidden')), true);
    console.log('PASS: guest cannot see the tablet editing action');
    await guest.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; });
