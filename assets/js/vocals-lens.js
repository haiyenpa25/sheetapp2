/**
 * assets/js/vocals-lens.js
 *
 * Vocals Lens — Chế độ chuyên biệt cho Ca sĩ / Ca đoàn (Ticket L4-6):
 * 1. Chế độ Một khổ (Single Verse Mode): Chữ lời phóng to, dễ đọc trên sân khấu.
 * 2. Chỉ giai điệu (Melody Only): Ẩn khuông khoá Fa (Staff 2) và ẩn các bè phụ (Alto/Tenor).
 * 3. Không hợp âm: Tắt toàn bộ ký hiệu hợp âm hòa thanh, nhường toàn bộ không gian cho nốt và lời.
 * 4. Thanh điều hướng khổ trực quan: Nút chuyển khổ nhanh và tuỳ chọn linh hoạt.
 */
const VocalsLens = (() => {
  'use strict';

  let _isActive = false;
  let _hideFaStaff = true;
  let _hideChords = true;
  let _singleVerse = true;

  function isActive() {
    return _isActive;
  }

  function isHideFaStaff() {
    return _hideFaStaff;
  }

  function isHideChords() {
    return _hideChords;
  }

  function isSingleVerse() {
    return _singleVerse;
  }

  function toggleHideFaStaff(forceVal) {
    _hideFaStaff = typeof forceVal === 'boolean' ? forceVal : !_hideFaStaff;
    if (window.OSMDRenderer?.setCompactMode) {
      window.OSMDRenderer.setCompactMode(_hideFaStaff);
    }
    _updateUI();
    return _hideFaStaff;
  }

  function toggleHideChords(forceVal) {
    _hideChords = typeof forceVal === 'boolean' ? forceVal : !_hideChords;
    if (typeof document !== 'undefined') {
      const chordCanvas = document.getElementById('chord-canvas');
      if (chordCanvas) {
        chordCanvas.style.display = _hideChords ? 'none' : 'block';
      }
    }
    _updateUI();
    return _hideChords;
  }

  function toggleSingleVerse(forceVal) {
    _singleVerse = typeof forceVal === 'boolean' ? forceVal : !_singleVerse;
    if (window.VerseManager?.setMode) {
      window.VerseManager.setMode(_singleVerse ? 'single' : 'all');
    }
    _updateUI();
    return _singleVerse;
  }

  /* ═══ GIAO DIỆN THANH CÔNG CỤ VOCALS LENS BAR ═══ */
  function _createVocalsLensBar() {
    if (typeof document === 'undefined') return null;
    let bar = document.getElementById('vocals-lens-bar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'vocals-lens-bar';
    bar.className = 'vocals-lens-bar hidden';
    bar.setAttribute('aria-label', 'Bảng điều khiển Hát Stage Lens');

    bar.innerHTML = `
      <div class="vocals-lens-inner">
        <span class="vocals-lens-tag">
          <span>🎤</span> Hát Lens:
        </span>

        <span class="vocals-mode-badge" id="vocals-mode-badge">
          Chỉ giai điệu · Ẩn khoá Fa · Không hợp âm · Một khổ
        </span>

        <!-- Nhóm chuyển khổ nhanh -->
        <div class="vocals-verse-group" id="vocals-verse-nav">
          <button type="button" id="btn-vocals-prev-verse" class="btn-vocals-tool" title="Khổ trước (Phím Shift+V)">◀</button>
          <span class="vocals-verse-indicator" id="vocals-verse-indicator">Khổ 1</span>
          <button type="button" id="btn-vocals-next-verse" class="btn-vocals-tool" title="Khổ sau (Phím V)">▶</button>
        </div>

        <!-- Nút toggle tuỳ chọn -->
        <button type="button" id="btn-vocals-toggle-fa" class="btn-vocals-tool active" title="Bật/Tắt ẩn khoá Fa và bè phụ">
          <span id="btn-vocals-fa-label">Ẩn khoá Fa: BẬT</span>
        </button>

        <button type="button" id="btn-vocals-toggle-chords" class="btn-vocals-tool active" title="Bật/Tắt ẩn hợp âm">
          <span id="btn-vocals-chords-label">Ẩn hợp âm: BẬT</span>
        </button>
      </div>
    `;

    const sheetArea = document.getElementById('sheet-area') || document.getElementById('main-container') || document.body;
    if (sheetArea && sheetArea.parentNode) {
      sheetArea.parentNode.insertBefore(bar, sheetArea);
    } else {
      document.body.appendChild(bar);
    }

    _bindBarEvents(bar);
    return bar;
  }

  function _bindBarEvents(bar) {
    if (!bar) return;

    bar.querySelector('#btn-vocals-prev-verse')?.addEventListener('click', () => {
      if (window.VerseManager?.prevVerse) window.VerseManager.prevVerse();
    });

    bar.querySelector('#btn-vocals-next-verse')?.addEventListener('click', () => {
      if (window.VerseManager?.nextVerse) window.VerseManager.nextVerse();
    });

    bar.querySelector('#btn-vocals-toggle-fa')?.addEventListener('click', () => {
      toggleHideFaStaff();
    });

    bar.querySelector('#btn-vocals-toggle-chords')?.addEventListener('click', () => {
      toggleHideChords();
    });
  }

  function _updateUI() {
    if (typeof document === 'undefined') return;

    const bar = document.getElementById('vocals-lens-bar');
    if (bar) {
      bar.classList.toggle('hidden', !_isActive);
    }

    const curVerse = window.VerseManager?.getCurrentVerse?.() || 1;
    const totalVerses = window.VerseManager?.getAvailableVerses?.()?.length || 1;
    const verseInd = document.getElementById('vocals-verse-indicator');
    if (verseInd) {
      verseInd.textContent = totalVerses > 1 ? `Khổ ${curVerse}/${totalVerses}` : `Khổ ${curVerse}`;
    }

    const btnFa = document.getElementById('btn-vocals-toggle-fa');
    const lblFa = document.getElementById('btn-vocals-fa-label');
    if (btnFa) btnFa.classList.toggle('active', _hideFaStaff);
    if (lblFa) lblFa.textContent = _hideFaStaff ? 'Ẩn khoá Fa: BẬT' : 'Ẩn khoá Fa: TẮT';

    const btnChords = document.getElementById('btn-vocals-toggle-chords');
    const lblChords = document.getElementById('btn-vocals-chords-label');
    if (btnChords) btnChords.classList.toggle('active', _hideChords);
    if (lblChords) lblChords.textContent = _hideChords ? 'Ẩn hợp âm: BẬT' : 'Ẩn hợp âm: TẮT';
  }

  function activate() {
    _isActive = true;

    if (typeof document !== 'undefined') {
      document.body.classList.add('vocals-lens-active');

      _createVocalsLensBar();
      _updateUI();

      // 1. Chế độ Một khổ (Single Verse)
      if (window.VerseManager?.setMode) {
        window.VerseManager.setMode('single');
      }

      // 2. Chỉ giai điệu (Ẩn khoá Fa & bè phụ)
      if (window.OSMDRenderer?.setCompactMode) {
        window.OSMDRenderer.setCompactMode(_hideFaStaff);
      }

      // 3. Không hợp âm: ẩn lớp hiển thị hợp âm
      const chordCanvas = document.getElementById('chord-canvas');
      if (chordCanvas) chordCanvas.style.display = _hideChords ? 'none' : 'block';

      // Ẩn thanh công cụ nhạc cụ khác
      const guitarBar = document.getElementById('guitar-lens-bar');
      if (guitarBar) guitarBar.classList.add('hidden');
      const bassBar = document.getElementById('bass-lens-bar');
      if (bassBar) bassBar.classList.add('hidden');
      const drumsStage = document.getElementById('drums-stage-container');
      if (drumsStage) drumsStage.classList.add('hidden');
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('vocals:activated', { hideFa: _hideFaStaff, hideChords: _hideChords });
    }
  }

  function deactivate() {
    _isActive = false;

    if (typeof document !== 'undefined') {
      document.body.classList.remove('vocals-lens-active');

      const bar = document.getElementById('vocals-lens-bar');
      if (bar) bar.classList.add('hidden');

      // Phục hồi hiển thị hợp âm
      const chordCanvas = document.getElementById('chord-canvas');
      if (chordCanvas) chordCanvas.style.display = 'block';

      // Phục hồi khuông Fa
      if (window.OSMDRenderer?.setCompactMode) {
        window.OSMDRenderer.setCompactMode(false);
      }

      // Phục hồi chế độ khổ
      if (window.VerseManager?.setMode) {
        window.VerseManager.setMode('all');
      }
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('vocals:deactivated');
    }
  }

  function init() {
    if (typeof document !== 'undefined') {
      _createVocalsLensBar();
      _updateUI();
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.on('verse:changed', () => {
        if (_isActive) _updateUI();
      });

      EventBus.on('song:loaded', () => {
        if (_isActive) {
          activate();
        }
      });

      EventBus.on('role:changed', (data) => {
        if (data?.role === 'vocals') {
          activate();
        } else if (_isActive) {
          deactivate();
        }
      });
    }
  }

  return {
    init,
    activate,
    deactivate,
    isActive,
    isHideFaStaff,
    isHideChords,
    isSingleVerse,
    toggleHideFaStaff,
    toggleHideChords,
    toggleSingleVerse
  };
})();

window.VocalsLens = VocalsLens;
