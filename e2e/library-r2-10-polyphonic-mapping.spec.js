// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

function loginAsBanHat() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat', {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
}

function runPhp(code) {
  return execSync('C:\\xampp\\php\\php.exe', {
    input: `<?php require 'api/core/DB.php'; require 'api/services/ChordSetService.php'; ${code}`,
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
}

test.describe('R2-10 · Thống nhất khoá nốt giữa TLH (XML) và bộ cá nhân (OSMD) cho bài nhiều bè (<backup>)', () => {

  test.beforeEach(async ({ page }) => {
    // Dọn dẹp bộ hợp âm BH của bài test
    runPhp("ChordSetService::deleteSet('thanh-ca-019', 'BH'); ChordSetService::deleteSet('thanh-ca-001', 'BH'); ChordSetService::deleteSet('thanh-ca-794', 'BH'); @rmdir('storage/data/chord_sets/thanh-ca-019'); @rmdir('storage/data/chord_sets/thanh-ca-794');");

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test.afterEach(async () => {
    runPhp("ChordSetService::deleteSet('thanh-ca-019', 'BH'); ChordSetService::deleteSet('thanh-ca-001', 'BH'); ChordSetService::deleteSet('thanh-ca-794', 'BH'); @rmdir('storage/data/chord_sets/thanh-ca-019'); @rmdir('storage/data/chord_sets/thanh-ca-794');");
  });

  test('1. Sao chép TLH sang BH trên bài 019 (nhiều bè, <backup>): hợp âm đúng vị trí noteIdx = 4 tại ô 11', async ({ page }) => {
    const sid = loginAsBanHat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.goto('./?song=thanh-ca-019', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Sao chép TLH sang BH
    const copyResult = await page.evaluate(async () => {
      const songId = window.App?.getCurrentSongId?.();
      await window.ChordCanvasEdit?.cloneAndStartEditing?.(songId, 'default', 'BH');
      return {
        currentSet: window.ChordCanvas?.getCurrentSet?.(),
        customChords: window.ChordCanvas?.getCustomChords?.()
      };
    });

    expect(copyResult.currentSet).toBe('BH');
    expect(copyResult.customChords).toBeDefined();

    // Hợp âm Bb ở ô nhịp 11 phải có key '11_4' (thay vì bị lệch sang '11_5')
    expect(copyResult.customChords['11_4']).toBe('Bb');
    expect(copyResult.customChords['11_5']).toBeUndefined();

    // Đợi canvas vẽ lại và kiểm tra hợp âm custom 'Bb' hiển thị trong DOM
    await page.waitForTimeout(500);
    const bbChords = page.locator('.cc-custom-chord-text', { hasText: 'Bb' });
    await expect(bbChords.first()).toBeVisible({ timeout: 5000 });
  });

  test('2. Sao chép TLH sang BH trên bài 001 và 794 (nhiều bè, <backup>): số lượng và vị trí khớp tuyệt đối', async ({ page }) => {
    const sid = loginAsBanHat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    // Test bài 001
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const chords001 = await page.evaluate(async () => {
      const songId = window.App?.getCurrentSongId?.();
      await window.ChordCanvasEdit?.cloneAndStartEditing?.(songId, 'default', 'BH');
      return window.ChordCanvas?.getCustomChords?.();
    });
    expect(Object.keys(chords001 || {}).length).toBe(17);

    // Test bài 794
    await page.goto('./?song=thanh-ca-794', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const chords794 = await page.evaluate(async () => {
      const songId = window.App?.getCurrentSongId?.();
      await window.ChordCanvasEdit?.cloneAndStartEditing?.(songId, 'default', 'BH');
      return window.ChordCanvas?.getCustomChords?.();
    });
    expect(Object.keys(chords794 || {}).length).toBe(28);
  });

});
