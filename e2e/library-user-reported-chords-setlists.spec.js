// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

async function login(page) {
  const sid = execFileSync('C:\\xampp\\php\\php.exe', ['tools/create_test_session.php', 'hoaidinh'], { encoding: 'utf8' }).trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
}

test('HD chords stay visible while editing, and plus marks only empty notes', async ({ page }) => {
  await login(page);
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'load') return route.fulfill({ json: { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'G' }] } });
    if (url.searchParams.get('action') === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
    return route.abort();
  });
  await page.goto('./?song=thanh-ca-001');
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.locator('.cc-custom-chord-text').first()).toContainText('G');
  await expect(page.locator('.cc-dot-btn').first()).toBeVisible();
  const plusesAtOccupied = await page.evaluate(() => {
    const chord = document.querySelector('.cc-custom-chord-text');
    if (!chord) return -1;
    const box = chord.getBoundingClientRect();
    return [...document.querySelectorAll('.cc-dot-btn')].filter(btn => {
      const b = btn.getBoundingClientRect();
      return Math.abs((b.left + b.width / 2) - (box.left + box.width / 2)) < 8
        && Math.abs((b.top + b.height / 2) - (box.top + box.height / 2)) < 35;
    }).length;
  });
  expect(plusesAtOccupied).toBe(0);
});

test('lyric chords use Ab spelling when transposing G by one semitone', async ({ page }) => {
  await login(page);
  await page.route('**/api/index.php?route=chord_sets*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'load') return route.fulfill({ json: { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'G' }] } });
    if (url.searchParams.get('action') === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
    return route.abort();
  });
  await page.goto('./?song=thanh-ca-001');
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  await page.evaluate(() => { window.App.transposeBy(1); window.DisplaySettings.renderLyricViewIfActive(); });
  await expect(page.locator('#lyric-view-container .lv-chord').first()).toContainText('Ab');
});

test('program creator can create and delete own program', async ({ page }) => {
  await login(page);
  let programs = [];
  await page.route('**/api/index.php?route=setlists*', route => {
    const req = route.request();
    if (req.method() === 'POST') { programs = [{ id: 901, title: JSON.parse(req.postData() || '{}').title, scheduled_date: '2026-10-03', item_count: 0, created_by: 3, status: 'draft' }]; return route.fulfill({ json: { success: true, id: 901 } }); }
    if (req.method() === 'DELETE') { programs = []; return route.fulfill({ json: { success: true } }); }
    return route.fulfill({ json: { success: true, data: programs } });
  });
  page.on('dialog', d => d.accept());
  await page.goto('./');
  await page.locator('.sidebar-tab[data-tab="setlist"]').click();
  await page.locator('#btn-create-setlist').click();
  await expect(page.locator('#create-setlist-title-input')).toBeVisible();
  await page.locator('#create-setlist-title-input').fill('Chương trình thử nghiệm');
  await page.locator('#btn-confirm-create-setlist').click();
  await expect(page.locator('#setlist-list .song-item')).toContainText('Chương trình thử nghiệm');
  await expect(page.locator('#setlist-list .btn-del')).toBeVisible();
  await page.locator('#setlist-list .btn-del').click();
  await expect(page.locator('#setlist-list .song-item')).toHaveCount(0);
});
