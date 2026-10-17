/**
 * page-nav.js — Điều hướng trang trong chế độ scroll liên tục
 *
 * Trong OSMD pageFormat='Endless', tất cả nốt nhạc nằm trên 1 SVG dài.
 * Module này scan các thẻ <svg> hoặc hệ thống con để ước lượng vị trí trang
 * và cho phép "lật trang" bằng cách scroll đến đúng vị trí.
 *
 * Cũng hiện số trang hiện tại dựa trên scroll position.
 */
const PageNav = (() => {
  'use strict';

  let totalPages   = 1;
  let currentPage  = 1;
  let pageOffsets  = [];    // Mảng vị trí scrollTop tương ứng mỗi trang (px)

  let _wrapperEl   = null;
  let _indicatorEl = null;

  function wrapper() {
    if (!_wrapperEl) _wrapperEl = document.querySelector('.sheet-viewer-wrapper');
    return _wrapperEl;
  }
  
  function indicator() {
    if (!_indicatorEl) _indicatorEl = document.getElementById('page-indicator');
    return _indicatorEl;
  }

  /* ===================== PUBLIC API ===================== */

  function init() {
    document.getElementById('btn-page-prev')?.addEventListener('click', goToPrev);
    document.getElementById('btn-page-next')?.addEventListener('click', goToNext);

    // Scroll listener → cập nhật trang hiện tại (Throttled via rAF)
    wrapper()?.addEventListener('scroll', _onScrollThrottled, { passive: true });
  }

  /**
   * Gọi sau khi OSMD render xong để tính toán số trang.
   * OSMD Endless mode → 1 SVG dài, dùng chiều cao viewport để ước trang.
   */
  function computePages() {
    const wrapEl = wrapper();
    if (!wrapEl) return;

    const viewportH = wrapEl.clientHeight;
    const totalH    = wrapEl.scrollHeight;

    // Ước lượng: mỗi trang ≈ 80% viewport height (tương đương trang A4)
    // Trong Endless mode không có page break thật → divide by viewport
    const pageH = viewportH * 0.92;

    totalPages = Math.max(1, Math.ceil(totalH / pageH));
    pageOffsets = [];
    for (let i = 0; i < totalPages; i++) {
      pageOffsets.push(Math.round(i * pageH));
    }

    // Thử lấy từ OSMD SVG nếu có nhiều trang thật
    _tryComputeFromSVG();

    currentPage = 1;
    _updateIndicator();
  }

  function goToPage(n) {
    const wrapEl = wrapper();
    if (!wrapEl) return;
    if (n < 1) n = 1;
    if (n > totalPages) n = totalPages;
    currentPage = n;
    const target = pageOffsets[n - 1] || 0;
    wrapEl.scrollTo({ top: target, behavior: 'smooth' });
    _updateIndicator();
  }

  function goToNext() { goToPage(currentPage + 1); }
  function goToPrev() { goToPage(currentPage - 1); }

  function reset() {
    totalPages  = 1;
    currentPage = 1;
    pageOffsets = [];
    _updateIndicator();
  }

  function getTotalPages()  { return totalPages; }
  function getCurrentPage() { return currentPage; }

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

  /**
   * Cố gắng đọc chiều cao từng SVG page của OSMD.
   * OSMD Endless mode → 1 SVG, nhưng khi dùng các pageFormat khác → nhiều SVG.
   */
  function _tryComputeFromSVG() {
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svgs = container.querySelectorAll('svg[id^="osmdSvgPage"]');
    if (svgs.length <= 1) return; // Endless → 1 SVG, skip

    // Nhiều SVG → tính offset từng cái
    totalPages  = svgs.length;
    pageOffsets = [];
    const containerRect = container.getBoundingClientRect();
    const wrapEl = wrapper();
    const wrapScrollTop = wrapEl ? wrapEl.scrollTop : 0;

    svgs.forEach(svg => {
      const rect = svg.getBoundingClientRect();
      const relTop = rect.top - containerRect.top + wrapScrollTop;
      pageOffsets.push(Math.round(relTop));
    });
  }

  function _updateIndicator() {
    const el = indicator();
    if (!el) return;
    if (totalPages <= 1) {
      el.textContent = '';
    } else {
      el.textContent = `Trang ${currentPage} / ${totalPages}`;
    }
    // Enable/disable prev-next buttons
    const prev = document.getElementById('btn-page-prev');
    const next = document.getElementById('btn-page-next');
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  return { init, computePages, goToPage, goToNext, goToPrev, reset, getTotalPages, getCurrentPage };
})();
