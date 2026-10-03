// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, serviceWorkers: 'block' });

test('nút bộ hợp âm điện thoại chỉ đổi HD và TLH, luôn hiện tên bộ ở 320px', async ({ page }) => {
  await page.route('**/api/index.php?route=chord_sets*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'list') {
      return route.fulfill({ json: { success: true, sets: ['HD', 'default', 'BH'] } });
    }
    if (url.searchParams.get('action') === 'load') {
      return route.fulfill({ json: { success: true, chords: [] } });
    }
    return route.continue();
  });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#mobile-thumb-bar')).toBeVisible();
  await expect(page.locator('#btn-mobile-edit')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas?.getCurrentSet?.())).toBe('HD');
  await page.locator('#chord-set-selector').evaluate(select => {
    for (const value of ['BH', '__create_new_set__', '__open_manager__']) {
      if (!Array.from(select.options).some(option => option.value === value)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.add(option);
      }
    }
  });

  const button = page.locator('#btn-mobile-chordset');
  for (const [set, label] of [['default', 'TLH'], ['HD', /^HD/], ['default', 'TLH'], ['HD', /^HD/]]) {
    await button.tap();
    await expect.poll(() => page.evaluate(() => window.ChordCanvas?.getCurrentSet?.())).toBe(set);
    await expect(page.locator('#mobile-chordset-label')).toHaveText(label);
  }
  await expect(page.locator('#mobile-chordset-label')).toBeVisible();
  await expect(button).toHaveAttribute('aria-label', /HD/);
  const fallback = await page.evaluate(() => window.ChordCanvas?.getChordStatus?.()?.isFallback);
  if (fallback) {
    await expect(page.locator('#mobile-chordset-label')).toHaveText('HD→TLH');
    await expect(button).toHaveAttribute('aria-label', /HD trống, đang hiện hợp âm TLH/);
  }
  for (const width of [320, 350, 390]) {
    await page.setViewportSize({ width, height: 568 });
    const bounds = await button.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(width);
    await expect(page.locator('#mobile-chordset-label')).toBeVisible();
    const textFits = await page.locator('#mobile-chordset-label').evaluate(el => el.scrollWidth <= el.clientWidth);
    expect(textFits).toBe(true);
  }
});

for (const status of [403, 409]) {
  test(`lỗi lưu ${status} trên điện thoại không báo Đã lưu`, async ({ page }) => {
    const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin', {
      env: { ...process.env, SHEETAPP_E2E: '1' }
    }).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.route('**/api/index.php?route=chord_sets*', route => {
      const request = route.request();
      const action = request.method() === 'POST'
        ? JSON.parse(request.postData() || '{}').action
        : new URL(request.url()).searchParams.get('action');
      if (action === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
      if (action === 'load') return route.fulfill({ json: { success: true, chords: [] } });
      if (action === 'save') return route.fulfill({ status, json: status === 409
        ? { error: 'Xung đột', conflict: true, currentChecksum: 'server', serverChords: [] }
        : { error: 'Không có quyền' } });
      return route.fulfill({ status: 400, json: { success: false } });
    });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.locator('#btn-mobile-edit').tap();
    await page.locator('.cc-dot-btn').first().tap();
    await page.locator('.cc-popup-mobile .cc-chip-dia').first().tap();
    if (status === 409) {
      await expect(page.locator('#cc-conflict-modal')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#cc-status-chip')).toHaveClass(/conflict/);
    } else {
      await expect(page.locator('#cc-status-chip')).toHaveClass(/error/, { timeout: 10000 });
    }
    await expect(page.locator('#cc-status-chip')).not.toContainText('Đã lưu');
  });
}

test('mất mạng lúc đặt hợp âm báo lưu ngoại tuyến, không báo Đã lưu', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin', {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  let saveRequests = 0;
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const request = route.request();
    const action = request.method() === 'POST'
      ? JSON.parse(request.postData() || '{}').action
      : new URL(request.url()).searchParams.get('action');
    if (action === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
    if (action === 'load') return route.fulfill({ json: { success: true, chords: [] } });
    if (action === 'save') saveRequests++;
    return route.fulfill({ status: 503, json: { error: 'Offline test' } });
  });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-mobile-edit').tap();
  await page.locator('.cc-dot-btn').first().tap();
  await page.context().setOffline(true);
  await page.locator('.cc-popup-mobile .cc-chip-dia').first().tap();
  await expect(page.locator('#cc-status-chip')).toHaveClass(/offline/, { timeout: 10000 });
  await expect(page.locator('#cc-status-chip')).not.toContainText('Đã lưu');
  expect(saveRequests).toBe(0);
  await page.context().setOffline(false);
});

test('Ban Hát chạm Soạn từ HD, chọn bộ BH và lưu vào BH', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat', {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  let saved = [];
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'POST' ? JSON.parse(request.postData() || '{}') : {};
    const action = body.action || url.searchParams.get('action');
    if (action === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default', 'BH'] } });
    if (action === 'load') return route.fulfill({ json: { success: true, chords: saved } });
    if (action === 'save') {
      expect(body.songId).toBe('thanh-ca-002');
      expect(body.name).toBe('BH');
      saved = body.chords;
      return route.fulfill({ json: { success: true, checksum: 'bh-mobile-test' } });
    }
    return route.fulfill({ status: 400, json: { success: false } });
  });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-mobile-edit').tap();
  await expect(page.locator('#cc-clone-edit-mine')).toBeVisible();
  await page.locator('#cc-clone-edit-mine').tap();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas?.getCurrentSet?.())).toBe('BH');
  await page.locator('.cc-dot-btn').first().tap();
  await page.locator('.cc-popup-mobile .cc-chip-dia').first().tap();
  await expect.poll(() => saved.length, { timeout: 10000 }).toBeGreaterThan(0);
});

for (const username of ['admin', 'hoaidinh']) {
test(`${username} chạm Soạn, đặt hợp âm HD và thấy dữ liệu sau khi tải lại`, async ({ page }) => {
  const sid = execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`, {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  let saved = [];
  await page.route('**/api/index.php?route=chord_sets*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'POST' ? JSON.parse(request.postData() || '{}') : {};
    const action = body.action || url.searchParams.get('action');
    if (action === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
    if (action === 'load') return route.fulfill({ json: { success: true, chords: saved } });
    if (action === 'save') {
      expect(body.songId).toBe('thanh-ca-001');
      expect(body.name).toBe('HD');
      saved = body.chords;
      return route.fulfill({ json: { success: true, checksum: 'mobile-test-checksum' } });
    }
    return route.fulfill({ status: 400, json: { success: false } });
  });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#btn-mobile-edit')).toBeVisible();
  await page.locator('#btn-mobile-edit').tap();
  await expect(page.locator('.cc-dot-btn').first()).toBeVisible();
  await page.locator('.cc-dot-btn').first().tap();
  await expect(page.locator('.cc-popup.cc-popup-mobile')).toBeVisible();
  await page.locator('.cc-popup-mobile .cc-chip-dia').first().tap();
  await expect.poll(() => saved.length, { timeout: 10000 }).toBeGreaterThan(0);
  await page.locator('#cc-mob-done').tap();
  await page.locator('#btn-mobile-chordset').tap();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas?.getCurrentSet?.())).toBe('HD');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Object.keys(window.ChordCanvas?.getCustomChords?.() || {}).length)).toBeGreaterThan(0);
});
}
