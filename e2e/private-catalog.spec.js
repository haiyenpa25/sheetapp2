// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Danh mục riêng + thêm bài (MusicXML) qua giao diện Quản lý, rồi kiểm khách không lấy được bài (2026-10-29).
 * Cần một tài khoản admin THỬ trong bản sao cô lập: SHEETAPP_E2E_ADMIN_USER / SHEETAPP_E2E_ADMIN_PASS (thiếu thì bỏ qua).
 * Tạo danh mục và bài trong CSDL của bản sao — chỉ chạy trên bản sao cô lập (xem e2e/assert-isolated-root.js).
 */
const ADMIN_USER = process.env.SHEETAPP_E2E_ADMIN_USER || '';
const ADMIN_PASS = process.env.SHEETAPP_E2E_ADMIN_PASS || '';
const SAMPLE_DIR = path.resolve(__dirname, '../storage/Thanh ca');

test.describe('Danh mục riêng và bài bản quyền', () => {
  test.skip(!ADMIN_USER || !ADMIN_PASS, 'Thiếu SHEETAPP_E2E_ADMIN_USER / SHEETAPP_E2E_ADMIN_PASS');

  test('admin tạo danh mục nội bộ, tải XML; khách không thấy', async ({ browser }) => {
    const sample = path.join(SAMPLE_DIR, fs.readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.xml'))[0]);
    const name = `Danh mục thử ${Date.now()}`;

    const admin = await browser.newContext();
    const page = await admin.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('./manager/');
    const login = await page.evaluate(([u, p]) => window.ApiService.auth.login({ username: u, password: p }), [ADMIN_USER, ADMIN_PASS]);
    expect(login.success).toBe(true);
    await page.goto('./manager/');
    await page.evaluate(() => ManagerApp.switchTab('tab-categories'));

    await page.click('#btn-add-category-modal');
    await page.fill('#cat-edit-name', name);
    await page.selectOption('#cat-edit-visibility', 'private');
    await page.click('#form-manage-category button[type=submit]');
    const card = page.locator('.cat-card', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.locator('.vis-badge')).toContainText('Nội bộ');

    await card.getByText('Thêm bài (XML)').click();
    await page.setInputFiles('#upload-song-files', sample);
    await page.click('#btn-upload-song-submit');
    await expect(page.locator('#upload-song-results .upload-ok')).toBeVisible({ timeout: 20000 });

    const list = await page.evaluate(() => fetch('/api/index.php?route=songs').then((r) => r.json()));
    const song = (Array.isArray(list) ? list : list.data || []).find((s) => (s.category || '') === name);
    expect(song, 'bài vừa tải xuất hiện cho admin').toBeTruthy();
    expect(song.visibility).toBe('private');
    expect(song.id.startsWith('pv-')).toBe(true);
    expect(song.xmlPath).toContain('action=xml');

    await page.goto(`./?song=${encodeURIComponent(song.id)}`);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 30000 });

    const guest = await browser.newContext();
    const gp = await guest.newPage();
    await gp.goto('./');
    const g = await gp.evaluate(async (id) => {
      const status = (u) => fetch(u).then((r) => r.status);
      const songs = await fetch('/api/index.php?route=songs').then((r) => r.json());
      const cats = await fetch('/api/index.php?route=categories').then((r) => r.json());
      return {
        inList: (Array.isArray(songs) ? songs : songs.data || []).some((s) => s.id === id),
        catVisible: (Array.isArray(cats) ? cats : []).some((c) => String(c.name).startsWith('Danh mục thử')),
        xml: await status('/api/index.php?route=songs&action=xml&id=' + id),
        chords: await status('/api/index.php?route=chord_sets&action=list&songId=' + id),
        exported: await status('/api/index.php?route=export&song_id=' + id + '&format=chordpro'),
        one: await status('/api/index.php?route=songs&action=get&id=' + id),
      };
    }, song.id);
    expect(g).toEqual({ inList: false, catVisible: false, xml: 404, chords: 404, exported: 404, one: 404 });
    expect(errors).toEqual([]);
  });
});
