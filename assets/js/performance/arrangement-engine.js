/**
 * assets/js/performance/arrangement-engine.js — Song Sections & Performance Roadmap Engine
 * 
 * Manages:
 * 1. Song Sections (Intro, Verse, Chorus, Bridge, Outro, etc.)
 * 2. Performance Arrangements (Roadmap sequence of sections, transpose changes, BPM jumps)
 * 3. Section Jump Bar UI (1-click navigation for Host & live sync to Followers)
 * 4. Section Editor modal integration for Admin & Ban Hát
 */
const ArrangementEngine = (() => {
  'use strict';

  let _currentSongId      = null;
  let _sections           = [];
  let _arrangements       = [];
  let _activeArrangement  = null;
  let _activeStepIndex    = 0;
  let _currentSectionId   = null;
  let _lastHighlightedSec = null;

  function init() {
    _createJumpBarDOM();
    _bindEvents();

    const curSong = window.Store?.get?.('currentSong');
    if (curSong?.id) {
      loadForSong(curSong.id);
    }

    console.log('[ArrangementEngine] Initialized');
  }

  function _bindEvents() {
    if (typeof EventBus === 'undefined') return;

    EventBus.on('song:loaded', ({ song, settings }) => {
      const songId = song?.id;
      if (songId) {
        if (settings?.sections && Array.isArray(settings.sections)) {
          _currentSongId = songId;
          _sections = settings.sections;
          _arrangements = [];
          renderJumpBar();
          EventBus.emit('arrangements:loaded', { songId, sections: _sections, arrangements: _arrangements });
        } else {
          const isLive = window.LiveSession?.isActive?.() || window.Store?.get?.('currentRoom');
          if (isLive || window.__enableArrangementsAutoLoad) {
            loadForSong(songId);
          } else {
            _currentSongId = songId;
            _sections = [];
            _arrangements = [];
            renderJumpBar();
          }
        }
      } else {
        clear();
      }
    });

    // Lắng nghe thay đổi ô nhịp để cập nhật active chip trên Section Bar
    EventBus.on('performance:measure_changed', ({ measure }) => {
      updateActiveSectionByMeasure(measure);
    });

    // Lắng nghe thay đổi chế độ và chương trình để cập nhật hiển thị Jump Bar (Ticket R1-4)
    EventBus.on('app:mode_change', () => renderJumpBar());
    EventBus.on('setlist:played', () => renderJumpBar());
    EventBus.on('setlist:ended', () => renderJumpBar());
  }

  /**
   * Tạo DOM container cho Section Jump Bar nếu chưa có
   */
  function _createJumpBarDOM() {
    let bar = document.getElementById('section-jump-bar-container');
    if (!bar) {
      const wrapper = document.querySelector('.sheet-viewer-wrapper') || document.getElementById('sheet-container') || document.body;
      
      bar = document.createElement('div');
      bar.id = 'section-jump-bar-container';
      bar.className = 'section-jump-bar-container hidden';
      bar.innerHTML = `
        <div class="section-jump-bar" id="section-jump-bar">
          <div class="section-chips-list" id="section-chips-list"></div>
          <button type="button" class="btn-section-edit" id="btn-section-edit" title="Chỉnh sửa phân đoạn (Admin/Ban Hát)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span class="btn-text">Phân đoạn</span>
          </button>
        </div>
      `;

      // Chèn lên trước sheet container hoặc vào đầu wrapper
      const sheetContainer = document.getElementById('sheet-container') || document.getElementById('osmd-container');
      if (sheetContainer && sheetContainer.parentNode) {
        sheetContainer.parentNode.insertBefore(bar, sheetContainer);
      } else {
        wrapper.appendChild(bar);
      }
    }

    // Gắn sự kiện nút Sửa phân đoạn
    const btnEdit = document.getElementById('btn-section-edit');
    if (btnEdit && !btnEdit.dataset.bound) {
      btnEdit.dataset.bound = 'true';
      btnEdit.addEventListener('click', async () => {
        if (_currentSongId && (!_sections || _sections.length === 0)) {
          await loadForSong(_currentSongId);
        }
        openSectionEditor();
      });
    }
  }

  /**
   * Tải danh sách sections và arrangements của bài hát từ API
   */
  async function loadForSong(songId) {
    _currentSongId = songId;
    _sections = [];
    _arrangements = [];
    _activeArrangement = null;
    _activeStepIndex = 0;
    _currentSectionId = null;
    _lastHighlightedSec = null;

    try {
      if (window.ApiService?.arrangements) {
        const [secRes, arrRes] = await Promise.all([
          window.ApiService.arrangements.getSections(songId).catch(() => ({ data: [] })),
          window.ApiService.arrangements.list(songId).catch(() => ({ data: [] }))
        ]);

        _sections = Array.isArray(secRes?.data) ? secRes.data : [];
        _arrangements = Array.isArray(arrRes?.data) ? arrRes.data : [];

        if (_arrangements.length > 0) {
          _activeArrangement = _arrangements.find(a => a.is_default) || _arrangements[0];
        }
      }
    } catch (e) {
      console.warn('[ArrangementEngine] Failed to load sections:', e);
    }

    renderJumpBar();
    EventBus.emit('arrangements:loaded', { songId, sections: _sections, arrangements: _arrangements });
  }

  function _isProgramOrSetlistActive() {
    return Boolean(document.querySelector('.toolbar-left')?.classList.contains('in-setlist') ||
      document.body.classList.contains('in-setlist') ||
      (window.SetlistUI?.getCurrentSetlist?.() && (window.SetlistUI?.getCurrentIndex?.() ?? -1) >= 0) ||
      !document.getElementById('setlist-program-bar')?.classList.contains('hidden'));
  }
  function _isPerformanceMode() {
    return Boolean(document.body.classList.contains('sheet-only-mode') || document.body.dataset.appMode === 'performance' || window.ModeManager?.getMode?.() === 'performance');
  }
  function _isLiveSyncActive() {
    const m = window.LiveSession?.getMode?.();
    return Boolean(m === 'host' || m === 'join' || document.getElementById('follow-leader-banner')?.classList.contains('hidden') === false || window.Store?.get?.('currentRoom'));
  }
  function _shouldShowJumpBar() {
    if (!_sections || _sections.length === 0) return false;
    return Boolean(_isProgramOrSetlistActive() || _isPerformanceMode() || _isLiveSyncActive() ||
      window.__forceShowSectionJumpBar || document.body.dataset.showSections === 'true' ||
      (typeof window !== 'undefined' && (window.location.search.includes('v=sheet') || window.location.search.includes('sections=1'))));
  }

  /**
   * Render danh sách Section Chips trên Jump Bar (Ticket R1-4)
   */
  function renderJumpBar() {
    const container = document.getElementById('section-jump-bar-container');
    const chipsList = document.getElementById('section-chips-list');
    if (!container || !chipsList) return;

    if (!_sections || _sections.length === 0) {
      const canEdit = window.Auth?.isAdmin?.() || window.Auth?.isBanhat?.();
      if (canEdit && _currentSongId && (_isProgramOrSetlistActive() || _isPerformanceMode() || window.__forceShowSectionJumpBar)) {
        container.classList.remove('hidden');
        chipsList.innerHTML = '<span class="section-empty-hint">Chưa có phân đoạn. Bấm [Phân đoạn] để tạo</span>';
      } else {
        container.classList.add('hidden');
        chipsList.innerHTML = '';
      }
      return;
    }

    if (!_shouldShowJumpBar()) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    chipsList.innerHTML = '';

    _sections.forEach((sec) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'section-chip';
      chip.dataset.sectionId = sec.id;
      chip.dataset.startMeasure = sec.start_measure;
      chip.dataset.endMeasure = sec.end_measure;
      chip.dataset.type = sec.type;

      const icon = _getSectionIcon(sec.type);
      const color = sec.color || _getSectionDefaultColor(sec.type);
      const vnName = _normalizeSectionLabel(sec.type, sec.name);

      chip.style.setProperty('--chip-accent', color);
      chip.innerHTML = `
        <span class="chip-icon">${icon}</span>
        <span class="chip-name">${_escapeHtml(vnName)}</span>
        <span class="chip-legacy-tag sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;">${_escapeHtml(sec.name || '')}</span>
        <span class="chip-measures">m.${sec.start_measure}${sec.end_measure > sec.start_measure ? `-${sec.end_measure}` : ''}</span>
      `;

      chip.addEventListener('click', () => {
        jumpToSection(sec.id);
      });

      chipsList.appendChild(chip);
    });

    const btnEdit = document.getElementById('btn-section-edit');
    if (btnEdit) {
      const canEdit = window.Auth?.isAdmin?.() || window.Auth?.isBanhat?.();
      btnEdit.style.display = canEdit ? 'inline-flex' : 'none';
    }
  }

  /**
   * Nhảy trực tiếp đến Section (Dành cho Host hoặc người dùng solo)
   */
  function jumpToSection(sectionId) {
    const sec = _sections.find(s => String(s.id) === String(sectionId));
    if (!sec) return;

    _currentSectionId = sec.id;
    _highlightChip(sec.id);

    const targetMeasure = parseInt(sec.start_measure, 10) || 1;

    // 1. Cuộn đến đúng ô nhịp
    if (window.MusicalPosition) {
      window.MusicalPosition.scrollToMeasure(targetMeasure, true);
    }

    // 2. Nếu là Host -> Broadcast sang tất cả Followers
    if (window.LiveSession && window.LiveSession.isHost()) {
      window.LiveSession.broadcastState({
        position: {
          measure: targetMeasure,
          sectionId: sec.id,
          progress: 0.0
        }
      });
    }

    // 3. Kích hoạt thông báo Cue Banner
    if (window.CueEngine) {
      window.CueEngine.showBanner(`Đã chuyển đến: ${sec.name} (Ô nhịp ${sec.start_measure})`, 'jump', 2500);
    } else if (window.AppUI?.showToast) {
      window.AppUI.showToast(`Chuyển đoạn: ${sec.name}`, 'info');
    } else if (window.App?.showToast) {
      window.App.showToast(`Chuyển đoạn: ${sec.name}`, 'info');
    }

    EventBus.emit('section:jumped', { section: sec, measure: targetMeasure });
  }

  /**
   * Nhảy tới phân đoạn tiếp theo trong bài
   */
  function nextSection() {
    if (!_sections || _sections.length === 0) return;
    const idx = _sections.findIndex(s => String(s.id) === String(_currentSectionId));
    if (idx === -1) {
      jumpToSection(_sections[0].id);
    } else if (idx < _sections.length - 1) {
      jumpToSection(_sections[idx + 1].id);
    }
  }

  /**
   * Nhảy về phân đoạn trước đó trong bài
   */
  function prevSection() {
    if (!_sections || _sections.length === 0) return;
    const idx = _sections.findIndex(s => String(s.id) === String(_currentSectionId));
    if (idx === -1) {
      jumpToSection(_sections[0].id);
    } else if (idx > 0) {
      jumpToSection(_sections[idx - 1].id);
    }
  }

  /**
   * Cập nhật Highlight Chip khi vị trí ô nhịp thay đổi trong quá trình chơi/cuộn
   */
  function updateActiveSectionByMeasure(measure) {
    if (!_sections || _sections.length === 0 || !measure) return;

    const sec = _sections.find(s => measure >= s.start_measure && measure <= s.end_measure);
    if (sec) {
      if (_lastHighlightedSec !== sec.id) {
        _lastHighlightedSec = sec.id;
        _currentSectionId = sec.id;
        _highlightChip(sec.id);
      }
    } else {
      if (_lastHighlightedSec !== null) {
        _lastHighlightedSec = null;
        _highlightChip(null);
      }
    }
  }

  function highlightSection(sectionId) {
    if (!sectionId || !_sections || _sections.length === 0) return;
    const sec = _sections.find(s => String(s.id) === String(sectionId));
    if (sec) {
      _currentSectionId = sec.id;
      _lastHighlightedSec = sec.id;
      _highlightChip(sec.id);
    }
  }

  function _highlightChip(sectionId) {
    const chips = document.querySelectorAll('.section-chip');
    chips.forEach(c => {
      if (sectionId && String(c.dataset.sectionId) === String(sectionId)) {
        c.classList.add('active');
        // Cuộn chip vào tầm nhìn ngang nếu dài
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        c.classList.remove('active');
      }
    });
  }

  function _normalizeSectionLabel(type, rawName = '') {
    const raw = String(rawName).trim();
    if (/^(intro|dạo\s*đầu|dạo)$/i.test(raw) || type === 'intro') return 'Dạo đầu';
    if (/^(outro|kết)$/i.test(raw) || type === 'outro') return 'Kết';
    if (/^(điệp\s*khúc|chorus|đk)$/i.test(raw) || type === 'chorus') return 'Điệp khúc';
    const numMatch = raw.match(/\d+/);
    if (numMatch && (/^(lời|đoạn|phiên\s*khúc|verse)/i.test(raw) || type === 'verse')) return `Phiên khúc ${numMatch[0]}`;
    if (/^(lời|lời\s*hát|đoạn|phiên\s*khúc|verse)$/i.test(raw) || type === 'verse') return 'Phiên khúc';
    if (type === 'bridge') return 'Dạo giữa';
    if (type === 'interlude') return 'Gian tấu';
    return raw || 'Phiên khúc';
  }

  function _getSectionIcon(type) {
    let icon = 'music';
    switch (type) {
      case 'intro':     icon = 'music'; break;
      case 'verse':     icon = 'book-open'; break;
      case 'chorus':    icon = 'zap'; break;
      case 'bridge':    icon = 'guitar'; break;
      case 'interlude': icon = 'disc'; break;
      case 'outro':     icon = 'check'; break;
      default:          icon = 'music'; break;
    }
    return `<svg class="icon icon-sm" width="13" height="13" aria-hidden="true"><use href="#icon-${icon}"></use></svg>`;
  }

  function _getSectionDefaultColor(type) {
    switch (type) {
      case 'intro':   return '#6366f1'; // Indigo
      case 'verse':   return '#10b981'; // Emerald
      case 'chorus':  return '#f59e0b'; // Amber
      case 'bridge':  return '#ec4899'; // Pink
      case 'interlude': return '#06b6d4'; // Cyan
      case 'outro':   return '#8b5cf6'; // Purple
      default:        return '#64748b'; // Slate
    }
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getSections() {
    return _sections;
  }

  function getCurrentSection() {
    return _sections.find(s => String(s.id) === String(_currentSectionId));
  }

  function clear() {
    _currentSongId = null;
    _sections = [];
    _arrangements = [];
    _activeArrangement = null;
    _currentSectionId = null;
    _lastHighlightedSec = null;
    renderJumpBar();
  }

  /**
   * Mở Modal biên tập phân đoạn
   */
  function openSectionEditor() {
    if (window.SectionEditorModal) {
      window.SectionEditorModal.open(_currentSongId, _sections);
    } else {
      window.App?.showToast?.('Đang mở bộ quản lý phân đoạn...', 'info');
      _openDefaultSectionModal();
    }
  }

  /**
   * Default modal view builder nếu chưa nạp riêng
   */
  function _openDefaultSectionModal() {
    let modal = document.getElementById('modal-section-editor');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-section-editor';
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = `
        <div class="modal-card modal-lg section-editor-card">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <span class="modal-icon"><svg class="icon icon-md" width="18" height="18" aria-hidden="true"><use href="#icon-sliders"></use></svg></span>
              <h3 class="modal-title">Cấu Trúc Phân Đoạn Bài Hát</h3>
            </div>
            <button type="button" class="modal-close" onclick="document.getElementById('modal-section-editor').classList.add('hidden')">&times;</button>
          </div>
          <div class="modal-body">
            <p class="section-editor-desc">Định nghĩa các đoạn nhạc (Dạo đầu, Phiên khúc 1, Điệp khúc, Dạo giữa, Kết) theo số thứ tự ô nhịp.</p>
            <div class="section-table-container">
              <table class="section-edit-table" id="section-edit-table">
                <thead><tr><th style="width:130px">Loại đoạn</th><th>Tên hiển thị</th><th style="width:85px">Ô bắt đầu</th><th style="width:85px">Ô kết thúc</th><th style="width:60px">Màu</th><th style="width:50px"></th></tr></thead>
                <tbody id="section-edit-tbody"></tbody>
              </table>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-section-row" style="margin-top:10px;">+ Thêm phân đoạn</button>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-section-editor').classList.add('hidden')">Hủy</button>
            <button type="button" class="btn btn-primary" id="btn-save-sections-all">Lưu Cấu Trúc</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btn-add-section-row')?.addEventListener('click', () => {
        _addSectionRow();
      });

      document.getElementById('btn-save-sections-all')?.addEventListener('click', async () => {
        await _saveSectionsFromModal();
      });
    }

    _populateModalRows();
    modal.classList.remove('hidden');
  }

  function _populateModalRows() {
    const tbody = document.getElementById('section-edit-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (_sections && _sections.length > 0) {
      _sections.forEach(s => _addSectionRow(s));
    } else {
      _addSectionRow({ type: 'intro', name: 'Dạo đầu', start_measure: 1, end_measure: 4, color: '#6366f1' });
      _addSectionRow({ type: 'verse', name: 'Phiên khúc 1', start_measure: 5, end_measure: 12, color: '#10b981' });
      _addSectionRow({ type: 'chorus', name: 'Điệp khúc', start_measure: 13, end_measure: 20, color: '#f59e0b' });
      _addSectionRow({ type: 'outro', name: 'Kết', start_measure: 21, end_measure: 24, color: '#8b5cf6' });
    }
  }

  function _addSectionRow(sec = {}) {
    const tbody = document.getElementById('section-edit-tbody');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.dataset.id = sec.id || '';

    const types = [
      { id: 'intro', label: 'Dạo đầu' },
      { id: 'verse', label: 'Phiên khúc' },
      { id: 'chorus', label: 'Điệp khúc' },
      { id: 'bridge', label: 'Dạo giữa' },
      { id: 'interlude', label: 'Gian tấu' },
      { id: 'outro', label: 'Kết' }
    ];

    const typeOpts = types.map(t => `<option value="${t.id}" ${sec.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('');

    row.innerHTML = `
      <td><select class="form-select sec-row-type">${typeOpts}</select></td>
      <td><input type="text" class="form-input sec-row-name" value="${_escapeHtml(sec.name || 'Phân đoạn')}" placeholder="VD: Phiên khúc 1, Điệp khúc"></td>
      <td><input type="number" class="form-input sec-row-start" value="${sec.start_measure || 1}" min="1" style="text-align: center"></td>
      <td><input type="number" class="form-input sec-row-end" value="${sec.end_measure || 4}" min="1" style="text-align: center"></td>
      <td><input type="color" class="sec-row-color" value="${sec.color || _getSectionDefaultColor(sec.type || 'verse')}" style="width: 100%; height: 32px; border: none; background: transparent; cursor: pointer;"></td>
      <td style="text-align: center"><button type="button" class="btn-del-row" style="background: none; border: none; color: var(--danger, #ef4444); font-size: 18px; cursor: pointer;" title="Xóa dòng">&times;</button></td>
    `;

    row.querySelector('.btn-del-row')?.addEventListener('click', () => {
      row.remove();
    });

    row.querySelector('.sec-row-type')?.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      const nameInput = row.querySelector('.sec-row-name');
      const colorInput = row.querySelector('.sec-row-color');
      if (nameInput && (!nameInput.value || ['Intro', 'Lời', 'Điệp Khúc', 'Dạo Giữa', 'Outro', 'Dạo đầu', 'Phiên khúc', 'Điệp khúc', 'Kết'].some(p => nameInput.value.includes(p)))) {
        const match = types.find(t => t.id === selectedType);
        if (match) nameInput.value = match.label;
      }
      if (colorInput) {
        colorInput.value = _getSectionDefaultColor(selectedType);
      }
    });

    tbody.appendChild(row);
  }

  async function _saveSectionsFromModal() {
    if (!_currentSongId) {
      window.App?.showToast?.('Chưa chọn bài hát', 'error');
      return;
    }

    const tbody = document.getElementById('section-edit-tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const sectionsPayload = [];

    rows.forEach((r, idx) => {
      const id = r.dataset.id ? parseInt(r.dataset.id, 10) : null;
      const type = r.querySelector('.sec-row-type')?.value || 'verse';
      const name = r.querySelector('.sec-row-name')?.value.trim() || 'Section';
      const start = parseInt(r.querySelector('.sec-row-start')?.value, 10) || 1;
      const end = parseInt(r.querySelector('.sec-row-end')?.value, 10) || start;
      const color = r.querySelector('.sec-row-color')?.value || '#6366f1';

      sectionsPayload.push({
        id: id || undefined,
        name: name,
        type: type,
        start_measure: start,
        end_measure: end,
        color: color,
        display_order: idx
      });
    });

    try {
      const res = await window.ApiService.arrangements.saveAllSections(_currentSongId, sectionsPayload);
      if (res && res.data) {
        _sections = res.data;
        renderJumpBar();
        window.App?.showToast?.('Đã lưu cấu trúc phân đoạn thành công!', 'success');
        document.getElementById('modal-section-editor')?.classList.add('hidden');
      }
    } catch (err) {
      console.error('[ArrangementEngine] Save error:', err);
      window.App?.showToast?.('Lỗi khi lưu phân đoạn: ' + err.message, 'error');
    }
  }

  // Đồng bộ dải phân đoạn nếu bài đã được tải trước lúc vào Biểu Diễn.
  async function loadForSongIfEmpty(requestedSongId) {
    const songId = requestedSongId || _currentSongId || window.Store?.get?.('currentSong')?.id
      || new URLSearchParams(window.location.search).get('song');
    if (!songId) return;
    if (_currentSongId === songId && _sections.length > 0) return renderJumpBar();
    await loadForSong(songId);
  }

  return {
    init,
    loadForSong,
    loadForSongIfEmpty,
    getSections,
    getCurrentSection,
    jumpToSection,
    nextSection,
    prevSection,
    highlightSection,
    updateActiveSectionByMeasure,
    renderJumpBar,
    openSectionEditor,
    clear
  };
})();

window.ArrangementEngine = ArrangementEngine;
