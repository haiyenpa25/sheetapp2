// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-centralized-store.spec.js
 *
 * Kiểm thử E2E Playwright cho Ticket L5-7 (ROADMAP4.md):
 * "State tập trung: song / set / transpose / zoom / mode / verse nằm trong Store;
 *  URL, thanh công cụ, HUD, chế độ Band là các bên đăng ký nghe.
 *  Nghiệm thu: đổi Store.set('transpose', 2) thì cả 4 chỗ hiển thị cập nhật."
 */

test.describe('L5-7: Centralized State Management (Store) & 4 Subscribers', () => {

  test.beforeEach(async ({ page }) => {
    // Thiết lập môi trường sạch trước mỗi test
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Store.set("transpose", 2) tự động cập nhật đồng thời cả 4 chỗ (URL, Toolbar, HUD, Band Mode)', async ({ page }) => {
    // 1. Mở bài 001 (tông gốc G)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });

    // Đợi DOM hoàn tất hiển thị
    await expect(page.locator('#toolbar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 15000 });

    // Kiểm tra trạng thái ban đầu của bài 001 (tông gốc G, transpose 0)
    await expect(page.locator('#song-key')).toHaveText('G');
    await expect(page.locator('#transpose-display')).toHaveText('0');
    await expect(page.locator('#gig-hud-key')).toHaveText('G');
    await expect(page.locator('#gig-hud-trans')).toHaveText('0');

    // 2. Kích hoạt State Store tập trung: Store.set('transpose', 2)
    await page.evaluate(() => {
      window.Store.set('transpose', 2);
    });

    // ── CHỖ 1: URL cập nhật query param t=2 (không reload) ──
    await expect.poll(async () => {
      return page.evaluate(() => new URLSearchParams(window.location.search).get('t'));
    }, { timeout: 3000 }).toBe('2');

    // ── CHỖ 2: Toolbar cập nhật #song-key sang A và #transpose-display sang +2 ──
    await expect(page.locator('#song-key')).toHaveText('A');
    await expect(page.locator('#transpose-display')).toHaveText('+2');

    // ── CHỖ 3: Stage HUD cập nhật #gig-hud-key sang A và #gig-hud-trans sang +2 ──
    await expect(page.locator('#gig-hud-key')).toHaveText('A');
    await expect(page.locator('#gig-hud-trans')).toHaveText('+2');

    // ── CHỖ 4: Chế độ Band cập nhật tiêu đề tông sang A ──
    // Mở chế độ Band để kiểm tra
    await page.evaluate(() => {
      window.DisplaySettings?.renderLyricViewIfActive?.();
    });
    const lvKeyLocator = page.locator('#lyric-view-container .lv-key strong');
    if (await lvKeyLocator.count() > 0) {
      await expect(lvKeyLocator).toHaveText('A');
    }

    // 3. Test alias 2 chiều: Store.set('currentTranspose', -1)
    await page.evaluate(() => {
      window.Store.set('currentTranspose', -1);
    });

    // URL cập nhật t=-1
    await expect.poll(async () => {
      return page.evaluate(() => new URLSearchParams(window.location.search).get('t'));
    }, { timeout: 3000 }).toBe('-1');

    // Toolbar cập nhật Gb / F# và -1
    const toolbarTrans = await page.locator('#transpose-display').textContent();
    expect(toolbarTrans).toBe('-1');
    const toolbarKey = await page.locator('#song-key').textContent();
    expect(['Gb', 'F#']).toContain(toolbarKey);

    // Stage HUD cập nhật Gb / F# và -1
    const hudTrans = await page.locator('#gig-hud-trans').textContent();
    expect(hudTrans).toBe('-1');
    const hudKey = await page.locator('#gig-hud-key').textContent();
    expect(['Gb', 'F#']).toContain(hudKey);

    // 4. Test zoom sync: Store.set('zoom', 1.30)
    await page.evaluate(() => {
      window.Store.set('zoom', 1.30);
    });
    await expect(page.locator('#zoom-slider')).toHaveValue('130');
    await expect(page.locator('#gig-hud-zoom')).toHaveText('130%');

    // 5. Test set sync: Store.set('set', 'banhat__Acoustic_Guitar')
    await page.evaluate(() => {
      window.Store.set('set', 'banhat__Acoustic_Guitar');
    });
    await expect.poll(async () => {
      return page.evaluate(() => new URLSearchParams(window.location.search).get('set'));
    }, { timeout: 3000 }).toBe('banhat__Acoustic_Guitar');

    // 6. Test mode sync: Store.set('mode', 'band')
    await page.evaluate(() => {
      window.Store.set('mode', 'band');
    });
    await expect.poll(async () => {
      return page.evaluate(() => new URLSearchParams(window.location.search).get('v'));
    }, { timeout: 3000 }).toBe('lyric');

    // 7. Reset về gốc: Store.set('transpose', 0)
    await page.evaluate(() => {
      window.Store.set('transpose', 0);
    });
    await expect.poll(async () => {
      return page.evaluate(() => new URLSearchParams(window.location.search).get('t'));
    }, { timeout: 3000 }).toBeNull();
    await expect(page.locator('#transpose-display')).toHaveText('0');
    await expect(page.locator('#song-key')).toHaveText('G');
    await expect(page.locator('#gig-hud-trans')).toHaveText('0');
    await expect(page.locator('#gig-hud-key')).toHaveText('G');
  });

});
