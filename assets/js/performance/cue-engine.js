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
  let _lastCue          = null;

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
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="cue-banner-content">
        <span class="cue-icon" id="cue-banner-icon">⚡</span>
        <span class="cue-text" id="cue-banner-text">Chuẩn bị vào Điệp Khúc</span>
        <button type="button" id="btn-cue-banner-close" class="cue-close-btn" title="Đóng thông điệp" aria-label="Đóng">×</button>
      </div>
    `;

    document.body.appendChild(banner);
    _cueBannerDOM = banner;

    document.getElementById('btn-cue-banner-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
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
   * @param {string} type 'info' | 'repeat' | 'slow' | 'key' | 'ending' | 'intro' | 'custom' | 'urgent-cue' | 'pre-cue'
   * @param {number} durationMs Thời gian tự đóng (mặc định 5000ms = 5 giây theo chuẩn Ticket L3-6)
   * @param {string} icon Icon hiển thị
   */
  function showBanner(htmlMessage, type = 'info', durationMs = 5000, icon = '⚡') {
    if (!_cueBannerDOM) _createCueBannerDOM();
    if (!_cueBannerDOM) return;

    clearTimeout(_dismissTimer);

    const iconEl = document.getElementById('cue-banner-icon');
    const textEl = document.getElementById('cue-banner-text');

    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.innerHTML = htmlMessage;

    _lastCue = {
      text: htmlMessage,
      type,
      durationMs,
      icon,
      timestamp: Date.now()
    };

    _cueBannerDOM.className = `cue-banner cue-${type}`;
    _cueBannerDOM.classList.remove('hidden');

    if (durationMs > 0) {
      _dismissTimer = setTimeout(() => {
        dismiss();
      }, durationMs);
    }
  }

  /**
   * Phát sóng thông điệp từ Ca Trưởng (Host) đến toàn ban nhạc qua LiveSession
   */
  function broadcastCue(cueData) {
    if (!cueData) return false;
    const isHost = window.LiveSession?.isHost?.() ?? false;
    if (!isHost) {
      window.App?.showToast?.('Chỉ Ca Trưởng đang mở phòng mới có thể gửi thông điệp đến ban nhạc!', 'warning');
      return false;
    }

    const cueObj = typeof cueData === 'string' ? { text: cueData } : cueData;
    const text = (cueObj.text || '').trim();
    if (!text) return false;

    const type = cueObj.type || 'info';
    const icon = cueObj.icon || '📣';
    const durationMs = cueObj.durationMs || 5000;
    const cueId = 'CUE-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const payload = {
      cueId,
      text,
      type,
      icon,
      durationMs,
      createdAt: Date.now() / 1000,
      expiresAt: (Date.now() / 1000) + (durationMs / 1000)
    };

    if (window.LiveSession?.broadcastState) {
      window.LiveSession.broadcastState({ cue: payload });
    }

    // Hiển thị ngay lập tức trên máy Host
    showBanner(text, type, durationMs, icon);
    window.App?.showToast?.(`📣 Đã gửi thông điệp: ${text}`, 'success');
    return true;
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
    broadcastCue,
    dismiss,
    setEnabled,
    getLastCue: () => _lastCue,
    getBannerDOM: () => _cueBannerDOM
  };
})();

window.CueEngine = CueEngine;
