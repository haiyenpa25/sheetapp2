/**
 * assets/js/performance/cue-engine.js — Real-Time Performance & Practice Cue Engine
 * 
 * Provides:
 * 1. Pre-cues (2-measure and 1-measure lookahead warning before section entry)
 * 2. Visual Cue Floating Banner with role-tailored performance hints
 * 3. Sound cue chimes for transition alerts
 */
const CueEngine = (() => {
  'use strict';

  let _cueBannerDOM     = null;
  let _dismissTimer     = null;
  let _lastAlertMeasure = null;
  let _enabled          = true;

  function init() {
    _createCueBannerDOM();
    _bindEvents();
    console.log('[CueEngine] Initialized');
  }

  function _createCueBannerDOM() {
    if (document.getElementById('cue-banner')) {
      _cueBannerDOM = document.getElementById('cue-banner');
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'cue-banner';
    banner.className = 'cue-banner hidden';
    banner.innerHTML = `
      <div class="cue-banner-content">
        <span class="cue-icon" id="cue-banner-icon">⚡</span>
        <span class="cue-text" id="cue-banner-text">Chuẩn bị vào Điệp Khúc</span>
      </div>
    `;

    document.body.appendChild(banner);
    _cueBannerDOM = banner;
  }

  function _bindEvents() {
    if (typeof EventBus === 'undefined') return;

    // Khi vị trí ô nhịp thay đổi
    EventBus.on('performance:measure_changed', ({ measure }) => {
      if (_enabled) {
        checkMeasure(measure);
      }
    });

    // Khi người dùng nhảy đoạn thủ công
    EventBus.on('section:jumped', ({ section }) => {
      _lastAlertMeasure = null; // reset để không bị duplicate alert
    });
  }

  /**
   * Kiểm tra ô nhịp hiện tại so với các Section trong bài để kích hoạt cảnh báo trước
   */
  function checkMeasure(currentMeasure) {
    if (!currentMeasure || currentMeasure === _lastAlertMeasure) return;
    _lastAlertMeasure = currentMeasure;

    const sections = window.ArrangementEngine?.getSections?.() || [];
    if (sections.length === 0) return;

    // Tìm section kế tiếp gần nhất
    const upcomingSec = sections.find(s => s.start_measure > currentMeasure);
    if (!upcomingSec) return;

    const remainingBars = upcomingSec.start_measure - currentMeasure;
    const role = window.LiveSession?.getRole?.() || 'viewer';

    if (remainingBars === 2) {
      // 2 ô nhịp trước khi vào đoạn mới
      const msg = `⚡ 2 ô nhịp nữa → <b>${_escapeHtml(upcomingSec.name)}</b>`;
      showBanner(msg, 'pre-cue', 2400, '⚡');
    } else if (remainingBars === 1) {
      // 1 ô nhịp trước khi vào đoạn mới (Cực kỳ quan trọng)
      const roleHint = _getRoleHint(role, upcomingSec.type);
      const msg = `🔥 1 ô nhịp nữa → <b>${_escapeHtml(upcomingSec.name)}</b> ${roleHint ? `<span class="cue-role-hint">(${roleHint})</span>` : ''}`;
      showBanner(msg, 'urgent-cue', 2600, '🔥');
    }
  }

  /**
   * Hiển thị Banner thông báo diễn tập nổi
   * @param {string} htmlMessage Nội dung thông báo
   * @param {string} type 'info' | 'pre-cue' | 'urgent-cue' | 'jump' | 'entry'
   * @param {number} durationMs Thời gian tự đóng (mặc định 3000ms)
   * @param {string} icon Icon hiển thị
   */
  function showBanner(htmlMessage, type = 'info', durationMs = 3000, icon = '⚡') {
    if (!_cueBannerDOM) _createCueBannerDOM();
    if (!_cueBannerDOM) return;

    clearTimeout(_dismissTimer);

    const iconEl = document.getElementById('cue-banner-icon');
    const textEl = document.getElementById('cue-banner-text');

    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.innerHTML = htmlMessage;

    _cueBannerDOM.className = `cue-banner cue-${type}`;
    _cueBannerDOM.classList.remove('hidden');

    if (durationMs > 0) {
      _dismissTimer = setTimeout(() => {
        dismiss();
      }, durationMs);
    }
  }

  function dismiss() {
    if (_cueBannerDOM) {
      _cueBannerDOM.classList.add('cue-hiding');
      setTimeout(() => {
        _cueBannerDOM.className = 'cue-banner hidden';
      }, 300);
    }
  }

  function _getRoleHint(role, sectionType) {
    if (role === 'guitar') {
      switch (sectionType) {
        case 'chorus': return '🎸 Quạt chả / Fill';
        case 'verse':  return '🎸 Rải nhẹ';
        case 'bridge': return '🎸 Đẩy nhịp';
        case 'outro':  return '🎸 Giảm cường độ';
        default: return '';
      }
    } else if (role === 'vocal') {
      switch (sectionType) {
        case 'chorus': return '🎤 Đồng ca';
        case 'verse':  return '🎤 Đơn ca / Lĩnh xướng';
        default: return '🎤 Chuẩn bị hát';
      }
    } else if (role === 'piano') {
      switch (sectionType) {
        case 'chorus': return '🎹 Đệm dày';
        case 'bridge': return '🎹 Dạo cao trào';
        default: return '';
      }
    }
    return '';
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setEnabled(val) {
    _enabled = !!val;
    if (!_enabled) dismiss();
  }

  return {
    init,
    checkMeasure,
    showBanner,
    dismiss,
    setEnabled
  };
})();

window.CueEngine = CueEngine;
