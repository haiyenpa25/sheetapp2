// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-drums-lens.spec.js
 *
 * Nghiệm thu Ticket L4-5 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Trống: bản đồ bài + BPM + đếm ô nhịp + đèn nhịp; không nốt, không hợp âm.
 * 2. Đổi sang vai trò Trống (icon 🥁) -> Hiển thị sân khấu Trống #drums-stage-container.
 * 3. Ẩn toàn bộ nốt nhạc (#osmd-container), ẩn hợp âm (#chord-canvas), ẩn lời (#lyric-view-container).
 * 4. Hiển thị số BPM cực lớn, các nút tăng/giảm BPM, nút TAP Tempo.
 * 5. Hiển thị hàng đèn nhịp LED (#drums-led-container) nhấp nháy trực quan.
 * 6. Hiển thị bộ đếm ô nhịp (#drums-current-measure) và các nút điều hướng ô nhịp.
 * 7. Hiển thị bản đồ bài hát (#drums-sections-list) với các thẻ phân đoạn Dạo, Lời, Điệp khúc.
 * 8. Bảo toàn qua reload và thoát chế độ phục hồi bản nhạc bình thường.
 */

test.describe('L4-5: Drums Stage Lens (Bản đồ bài, BPM, đếm ô nhịp, đèn nhịp)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Drums Lens: Sân khấu trống, BPM to, đèn nhịp, đếm ô, bản đồ bài, không nốt & hợp âm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đợi nạp bản nhạc ban đầu
    const osmdContainer = page.locator('#osmd-container');
    await expect(osmdContainer).toBeVisible({ timeout: 25000 });

    // 1. Mở modal chọn vai trò và chọn Trống (Drums)
    // Ticket R4-1 (ROADMAP5): #btn-instrument-role trên toolbar bị ẩn vĩnh viễn
    // (.toolbar-secondary-controls { display:none !important }, không điều kiện) --
    // "Góc nhìn nhạc cụ" chuyển hẳn vào menu Công cụ (⋯) → Hiển thị.
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-menu-instrument-role').click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const drumsCard = page.locator('.stage-lens-role-card[data-role="drums"]');
    await drumsCard.click();
    await expect(modal).toBeHidden();

    // 2. Kiểm tra vai trò Trống đã kích hoạt trên Toolbar
    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');
    await expect(roleIcon).toHaveText('🥁');
    await expect(roleLabel).toHaveText('Trống');

    const bodyLens = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLens).toBe('drums');

    // 3. Kiểm tra ẩn nốt nhạc & ẩn hợp âm & ẩn lời
    await expect(osmdContainer).toBeHidden();
    const chordCanvas = page.locator('#chord-canvas');
    if (await chordCanvas.count() > 0) {
      await expect(chordCanvas).toBeHidden();
    }
    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeHidden();

    // 4. Kiểm tra hiển thị sân khấu Trống #drums-stage-container
    const drumsStage = page.locator('#drums-stage-container');
    await expect(drumsStage).toBeVisible({ timeout: 5000 });
    await expect(drumsStage).not.toHaveClass(/hidden/);

    // 5. Kiểm tra BPM cực lớn & các nút tăng giảm
    const bpmVal = page.locator('#drums-bpm-val');
    await expect(bpmVal).toBeVisible();
    const origBpmStr = await bpmVal.textContent();
    const origBpm = parseInt(origBpmStr || '80', 10);

    const btnInc = page.locator('.btn-drums-bpm[data-delta="+1"]');
    await btnInc.click();
    await expect(bpmVal).toHaveText(String(origBpm + 1));

    const btnDec = page.locator('.btn-drums-bpm[data-delta="-1"]');
    await btnDec.click();
    await expect(bpmVal).toHaveText(String(origBpm));

    // 6. Kiểm tra đèn nhịp LED (#drums-led-container)
    const ledContainer = page.locator('#drums-led-container');
    await expect(ledContainer).toBeVisible();
    const ledDots = ledContainer.locator('.drums-led-dot');
    const dotCount = await ledDots.count();
    expect(dotCount).toBeGreaterThanOrEqual(3);

    // 7. Kiểm tra bộ đếm ô nhịp (Measure Counter)
    const curMeasureEl = page.locator('#drums-current-measure');
    await expect(curMeasureEl).toBeVisible();
    await expect(curMeasureEl).toHaveText('1');

    const btnNextMeasure = page.locator('#btn-drums-next-measure');
    await btnNextMeasure.click();
    await expect(curMeasureEl).toHaveText('2');

    const btnPrevMeasure = page.locator('#btn-drums-prev-measure');
    await btnPrevMeasure.click();
    await expect(curMeasureEl).toHaveText('1');

    // 8. Kiểm tra bản đồ bài hát (Song Roadmap)
    const roadmapList = page.locator('#drums-sections-list');
    await expect(roadmapList).toBeVisible();
    const sectionChips = roadmapList.locator('.drums-section-chip');
    const chipCount = await sectionChips.count();
    expect(chipCount).toBeGreaterThanOrEqual(4);

    // Nhấp vào thẻ phân đoạn để nhảy
    const secondChip = sectionChips.nth(1);
    await secondChip.click();
    await expect(secondChip).toHaveClass(/active/);
    const measureAfterJump = await curMeasureEl.textContent();
    expect(parseInt(measureAfterJump || '1', 10)).toBeGreaterThan(1);

    // 9. Reload trang -> Vai trò Trống và Sân khấu Trống vẫn bảo tồn
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#drums-stage-container', { timeout: 20000 });

    const roleIconReload = page.locator('#instrument-role-icon');
    await expect(roleIconReload).toHaveText('🥁');
    await expect(page.locator('#drums-stage-container')).toBeVisible();
    await expect(page.locator('#osmd-container')).toBeHidden();

    // 10. Thoát chế độ Trống qua nút Đóng -> Phục hồi bản nhạc bình thường
    const btnExit = page.locator('#btn-drums-exit');
    await btnExit.click();
    await expect(page.locator('#drums-stage-container')).toBeHidden();
    await expect(page.locator('#osmd-container')).toBeVisible({ timeout: 10000 });

    console.log('[L4-5 E2E] Drums Lens verification successful: Zero notes/chords, big BPM, LED flasher, measure counter & roadmap verified!');
  });

});
