// @ts-check
const { test, expect, devices } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost:8922/sheetapp2/';

test.describe('M4-1 · Viewport viewport-fit=cover & safe-area-inset trên iPhone 13 WebKit', () => {
  test('M4-1 viewport-fit=cover on both UIs and safe-area-inset CSS rules', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-1 nghiệm thu trên iPhone 13 WebKit');
    test.setTimeout(40000);

    const context = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    // 1. Modern UI
    await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const modernCheck = await page.evaluate(() => {
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const sheets = Array.from(document.styleSheets);
      let hasSafeAreaToolbar = false;
      let hasSafeAreaBottom = false;
      for (const s of sheets) {
        try {
          for (const r of Array.from(s.cssRules || [])) {
            const txt = r.cssText || '';
            if (txt.includes('safe-area-inset') && (txt.includes('unified-toolbar') || txt.includes('.toolbar'))) {
              hasSafeAreaToolbar = true;
            }
            if (txt.includes('safe-area-inset') && (txt.includes('mobile-thumb-bar') || txt.includes('gig-floating-hud'))) {
              hasSafeAreaBottom = true;
            }
          }
        } catch (_) {}
      }
      const bar = document.getElementById('mobile-thumb-bar')?.getBoundingClientRect();
      return {
        vp,
        hasViewportFitCover: vp.includes('viewport-fit=cover'),
        hasSafeAreaToolbar,
        hasSafeAreaBottom,
        barVisible: Boolean(bar && bar.height >= 44 && bar.bottom <= window.innerHeight + 1),
      };
    });

    expect(modernCheck.hasViewportFitCover).toBe(true);
    expect(modernCheck.hasSafeAreaToolbar).toBe(true);
    expect(modernCheck.hasSafeAreaBottom).toBe(true);
    expect(modernCheck.barVisible).toBe(true);

    await page.screenshot({
      path: path.resolve(__dirname, '../docs/mobile-evidence/M4-1-iphone13-safe-area.png'),
      fullPage: false,
    });

    // 2. Classic UI
    await page.goto(BASE_URL + 'old/?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const classicCheck = await page.evaluate(() => {
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const sheets = Array.from(document.styleSheets);
      let hasSafeAreaClassic = false;
      for (const s of sheets) {
        try {
          for (const r of Array.from(s.cssRules || [])) {
            const txt = r.cssText || '';
            if (txt.includes('safe-area-inset') && (txt.includes('.toolbar') || txt.includes('.page-bar'))) {
              hasSafeAreaClassic = true;
            }
          }
        } catch (_) {}
      }
      return {
        vp,
        hasViewportFitCover: vp.includes('viewport-fit=cover'),
        hasSafeAreaClassic,
      };
    });

    expect(classicCheck.hasViewportFitCover).toBe(true);
    expect(classicCheck.hasSafeAreaClassic).toBe(true);

    await context.close();
  });
});

test.describe('M4-2a · Modern Lớp 1 điện thoại: thanh dưới đủ 6 ô ≥ 44×44 + sheet chọn bộ hợp âm', () => {
  test('M4-2a 390 bottom bar 6 controls >=44x44 and chordset sheet selects non-HD/TLH set', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-2a nghiệm thu trên 390 (iPhone 13 WebKit)');
    test.setTimeout(40000);

    const context = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    // Giả lập API danh sách bộ hợp âm có thêm bộ NAM ngoài HD và default
    await page.route('**/*route=chord_sets*action=list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sets: ['HD', 'default', 'NAM'] }),
      });
    });
    await page.route('**/*route=chord_sets*action=load*set=NAM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, chords: { '0_0': 'C', '1_0': 'G7' } }),
      });
    });

    await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const barCheck = await page.evaluate(() => {
      const ids = [
        'btn-mobile-transpose-down',
        'mobile-transpose-display',
        'btn-mobile-transpose-up',
        'btn-mobile-chordset',
        'btn-mobile-view-toggle',
        'btn-mobile-prev-song',
        'btn-mobile-next-song',
        'btn-mobile-gig',
      ];
      const rects = ids.map(id => {
        const el = document.getElementById(id);
        if (!el) return { id, missing: true, w: 0, h: 0, left: -1, right: 9999 };
        const r = el.getBoundingClientRect();
        return { id, missing: false, w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
      });
      return {
        allExist: rects.every(r => !r.missing),
        allAtLeast44: rects.every(r => r.w >= 44 && r.h >= 44),
        outside: rects.filter(r => r.left < 0 || r.right > window.innerWidth + 1),
        rects,
      };
    });

    expect(barCheck.allExist).toBe(true);
    expect(barCheck.allAtLeast44).toBe(true);
    expect(barCheck.outside).toEqual([]);

    // Chạm nút Bộ hợp âm -> mở sheet chọn bộ hợp âm
    await page.locator('#btn-mobile-chordset').click();
    await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').waitFor({ state: 'visible', timeout: 5000 });

    const optRect = await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').boundingBox();
    expect(optRect && optRect.height >= 44).toBe(true);

    await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').click();
    await page.waitForTimeout(250);

    const activeSet = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(activeSet).toBe('NAM');

    await context.close();
  });
});


test.describe('M4-2c · Modern Lớp 1 tablet: một hàng điều khiển, select bộ hợp âm ≥ 160px, zoom − % + ngoài menu, mọi điều khiển ≥ 44px', () => {
  test('M4-2c 768 & 1024 zero Layer-1 controls < 44px, chord-set >= 160px, zoom outside menu, no text cut', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-2c nghiệm thu trên iPad Mini WebKit (768 và 1024)');
    test.setTimeout(50000);

    for (const vp of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      const context = await browser.newContext({
        ...devices['iPad Mini'],
        viewport: vp,
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });

      await page.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

      const audit = await page.evaluate(() => {
        const tb = document.getElementById('toolbar');
        const controlsRow = document.getElementById('toolbar-controls');
        const csEl = document.getElementById('chord-set-selector');
        const zoomOut = document.getElementById('btn-zoom-out');
        const zoomSelect = document.getElementById('zoom-slider');
        const zoomIn = document.getElementById('btn-zoom-in');

        const isVis = (el) => {
          if (!el) return false;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
          if (el.closest('.hidden') || el.closest('.d-none')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };

        const csRect = csEl && isVis(csEl) ? csEl.getBoundingClientRect() : null;
        const zoomOutsideVisible = isVis(zoomOut) && isVis(zoomSelect) && isVis(zoomIn);

        const visibleControls = Array.from(tb.querySelectorAll('button, select, #transpose-display')).filter(isVis);
        const under44 = [];
        const clipped = [];
        const outside = [];

        for (const el of visibleControls) {
          const r = el.getBoundingClientRect();
          const w = Math.round(r.width);
          const h = Math.round(r.height);
          const id = el.id || el.className;
          if (w < 44 || h < 44) under44.push({ id, w, h });
          if (el.scrollWidth > el.clientWidth + 1) clipped.push({ id, sw: el.scrollWidth, cw: el.clientWidth });
          if (r.left < -1 || r.right > window.innerWidth + 1) outside.push({ id, left: Math.round(r.left), right: Math.round(r.right) });
        }

        const rowPills = Array.from(controlsRow ? controlsRow.children : []).filter(isVis);
        const rowTops = rowPills.map(el => Math.round(el.getBoundingClientRect().top));
        const singleBandRow = rowTops.length > 0 && (Math.max(...rowTops) - Math.min(...rowTops) <= 8);

        return {
          vp: window.innerWidth,
          chordSetWidth: csRect ? Math.round(csRect.width) : 0,
          chordSetHeight: csRect ? Math.round(csRect.height) : 0,
          zoomOutsideVisible,
          singleBandRow,
          under44,
          clipped,
          outside,
          totalControls: visibleControls.length,
        };
      });

      expect(audit.chordSetWidth, `width=${vp.width} chord-set-selector >= 160px`).toBeGreaterThanOrEqual(160);
      expect(audit.chordSetHeight, `width=${vp.width} chord-set-selector >= 44px`).toBeGreaterThanOrEqual(44);
      expect(audit.zoomOutsideVisible, `width=${vp.width} zoom - % + visible outside menu`).toBe(true);
      expect(audit.singleBandRow, `width=${vp.width} band controls on a single row`).toBe(true);
      expect(audit.under44, `width=${vp.width} 0 Layer-1 controls < 44px`).toEqual([]);
      expect(audit.clipped, `width=${vp.width} no text clipped`).toEqual([]);
      expect(audit.outside, `width=${vp.width} no control outside viewport`).toEqual([]);

      await context.close();
    }
  });
});

test.describe('M4-3 · Modern: gỡ nút trùng theo bảng phân bổ (không hành động nào > 2 nút cùng hiện)', () => {
  test('M4-3 action duplicate count <= 2 across 390, 768, 1366 (sheet & lyrics, menu open)', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-3 nghiệm thu trên WebKit');
    test.setTimeout(60000);

    for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({
        viewport: vp,
        isMobile: vp.width < 1100,
        hasTouch: vp.width < 1100,
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });

      await page.goto(BASE_URL + '?song=thanh-ca-001&v=lyrics', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(400);

      // Mở thử thanh chương trình và menu ⋯ để kiểm tra mức hiển thị tối đa trên cùng một màn hình
      await page.evaluate(() => {
        const spBar = document.getElementById('setlist-program-bar');
        if (spBar) spBar.classList.remove('hidden');
        const lcBar = document.getElementById('lc-setlist-nav');
        if (lcBar) lcBar.classList.remove('hidden');
      });
      await page.locator('#btn-more-options').click();
      await page.waitForTimeout(200);

      const counts = await page.evaluate(() => {
        const isVis = (el) => {
          if (!el) return false;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
          if (el.closest('.hidden') || el.closest('.d-none')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const groups = {
          prev_song: ['#btn-prev-song', '#btn-mobile-prev-song', '#btn-sp-prev', '#btn-gig-sp-prev', '#btn-lc-prev'],
          next_song: ['#btn-next-song', '#btn-mobile-next-song', '#btn-sp-next', '#btn-gig-sp-next', '#btn-lc-next'],
          zoom_out: ['#btn-zoom-out', '#btn-menu-zoom-out', '#btn-gig-zoom-out'],
          zoom_in: ['#btn-zoom-in', '#btn-menu-zoom-in', '#btn-gig-zoom-in'],
          lock_zoom: ['#btn-lock-zoom', '#btn-menu-lock-zoom', '#btn-gig-lock-zoom'],
          view_toggle: ['#view-switch', '#btn-band-toggle', '#btn-mobile-view-toggle', '#btn-gig-view-toggle'],
          chord_edit: ['#btn-add-chord-mode-bar', '#btn-mobile-edit', '#btn-menu-add-chord-mode', '#btn-menu-chord-edit', '#btn-section-edit', '.lv-edit-chordpro-btn', '.lv-edit-btn'],
          auth_login: ['#btn-auth', '#shell-btn-login', '#btn-toolbar-auth', '#btn-menu-auth'],
          transpose_reset: ['#transpose-display', '#mobile-transpose-display', '#btn-transpose-reset', '#btn-menu-transpose-reset', '#btn-gig-trans-reset'],
        };
        const over2 = [];
        for (const [action, selectors] of Object.entries(groups)) {
          const matched = [];
          for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
              if (isVis(el)) matched.push(el.id || sel);
            }
          }
          if (matched.length > 2) {
            over2.push({ action, count: matched.length, matched });
          }
        }
        return { vp: window.innerWidth, over2 };
      });

      expect(counts.over2, `vp=${vp.width} no action should have > 2 visible buttons`).toEqual([]);
      await context.close();
    }
  });
});

test.describe('M4-4 · Modern menu ⋯: 4 nhóm có tiêu đề, mọi mục có chữ, Đổi giao diện & Đăng nhập ở nhóm cuối cố định', () => {
  test('M4-4 390 menu <= 2 scroll screens, all items have text & accessible name, sticky footer has old-ui & login', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-4 nghiệm thu trên 390 (iPhone 13 WebKit)');
    test.setTimeout(40000);

    const context = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    await page.locator('#btn-more-options').click();
    await page.locator('#main-dropdown-menu').waitFor({ state: 'visible', timeout: 5000 });

    const menuAudit = await page.evaluate(() => {
      const menu = document.getElementById('main-dropdown-menu');
      const isVis = (el) => {
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        if (el.closest('.hidden') || el.closest('.d-none')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const compactText = document.querySelector('#btn-compact-mode .btn-text');
      const compactTextVisible = isVis(compactText);

      const footer = menu.querySelector('.menu-sticky-footer');
      const footerSticky = footer ? getComputedStyle(footer).position === 'sticky' : false;
      const hasOldUiInFooter = !!(footer && footer.querySelector('#btn-menu-old-ui'));
      const hasLoginInFooter = !!(footer && footer.querySelector('#btn-menu-login'));

      const visibleHeaders = Array.from(menu.querySelectorAll('.menu-section-header')).filter(isVis).map(h => h.textContent.trim());

      const items = Array.from(menu.querySelectorAll('button, a, select')).filter(isVis);
      const nameless = [];
      for (const el of items) {
        const name = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
        if (!name) nameless.push(el.id || el.className);
      }

      return {
        scrollHeight: menu.scrollHeight,
        clientHeight: menu.clientHeight,
        ratio: menu.scrollHeight / Math.max(1, menu.clientHeight),
        compactTextVisible,
        footerSticky,
        hasOldUiInFooter,
        hasLoginInFooter,
        visibleHeaders,
        nameless,
      };
    });

    expect(menuAudit.compactTextVisible).toBe(true);
    expect(menuAudit.footerSticky).toBe(true);
    expect(menuAudit.hasOldUiInFooter).toBe(true);
    expect(menuAudit.hasLoginInFooter).toBe(true);
    expect(menuAudit.visibleHeaders.length).toBe(4);
    expect(menuAudit.nameless).toEqual([]);
    expect(menuAudit.ratio).toBeLessThanOrEqual(2);

    await context.close();
  });
});

test.describe('M4-5 · Ẩn hẳn mục không đủ quyền (U6) cho khách và viewer; banhat vẫn thấy', () => {
  test('M4-5 guest and viewer do not see U6 items; banhat sees them', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-5 nghiệm thu trên WebKit');
    test.setTimeout(60000);

    const checkRoleVisibility = async (authPayload) => {
      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });

      await page.route('**/*route=auth*action=me*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(authPayload),
        });
      });

      await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#osmd-container svg, .lv-verse').first().waitFor({ state: 'attached', timeout: 15000 });
      await page.evaluate(() => document.getElementById('btn-band-toggle')?.click());
      await page.locator('.lv-verse').first().waitFor({ state: 'attached', timeout: 5000 });

      // Mở sidebar (nếu đang đóng) và chuyển sang tab Chương trình
      await page.evaluate(() => {
        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('mobile-hidden')) {
          document.getElementById('btn-open-sidebar')?.click();
        }
        document.querySelector('.sidebar-tab[data-tab="setlist"]')?.click();
      });
      await page.waitForTimeout(200);

      // Mở menu ⋯
      await page.locator('#btn-more-options').click();
      await page.waitForTimeout(150);

      const res = await page.evaluate(() => {
        const isVis = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
          if (el.closest('.hidden') || el.closest('.d-none')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        return {
          createSetlist: isVis('#btn-create-setlist'),
          newChordSet: isVis('#btn-new-chord-set'),
          chordProEdit: isVis('.lv-edit-chordpro-btn'),
          menuEditor: isVis('#btn-toolbar-editor'),
          menuSession: isVis('#btn-menu-session-panel'),
          menuCreateSet: isVis('#btn-menu-create-chordset'),
          menuAddChord: isVis('#btn-menu-add-chord-mode'),
          menuManager: isVis('#main-dropdown-menu a[href$="manager/"]'),
          menuMembers: isVis('#main-dropdown-menu a[data-target="/manager/#tab-users"]'),
        };
      });

      await context.close();
      return res;
    };

    const guestRes = await checkRoleVisibility({ loggedIn: false });
    expect(guestRes).toEqual({
      createSetlist: false,
      newChordSet: false,
      chordProEdit: false,
      menuEditor: false,
      menuSession: false,
      menuCreateSet: false,
      menuAddChord: false,
      menuManager: false,
      menuMembers: false,
    });

    const viewerRes = await checkRoleVisibility({ loggedIn: true, user_id: 9, username: 'viewer1', role: 'viewer', chord_code: '' });
    expect(viewerRes).toEqual({
      createSetlist: false,
      newChordSet: false,
      chordProEdit: false,
      menuEditor: false,
      menuSession: false,
      menuCreateSet: false,
      menuAddChord: false,
      menuManager: false,
      menuMembers: false,
    });

    const banhatRes = await checkRoleVisibility({ loggedIn: true, user_id: 5, username: 'banhat1', role: 'banhat', chord_code: 'BH' });
    expect(banhatRes.createSetlist).toBe(true);
    expect(banhatRes.chordProEdit).toBe(true);
    expect(banhatRes.menuEditor).toBe(true);
    expect(banhatRes.menuSession).toBe(true);
    expect(banhatRes.menuCreateSet).toBe(true);
    expect(banhatRes.menuAddChord).toBe(true);
    expect(banhatRes.menuManager).toBe(true);
    expect(banhatRes.menuMembers).toBe(true);
  });
});
