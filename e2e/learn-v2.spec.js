// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tập luyện v2 bước 2: 3 chế độ (Nghe & Đệm / Chơi / Tập bè) chỉ hiện thẻ của chế độ đang chọn,
 * mục "Tùy chỉnh đệm" thu gọn sẵn, và "Tuần này cần tập" lấy bài từ chương trình lễ sắp tới.
 */
async function adminSession(page) {
  const sessionId = require('./helpers/php-session').run(['admin', 'admin']).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);
}

test.describe('Learn v2', () => {
  test('3 chế độ đổi thẻ hiển thị, đệm nâng cao thu gọn, console sạch', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await adminSession(page);
    await page.goto('./learn/?song=thanh-ca-090', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#learn-pattern-card')).toBeVisible({ timeout: 20000 });

    expect(await page.locator('.btn-learn-mode').count()).toBe(3);
    await expect(page.locator('#learn-pattern-advanced')).not.toHaveAttribute('open', '');
    await expect(page.locator('#learn-melody-card')).toBeHidden();
    await expect(page.locator('#learn-satb-card')).toBeHidden();

    await page.click('.btn-learn-mode[data-mode="melody"]');
    await expect(page.locator('#learn-melody-card')).toBeVisible();
    await expect(page.locator('#learn-pattern-card')).toBeHidden();

    await page.click('.btn-learn-mode[data-mode="satb"]');
    await expect(page.locator('#learn-satb-card')).toBeVisible();
    await expect(page.locator('#learn-melody-card')).toBeHidden();

    await page.click('.btn-learn-mode[data-mode="piano"]');
    await expect(page.locator('#learn-pattern-card')).toBeVisible();
    await page.click('#learn-pattern-advanced > summary');
    await expect(page.locator('#learn-pattern-select')).toBeVisible();

    expect(errors.filter((e) => !/access control checks|Load failed/i.test(e))).toEqual([]);
  });

  test('"Tuần này cần tập" hiện bài của chương trình sắp tới và mở được bài', async ({ page }) => {
    await adminSession(page);
    await page.goto('./learn/?song=thanh-ca-090', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#learn-pattern-card')).toBeVisible({ timeout: 20000 });

    // Tạo chương trình sắp tới đã phát hành, có 2 bài (qua API như người dùng thật).
    const songs = await page.evaluate(async () => {
      const api = window.ApiService;
      const d = new Date(Date.now() + 3 * 86400000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const created = await api.setlists.create({ title: 'CN test tuần', scheduled_date: date });
      const id = created.id;
      const list = await api.songs.list();
      const picks = (Array.isArray(list) ? list : list.data || []).slice(0, 2);
      for (const [idx, s] of picks.entries()) {
        await api.setlists.addItem({ setlist_id: id, song_id: s.id, order_index: idx + 1, chord_profile: 'HD', transpose_key: 0 });
      }
      await api.setlists.publish(id);
      return picks.map((s) => s.id);
    });
    expect(songs.length).toBe(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#learn-pattern-card')).toBeVisible({ timeout: 20000 });
    await page.click('#btn-learn-song-picker');
    await expect(page.locator('#learn-week-plan')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.learn-week-song').count()).toBeGreaterThanOrEqual(2);

    await page.locator('.learn-week-song').nth(1).click();
    await expect(page.locator('#learn-song-picker-panel')).toBeHidden();
    await expect(page.locator('#learn-song-label')).not.toHaveText(/Đang tải/, { timeout: 15000 });
  });
});
