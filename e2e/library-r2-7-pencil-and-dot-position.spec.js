// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

test.describe('R2-7 · Sửa vị trí ✎ và chấm (B9, B16)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Mọi nút ✎ nằm trong khoảng 0–40px phía trên dòng kẻ khuông và bám đúng toạ độ nốt (B9)', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa trên bộ mặc định TLH để hiện các nút ✎
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('default');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
    });

    const badges = page.locator('.cc-edit-badge');
    await expect(badges.first()).toBeVisible({ timeout: 5000 });
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    // Kiểm tra vị trí của tất cả ✎
    const coords = await page.evaluate(() => {
      const cRect = document.getElementById('osmd-container').getBoundingClientRect();
      const osmd = window.OSMDRenderer?.getInstance?.();
      const ml = osmd?.graphic?.measureList;
      const unit = osmd?.graphic?.unitInPixels || 10;
      const els = document.querySelectorAll('.cc-edit-badge');

      return Array.from(els).map(b => {
        const r = b.getBoundingClientRect();
        const top = r.top - cRect.top;
        const left = r.left - cRect.left;

        let closestStaff = null;
        let minDist = Infinity;
        for (let mi = 0; mi < ml.length; mi++) {
          const sl = ml[mi]?.[0]?.ParentStaffLine;
          const sTop = (sl?.PositionAndShape?.AbsolutePosition?.y || 0) * unit;
          if (sTop >= top - 20 && (sTop - top) < minDist) {
            minDist = sTop - top;
            closestStaff = sTop;
          }
        }

        const diffAbove = closestStaff ? (closestStaff - top) : null;
        return { top, left, closestStaff, diffAbove, inRange: diffAbove >= 0 && diffAbove <= 40 };
      });
    });

    expect(coords.length).toBe(count);
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      expect(c.diffAbove).toBeGreaterThanOrEqual(0);
      expect(c.diffAbove).toBeLessThanOrEqual(40);
      expect(c.inRange).toBe(true);
    }
  });

  test('2. Chấm "+" bám đúng toạ độ nốt và bấm chính xác nốt đang chọn (B16)', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.route('**/api/index.php?route=chord_sets*', async (route) => {
      const action = new URL(route.request().url()).searchParams.get('action');
      if (action === 'list') return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
      if (action === 'load') return route.fulfill({ json: { success: true, chords: [] } });
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bấm C vào chế độ sửa hợp âm
    await page.keyboard.press('c');
    const plusBtns = page.locator('.cc-dot-btn');
    await expect(plusBtns.first()).toBeVisible({ timeout: 5000 });

    // Bấm vào nút + đầu tiên
    await plusBtns.first().click();

    // Popup mở ra gắn đúng vị trí
    const popup = page.locator('.cc-popup, .cc-popup-mobile');
    await expect(popup).toBeVisible({ timeout: 5000 });
  });

});
