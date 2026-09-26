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
    console.log('[ArrangementEngine] Initialized');
  }

  function _bindEvents() {
    if (typeof EventBus === 'undefined') return;

    EventBus.on('song:loaded', async ({ song }) => {
      const songId = song?.id;
      if (songId) {
        await loadForSong(songId);
      } else {
        clear();
      }
    });

    // Lắng nghe thay đổi ô nhịp để cập nhật active chip trên Section Bar
    EventBus.on('performance:measure_changed', ({ measure }) => {
      updateActiveSectionByMeasure(measure);
    });
  }

  /**
   * Tạo DOM container cho Section Jump Bar nếu chưa có
   */
  function _createJumpBarDOM() {
    if (document.getElementById('section-jump-bar-container')) return;

    const wrapper = document.querySelector('.sheet-viewer-wrapper') || document.getElementById('sheet-container') || document.body;
    
    const bar = document.createElement('div');
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

    // Gắn sự kiện nút Sửa phân đoạn
    document.getElementById('btn-section-edit')?.addEventListener('click', () => {
      openSectionEditor();
    });
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

  /**
   * Render danh sách Section Chips trên Jump Bar
   */
  function renderJumpBar() {
    const container = document.getElementById('section-jump-bar-container');
    const chipsList = document.getElementById('section-chips-list');
    if (!container || !chipsList) return;

    if (!_sections || _sections.length === 0) {
      // Ẩn bar nếu bài chưa có section nào (trừ khi là Admin/Ban Hát muốn tạo)
      const canEdit = window.Auth?.isAdmin?.() || window.Auth?.isBanhat?.();
      if (canEdit && _currentSongId) {
        container.classList.remove('hidden');
        chipsList.innerHTML = `<span class="section-empty-hint">Chưa có phân đoạn. Bấm [Phân đoạn] để tạo</span>`;
      } else {
        container.classList.add('hidden');
        chipsList.innerHTML = '';
      }
      return;
    }

    container.classList.remove('hidden');
    chipsList.innerHTML = '';

    _sections.forEach((sec, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'section-chip';
      chip.dataset.sectionId = sec.id;
      chip.dataset.startMeasure = sec.start_measure;
      chip.dataset.endMeasure = sec.end_measure;
      chip.dataset.type = sec.type;

      // Icon biểu tượng theo loại
      const icon = _getSectionIcon(sec.type);
      const color = sec.color || _getSectionDefaultColor(sec.type);

      chip.style.setProperty('--chip-accent', color);
      chip.innerHTML = `
        <span class="chip-icon">${icon}</span>
        <span class="chip-name">${_escapeHtml(sec.name)}</span>
        <span class="chip-measures">m.${sec.start_measure}${sec.end_measure > sec.start_measure ? `-${sec.end_measure}` : ''}</span>
      `;

      chip.addEventListener('click', () => {
        jumpToSection(sec.id);
      });

      chipsList.appendChild(chip);
    });

    // Cập nhật quyền hiển thị nút Sửa
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
      window.CueEngine.showBanner(`🎯 Đã nhảy đến: ${sec.name} (Ô nhịp ${sec.start_measure})`, 'jump', 2500);
    } else if (window.App?.showToast) {
      window.App.showToast(`🎯 Chuyển đoạn: ${sec.name}`, 'info');
    }

    EventBus.emit('section:jumped', { section: sec, measure: targetMeasure });
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

  function _getSectionIcon(type) {
    switch (type) {
      case 'intro':   return '🎵';
      case 'verse':   return '📖';
      case 'chorus':  return '⚡';
      case 'bridge':  return '🎸';
      case 'interlude': return '🎹';
      case 'outro':   return '🏁';
      default:        return '🔖';
    }
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
              <span class="modal-icon">📐</span>
              <h3 class="modal-title">Cấu Trúc Phân Đoạn Bài Hát</h3>
            </div>
            <button type="button" class="modal-close" onclick="document.getElementById('modal-section-editor').classList.add('hidden')">&times;</button>
          </div>
          <div class="modal-body">
            <p class="section-editor-desc">Định nghĩa các đoạn nhạc (Intro, Lời 1, Điệp khúc, Dạo giữa, Outro) theo số thứ tự ô nhịp trong bản nhạc.</p>
            <div class="section-table-container">
              <table class="section-edit-table" id="section-edit-table">
                <thead>
                  <tr>
                    <th style="width: 130px">Loại đoạn</th>
                    <th>Tên hiển thị</th>
                    <th style="width: 85px">Ô bắt đầu</th>
                    <th style="width: 85px">Ô kết thúc</th>
                    <th style="width: 60px">Màu</th>
                    <th style="width: 50px"></th>
                  </tr>
                </thead>
                <tbody id="section-edit-tbody"></tbody>
              </table>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-section-row" style="margin-top: 10px;">
              + Thêm phân đoạn
            </button>
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
      // Mặc định tạo sẵn gợi ý
      _addSectionRow({ type: 'intro', name: 'Intro', start_measure: 1, end_measure: 4, color: '#6366f1' });
      _addSectionRow({ type: 'verse', name: 'Lời 1', start_measure: 5, end_measure: 12, color: '#10b981' });
      _addSectionRow({ type: 'chorus', name: 'Điệp Khúc', start_measure: 13, end_measure: 20, color: '#f59e0b' });
      _addSectionRow({ type: 'outro', name: 'Outro', start_measure: 21, end_measure: 24, color: '#8b5cf6' });
    }
  }

  function _addSectionRow(sec = {}) {
    const tbody = document.getElementById('section-edit-tbody');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.dataset.id = sec.id || '';

    const types = [
      { id: 'intro', label: '🎵 Intro' },
      { id: 'verse', label: '📖 Lời (Verse)' },
      { id: 'chorus', label: '⚡ Điệp khúc (Chorus)' },
      { id: 'bridge', label: '🎸 Dạo giữa (Bridge)' },
      { id: 'interlude', label: '🎹 Gian tấu (Interlude)' },
      { id: 'outro', label: '🏁 Outro (Kết)' }
    ];

    const typeOpts = types.map(t => `<option value="${t.id}" ${sec.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('');

    row.innerHTML = `
      <td>
        <select class="form-select sec-row-type">${typeOpts}</select>
      </td>
      <td>
        <input type="text" class="form-input sec-row-name" value="${_escapeHtml(sec.name || 'Phân đoạn')}" placeholder="VD: Lời 1, Điệp khúc">
      </td>
      <td>
        <input type="number" class="form-input sec-row-start" value="${sec.start_measure || 1}" min="1" style="text-align: center">
      </td>
      <td>
        <input type="number" class="form-input sec-row-end" value="${sec.end_measure || 4}" min="1" style="text-align: center">
      </td>
      <td>
        <input type="color" class="sec-row-color" value="${sec.color || _getSectionDefaultColor(sec.type || 'verse')}" style="width: 100%; height: 32px; border: none; background: transparent; cursor: pointer;">
      </td>
      <td style="text-align: center">
        <button type="button" class="btn-del-row" style="background: none; border: none; color: var(--danger, #ef4444); font-size: 18px; cursor: pointer;" title="Xóa dòng">&times;</button>
      </td>
    `;

    row.querySelector('.btn-del-row')?.addEventListener('click', () => {
      row.remove();
    });

    row.querySelector('.sec-row-type')?.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      const nameInput = row.querySelector('.sec-row-name');
      const colorInput = row.querySelector('.sec-row-color');
      if (nameInput && (!nameInput.value || ['Intro', 'Lời', 'Điệp Khúc', 'Dạo Giữa', 'Outro'].some(p => nameInput.value.includes(p)))) {
        const match = types.find(t => t.id === selectedType);
        if (match) nameInput.value = match.label.replace(/^[^\s]+\s+/, '').split(' (')[0];
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

  return {
    init,
    loadForSong,
    getSections,
    getCurrentSection,
    jumpToSection,
    updateActiveSectionByMeasure,
    renderJumpBar,
    openSectionEditor,
    clear
  };
})();

window.ArrangementEngine = ArrangementEngine;
