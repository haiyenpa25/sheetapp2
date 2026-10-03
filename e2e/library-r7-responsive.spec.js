// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { execSync } = require('child_process');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sheetapp_guest_chosen', '1');
    sessionStorage.setItem('sheetapp_gig_hint_shown', '1');
  });
});

test('phone toolbar keeps every primary control reachable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#mobile-thumb-bar')).toBeVisible();
  for (const id of ['btn-mobile-transpose-down', 'mobile-transpose-display', 'btn-mobile-transpose-up', 'btn-mobile-view-toggle', 'btn-mobile-gig']) {
    const button = page.locator(`#${id}`);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(320);
    expect(box.width, id).toBeGreaterThanOrEqual(44);
    expect(box.height, id).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('#btn-mobile-view-toggle')).toHaveAttribute('aria-label', /Bản nhạc|Lời/);
  await page.screenshot({ path: 'test-results/r7-phone-320.png' });
});

test('phone song load does not cover the score with duplicate information', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    window.__r7InfoToasts = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const region = document.getElementById('toast-container');
      if (!region) return;
      new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof window.Element && node.matches('.toast.info')) window.__r7InfoToasts++;
          }
        }
      }).observe(region, { childList: true });
    });
  });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#mobile-transpose-display')).not.toHaveText('--');
  expect(await page.evaluate(() => window.__r7InfoToasts)).toBe(0);
});

test('phone fullscreen keeps view and transpose controls in a touch-friendly HUD', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-mobile-gig').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'performance');
  await page.screenshot({ path: 'test-results/r7-fullscreen-390.png' });
  const view = page.locator('#btn-gig-view-toggle');
  await expect(view).toBeVisible();
  await view.click();
  await expect(page.locator('#lyric-view-container')).toBeVisible();
  for (const id of ['btn-gig-trans-down', 'btn-gig-trans-up', 'btn-gig-view-toggle', 'btn-gig-exit']) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box).not.toBeNull();
    expect(box.width, id).toBeGreaterThanOrEqual(44);
    expect(box.height, id).toBeGreaterThanOrEqual(44);
  }
  await page.locator('#btn-gig-tools').click();
  await expect(page.locator('#main-dropdown-menu')).toBeVisible();
  await page.locator('#main-dropdown-backdrop').click({ position: { x: 4, y: 4 } });
  await page.waitForTimeout(3300);
  await expect(page.locator('#gig-hud-reveal')).toBeVisible();
  await page.locator('#gig-hud-reveal').click();
  await expect(page.locator('#gig-floating-hud')).not.toHaveClass(/faded/);
  await page.locator('#btn-gig-exit').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'view');
});

test('library logo lives in the song picker on laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-open-sidebar').click();
  await expect(page.locator('.sidebar-header .logo-text')).toBeVisible();
  await expect(page.locator('#app-shell-navbar .shell-brand')).toBeHidden();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/r7-sidebar-1366.png' });
  await page.locator('#btn-toggle-sidebar').click();
  await expect(page.locator('#sidebar')).toHaveClass(/mobile-hidden/);
  await expect(page.locator('#btn-open-sidebar')).toBeFocused();
});

for (const width of [360, 390, 430]) {
  test(`phone controls work without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#mobile-thumb-bar')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const bar = document.getElementById('mobile-thumb-bar');
      const ids = ['btn-mobile-transpose-down', 'mobile-transpose-display', 'btn-mobile-transpose-up', 'btn-mobile-chordset', 'btn-mobile-view-toggle', 'btn-mobile-gig'];
      return { scrollWidth: document.documentElement.scrollWidth, buttons: ids.map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { id, left: r.left, right: r.right, height: r.height };
      }), barTop: bar.getBoundingClientRect().top };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    for (const b of geometry.buttons) {
      expect(b.left, b.id).toBeGreaterThanOrEqual(0);
      expect(b.right, b.id).toBeLessThanOrEqual(width);
      expect(b.height, b.id).toBeGreaterThanOrEqual(44);
    }
    const keyBefore = await page.locator('#mobile-transpose-display').textContent();
    await page.locator('#btn-mobile-transpose-up').click();
    await expect(page.locator('#mobile-transpose-display')).not.toHaveText(keyBefore);
    await page.locator('#mobile-transpose-display').click();
    await expect(page.locator('#mobile-transpose-display')).toHaveText(keyBefore);
    await page.locator('#btn-mobile-view-toggle').click();
    await expect(page.locator('#lyric-view-container')).toBeVisible();
    await expect(page.locator('#btn-mobile-view-toggle')).toHaveAttribute('aria-label', /Đang xem Lời/);
    await page.locator('#btn-mobile-view-toggle').click();
    await expect(page.locator('#lyric-view-container')).toBeHidden();
  });
}

for (const width of [820, 1024, 1092, 1366, 1440, 1920]) {
  test(`laptop toolbar stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#btn-more-options')).toBeVisible();
    const ids = ['btn-open-sidebar', 'btn-transpose-down', 'btn-transpose-up', 'btn-view-sheet', 'btn-view-lyrics', 'btn-fullscreen', 'btn-more-options'];
    for (const id of ids) {
      const el = page.locator(`#${id}`);
      await expect(el, id).toBeVisible();
      const box = await el.boundingBox();
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(width);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}

test('mobile reader and performance controls have no serious accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#mobile-thumb-bar')).toBeVisible();
  for (const selector of ['#mobile-thumb-bar', '#gig-floating-hud']) {
    if (selector === '#gig-floating-hud') {
      await page.locator('#btn-mobile-gig').click();
      await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'performance');
    }
    const results = await new AxeBuilder({ page }).include(selector).analyze();
    const severe = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(severe.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});

test('compact fullscreen HUD and section map do not overlap at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-mobile-gig').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'performance');
  await expect(page.locator('#btn-gig-view-toggle')).toBeVisible();
  const boxes = await page.evaluate(() => {
    const hud = document.getElementById('gig-floating-hud').getBoundingClientRect();
    const map = document.getElementById('section-jump-bar-container');
    const mapRect = map.getBoundingClientRect();
    const actions = ['btn-gig-trans-down', 'btn-gig-trans-up', 'btn-gig-view-toggle', 'btn-gig-exit'].map(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, left: r.left, right: r.right, width: r.width, height: r.height };
    });
    return { hudTop: hud.top, mapBottom: map.classList.contains('hidden') ? null : mapRect.bottom, actions };
  });
  if (boxes.mapBottom !== null) expect(boxes.mapBottom).toBeLessThanOrEqual(boxes.hudTop);
  for (const action of boxes.actions) {
    expect(action.left, action.id).toBeGreaterThanOrEqual(0);
    expect(action.right, action.id).toBeLessThanOrEqual(320);
    expect(action.width, action.id).toBeGreaterThanOrEqual(44);
    expect(action.height, action.id).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: 'test-results/r7-fullscreen-320.png' });
});

test('last sheet system and last lyric line can scroll above the phone toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  const sheet = await page.evaluate(() => {
    const wrapper = document.getElementById('sheet-viewer-wrapper');
    wrapper.scrollTop = wrapper.scrollHeight;
    const score = document.querySelector('#osmd-container svg:last-of-type');
    const bar = document.getElementById('mobile-thumb-bar');
    return { scrollTop: wrapper.scrollTop, bottom: score.getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top };
  });
  expect(sheet.scrollTop).toBeGreaterThan(0);
  expect(sheet.bottom).toBeLessThanOrEqual(sheet.barTop);
  await page.locator('#btn-mobile-view-toggle').click();
  await expect(page.locator('#lyric-view-container')).toBeVisible();
  const lyrics = await page.evaluate(() => {
    const wrapper = document.getElementById('sheet-viewer-wrapper');
    wrapper.scrollTop = wrapper.scrollHeight;
    const line = document.querySelector('#lyric-view-container .lv-verse:last-of-type');
    const bar = document.getElementById('mobile-thumb-bar');
    return { found: !!line, bottom: line?.getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top };
  });
  expect(lyrics.found).toBe(true);
  expect(lyrics.bottom).toBeLessThanOrEqual(lyrics.barTop);
});

test('selected song in the left picker uses compact type and a blue highlight', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-open-sidebar').click();
  const active = page.locator('#song-list .song-item.active').first();
  await expect(active).toBeVisible();
  const style = await active.evaluate(el => {
    const title = el.querySelector('.song-item-title');
    const bg = window.getComputedStyle(el).backgroundColor;
    return { fontSize: parseFloat(window.getComputedStyle(title).fontSize), bg };
  });
  expect(style.fontSize).toBeLessThanOrEqual(12.5);
  const colors = style.bg.match(/[\d.]+/g)?.map(Number) || [];
  expect(colors[2]).toBeGreaterThan(colors[0]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/r7-selected-song-blue.png' });
});

for (const username of ['admin', 'hoaidinh']) {
  test(`${username} sees mobile Soạn and enters chord placement directly`, async ({ page }) => {
    const sid = execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.locator('#btn-mobile-view-toggle').click();
    await expect(page.locator('#lyric-view-container')).toBeVisible();
    await expect(page.locator('#btn-mobile-view-toggle')).toHaveAttribute('aria-label', /Đang xem Lời/);
    const edit = page.locator('#btn-mobile-edit');
    await expect(edit).toBeVisible();
    await expect(edit).toBeEnabled();
    if (username === 'admin') await page.screenshot({ path: 'test-results/r7-admin-phone-toolbar.png' });
    await edit.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'edit_chords');
    await expect(page.locator('#lyric-view-container')).toBeHidden();
    await expect(page.locator('#osmd-container .cc-dot-btn').first()).toBeVisible();
    await expect(edit).toHaveAttribute('aria-pressed', 'true');
  });
}

test('phone guest does not see Soạn', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btn-mobile-edit')).toBeHidden();
});

test('admin mobile toolbar fits at 320px with Soạn visible', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btn-mobile-edit')).toBeVisible();
  const geometry = await page.evaluate(() => {
    const ids = ['btn-open-sidebar', 'song-info', 'btn-mobile-edit', 'btn-more-options'];
    return ids.map(id => {
      const rect = document.getElementById(id).getBoundingClientRect();
      return { id, x: rect.x, right: rect.right, width: rect.width };
    });
  });
  for (const item of geometry) {
    expect(item.x, item.id).toBeGreaterThanOrEqual(0);
    expect(item.right, item.id).toBeLessThanOrEqual(320);
  }
  for (let index = 1; index < geometry.length; index++) {
    expect(geometry[index].x, geometry[index].id).toBeGreaterThanOrEqual(geometry[index - 1].right);
  }
  expect(geometry[1].width).toBeGreaterThan(40);
});

test('lyrics chords use Ab when a song in G is raised one semitone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-mobile-view-toggle').click();
  await expect(page.locator('#lyric-view-container .lv-chord').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-mobile-transpose-up').click();
  await expect(page.locator('#mobile-transpose-display')).toContainText('Ab');
  const chords = await page.locator('#lyric-view-container .lv-chord').allTextContents();
  expect(chords.some(chord => chord.trim() === 'Ab')).toBe(true);
  expect(chords.some(chord => chord.trim() === 'G#')).toBe(false);
});
