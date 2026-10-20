const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');
const instruments = [
  { id: 'general', name: 'Chung' }, { id: 'guitar', name: 'Guitar' },
  { id: 'drums', name: 'Trống' }
];
const notes = [
  { id: 'g1', instrumentId: 'guitar', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Rải nhẹ' },
  { id: 'd1', instrumentId: 'drums', measureIdx: 0, staffIdx: 0, noteIdx: 0, text: 'Fill' },
  { id: 'd2', instrumentId: 'drums', measureIdx: 0, staffIdx: 1, noteIdx: 0, text: 'Điệu 6/8' }
];
async function setup(page, admin = false) {
  await page.goto('http://localhost/sheetapp2-roadmap6-oct19-061901/robots.txt');
  await page.evaluate(() => localStorage.removeItem('sheetapp_annotation_layers'));
  await page.setContent('<main id="sheet-viewer-wrapper"><div id="sheet-area"><div id="osmd-container" style="position:relative"><svg width="500" height="140"><g id="n1"><rect x="60" y="40" width="10" height="10"/></g></svg><svg width="500" height="140"><g id="n2"><rect x="90" y="40" width="10" height="10"/></g></svg></div></div></main><button id="btn-add-annotate-mode"></button>');
  await page.addStyleTag({ path: path.join(root, 'assets/css/instrument-annotations.css') });
  await page.evaluate(({ admin, instruments, notes }) => {
    window.currentSong = 'song-a'; window.isAdmin = admin; window.saved = []; window.failSave = false;
    window.Auth = { isAdmin: () => window.isAdmin };
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
  }, { admin, instruments, notes });
  for (const file of ['annotation-geometry.js', 'annotation-panel.js', 'annotation-canvas.js']) {
    await page.addScriptTag({ path: path.join(root, 'assets/js', file) });
  }
  await page.evaluate(async () => { AnnotationCanvas.init(); await AnnotationCanvas.loadSong('song-a'); });
  await page.getByRole('button', { name: 'Ghi chú nhạc cụ', exact: true }).click();
}

test('readers filter multiple instrument layers and both staves without edit controls', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.ano-dot')).toHaveCount(2);
  await expect(page.locator('[data-annotation-id="d2"]')).toContainText('Điệu 6/8');
  await page.getByRole('button', { name: 'Ẩn tất cả', exact: true }).click();
  await expect(page.locator('.ano-dot')).toHaveCount(0);
  await page.getByLabel('Guitar', { exact: false }).check();
  await expect(page.locator('.ano-dot')).toHaveCount(1);
  await expect(page.locator('.ano-dot')).toContainText('Guitar');
  await page.getByLabel('Trống', { exact: false }).check();
  await expect(page.locator('.ano-dot')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Soạn ghi chú', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetapp_annotation_layers')))).toEqual(['guitar', 'drums']);
  await page.evaluate(() => AnnotationCanvas.setAddMode(true));
  await expect(page.locator('.ano-dot-btn')).toHaveCount(0);
  await page.evaluate(() => AnnotationCanvas.onOSMDRendered());
  await expect(page.locator('.ano-dot')).toHaveCount(2);
});

test('admin adds an independent layer, edits and deletes without losing other instruments', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Soạn ghi chú', exact: true }).click();
  await page.getByLabel('Nhạc cụ đang soạn').selectOption('drums');
  await page.locator('.ano-dot-btn').first().click();
  await page.getByLabel('Nội dung ghi chú').fill('Fill mới');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const saved = await page.evaluate(() => window.saved[0]);
  expect(saved.revision).toBe('r1');
  expect(saved.list).toHaveLength(4);
  expect(saved.list.find(note => note.id === 'g1').text).toBe('Rải nhẹ');
  expect(saved.list[3].instrumentId).toBe('drums');
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByLabel('Nội dung ghi chú').fill('Quạt nhẹ');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.locator('[data-annotation-id="g1"]')).toContainText('Quạt nhẹ');
  await page.locator('[data-annotation-id="g1"] [data-action="edit"]').click();
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).click();
  await expect(page.locator('[data-annotation-id="g1"]')).toHaveCount(0);
  expect(await page.evaluate(() => saved.at(-1).list.filter(n => n.instrumentId === 'drums').length)).toBe(3);
});

test('failed save keeps the draft and allows retry', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Soạn ghi chú', exact: true }).click();
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
