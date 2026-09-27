/**
 * page-nav.js — Điều hướng trang & Lật nửa trang theo hàng nhạc (Ticket L1-9)
 * 
 * Lấy cảm hứng từ forScore:
 * 1. Lật theo hàng nhạc (System-aligned): Tuyệt đối không cắt đôi một hàng nhạc
 * 2. Chế độ lật nửa trang (Half-page turn):
 *    - Nửa trên hiện trước phần tiếp theo, có vạch chia rõ ràng (#half-page-divider)
 *    - Mỗi lần lật cuộn qua khoảng 1/2 số hàng nhạc nhìn thấy
 * 3. Đồng bộ với chế độ Band (Lyric View): căn theo đỉnh khổ thơ (không cắt đôi khổ)
 */
const PageNav = (() => {
  'use strict';

  let totalPages   = 1;
  let currentPage  = 1;
  let pageOffsets  = [];    // Mảng vị trí scrollTop tương ứng mỗi bước lật (px)
  let _systems     = [];    // Mảng tọa độ các hàng nhạc [{ index, top, height, bottom }]
  let _turnMode    = 'half'; // 'half' (lật nửa trang) | 'full' (lật cả trang)
  let _dividerTimer = null;

  let _wrapperEl   = null;
  let _indicatorEl = null;
  let _dividerEl   = null;

  function wrapper() {
    if (!_wrapperEl) _wrapperEl = document.querySelector('.sheet-viewer-wrapper');
    return _wrapperEl;
  }
  
  function indicator() {
    if (!_indicatorEl) _indicatorEl = document.getElementById('page-indicator');
    return _indicatorEl;
  }

  function divider() {
    if (!_dividerEl) _dividerEl = document.getElementById('half-page-divider');
    return _dividerEl;
  }

  /* ===================== PUBLIC API ===================== */

  function init() {
    // Đọc tùy chọn chế độ lật từ localStorage (mặc định 'half' theo L1-9)
    try {
      const savedMode = localStorage.getItem('sheetapp_page_turn_mode');
      if (savedMode === 'full' || savedMode === 'half') {
        _turnMode = savedMode;
      }
    } catch(e) {}

    document.getElementById('btn-page-prev')?.addEventListener('click', goToPrev);
    document.getElementById('btn-page-next')?.addEventListener('click', goToNext);

    // Scroll listener → cập nhật trang hiện tại (Throttled via rAF)
    wrapper()?.addEventListener('scroll', _onScrollThrottled, { passive: true });
  }

  /**
   * Truy xuất danh sách các hàng nhạc (MusicSystems) từ OSMD
   */
  function _getSystemsFromOSMD() {
    const container = document.getElementById('osmd-container');
    if (!container || container.classList.contains('hidden') || container.offsetParent === null) {
      return [];
    }
    const osmd = window.OSMDRenderer?.getInstance?.();
    const g = osmd?.graphic;
    const systems = g?.MusicPages?.[0]?.MusicSystems;
    const wrapEl = wrapper();
    if (!systems || !wrapEl) return [];

    const svg = container.querySelector('svg');
    if (!svg || !svg.viewBox?.baseVal?.height) return [];

    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrapEl.getBoundingClientRect();
    const scale = svgRect.height / svg.viewBox.baseVal.height;
    const svgOffsetInWrap = (svgRect.top - wrapRect.top) + wrapEl.scrollTop;

    return systems.map((sys, idx) => {
      const viewBoxY = sys.PositionAndShape.AbsolutePosition.y * 10;
      const viewBoxH = sys.PositionAndShape.size.height * 10;
      const topPx = (viewBoxY * scale) + svgOffsetInWrap;
      const heightPx = (viewBoxH * scale);
      return {
        index: idx,
        top: Math.round(topPx),
        height: Math.round(heightPx),
        bottom: Math.round(topPx + heightPx)
      };
    });
  }

  /**
   * Truy xuất danh sách các khổ thơ từ Band View (Lyric View)
   */
  function _getSectionsFromLyricView() {
    const wrapEl = wrapper();
    const container = document.getElementById('lyric-view-container');
    if (!wrapEl || !container || container.classList.contains('hidden')) return [];

    const verses = Array.from(container.querySelectorAll('.lv-verse, .lv-chorus'));
    if (!verses.length) return [];

    const wrapRect = wrapEl.getBoundingClientRect();
    return verses.map((v, idx) => {
      const r = v.getBoundingClientRect();
      const topPx = (r.top - wrapRect.top) + wrapEl.scrollTop;
      return {
        index: idx,
        top: Math.round(topPx),
        height: Math.round(r.height),
        bottom: Math.round(topPx + r.height)
      };
    });
  }

  /**
   * Gọi sau khi OSMD hoặc Band View render xong để tính toán các điểm lật trang.
   * Căn chính xác theo hàng nhạc, không bao giờ cắt đôi hàng nhạc.
   */
  function computePages() {
    const wrapEl = wrapper();
    if (!wrapEl) return;

    const viewportH = wrapEl.clientHeight || window.innerHeight;
    const totalH    = wrapEl.scrollHeight;

    // 1. Thử lấy danh sách hàng nhạc từ OSMD
    _systems = _getSystemsFromOSMD();

    // 2. Nếu không có OSMD (hoặc đang mở Band View), thử lấy danh sách khổ thơ
    if (!_systems.length) {
      _systems = _getSectionsFromLyricView();
    }

    pageOffsets = [0];

    // Gom nhóm các hàng/khổ có cùng cao độ top (ví dụ chế độ Band 2 cột)
    const distinctRows = [];
    for (const s of _systems) {
      const prev = distinctRows[distinctRows.length - 1];
      if (!prev || Math.abs(s.top - prev.top) > 30) {
        distinctRows.push(s);
      }
    }
    const workingSystems = distinctRows.length > 0 ? distinctRows : _systems;

    if (workingSystems.length > 0) {
      // Tính chiều cao trung bình mỗi hàng
      const totalSysH = workingSystems.reduce((acc, s) => acc + s.height, 0);
      const avgSysH = totalSysH / workingSystems.length;
      // Số hàng trung bình vừa trong 1 khung nhìn viewport
      const visibleCount = Math.max(1, Math.floor(viewportH / avgSysH));

      // Bước nhảy lật trang:
      // - Chế độ Half-page: cuộn khoảng 1/2 số hàng nhìn thấy (1 hoặc 2 hàng)
      // - Chế độ Full-page: cuộn qua toàn bộ số hàng nhìn thấy (trừ 1 hàng để giữ ngữ cảnh)
      const step = _turnMode === 'half'
        ? Math.max(1, Math.floor(visibleCount / 2))
        : Math.max(1, visibleCount - 1);

      for (let i = step; i < workingSystems.length; i += step) {
        // Căn lề trên chừa padding 12px phía trên hàng nhạc
        const targetTop = Math.max(0, workingSystems[i].top - 12);
        // Không vượt quá scroll tối đa
        const maxScroll = Math.max(0, totalH - viewportH);
        const snappedTop = Math.min(targetTop, maxScroll);

        const last = pageOffsets[pageOffsets.length - 1];
        if (snappedTop - last > 24) {
          pageOffsets.push(snappedTop);
        }
      }

      // Đảm bảo có điểm chạm đáy nếu chưa có
      const maxScroll = Math.max(0, totalH - viewportH);
      if (maxScroll > 0 && maxScroll - pageOffsets[pageOffsets.length - 1] > 36) {
        pageOffsets.push(maxScroll);
      }
    } else {
      // Fallback khi không quét được hệ thống: chia theo 75% chiều cao viewport
      const stepH = _turnMode === 'half' ? viewportH * 0.45 : viewportH * 0.85;
      const count = Math.max(1, Math.ceil(totalH / stepH));
      for (let i = 1; i < count; i++) {
        pageOffsets.push(Math.min(Math.round(i * stepH), Math.max(0, totalH - viewportH)));
      }
    }

    totalPages = Math.max(1, pageOffsets.length);
    // Giữ vị trí trang hiện tại theo scroll thực tế nếu layout reflow
    let closest = 1;
    const curScroll = wrapEl.scrollTop;
    for (let i = 0; i < pageOffsets.length; i++) {
      if (curScroll >= pageOffsets[i] - 30) closest = i + 1;
    }
    currentPage = Math.min(Math.max(1, closest), totalPages);
    _updateIndicator();
  }

  let _isNavigating = false;
  let _navTimer     = null;

  function goToPage(n) {
    const wrapEl = wrapper();
    if (!wrapEl) return;

    // Nếu chưa quét hệ thống hàng nhạc, tự động quét lại ngay
    if (!_systems.length) {
      computePages();
    }

    if (n < 1) n = 1;
    if (n > totalPages) n = totalPages;
    currentPage = n;
    const target = pageOffsets[n - 1] || 0;

    _isNavigating = true;
    clearTimeout(_navTimer);

    // Dứt khoát chuyển ngay đến vị trí mục tiêu chuẩn xác (chuẩn forScore pedal/tap turn)
    wrapEl.scrollTop = target;

    _navTimer = setTimeout(() => {
      _isNavigating = false;
      _updateIndicator();
    }, 250);

    // Hiển thị vạch chia nửa trang khi lật
    _showHalfPageDivider(target);
    _updateIndicator();
  }

  function goToNext() { goToPage(currentPage + 1); }
  function goToPrev() { goToPage(currentPage - 1); }

  function reset() {
    totalPages  = 1;
    currentPage = 1;
    pageOffsets = [];
    _systems    = [];
    _isNavigating = false;
    clearTimeout(_navTimer);
    _hideHalfPageDivider();
    _updateIndicator();
  }

  function getTotalPages()  { return totalPages; }
  function getCurrentPage() { return currentPage; }
  function getTurnMode()    { return _turnMode; }
  function getSystems()     { return _systems; }
  function getPageOffsets() { return pageOffsets; }

  function setTurnMode(mode) {
    if (mode !== 'half' && mode !== 'full') return;
    _turnMode = mode;
    try { localStorage.setItem('sheetapp_page_turn_mode', mode); } catch(e) {}
    computePages();
  }

  function toggleTurnMode() {
    setTurnMode(_turnMode === 'half' ? 'full' : 'half');
  }

  /**
   * Kiểm tra xem ở vị trí scroll hiện tại, có hàng nhạc nào bị cắt đôi ở mép trên không.
   * Hàng nhạc bị cắt nếu: sys.top < scrollTop VÀ sys.bottom > scrollTop + 16px.
   */
  function isAnySystemCutAtTop(customScrollTop = null) {
    const wrapEl = wrapper();
    if (!wrapEl || !_systems.length) return false;
    const scrollTop = customScrollTop !== null ? customScrollTop : wrapEl.scrollTop;

    for (const sys of _systems) {
      // Hàng nhạc bị cắt đôi nếu mép trên cắt sâu vào thân hàng nhạc (> 40px)
      if (sys.top < scrollTop - 12 && sys.bottom > scrollTop + 40) {
        return true;
      }
    }
    return false;
  }

  /* ===================== INTERNAL ===================== */
  let _ticking = false;
  function _onScrollThrottled() {
    if (!_ticking) {
      window.requestAnimationFrame(() => {
        _onScroll();
        _ticking = false;
      });
      _ticking = true;
    }
  }

  function _onScroll() {
    if (_isNavigating) return;
    const wrapEl = wrapper();
    if (!wrapEl || pageOffsets.length === 0) return;
    const scrollTop = wrapEl.scrollTop;

    // Tìm trang gần nhất
    let closest = 1;
    for (let i = 0; i < pageOffsets.length; i++) {
      if (scrollTop >= pageOffsets[i] - 20) closest = i + 1;
    }
    if (closest !== currentPage) {
      currentPage = closest;
      _updateIndicator();
    }
  }

  function _showHalfPageDivider(targetScrollTop) {
    const divEl = divider();
    const wrapEl = wrapper();
    if (!divEl || !wrapEl || _turnMode !== 'half' || totalPages <= 1) {
      _hideHalfPageDivider();
      return;
    }

    clearTimeout(_dividerTimer);

    // Đặt vạch chia ở giữa khung nhìn viewport của trang mới
    const dividerY = targetScrollTop + Math.round(wrapEl.clientHeight * 0.46);
    divEl.style.top = `${dividerY}px`;
    divEl.classList.remove('hidden', 'faded');

    // Mờ dần sau 2.5s và ẩn sau 4s
    _dividerTimer = setTimeout(() => {
      divEl.classList.add('faded');
      _dividerTimer = setTimeout(() => {
        divEl.classList.add('hidden');
      }, 1500);
    }, 2500);
  }

  function _hideHalfPageDivider() {
    clearTimeout(_dividerTimer);
    const divEl = divider();
    if (divEl) divEl.classList.add('hidden');
  }

  function _updateIndicator() {
    const el = indicator();
    if (!el) return;
    if (totalPages <= 1) {
      el.textContent = '';
    } else {
      const modeText = _turnMode === 'half' ? ' · Nửa trang' : '';
      el.textContent = `Trang ${currentPage} / ${totalPages}${modeText}`;
    }
    // Enable/disable prev-next buttons
    const prev = document.getElementById('btn-page-prev');
    const next = document.getElementById('btn-page-next');
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  return {
    init,
    computePages,
    goToPage,
    goToNext,
    goToPrev,
    reset,
    getTotalPages,
    getCurrentPage,
    getTurnMode,
    setTurnMode,
    toggleTurnMode,
    getSystems,
    getPageOffsets,
    isAnySystemCutAtTop
  };
})();

window.PageNav = PageNav;
