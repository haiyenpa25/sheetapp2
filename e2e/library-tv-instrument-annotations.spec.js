const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');
const instruments = [
  { id: 'general', name: 'Chung' }, { id: 'guitar', name: 'Guitar' },
  { id: 'drums', name: 'Trống' }
];
const notes = [
  { id: 'g1', instrumentId: 'guitar', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Rải nhẹ', color: 'blue' },
  { id: 'd1', instrumentId: 'drums', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Fill' },
  { id: 'd2', instrumentId: 'drums', measureIdx: 0, staffIdx: 1, noteIdx: 0, text: 'Điệu 6/8' }
];
async function setup(page, admin = false, initialNotes = notes) {
  await page.route('https://annotations.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('https://annotations.test/');
  await page.evaluate(() => localStorage.removeItem('sheetapp_annotation_layers'));
  await page.setContent('<header id="toolbar"><div id="toolbar-controls"></div></header><main id="sheet-viewer-wrapper"><div id="sheet-area"><div id="osmd-container" style="position:relative"><svg width="500" height="300"><g id="n1"><rect x="60" y="180" width="10" height="10"/></g></svg><svg width="500" height="300"><g id="n2"><rect x="90" y="180" width="10" height="10"/></g></svg></div></div></main><button id="btn-add-annotate-mode"></button><button id="btn-add-chord-mode"></button>');
  await page.addStyleTag({ path: path.join(root, 'assets/css/instrument-annotations.css') });
  await page.evaluate(({ admin, instruments, notes }) => {
    window.currentSong = 'song-a'; window.isAdmin = admin; window.saved = []; window.failSave = false;
    window.Auth = { isAdmin: () => window.isAdmin };
    const events = {};
    window.EventBus = { on: (name, callback) => { events[name] = callback; }, emit: name => events[name]?.() };
    window.Store = { get: key => key === 'currentSong' ? { id: currentSong } : null };
    window.App = { getCurrentSongId: () => currentSong, showToast() {} };
    window.ApiService = { annotations: {
      load: async () => ({ annotations: notes, instruments, revision: 'r1', registryRevision: 'i1' }),
      save: async (song, list, revision) => {
        if (window.failSave) { const e = new Error('Mất mạng, thử lại'); e.status = 503; throw e; }
        saved.push({ song, list, revision });
        return { annotations: list, instruments, revision: 'r2', registryRevision: 'i1' };
      },
      clearCache() {}
    } };
    window.OSMDRenderer = { getInstance: () => ({ graphic: { measureList: [[
      { staffEntries: [{ graphicalVoiceEntries: [{ notes: [{ getSVGGElement: () => document.getElementById('n1') }] }] }] },
      { staffEntries: [{ graphicalVoiceEntries: [{ notes: [{ getSVGGElement: () => document.getElementById('n2') }] }] }] }
    ]] } }) };
  }, { admin, instruments, notes: initialNotes });
  for (const file of ['annotation-geometry.js', 'annotation-panel.js', 'annotation-canvas.js']) {
    await page.addScriptTag({ path: path.join(root, 'assets/js', file) });
  }
  await page.evaluate(async () => { AnnotationCanvas.init(); await AnnotationCanvas.loadSong('song-a'); });
  await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
}

test('readers filter multiple instrument layers and both staves without edit controls', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.ano-dot')).toHaveCount(3);
  await expect(page.locator('[data-annotation-id="d2"]')).toContainText('Điệu 6/8');
  await page.getByRole('button', { name: 'Ẩn tất cả', exact: true }).click();
  await expect(page.locator('.ano-dot')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /^Guitar/ }).check();
  await expect(page.locator('.ano-dot')).toHaveCount(1);
  await expect(page.locator('.ano-dot')).toContainText('Guitar');
  await page.getByRole('checkbox', { name: /^Trống/ }).check();
  await expect(page.locator('.ano-dot')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Ghi chú', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetapp_annotation_layers')))).toEqual(['guitar', 'drums']);
  await page.evaluate(() => AnnotationCanvas.setAddMode(true));
  await expect(page.locator('.ano-dot-btn')).toHaveCount(0);
  await page.evaluate(() => AnnotationCanvas.onOSMDRendered());
  await expect(page.locator('.ano-dot')).toHaveCount(3);
});

test('admin adds an independent layer, edits and deletes without losing other instruments', async ({ page }) => {
  await setup(page, true, notes.filter(note => note.id !== 'd1'));
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.locator('.ano-dot-btn').first().click();
  await page.getByLabel('Nội dung ghi chú').fill('Fill mới');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const saved = await page.evaluate(() => window.saved[0]);
  expect(saved.revision).toBe('r1');
  expect(saved.list).toHaveLength(3);
  expect(saved.list.find(note => note.id === 'g1').text).toBe('Rải nhẹ');
  expect(saved.list[2].instrumentId).toBe('drums');
  if (!await page.locator('#annotation-panel-body').isVisible()) await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByLabel('Nội dung ghi chú').fill('Quạt nhẹ');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('[data-annotation-id="g1"]')).toContainText('Quạt nhẹ');
  if (!await page.locator('#annotation-panel-body').isVisible()) await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).click();
  await expect(page.locator('[data-annotation-id="g1"]')).toHaveCount(0);
  expect(await page.evaluate(() => saved.at(-1).list.filter(n => n.instrumentId === 'drums').length)).toBe(2);
});

test('failed save keeps the draft and allows retry', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.locator('.ano-dot-btn').first().click();
  await page.getByLabel('Nội dung ghi chú').fill('<img src=x onerror=alert(1)>');
  await page.evaluate(() => { failSave = true; });
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('<img src=x onerror=alert(1)>');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Mất mạng');
  await page.evaluate(() => { failSave = false; });
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#instrument-annotations img')).toHaveCount(0);
});

test('a delayed old song response cannot replace the current song', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    let release;
    const old = new Promise(resolve => { release = resolve; });
    ApiService.annotations.load = song => song === 'old' ? old : Promise.resolve({ annotations: [], instruments: [], revision: 'new' });
    currentSong = 'old'; const pending = AnnotationCanvas.loadSong('old', true);
    currentSong = 'new'; await AnnotationCanvas.loadSong('new', true);
    release({ annotations: [{ id: 'old', instrumentId: 'drums', text: 'Bài cũ', measureIdx: 0, noteIdx: 0 }], revision: 'old' });
    await pending;
  });
  await expect(page.locator('.ano-dot')).toHaveCount(0);
  await expect(page.locator('#instrument-annotations')).not.toContainText('Bài cũ');
});

test('scroll gestures do not open an editor and keyboard activation still works', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  const point = page.locator('.ano-dot-btn').first();
  await point.dispatchEvent('pointerdown', { clientX: 60, clientY: 40 });
  await point.dispatchEvent('pointermove', { clientX: 61, clientY: 80 });
  await point.dispatchEvent('click', { detail: 1 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await point.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('failed load can be retried and does not enable an empty editor', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(async () => {
    ApiService.annotations.load = async () => { throw new Error('Không có mạng'); };
    await AnnotationCanvas.loadSong('song-a', true);
  });
  await expect(page.locator('#instrument-annotations [role=alert]')).toContainText('Không có mạng');
  await expect(page.getByRole('button', { name: 'Ghi chú', exact: true })).toHaveCount(0);
  await page.evaluate(() => { ApiService.annotations.load = async () => ({ annotations: [], instruments: [], revision: 'retry' }); });
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(page.locator('#instrument-annotations')).toContainText('Bài này chưa có ghi chú.');
});

test('a changed score hides stale anchors and lets admin place the same note again', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(async () => {
    Store.get = key => key === 'originalXml' ? '<score-partwise><part><measure><note><rest/><duration>1</duration></note></measure></part></score-partwise>' : { id: currentSong };
    ApiService.annotations.load = async () => ({
      annotations: [{ id: 'moved', instrumentId: 'drums', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Giữ nguyên', scoreFingerprint: 'ffffffff' }],
      instruments: [{ id: 'drums', name: 'Trống' }], revision: 'changed'
    });
    await AnnotationCanvas.loadSong('song-a', true);
  });
  await expect(page.locator('.ano-dot')).toHaveCount(0);
  await expect(page.locator('[data-annotation-id=moved]')).toContainText('Cần kiểm tra vị trí');
  await page.getByRole('button', { name: 'Đặt lại vị trí', exact: true }).click();
  await page.locator('.ano-dot-btn').last().click();
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot')).toHaveCount(1);
  const record = await page.evaluate(() => saved.at(-1).list[0]);
  expect(record.id).toBe('moved'); expect(record.staffIdx).toBe(1);
  expect(record.scoreFingerprint).not.toBe('ffffffff');
});

test('semantic time survives note index changes and equivalent fractions', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const instance = OSMDRenderer.getInstance();
    instance.graphic.measureList[0][0].staffEntries.unshift({ graphicalVoiceEntries: [] });
    instance.graphic.measureList[0][0].staffEntries[1].relInMeasureTimestamp = { numerator: 1, denominator: 4 };
    OSMDRenderer.getInstance = () => instance;
    ApiService.annotations.load = async () => ({
      annotations: [{ id: 'beat', instrumentId: 'drums', measureIdx: 0, staffIdx: 0, noteIdx: 0, beat: '2/8', text: 'Đúng phách' }],
      instruments: [{ id: 'drums', name: 'Trống' }], revision: 'beat'
    });
    await AnnotationCanvas.loadSong('song-a', true);
  });
  await expect(page.locator('.ano-dot')).toHaveCount(1);
  await expect(page.locator('.ano-dot')).toContainText('Đúng phách');
  await expect(page.locator('.ano-warning')).toHaveCount(0);
});

test('annotation labels avoid notation and lyrics rather than covering them', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.querySelectorAll('#osmd-container svg').forEach(svg => {
      const obstacle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [key, value] of Object.entries({ x: 0, y: 5, width: 500, height: 30 })) obstacle.setAttribute(key, value);
      svg.append(obstacle);
    });
    AnnotationCanvas.reposition();
  });
  await expect.poll(() => page.evaluate(() => {
    const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return Array.from(document.querySelectorAll('.ano-dot')).every(dot =>
      Array.from(document.querySelectorAll('#osmd-container svg rect')).every(node => !overlap(dot.getBoundingClientRect(), node.getBoundingClientRect())));
  })).toBe(true);
});

test('losing admin access closes the editor and removes authoring controls', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.locator('.ano-dot-btn').first().click();
  await page.evaluate(() => { isAdmin = false; EventBus.emit('auth:changed'); });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.ano-dot-btn')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ghi chú', exact: true })).toHaveCount(0);
});

test('conflict reload preserves the draft and saves it alongside newer notes', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.locator('.ano-dot-btn').first().click();
  await page.getByLabel('Nội dung ghi chú').fill('Bản nháp đang soạn');
  await page.evaluate(() => {
    ApiService.annotations.save = async () => { const error = new Error('Phiên khác đã thay đổi. Hãy tải lại.'); error.status = 409; throw error; };
  });
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Phiên khác');
  await page.evaluate(() => {
    ApiService.annotations.load = async () => ({ annotations: [{ id: 'newer', instrumentId: 'drums', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Phiên mới' }], instruments: [{ id: 'drums', name: 'Trống' }], revision: 'r-new' });
    ApiService.annotations.save = async (song, list, revision) => { saved.push({ song, list, revision }); return { annotations: list, revision: 'r-final' }; };
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Tải lại dữ liệu', exact: true }).click();
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('Bản nháp đang soạn');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const result = await page.evaluate(() => saved.at(-1));
  expect(result.revision).toBe('r-new');
  expect(result.list.map(n => n.text)).toEqual(['Phiên mới', 'Bản nháp đang soạn']);
});

test('API client sends revisions and refreshes cached registries after adding an instrument', async ({ page }) => {
  await setup(page);
  let reads = 0, payload;
  await page.route('**/api/index.php?route=annotations*', async route => {
    if (route.request().method() === 'GET') {
      reads++;
      await route.fulfill({ json: { annotations: [], instruments: [{ id: 'new', name: `Version ${reads}` }], revision: 'r1' } });
    } else {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { instruments: [{ id: 'new', name: 'New' }], registryRevision: 'i2', annotations: [], revision: 'r2' } });
    }
  });
  await page.addScriptTag({ path: path.join(root, 'assets/js/core/ApiService.js') });
  await page.evaluate(async () => { await ApiService.annotations.load('transport'); await ApiService.annotations.load('transport'); });
  expect(reads).toBe(1);
  await page.evaluate(() => ApiService.annotations.save('transport', [], 'expected-revision'));
  expect(payload.revision).toBe('expected-revision');
  await page.evaluate(async () => {
    await ApiService.annotations.load('transport');
    await ApiService.annotations.saveInstrument({ name: 'Violin', registryRevision: 'i1' });
    await ApiService.annotations.load('transport');
  });
  expect(reads).toBe(3);
  expect(payload).toMatchObject({ action: 'instrument_save', name: 'Violin', registryRevision: 'i1' });
});

test('a compact sheet badge opens and focuses its full note', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await page.locator('.ano-dot').last().click();
  await expect(page.locator('#annotation-panel-body')).toBeVisible();
  await expect(page.locator('[data-annotation-id="d2"]')).toBeFocused();
  await page.evaluate(() => { window.previousNoteCard = document.activeElement; AnnotationCanvas.reposition(); });
  await expect.poll(() => page.evaluate(() => previousNoteCard.isConnected)).toBe(false);
  await expect(page.locator('[data-annotation-id="d2"]')).toBeFocused();
});

test('switching to chord editing ends instrument annotation editing', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot-btn')).toHaveCount(2);
  await page.evaluate(() => document.getElementById('btn-add-chord-mode').classList.add('active'));
  await expect(page.locator('.ano-dot-btn')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ghi chú', exact: true })).toBeVisible();
});

test('instrument editor preserves legacy color metadata and icon authoring', async ({ page }) => {
  await setup(page, true);
  if (!await page.locator('#annotation-panel-body').isVisible()) await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByLabel('Biểu tượng ghi chú', { exact: true }).selectOption('🎹');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => saved.at(-1).list.find(note => note.id === 'g1'))).toMatchObject({ color: 'blue', icon: '🎹' });
  if (!await page.locator('#annotation-panel-body').isVisible()) await page.getByRole('button', { name: 'Nhạc cụ', exact: true }).click();
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#15803d');
  await expect(page.getByLabel('Biểu tượng ghi chú', { exact: true })).toHaveValue('🎹');
});

test('adding a note works when the browser has no randomUUID API', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.locator('.ano-dot-btn').first().click();
  await page.getByLabel('Nội dung ghi chú').fill('Ghi chú trên máy trong mạng nội bộ');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => saved.at(-1).list.at(-1).id)).toMatch(/^note-[a-zA-Z0-9_-]+$/);
});


test('toolbar selects an instrument, offers its presets and uses one color per instrument', async ({ page }) => {
  await setup(page, true, notes.filter(note => note.instrumentId === 'guitar'));
  await expect(page.locator('#toolbar #instrument-annotations')).toBeVisible();
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  const point = page.locator('.ano-dot-btn').first();
  await expect(point).toHaveCSS('background-color', 'rgb(255, 224, 102)');
  await point.click();
  await page.getByRole('button', { name: 'Fill', exact: true }).click();
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('Fill');
  await page.getByLabel('Nhạc cụ', { exact: true }).selectOption('guitar');
  await expect(page.getByRole('button', { name: 'Rải', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('Fill');
  await page.getByRole('button', { name: 'Rải', exact: true }).click();
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('Fill · Rải');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot[data-instrument-id=guitar]')).toHaveCount(2);
  const colors = await page.locator('.ano-dot[data-instrument-id=guitar]').evaluateAll(nodes => nodes.map(n => n.style.getPropertyValue('--instrument-color')));
  expect(new Set(colors).size).toBe(1);
  expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
});


test('an existing instrument note replaces the yellow plus and opens for direct editing', async ({ page }) => {
  await setup(page, true);
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot-btn')).toHaveCount(0);
  await page.locator('.ano-dot[data-note-id=d1]').click();
  await expect(page.getByLabel('Nhạc cụ', { exact: true })).toHaveValue('drums');
  await expect(page.getByLabel('Nội dung ghi chú')).toHaveValue('Fill');
  await page.getByLabel('Nội dung ghi chú').fill('Fill 1 ô');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot[data-note-id=d1]')).toContainText('Fill 1 ô');
  expect(await page.evaluate(() => saved.at(-1).list.filter(note => note.id === 'd1').length)).toBe(1);
});


test('a pending instrument color survives sheet redraws and save errors', async ({ page }) => {
  await setup(page, true);
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('guitar');
  // WebKit's headless color input lacks a native picker; dispatch its value-change event.
  await page.getByLabel('Màu nhạc cụ', { exact: true }).evaluate(input => { input.value = '#284b63'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => AnnotationCanvas.reposition());
  await page.waitForTimeout(200);
  await expect(page.getByLabel('Màu nhạc cụ', { exact: true })).toHaveValue('#284b63');
  await page.evaluate(() => { ApiService.annotations.saveInstrument = async () => { throw new Error('Không lưu được màu'); }; });
  await page.getByRole('button', { name: 'Lưu màu nhạc cụ', exact: true }).click();
  await expect(page.locator('#annotation-panel-body [role=alert]').first()).toContainText('Không lưu được màu');
  await expect(page.getByLabel('Màu nhạc cụ', { exact: true })).toHaveValue('#284b63');
  await page.evaluate(() => { ApiService.annotations.saveInstrument = async payload => ({ instruments: [{ id: 'guitar', name: 'Guitar', color: payload.color }, { id: 'drums', name: 'Trống', color: '#c2410c' }], registryRevision: 'i2' }); });
  await page.getByRole('button', { name: 'Lưu màu nhạc cụ', exact: true }).click();
  await expect(page.locator('#annotation-panel-body p[role=alert]')).toHaveCount(0);
  await expect(page.getByLabel('Màu nhạc cụ', { exact: true })).toHaveValue('#284b63');
});


test('editor saves a custom note color and leaves other notes unchanged', async ({ page }) => {
  await setup(page, true);
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#15803d');
  await page.getByRole('button', { name: 'Màu đỏ', exact: true }).click();
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#e11d48');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('.ano-dot[data-note-id=g1]')).toHaveCSS('border-left-color', 'rgb(225, 29, 72)');
  const result = await page.evaluate(() => saved.at(-1).list);
  expect(result.find(note => note.id === 'g1').customColor).toBe('#e11d48');
  expect(result.find(note => note.id === 'd1').customColor).toBeUndefined();
  expect(result.find(note => note.id === 'g1').color).toBe('blue');
});

test('custom note color survives a failed save and can return to instrument color', async ({ page }) => {
  await setup(page, true);
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByLabel('Màu ghi chú', { exact: true }).evaluate(input => { input.value = '#284b63'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.getByLabel('Nhạc cụ', { exact: true }).selectOption('drums');
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#284b63');
  await page.evaluate(() => { failSave = true; });
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Mất mạng');
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#284b63');
  await page.getByRole('button', { name: 'Theo màu nhạc cụ', exact: true }).click();
  await expect(page.getByLabel('Màu ghi chú', { exact: true })).toHaveValue('#c2410c');
  await page.evaluate(() => { failSave = false; });
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  expect(await page.evaluate(() => saved.at(-1).list.find(note => note.id === 'g1').customColor)).toBeUndefined();
  await expect(page.locator('.ano-dot[data-note-id=g1]')).toHaveCSS('border-left-color', 'rgb(194, 65, 12)');
});

test('starting note authoring remembers visible layers for reload and interface switching', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('sheetapp_annotation_layers'))).toBe('null');
});


test('mobile note editor stays centered even when the application resets element margins', async ({ page }) => {
  await setup(page, true);
  await page.addStyleTag({ content: '* { margin: 0; }' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(10);
  expect(Math.abs(bounds.x + bounds.width / 2 - 195)).toBeLessThan(2);
  expect(bounds.y).toBeGreaterThanOrEqual(10);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(834);
});


test('changing an instrument default repaints inherited notes immediately and keeps custom colors', async ({ page }) => {
  await setup(page, true, [notes[0], { ...notes[2], id: 'pinned', instrumentId: 'guitar', customColor: '#7e22ce' }]);
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('guitar');
  await page.getByLabel('Màu nhạc cụ', { exact: true }).evaluate(input => { input.value = '#0e7490'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { ApiService.annotations.saveInstrument = async () => ({ instruments: [{ id: 'general', name: 'Chung' }, { id: 'guitar', name: 'Guitar', color: '#0e7490' }], registryRevision: 'i2' }); });
  await page.getByRole('button', { name: 'Lưu màu nhạc cụ', exact: true }).click();
  await expect(page.locator('.ano-dot[data-note-id=g1]')).toHaveCSS('border-left-color', 'rgb(14, 116, 144)');
  await expect(page.locator('.ano-dot[data-note-id=pinned]')).toHaveCSS('border-left-color', 'rgb(126, 34, 206)');
});
