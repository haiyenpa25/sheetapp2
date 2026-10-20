const { test, expect } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires an explicit isolated Apache URL');
test.use({ serviceWorkers: 'allow' });
test('PWA refreshes annotation code together and keeps offline music packages', async ({ page }) => {
  test.setTimeout(45000);
  expect(new URL(base).hostname).toBe('localhost');
  expect(new URL(base).pathname).toMatch(/^\/sheetapp2-roadmap6-oct19-061901\/?$/);
  await page.goto(`${base}/robots.txt`);
  await page.evaluate(async baseUrl => {
    const old = await caches.open('sheetapp-app-v5');
    await old.put(`${baseUrl}/assets/js/annotation-canvas.js`, new Response('window.__staleAnnotation = true;'));
    const offline = await caches.open('sheetapp-offline-annotation-fixture');
    await offline.put(`${baseUrl}/offline-fixture.xml`, new Response('<score-partwise/>'));
  }, base);
  await page.goto(`${base}/?song=thanh-ca-001&v=sheet`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nhạc cụ', exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const keys = await caches.keys();
    const app = keys.find(key => key.startsWith('sheetapp-app-v5-'));
    const cache = app ? await caches.open(app) : null;
    const urls = cache ? (await cache.keys()).map(request => new URL(request.url).pathname) : [];
    return { keys, urls, stale: !!window.__staleAnnotation, panel: typeof window.AnnotationPanel?.show };
  });
  expect(result.stale).toBe(false);
  expect(result.panel).toBe('function');
  expect(result.keys).not.toContain('sheetapp-app-v5');
  expect(result.keys).toContain('sheetapp-offline-annotation-fixture');
  for (const file of ['annotation-canvas.js', 'annotation-panel.js', 'annotation-geometry.js', 'instrument-annotations.css']) {
    expect(result.urls.some(url => url.endsWith('/' + file))).toBe(true);
  }
});
