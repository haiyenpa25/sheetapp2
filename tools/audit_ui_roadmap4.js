const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, '../artifacts_ui');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'desktop-1440x900', width: 1440, height: 900 },
    { name: 'ipad-landscape-1180x820', width: 1180, height: 820 },
    { name: 'ipad-portrait-820x1180', width: 820, height: 1180 },
    { name: 'mobile-390x844', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    console.log(`\n========================================================`);
    console.log(`🔍 KIỂM TRA ĐỘ PHÂN GIẢI: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================================`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });

    await page.goto('http://localhost/sheetapp2/?song=thanh-ca-001&v=sheet', { waitUntil: 'networkidle' });
    await page.waitForSelector('#osmd-container svg', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Chụp screenshot toàn trang
    const shotPath = path.join(screenshotDir, `${vp.name}-main.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    // Phân tích sâu giao diện
    const res = await page.evaluate((vpInfo) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const issues = [];

      // 1. App Shell Header Nav
      const appNav = document.getElementById('app-nav');
      let appNavHeight = 0;
      if (appNav) {
        const r = appNav.getBoundingClientRect();
        appNavHeight = Math.round(r.height);
      }

      // 2. Toolbar
      const toolbar = document.getElementById('toolbar') || document.querySelector('.unified-toolbar');
      let toolbarHeight = 0;
      let toolbarOverflow = false;
      const offscreenButtons = [];

      if (toolbar) {
        const r = toolbar.getBoundingClientRect();
        toolbarHeight = Math.round(r.height);
        toolbarOverflow = toolbar.scrollWidth > toolbar.clientWidth + 2;

        const allButtons = Array.from(toolbar.querySelectorAll('button, select, a, .icon-btn, .btn, .band-pill'));
        allButtons.forEach(btn => {
          if (btn.offsetParent !== null) {
            const br = btn.getBoundingClientRect();
            if (br.right > w + 2) {
              offscreenButtons.push({
                id: btn.id || btn.className,
                text: btn.textContent.trim().replace(/\s+/g, ' ').substring(0, 20),
                right: Math.round(br.right),
                windowW: w
              });
            }
          }
        });
      }

      // 3. Jump Bar / Section Bar
      const jumpBar = document.getElementById('section-jump-bar-container');
      let jumpBarHeight = 0;
      let jumpBarVisible = false;
      let jumpBarOverlapsMusic = false;

      if (jumpBar && jumpBar.offsetParent !== null && !jumpBar.classList.contains('hidden')) {
        jumpBarVisible = true;
        const jr = jumpBar.getBoundingClientRect();
        jumpBarHeight = Math.round(jr.height);

        const osmdSvg = document.querySelector('#osmd-container svg');
        if (osmdSvg) {
          const sr = osmdSvg.getBoundingClientRect();
          if (jr.bottom > sr.top + 2) {
            jumpBarOverlapsMusic = true;
          }
        }
      }

      // 4. OSMD Sheet Music Area
      const osmd = document.getElementById('osmd-container');
      let musicTop = 0;
      let musicHeight = 0;
      let musicAreaPct = 0;
      if (osmd) {
        const r = osmd.getBoundingClientRect();
        musicTop = Math.round(r.top);
        musicHeight = Math.round(r.height);
        const visibleH = Math.max(0, h - musicTop);
        musicAreaPct = Math.round((r.width * visibleH) / (w * h) * 100);
      }

      // 5. Sidebar
      const sidebar = document.getElementById('sidebar');
      let sidebarVisible = false;
      let sidebarWidth = 0;
      if (sidebar && sidebar.offsetParent !== null && !sidebar.classList.contains('mobile-hidden')) {
        sidebarVisible = true;
        sidebarWidth = Math.round(sidebar.getBoundingClientRect().width);
      }

      // 6. Quét từ "phụng vụ" trong DOM
      const liturgyElements = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
      let el;
      while (el = walker.nextNode()) {
        const title = el.getAttribute('title') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const placeholder = el.getAttribute('placeholder') || '';
        
        if (/phụng\s*vụ/i.test(title)) {
          liturgyElements.push({ tag: el.tagName, id: el.id, attr: 'title', val: title });
        }
        if (/phụng\s*vụ/i.test(ariaLabel)) {
          liturgyElements.push({ tag: el.tagName, id: el.id, attr: 'aria-label', val: ariaLabel });
        }
        if (/phụng\s*vụ/i.test(placeholder)) {
          liturgyElements.push({ tag: el.tagName, id: el.id, attr: 'placeholder', val: placeholder });
        }
      }

      const bodyText = document.body.innerText;
      const textMatches = [];
      const re = /phụng\s*vụ/gi;
      let m;
      while ((m = re.exec(bodyText)) !== null) {
        const s = Math.max(0, m.index - 25);
        const e = Math.min(bodyText.length, m.index + 35);
        textMatches.push(bodyText.substring(s, e).replace(/\n+/g, ' '));
      }

      // 7. Z-Index and Stacking check
      const overlays = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden), .sidebar-overlay:not(.hidden)'));
      const activeOverlays = overlays.map(o => ({ id: o.id, z: window.getComputedStyle(o).zIndex }));

      return {
        appNavHeight,
        toolbarHeight,
        toolbarOverflow,
        offscreenButtons,
        jumpBarVisible,
        jumpBarHeight,
        jumpBarOverlapsMusic,
        musicTop,
        musicAreaPct,
        sidebarVisible,
        sidebarWidth,
        liturgyElements,
        textMatches,
        activeOverlays
      };
    }, vp);

    console.log(`  • App Shell Nav: ${res.appNavHeight}px`);
    console.log(`  • Toolbar Header: ${res.toolbarHeight}px (Tràn ngang: ${res.toolbarOverflow ? 'CÓ ⚠️' : 'Không'})`);
    if (res.offscreenButtons.length > 0) {
      console.log(`  • ⚠️ CÁC NÚT BỊ ĐẨY RA NGOÀI MÀN HÌNH (${res.offscreenButtons.length} nút):`);
      res.offscreenButtons.forEach(b => console.log(`      - [${b.id}] "${b.text}" (right=${b.right}px > w=${b.windowW}px)`));
    }
    console.log(`  • Dải nhảy đoạn Jump Bar: ${res.jumpBarVisible ? `Hiện (${res.jumpBarHeight}px)` : 'Ẩn'}`);
    if (res.jumpBarOverlapsMusic) {
      console.log(`  • ⚠️ CẢNH BÁO: Jump Bar che khuất nốt nhạc đầu tiên!`);
    }
    console.log(`  • Điểm bắt đầu vùng nhạc: Y = ${res.musicTop}px`);
    console.log(`  • Tỷ lệ diện tích nhạc: ${res.musicAreaPct}%`);
    console.log(`  • Sidebar: ${res.sidebarVisible ? `Mở (${res.sidebarWidth}px)` : 'Đóng (Mobile/iPad overlay)'}`);
    if (res.liturgyElements.length > 0) {
      console.log(`  • ⚠️ PHÁT HIỆN TỪ 'PHỤNG VỤ' TRONG THUỘC TÍNH (${res.liturgyElements.length} vị trí):`);
      res.liturgyElements.forEach(item => console.log(`      - <${item.tag} id="${item.id}"> ${item.attr}="${item.val}"`));
    }
    if (res.textMatches.length > 0) {
      console.log(`  • ⚠️ PHÁT HIỆN TỪ 'PHỤNG VỤ' TRONG VĂN BẢN HIỂN THỊ (${res.textMatches.length} vị trí):`);
      res.textMatches.forEach(t => console.log(`      - "...${t}..."`));
    }

    await context.close();
  }

  await browser.close();
})();
