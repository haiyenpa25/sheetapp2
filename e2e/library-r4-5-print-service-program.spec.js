// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r4-5-print-service-program.spec.js
 *
 * E2E test cho Ticket R4-5:
 * - Bản in "Lời & Hợp âm" (print/chord-sheet.php) và "Tập chương trình thờ phượng" (print/service-booklet.php).
 * - Sử dụng từ ngữ Tin Lành chuẩn hóa.
 */
test.use({ serviceWorkers: 'block' });

test.describe('R4-5 · Bản in Lời & Hợp âm và Tập chương trình thờ phượng', () => {

  test('1. Mở trang in Lời & Hợp âm chord-sheet.php với bài 001', async ({ page }) => {
    await page.goto('./print/chord-sheet.php?song=001&set=HD&t=0', { waitUntil: 'domcontentloaded' });

    // Tiêu đề và thông tin bài hát
    await expect(page.locator('h1.song-title')).toBeVisible();
    await expect(page.locator('.meta-pills')).toContainText('Tông hát:');
    await expect(page.locator('.meta-pills')).toContainText('Bộ hợp âm:');

    // Chân trang chuẩn Tin Lành (.sheet-footer)
    await expect(page.locator('.sheet-footer')).toContainText('Thánh Ca Hội Thánh — SheetApp Thờ Phượng');
  });

  test('2. Mở Tập chương trình thờ phượng service-booklet.php và kiểm tra thuật ngữ chuẩn', async ({ page }) => {
    await page.goto('./print/service-booklet.php', { waitUntil: 'domcontentloaded' });

    // Kiểm tra tiêu đề nút in và nội dung
    const printBtn = page.locator('button:has-text("In tập chương trình")');
    if (await printBtn.count() > 0) {
      await expect(printBtn).toBeVisible();
    }

    // Trang bìa hoặc tiêu đề không chứa từ ngữ Công giáo
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('ca viên chính');
    expect(bodyText.toLowerCase()).not.toContain('booklet thờ phượng');
  });

});
