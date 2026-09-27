// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-offline-sunday.spec.js
 * 
 * Nghiệm thu Ticket L3-9 — "Tải cho Chúa nhật" (Offline Package 1-Click):
 * 1. Nút "Tải cho Chúa nhật" (#btn-sp-offline-dl) tải toàn bộ chương trình về máy.
 * 2. Huy hiệu "✓ Sẵn sàng offline (n/n)" xuất hiện sau khi tải xong.
 * 3. Kiểm tra lại khi mở app (reload trang -> checkOnStartup xác thực gói offline).
 * 4. Chế độ Mất mạng (Offline): Vẫn mở và render bản nhạc thành công từ cache offline.
 */

test.describe('L3-9: Tải cho Chúa nhật (Offline Package 1-Click)', () => {

  test('Tải trọn bộ chương trình, Huy hiệu ✓ Sẵn sàng offline, Mở khi mất mạng', async ({ page }) => {
    // 1. Mở trang chính
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-list', { timeout: 15000 });

    // 2. Mock và hiển thị Service Plan với 1 chương trình Chúa nhật
    await page.evaluate(async () => {
      const mockSetlist = {
        id: 888,
        title: 'Chương Trình Lễ Chúa Nhật',
        name: 'Chương Trình Lễ Chúa Nhật',
        scheduled_date: '2026-10-04',
        status: 'published',
        items: [
          {
            id: 201,
            setlist_id: 888,
            song_id: 'thanh-ca-001',
            title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI',
            xmlPath: 'storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml',
            bpm: 80,
            chord_profile: 'HD',
            transpose_key: 0,
            item_type: 'song'
          }
        ]
      };

      // Mock ApiService.setlists.getOfflinePackage
      if (window.ApiService?.setlists) {
        window.ApiService.setlists.getOfflinePackage = async (id) => {
          return {
            success: true,
            data: {
              setlist: mockSetlist,
              package_version: '1.0',
              total_songs: 1,
              songs: {
                'thanh-ca-001': {
                  id: 'thanh-ca-001',
                  title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI',
                  xmlPath: 'storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml',
                  defaultKey: 'F'
                }
              },
              chord_sets: {
                'thanh-ca-001': {
                  'HD': []
                }
              }
            }
          };
        };
      }

      // Xóa gói cũ nếu có
      window.OfflineSetlistManager?.removePackage?.(888);

      // Ẩn tab Library và chuyển sang tab Setlist Detail
      document.getElementById('tab-content-library')?.classList.add('hidden');
      document.getElementById('tab-content-setlist')?.classList.remove('hidden');
      document.getElementById('setlist-list')?.classList.add('hidden');
      document.getElementById('setlist-detail')?.classList.remove('hidden');

      // Render Service Plan Meta
      if (window.ServicePlanUI) {
        window.ServicePlanUI.renderServicePlanMeta(mockSetlist, {});
      }
    });

    // 3. Kiểm tra nút "Tải cho Chúa nhật"
    const dlBtn = page.locator('#btn-sp-offline-dl');
    await expect(dlBtn).toBeVisible({ timeout: 5000 });
    await expect(dlBtn).toContainText('Tải cho Chúa nhật');

    // 4. Bấm nút "Tải cho Chúa nhật"
    await dlBtn.click();

    // 5. Chờ tải xong và kiểm tra huy hiệu "✓ Sẵn sàng offline"
    const readyBadge = page.locator('.tag-offline-ready');
    await expect(readyBadge).toBeVisible({ timeout: 10000 });
    await expect(readyBadge).toContainText('✓ Sẵn sàng offline (1/1)');

    // Kiểm tra có nút Cập nhật và Xóa
    await expect(page.locator('#btn-sp-offline-sync')).toBeVisible();
    await expect(page.locator('#btn-sp-offline-del')).toBeVisible();

    // 6. Kiểm tra lại khi mở app (Reload trang -> checkOnStartup)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-list', { timeout: 15000 });

    const statusAfterReload = await page.evaluate(async () => {
      // @ts-ignore
      const res = await window.OfflineSetlistManager?.verifyPackage?.(888);
      return res;
    });
    console.log('[L3-9 E2E] Status after startup verification:', statusAfterReload);
    expect(statusAfterReload.isReady).toBe(true);
    expect(statusAfterReload.cachedCount).toBe(1);

    // 7. Thử nghiệm mở bài hát khi Mất Mạng (Offline Mode)
    await page.context().setOffline(true);
    console.log('[L3-9 E2E] Network set to OFFLINE');

    // Mở bài thanh-ca-001 khi offline
    await page.evaluate(async () => {
      const offlineSong = window.OfflineSetlistManager?.getOfflineSong?.('thanh-ca-001');
      if (offlineSong && window.SongLoader) {
        await window.SongLoader.load(offlineSong);
      }
    });

    // Bản nhạc OSMD vẫn render thành công từ cache offline
    await page.waitForSelector('#osmd-container svg', { timeout: 15000 });
    const isSvgVisible = await page.locator('#osmd-container svg').isVisible();
    expect(isSvgVisible).toBe(true);
    console.log('[L3-9 E2E] Offline render successful!');

    // Khôi phục online
    await page.context().setOffline(false);
  });

});
