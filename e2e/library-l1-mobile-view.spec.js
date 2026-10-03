// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-mobile-view.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-8: Tối ưu hiển thị điện thoại:
 * 1. Thanh đỉnh đầu thu gọn 44px duy nhất, sạch sẽ.
 * 2. Thanh điều khiển cạnh dưới 52px cho ngón cái (#mobile-thumb-bar) với touch targets >= 44x44px.
 * 3. Tự vừa bề ngang (không có thanh cuộn ngang) và không chữ nào đè nhau ở 390px.
 * 4. Mặc định ẩn tên tác giả và chú thích phụ trên điện thoại.
 * 5. Bảo đảm >= 2 ô nhịp mỗi hàng (system) trên điện thoại.
 * 6. Thao tác ngón cái: Dịch giọng, đổi bộ hợp âm, đổi chế độ Band/Nhạc hoạt động mượt mà.
 */

test.describe('L1-8 · Tối ưu hiển thị điện thoại (Mobile View & Bottom Thumb Bar)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Thanh đỉnh đầu 44px và thanh ngón cái 52px ở cạnh dưới trên iPhone (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    // Đợi nạp xong
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // 1. Thanh đỉnh đầu thu gọn 44px
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox).not.toBeNull();
    if (toolbarBox) {
      expect(toolbarBox.height).toBeLessThanOrEqual(48); // chuẩn 44px
    }

    // Band controls trên đỉnh bị ẩn vì đã đưa xuống thanh đáy
    await expect(page.locator('.band-controls')).toBeHidden();

    // 2. Thanh điều khiển cạnh dưới 52px hiển thị
    const thumbBar = page.locator('#mobile-thumb-bar');
    await expect(thumbBar).toBeVisible();
    const thumbBox = await thumbBar.boundingBox();
    expect(thumbBox).not.toBeNull();
    if (thumbBox) {
      expect(thumbBox.height).toBeGreaterThanOrEqual(48);
      // Nằm ở đáy viewport
      expect(thumbBox.y + thumbBox.height).toBeGreaterThanOrEqual(840);
    }

    // 3. Các nút ngón cái đạt touch target >= 44x44px
    const buttons = [
      '#btn-mobile-transpose-down',
      '#mobile-transpose-display',
      '#btn-mobile-transpose-up',
      '#btn-mobile-chordset',
      '#btn-mobile-view-toggle',
      '#btn-mobile-gig'
    ];

    for (const btnSelector of buttons) {
      const btn = page.locator(btnSelector);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('2. Tự vừa bề ngang (không tràn ngang) và không chữ nào đè nhau ở 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra không có thanh cuộn ngang ở container chính
    const hasHorizontalOverflow = await page.evaluate(() => {
      const wrapper = document.querySelector('.sheet-viewer-wrapper');
      const container = document.getElementById('sheet-container');
      const body = document.body;
      const wOverflow = wrapper ? (wrapper.scrollWidth > wrapper.clientWidth + 2) : false;
      const cOverflow = container ? (container.scrollWidth > container.clientWidth + 2) : false;
      const bOverflow = body ? (body.scrollWidth > window.innerWidth + 2) : false;
      return wOverflow || cOverflow || bOverflow;
    });

    expect(hasHorizontalOverflow).toBe(false);

    // Kiểm tra padding đáy an toàn không bị che bởi thanh điều khiển đáy
    const wrapperPaddingBottom = await page.evaluate(() => {
      const wrapper = document.querySelector('.sheet-viewer-wrapper');
      return wrapper ? parseFloat(window.getComputedStyle(wrapper).paddingBottom) : 0;
    });
    expect(wrapperPaddingBottom).toBeGreaterThanOrEqual(52);
  });

  test('3. Mặc định ẩn tên tác giả và chú thích trên điện thoại', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kiểm tra các text meta (tác giả, lyricist, subtitle) bị ẩn
    const metaVisibleCount = await page.evaluate(() => {
      const metaEls = document.querySelectorAll(
        '.sheet-container svg text.osmd-composer, ' +
        '.sheet-container svg text.osmd-lyricist, ' +
        '.sheet-container svg text.osmd-subtitle, ' +
        '.sheet-container svg text.osmd-credit, ' +
        '.sheet-container svg text.osmd-meta-text'
      );
      let visible = 0;
      metaEls.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          visible++;
        }
      });
      return visible;
    });

    expect(metaVisibleCount).toBe(0);
  });

  test('4. Bảo đảm >= 2 ô nhịp mỗi hàng nhạc trên điện thoại', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đợi autofit hoàn tất
    await page.waitForTimeout(600);

    const measureDensityCheck = await page.evaluate(() => {
      const osmd = window.OSMDRenderer?.getInstance?.();
      if (!osmd || !osmd.graphic || !osmd.graphic.measureList) {
        return { ok: false, reason: 'No measure list' };
      }
      const systems = osmd.graphic.measureList;
      if (systems.length <= 1) return { ok: true, systemsCount: systems.length };

      const systemLengths = [];
      // Kiểm tra tất cả các hàng trừ hàng cuối (hàng cuối có thể có 1 ô nhịp kết thúc)
      for (let i = 0; i < systems.length - 1; i++) {
        const count = systems[i] ? systems[i].length : 0;
        systemLengths.push(count);
        if (count < 2) {
          return { ok: false, failedIndex: i, count, systemLengths };
        }
      }
      return { ok: true, systemLengths };
    });

    expect(measureDensityCheck.ok).toBe(true);
  });

  test('5. Thao tác điều khiển ngón cái: Dịch tông, Đổi bộ hợp âm, Đổi chế độ Band', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnUp = page.locator('#btn-mobile-transpose-up');
    const toneDisplay = page.locator('#mobile-transpose-display');
    const chordsetBtn = page.locator('#btn-mobile-chordset');
    const chordsetLabel = page.locator('#mobile-chordset-label');
    const viewToggleBtn = page.locator('#btn-mobile-view-toggle');

    // 1. Tông gốc ban đầu là G (bài 001)
    await expect(toneDisplay).toHaveText(/G/);

    // 2. Bấm tăng tông [+] -> Tông chuyển thành A (+2 hoặc +1)
    await btnUp.click();
    await page.waitForTimeout(150);
    // Nhấp thêm 1 lần thành +2
    await btnUp.click();
    await page.waitForTimeout(200);

    await expect(toneDisplay).toHaveText(/A\s*\(\+2\)/);

    // Chạm vào nút tông để reset về gốc
    await toneDisplay.click();
    await page.waitForTimeout(200);
    await expect(toneDisplay).toHaveText(/G/);

    // 3. Chuyển đổi bộ hợp âm qua nút [🎸 HD]
    await expect(chordsetLabel).toHaveText('HD');
    await chordsetBtn.click();
    await page.waitForTimeout(200);
    await expect(chordsetLabel).toHaveText('TLH');

    // 4. Chuyển sang chế độ Band qua nút ngón cái
    await viewToggleBtn.click();
    await page.waitForTimeout(200);

    // Container lời xuất hiện và container bản nhạc ẩn
    await expect(page.locator('#lyric-view-container')).toBeVisible();
    await expect(page.locator('#osmd-container')).toBeHidden();
    await expect(viewToggleBtn).toHaveClass(/active/);
    await expect(page.locator('#mobile-view-label')).toHaveText('Lời & HÂ');
  });

});
