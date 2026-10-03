// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sheetapp_guest_chosen', '1');
    sessionStorage.setItem('sheetapp_gig_hint_shown', '1');
  });
});

test('Guest cannot see chord authoring actions in the real Tools menu', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-more-options').click();
  await expect(page.locator('#btn-menu-add-chord-mode')).toBeHidden();
  await expect(page.locator('#btn-menu-create-chordset')).toBeHidden();
});

for (const username of ['admin', 'hoaidinh']) {
  test(`${username} can reach chord editing from Tools menu`, async ({ page }) => {
    const sid = execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#btn-menu-add-chord-mode')).toBeVisible();
    await expect(page.locator('#btn-menu-create-chordset')).toBeVisible();
    await page.locator('#btn-menu-add-chord-mode').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'edit_chords');
    await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Bắt đầu sửa hợp âm' })).toBeHidden();
  });
}

test('Ban Hát must choose their own set before editing while viewing HD', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#chord-set-selector')).toHaveValue('HD');
  await page.locator('#btn-add-chord-mode-bar').click();
  await expect(page.getByRole('dialog', { name: 'Bắt đầu sửa hợp âm' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(false);
  await page.locator('#cc-clone-edit-mine').click();
  await expect(page.locator('#chord-set-selector')).toHaveValue('BH');
  await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
});

test('Admin sees chord placement buttons on notes after enabling Soạn', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-add-chord-mode-bar').click();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
  const metrics = await page.evaluate(() => ({
    notes: document.querySelectorAll('#osmd-container g.vf-stavenote').length,
    buttons: document.querySelectorAll('#osmd-container .cc-dot-btn').length,
    visible: Array.from(document.querySelectorAll('#osmd-container .cc-dot-btn')).filter(el => window.getComputedStyle(el).display !== 'none').length
  }));
  expect(metrics.notes).toBeGreaterThan(0);
  expect(metrics.buttons).toBeGreaterThan(0);
  expect(metrics.visible).toBeGreaterThan(0);
  await page.locator('#osmd-container .cc-dot-btn').first().click();
  await expect(page.locator('.cc-popup').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/r6-admin-edit.png' });
});

test('Admin can open a purple chord target from mobile Tools', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-more-options').click();
  await page.locator('#btn-menu-add-chord-mode').click();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
  const target = page.locator('#osmd-container .cc-dot-btn').first();
  await expect(target).toBeVisible();
  const firstRows = await page.evaluate(() => Array.from(document.querySelectorAll('#osmd-container .cc-dot-btn'))
    .slice(0, 12).map(el => Math.round(el.getBoundingClientRect().y / 20)));
  expect(new Set(firstRows).size).toBeGreaterThan(2);
  await page.screenshot({ path: 'test-results/r6-admin-mobile-edit.png' });
  await target.click();
  await expect(page.locator('.cc-popup').first()).toBeVisible();
});

test('Chord targets retain their score positions after scrolling and rebuilding', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-more-options').click();
  await page.locator('#btn-menu-add-chord-mode').click();
  await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
  const positions = await page.evaluate(() => {
    const wrap = document.getElementById('sheet-viewer-wrapper');
    const first = () => parseFloat(document.querySelector('#osmd-container .cc-dot-btn').style.top);
    const before = first();
    wrap.scrollTop += 300;
    window.ChordCanvas.build();
    return { before, after: first(), scrollTop: wrap.scrollTop };
  });
  expect(positions.scrollTop).toBeGreaterThan(100);
  expect(Math.abs(positions.after - positions.before)).toBeLessThan(12);
});

for (const [width, songId] of [[360, 'thanh-ca-001'], [390, 'thanh-ca-001'], [820, 'thanh-ca-001'], [1366, 'thanh-ca-001'], [390, 'thanh-ca-002'], [820, 'thanh-ca-123']]) {
  test(`Chord targets stay beside their notes for ${songId} at ${width}px`, async ({ page }) => {
    const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin').toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`./?song=${songId}&v=sheet`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.locator('#btn-more-options').click();
    await page.locator('#btn-menu-add-chord-mode').click();
    await expect.poll(() => page.evaluate(() => window.ChordCanvas.isAddMode())).toBe(true);
    const gaps = await page.evaluate(() => {
      const top = document.getElementById('osmd-container').getBoundingClientRect().top;
      return Array.from(document.querySelectorAll('#osmd-container .cc-dot-btn')).map(el =>
        top + Number(el.dataset.noteTop) - el.getBoundingClientRect().top);
    });
    expect(gaps.length).toBeGreaterThan(5);
    expect(Math.min(...gaps)).toBeGreaterThan(-10);
    // Nốt thấp và nhóm SVG của WebKit có thể cách hàng hợp âm khoảng 110px.
    expect(Math.max(...gaps)).toBeLessThan(120);
  });
}

test('HD new-set action never overwrites an existing HD set with empty chords', async ({ page }) => {
  const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('route=chord_sets')) writes.push(request.postDataJSON());
  });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-more-options').click();
  await page.locator('#btn-menu-create-chordset').click();
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('edit_chords');
  expect(writes.filter((body) => body?.action === 'save' && body?.name === 'HD' && body?.chords?.length === 0)).toEqual([]);
});

test('Browser fullscreen exit restores view mode and toolbar', async ({ page }) => {
  await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-fullscreen').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('view');
  await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);
  await expect(page.locator('#toolbar')).toBeVisible();
});

test('Rejected fullscreen request restores view mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen blocked'));
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-fullscreen').click();
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('view');
  await expect(page.locator('#toolbar')).toBeVisible();
});

test('Missing fullscreen API leaves the app in view mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.Element.prototype.requestFullscreen = undefined;
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-fullscreen').click();
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('view');
});

test('Escape exits fullscreen and restores the toolbar', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-fullscreen').click();
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('performance');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('view');
});

test('Fullscreen control keeps a vector icon on both transitions', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-fullscreen').click();
  await expect(page.locator('#btn-fullscreen .gig-icon svg')).toBeAttached();
  await page.evaluate(() => window.ModeManager.resetToView());
  await expect(page.locator('#btn-fullscreen .gig-icon svg')).toBeAttached();
});

test('Section jump controls follow the fullscreen HUD visibility', async ({ page }) => {
  await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.LiveSync.ensureLoaded());
  await page.evaluate(async () => {
    window.ApiService.arrangements.getSections = async () => ({ data: [{ id: 1, name: 'Intro', type: 'intro', start_measure: 1, end_measure: 4 }] });
    window.ApiService.arrangements.list = async () => ({ data: [] });
    await window.ArrangementEngine.loadForSong('thanh-ca-001');
  });
  await page.locator('#btn-fullscreen').click();
  await expect(page.locator('#section-jump-bar-container')).toBeVisible();
  await page.evaluate(() => window.ModeManager.fadeHud());
  await expect(page.locator('#section-jump-bar-container')).toBeHidden();
  await page.evaluate(() => window.ModeManager.showHud());
  await expect(page.locator('#section-jump-bar-container')).toBeVisible();
});

test('Toast deduplicates messages and errors can be dismissed', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.getElementById('toast-container').replaceChildren();
    window.AppUI.showToast('R6 error', 'error');
    window.AppUI.showToast('R6 error', 'error');
  });
  await expect(page.locator('#toast-container .toast')).toHaveCount(1);
  await page.locator('#toast-container .toast button').click();
  await expect(page.locator('#toast-container .toast')).toHaveCount(0);
  await page.evaluate(() => {
    window.AppUI.showToast('Nhắc thao tác', 'info');
    window.AppUI.showToast('Lỗi lưu', 'error');
    window.AppUI.showToast('Nhắc khác', 'info');
  });
  await expect(page.locator('#toast-container .toast')).toHaveCount(1);
  await expect(page.locator('#toast-container .toast')).toContainText('Lỗi lưu');
});

for (const width of [1366, 820, 390]) {
  test(`Error toast leaves the first score system clear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.evaluate(() => window.AppUI.showToast('Lỗi kiểm tra vị trí', 'error'));
    await expect(page.locator('#toast-container .toast.error')).toBeVisible();
    const bounds = await page.evaluate(() => {
      const toast = document.querySelector('#toast-container .toast.error').getBoundingClientRect();
      const firstNote = document.querySelector('#osmd-container g.vf-stavenote').getBoundingClientRect();
      return { toastTop: toast.top, noteBottom: firstNote.bottom, toastRight: toast.right, viewportWidth: window.innerWidth };
    });
    expect(bounds.toastTop).toBeGreaterThan(bounds.noteBottom);
    expect(bounds.toastRight).toBeLessThanOrEqual(bounds.viewportWidth);
  });
}

for (const [username, setName] of [['hoaidinh', 'HD'], ['admin', 'ADMIN']]) {
  test(`${username} saves a chord and sees it after reload`, async ({ page }) => {
    const sid = execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`).toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    if (setName === 'ADMIN') {
      await page.locator('#btn-new-chord-set').click();
      await expect(page.locator('#chord-set-selector')).toHaveValue('ADMIN');
    } else {
      await page.locator('#btn-add-chord-mode-bar').click();
    }
    await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'edit_chords');
    await page.evaluate(() => window.ChordCanvasEdit.saveChord(0, 0, 'Bb7'));
    await expect.poll(async () => page.evaluate(async (name) => {
      const data = await window.ApiService.chordSets.load('thanh-ca-001', name);
      return data.chords?.some(item => item.measureIdx === 0 && item.noteIdx === 0 && item.chord === 'Bb7');
    }, setName), { timeout: 15000 }).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect.poll(async () => page.evaluate(async (name) => {
      const data = await window.ApiService.chordSets.load('thanh-ca-001', name);
      return data.chords?.some(item => item.measureIdx === 0 && item.noteIdx === 0 && item.chord === 'Bb7');
    }, setName)).toBe(true);
  });
}

for (const status of [403, 409]) {
  test(`Chord save ${status} never reports success`, async ({ page }) => {
    const sid = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.evaluate(async (code) => {
      window.ChordCanvas.setCustomChords({ '0_0': 'Bb7' });
      window.ApiService.chordSets.save = async () => {
        throw { status: code, message: code === 403 ? 'Forbidden' : 'Conflict',
          data: code === 409 ? { conflict: true, currentChecksum: 'other', serverChords: [] } : {} };
      };
      await window.ChordCanvasEdit.executeSave();
    }, status);
    if (status === 409) {
      await expect(page.locator('#cc-conflict-modal')).toBeVisible();
      await expect(page.locator('#cc-status-chip')).toContainText('Xung đột');
    } else {
      await expect(page.locator('#cc-status-chip')).toContainText('Lỗi lưu');
      await expect(page.locator('#toast-container .toast.error')).toBeVisible();
    }
    await expect(page.locator('#cc-status-chip')).not.toContainText('Đã lưu');
  });
}

for (const width of [360, 390, 820, 1366, 1440]) {
  test(`Toolbar fits ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      targets: Array.from(document.querySelectorAll('#mobile-thumb-bar button'))
        .filter(el => window.getComputedStyle(el).display !== 'none')
        .map(el => ({ id: el.id, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
    if (width <= 390) {
      for (const target of metrics.targets) {
        expect(target.width, target.id).toBeGreaterThanOrEqual(44);
        expect(target.height, target.id).toBeGreaterThanOrEqual(44);
      }
    }
  });
}

test('Mobile Tools menu scrolls and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-more-options').click();
  await expect(page.locator('#main-dropdown-menu')).toBeVisible();
  const metrics = await page.locator('#main-dropdown-menu').evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  await page.keyboard.press('Escape');
  await expect(page.locator('#main-dropdown-menu')).toBeHidden();
});

test('Reading, Tools, and Fullscreen produce no uncaught JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  await page.locator('#btn-more-options').click();
  await page.keyboard.press('Escape');
  await page.locator('#btn-mobile-view-toggle').click();
  await expect(page.locator('#lyric-view-container')).toBeVisible();
  await page.locator('#btn-mobile-gig').click();
  await expect.poll(() => page.evaluate(() => window.ModeManager.getMode())).toBe('performance');
  await page.evaluate(() => window.ModeManager.resetToView());
  expect(errors).toEqual([]);
});

for (const [width, expectedPx] of [[1366, 18], [820, 18], [390, 20]]) {
  test(`Sheet lyrics remain readable at ${width}px without oversized desktop text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    const metrics = await page.evaluate(() => {
      const lyric = Array.from(document.querySelectorAll('#osmd-container svg text'))
        .find(el => el.textContent.trim() === '1.Thờ');
      const paper = document.getElementById('osmd-container').getBoundingClientRect();
      return { fontSize: Number(lyric?.getAttribute('font-size')?.replace('px', '')), paperWidth: paper.width, viewportWidth: window.innerWidth };
    });
    expect(metrics.fontSize).toBe(expectedPx);
    expect(metrics.paperWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    await page.screenshot({ path: `test-results/r6-lyrics-${width}.png` });
  });
}
