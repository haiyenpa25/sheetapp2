const { test, expect } = require('@playwright/test');
const path = require('path');
for (const classic of [false, true]) {
  for (const width of [1366, 820, 390]) {
    test(`${classic ? 'Classic' : 'Modern'} ${width}: one info toast, icon and text do not overlap`, async ({ page }) => {
      const root = path.resolve(__dirname, '..');
      await page.setViewportSize({ width, height: 844 });
      await page.setContent('<header style="height:80px">Tiêu đề bản nhạc</header><div id="toast-container" class="toast-container"></div>');
      for (const css of ['base.css', 'components.css', ...(classic ? [] : ['library-polish.css'])]) {
        await page.addStyleTag({ path: path.join(root, classic ? 'old/assets/css' : 'assets/css', css) });
      }
      await page.addScriptTag({ path: path.join(root, 'assets/js/core/SafeHtml.js') });
      await page.addScriptTag({ path: path.join(root, classic ? 'old/assets/js/app-ui.js' : 'assets/js/app-ui.js') });
      await page.evaluate(() => {
        for (let i = 0; i < 2; i++) AppUI.showToast('HD (chưa có) · đang hiện TLH — Mô tả bộ hợp âm và bản nhạc đang được chọn', 'info');
      });
      await expect(page.locator('.toast.info')).toHaveCount(1);
      await expect.poll(() => page.locator('.toast').evaluate(toast => {
        const rect = toast.getBoundingClientRect();
        const [icon, text] = [...toast.querySelectorAll('span')].map(span => span.getBoundingClientRect());
        return rect.top >= 80 && icon.right <= text.left + 1 && rect.right <= innerWidth;
      })).toBe(true);
      await page.getByRole('button', { name: 'Đóng thông báo' }).click();
      await expect(page.locator('.toast')).toHaveCount(0);
    });
  }
}
