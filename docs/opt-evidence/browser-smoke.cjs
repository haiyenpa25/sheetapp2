const { chromium, webkit, expect } = require('@playwright/test');
const path = require('path');
const base = process.env.SHEETAPP_OPT_TEST_URL;
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/sheetapp2\/?$/.test(base)) {
  throw new Error('SHEETAPP_OPT_TEST_URL must name the explicitly isolated local installation');
}
(async () => {
  let checks = 0;
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    for (const classic of [false, true]) {
      for (const width of [1366, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base.replace(/\/$/, '')}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 30000 });
        await expect.poll(() => page.evaluate(() => window.Store.get('currentTranspose'))).toBe(0);
        const button = page.locator('#btn-transpose-up:visible, #btn-mobile-transpose-up:visible').first();
        if (await button.isVisible()) {
          await button.click();
          await expect.poll(() => page.evaluate(() => window.Store.get('currentTranspose'))).toBe(1);
        } else {
          throw new Error('Transpose control is not visible');
        }
        const log = await page.evaluate(() => window.ApiService.errors.report({ type: 'test', message: 'isolated browser smoke', source: 'browser-smoke.cjs' }));
        expect(log.success).toBe(true);
        expect(errors).toEqual([]);
        const label = `${name}-${classic ? 'classic' : 'modern'}-${width}`;
        await page.screenshot({ path: path.join(__dirname, `${label}.png`) });
        console.log(`PASS ${label}: SVG, original key, transpose UI, routed client log, no pageerror`);
        checks++;
        await context.close();
      }
    }
    await browser.close();
  }
  console.log(`BROWSER_COMPLETE total=${checks}`);
})().catch(error => { console.error(error); process.exit(1); });
