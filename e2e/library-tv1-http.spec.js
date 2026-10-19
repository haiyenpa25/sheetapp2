const { test, expect } = require('@playwright/test');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires an explicit isolated Apache URL');

test('HTTP search returns the complete 343-song theme across two pages', async ({ request }) => {
  const pages = [];
  for (const offset of [0, 200]) {
    const response = await request.get(`${base}/api/index.php`, { params: { route: 'songs', action: 'search', theme: 'Đời tín đồ', limit: 200, offset } });
    expect(response.status()).toBe(200);
    const page = await response.json();
    expect(page.total).toBe(343);
    expect(page.data.length).toBe(offset ? 143 : 200);
    pages.push(...page.data);
  }
  expect(new Set(pages.map(song => song.id)).size).toBe(343);
  expect(pages.every(song => song.theme === 'Đời tín đồ')).toBe(true);
});

test('Modern theme filter reaches the final song through Xem thêm', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?song=thanh-ca-001`);
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  if ((await page.locator('#sidebar').getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
  await page.locator('#btn-filter-toggle').click();
  await page.selectOption('#theme-filter', 'Đời tín đồ');
  await expect(page.locator('#library-count')).toHaveText('200/343');
  await page.locator('#library-load-more').click();
  await expect(page.locator('#library-count')).toHaveText('343');
  await expect(page.locator('#library-load-more')).toHaveCount(0);
});

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} real page uses lyric mode for song 259`, async ({ page }) => {
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    const sidebar = page.locator('#sidebar');
    if ((await sidebar.getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
    await page.locator('#btn-search-lyrics').click();
    const searchResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.searchParams.get('action') === 'search' && url.searchParams.get('q') === 'yêu thương thế gian';
    });
    await page.fill('#search-input', 'yêu thương thế gian');
    const response = await searchResponse;
    expect(response.status(), response.url()).toBe(200);
    expect(new URL(response.url()).searchParams.get('mode')).toBe('lyric');
    await expect(page.locator('.song-item').first()).toHaveAttribute('data-id', 'ton-vinh-chua-hang-huu--259-chua-yeu-the-gian');
    await page.screenshot({ path: path.resolve(__dirname, `../test-results/roadmap6-evidence/TV1-${classic ? 'classic' : 'modern'}-lyrics.png`) });
  });
}
