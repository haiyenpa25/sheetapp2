// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/practice-assignments.spec.js
 *
 * Kiểm thử E2E cho Epic 4.1: Giao bài & Tập bè cho ca đoàn
 * 1. Ca Trưởng / Admin giao bài tập cho ca viên @banhat (kèm hạn chót, BPM mục tiêu, bè hát).
 * 2. Ca viên @banhat đăng nhập và mở /learn/ -> nút "Bài tập" xuất hiện kèm badge số lượng.
 * 3. Ca viên bấm nút "Bài tập" -> Modal "Bài Tập Của Tôi" mở ra hiển thị danh sách thẻ bài tập.
 * 4. Ca viên kiểm tra chi tiết: bài hát, bè được phân công, yêu cầu hoàn thành.
 * 5. Ca viên đánh dấu "Đã thuộc" -> Thẻ bài tập lập tức cập nhật sang trạng thái Hoàn thành.
 * 6. Tự động dọn dẹp dữ liệu kiểm thử.
 */

test.describe('Epic 4.1 — Giao bài & Tập bè cho ca đoàn (/learn)', () => {
  let testData = null;

  test.beforeEach(async () => {
    // 1. Tạo bài tập thử nghiệm cho ca viên @banhat
    const out = execSync('C:\\xampp\\php\\php.exe tools/setup_e2e_practice_assignment.php setup banhat').toString().trim();
    testData = JSON.parse(out);
  });

  test.afterEach(async () => {
    // Dọn dẹp sau khi kiểm thử
    if (testData && testData.assignment_id) {
      execSync(`C:\\xampp\\php\\php.exe tools/setup_e2e_practice_assignment.php cleanup ${testData.assignment_id}`);
    }
  });

  test('Ca viên xem danh sách bài tập được giao và đánh dấu hoàn thành', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());

    // 1. Tạo session đăng nhập cho ca viên @banhat
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat banhat').toString().trim();
    await page.context().clearCookies();
    await page.context().addCookies([
      { name: 'PHPSESSID', value: sessionId, url: 'http://localhost/sheetapp2/' },
    ]);

    // 2. Mở Learn Studio (/learn/)
    await page.goto('./learn/', { waitUntil: 'domcontentloaded' });

    // 3. Nút "Bài tập" xuất hiện trên Header
    const assignmentsBtn = page.locator('#btn-learn-assignments');
    await expect(assignmentsBtn).toBeVisible({ timeout: 10000 });

    // 4. Badge số lượng bài tập chưa làm hiển thị
    const countBadge = page.locator('#learn-assignments-count-badge');
    await expect(countBadge).toBeVisible({ timeout: 5000 });
    const countText = await countBadge.innerText();
    expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(1);

    // 5. Bấm nút "Bài tập" để mở Modal
    await assignmentsBtn.click();
    const modal = page.locator('#modal-learn-assignments');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 6. Kiểm tra thẻ bài tập xuất hiện đúng tên và bè
    const card = modal.locator(`.learn-assignment-card[data-id="${testData.assignment_id}"]`);
    await expect(card).toBeVisible({ timeout: 6000 });
    await expect(card).toContainText(testData.title);
    await expect(card).toContainText(`Bè ${testData.voice_part}`);

    // 7. Bấm nút "✓ Đã thuộc" trên thẻ bài tập
    const markDoneBtn = card.locator('button[data-action="mark_done"]');
    await expect(markDoneBtn).toBeVisible();
    await markDoneBtn.scrollIntoViewIfNeeded();
    await markDoneBtn.dispatchEvent('click');

    // 8. Thẻ bài tập chuyển sang trạng thái "Đã thuộc" và nút mark_done biến mất
    const statusBadge = card.locator('.lac-status-badge');
    await expect(statusBadge).toHaveClass(/status-completed/, { timeout: 8000 });
    await expect(statusBadge).toContainText('Đã thuộc', { timeout: 5000 });
    await expect(markDoneBtn).toBeHidden({ timeout: 5000 });

    // 9. Đóng modal qua nút close
    const closeBtn = page.locator('#btn-close-assignments-modal');
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 3000 });
  });
});
