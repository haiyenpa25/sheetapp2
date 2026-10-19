const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires explicit isolated Apache URL');

for (const classic of [false, true]) for (const width of [1366, 390]) {
  test(`${classic ? 'Classic' : 'Modern'} sidebar keyboard and axe at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/${classic ? 'old/' : ''}?song=thanh-ca-001&v=sheet`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    const sidebar = page.locator('#sidebar');
    if ((await sidebar.getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
    await expect(page.getByLabel('Tìm bài hát trong thư viện')).toHaveCount(1);
    await page.getByLabel('Tìm bài hát trong thư viện').focus();
    for (let i = 0; i < 60 && !(await page.locator('#song-list').evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(page.locator('#song-list')).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/song=thanh-ca-003(?:&|$)/);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible();
    if ((await sidebar.getAttribute('class')).includes('mobile-hidden')) await page.locator('#btn-open-sidebar').click();
    await expect.poll(async () => Math.round((await sidebar.boundingBox()).x)).toBe(0);
    const axe = await new AxeBuilder({ page }).include('#sidebar').analyze();
    expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ id: item.id, nodes: item.nodes.slice(0, 4).map(node => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([]);
    expect(errors).toEqual([]);
  });
}
