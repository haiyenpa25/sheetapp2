// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

function loginAsBanHat() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat', {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
}

test.describe('R2-8 · Hiển thị đúng bộ đang soạn, dropdown & chip cập nhật ngay (B8, B10)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Đang soạn BH thì chỉ hiện hợp âm BH (và TLH mờ nếu bật gợi ý) (B8)', async ({ page }) => {
    const sid = loginAsBanHat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Chuyển sang bộ cá nhân BH và bật chế độ soạn
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('BH');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
    });

    // 1. Kiểm tra dropdown selector hiển thị và chọn đúng BH
    const selector = page.locator('#chord-set-selector');
    await expect(selector).toHaveValue('BH', { timeout: 5000 });

    // 2. Khi chưa bật gợi ý TLH: không hiện hợp âm TLH/HD dạng .cc-custom-chord-text hay .cc-tlh-ghost-chord
    const ghostChords = page.locator('.cc-tlh-ghost-chord');
    await expect(ghostChords).toHaveCount(0);

    // 3. Bật gợi ý TLH mờ
    await page.evaluate(() => {
      window.ChordCanvas?.setShowTlhSuggestions?.(true);
    });

    // Các hợp âm gợi ý từ TLH xuất hiện dạng ghost mờ
    await expect(ghostChords.first()).toBeVisible({ timeout: 5000 });
    const ghostCount = await ghostChords.count();
    expect(ghostCount).toBeGreaterThan(0);

    // Kiểm tra style của ghost chord: mờ và pointer-events: none
    const ghostStyle = await ghostChords.first().evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        opacity: parseFloat(s.opacity),
        pointerEvents: s.pointerEvents,
        isCustomChord: el.classList.contains('cc-custom-chord-text')
      };
    });
    expect(ghostStyle.opacity).toBeLessThanOrEqual(0.6);
    expect(ghostStyle.pointerEvents).toBe('none');
    expect(ghostStyle.isCustomChord).toBe(false);

    // 4. Tắt gợi ý TLH mờ: các ghost chords biến mất
    await page.evaluate(() => {
      window.ChordCanvas?.setShowTlhSuggestions?.(false);
    });
    await expect(ghostChords).toHaveCount(0);
  });

  test('2. Dropdown và chip đếm cập nhật ngay lập tức khi thêm/sửa hợp âm (B10)', async ({ page }) => {
    const sid = loginAsBanHat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Chuyển sang bộ BH và bật chế độ soạn
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('BH');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
    });

    const countBadge = page.locator('#chord-set-count');
    const chordChip  = page.locator('#si-chord-set-chip');

    // Thêm hợp âm đầu tiên "G" tại ô 0, nốt 0
    await page.evaluate(async () => {
      await window.ChordCanvasEdit?.saveChord?.(0, 0, 'G', true);
    });

    // Kiểm tra chip đếm cập nhật ngay: không còn "Chưa có", phải chứa "1 hợp âm"
    await expect(countBadge).toContainText('1 hợp âm', { timeout: 3000 });
    await expect(chordChip).toContainText('1');

    // Thêm hợp âm thứ 2 "D" tại ô 1, nốt 0
    await page.evaluate(async () => {
      await window.ChordCanvasEdit?.saveChord?.(1, 0, 'D', true);
    });

    await expect(countBadge).toContainText('2 hợp âm', { timeout: 3000 });
    await expect(chordChip).toContainText('2');

    // Xoá hợp âm tại ô 0, nốt 0: chip đếm giảm ngay lập tức về 1
    await page.evaluate(async () => {
      await window.ChordCanvasEdit?.deleteChord?.(0, 0);
    });

    await expect(countBadge).toContainText('1 hợp âm', { timeout: 3000 });
    await expect(chordChip).toContainText('1');
  });

});
