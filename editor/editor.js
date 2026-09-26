/**
 * editor/editor.js — MusicXML Note Editor Pro (Coordinator)
 * Độc lập 4 bè · Kéo thả thẳng đứng 60 FPS · Bảo toàn bản gốc & Quản lý phiên bản theo user
 */
(() => {
  'use strict';

  /* ─── State Quản Lý Toàn Cục ─────────────────────────────────── */
  let _songsList = [];
  let _currentSong = null;
  let _currentVersion = null; // null = Bản Gốc (Master)
  let _songVersionsList = [];
  let _xmlDoc = null;
  let _osmd = null;

  // Lịch sử Undo / Redo
  let _undoStack = [];
  let _redoStack = [];
  const MAX_UNDO = 30;
  let _isDirty = false;

  // Vị trí nốt đang chọn
  const _selectedPosition = {
    measureNumber: 1,
    voice: 'soprano', // 'soprano' | 'alto' | 'tenor' | 'bass'
    beatIndex: 0,
    activeVoiceMap: { soprano: null, alto: null, tenor: null, bass: null }
  };

  let _zoom = 1.0;
  let _smartOverwriteMode = true;

  // Trạng thái SATB Audio Mixer
  const _mixerState = {
    soprano: { volume: 0.85, solo: false, mute: false },
    alto:    { volume: 0.85, solo: false, mute: false },
    tenor:   { volume: 0.85, solo: false, mute: false },
    bass:    { volume: 0.85, solo: false, mute: false },
    tempo: 90,
    metronome: false
  };

  let _measureHealth = {};

  function _refreshInspectorUI() {
    if (window.EditorUI) {
      window.EditorUI.refreshInspectorUI(_selectedPosition, _measureHealth, _smartOverwriteMode);
    }
  }

  /* ─── Undo / Redo & Quản Lý Trạng Thái ────────────────────────── */
  function _saveSnapshotForUndo() {
    if (!_xmlDoc) return;
    const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
    _undoStack.push(xmlString);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = [];
    _updateUndoRedoButtons();
    _setDirty(true);
  }

  function _setDirty(dirty) {
    _isDirty = dirty;
    const badge = document.getElementById('unsaved-status-badge');
    if (badge) {
      badge.textContent = dirty ? '● Có thay đổi chưa lưu' : 'Đã đồng bộ';
      badge.className = dirty ? 'badge-clean dirty' : 'badge-clean';
    }
  }

  function _updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = (_undoStack.length === 0);
    if (btnRedo) btnRedo.disabled = (_redoStack.length === 0);
  }

  async function undo() {
    if (_undoStack.length === 0) return;
    const curXml = new XMLSerializer().serializeToString(_xmlDoc);
    _redoStack.push(curXml);
    const prevXml = _undoStack.pop();
    _updateUndoRedoButtons();
    showToast('↩ Đã hoàn tác', 'info', 1000);
    await _parseAndLoadXml(prevXml, false);
  }

  async function redo() {
    if (_redoStack.length === 0) return;
    const curXml = new XMLSerializer().serializeToString(_xmlDoc);
    _undoStack.push(curXml);
    const nextXml = _redoStack.pop();
    _updateUndoRedoButtons();
    showToast('↪ Đã làm lại', 'info', 1000);
    await _parseAndLoadXml(nextXml, false);
  }

  /* ─── Thay Đổi Cao Độ Nốt (Modify Pitch) ─────────────────────── */
  async function modifyPitch(step, octave = null, alter = 0) {
    const curVoice = _selectedPosition.voice;
    const curNote = _selectedPosition.activeVoiceMap[curVoice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const finalOct = (octave !== null) ? octave : curNote.octave;
    window.EditorModifiers.setNotePitchInXml(_xmlDoc, curNote.xmlNode, step, finalOct, alter);
    window.EditorAudio.playSinglePitch(step, finalOct, alter, 0.4);

    curNote.step = step.toUpperCase();
    curNote.octave = finalOct;
    curNote.alter = alter;
    curNote.isRest = false;

    await _renderOsmdFromXmlDoc();
  }

  /* ─── Render OSMD từ XML Doc ─────────────────────────────────── */
  async function _renderOsmdFromXmlDoc() {
    if (!_xmlDoc || !_osmd) return;
    const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
    await _osmd.load(xmlString);
    _osmd.setLogLevel('warn');
    _osmd.render();

    if (window.EditorHealth) {
      _measureHealth = window.EditorHealth.validateAllMeasures(_xmlDoc, _selectedPosition, (mNum) => {
        _selectedPosition.measureNumber = mNum;
        _selectedPosition.beatIndex = 0;
        _refreshInspectorUI();
      });
      window.EditorHealth.applyMeasureSvgHighlights(_osmd, _measureHealth, _selectedPosition);
    }
    _refreshInspectorUI();

    if (window.EditorDrag) {
      window.EditorDrag.wireVerticalDragEvents({
        osmd: _osmd,
        zoom: _zoom,
        getZoom: () => _zoom,
        selectedPosition: _selectedPosition,
        onSelectNote: (mNum, bIdx, voice) => {
          _selectedPosition.measureNumber = mNum;
          _selectedPosition.beatIndex = bIdx;
          _selectedPosition.voice = voice;
          _refreshInspectorUI();
        },
        onPlayPitch: (step, oct, alt, dur) => window.EditorAudio.playSinglePitch(step, oct, alt, dur),
        onCommitPitch: (step, oct, alt) => modifyPitch(step, oct, alt)
      });
    }
  }

  async function _parseAndLoadXml(xmlString, resetUndo = true) {
    const parser = new DOMParser();
    _xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    if (resetUndo) {
      _undoStack = [];
      _redoStack = [];
      _setDirty(false);
      _updateUndoRedoButtons();
    }
    await _renderOsmdFromXmlDoc();
  }

  /* ─── Quản Lý Phiên Bản & Lưu Server ─────────────────────────── */
  function openSaveVersionModal() {
    const modal = document.getElementById('save-version-modal');
    if (!modal) return;
    let badCount = 0;
    Object.values(_measureHealth).forEach(m => {
      if (m.status !== 'ok') badCount++;
    });

    const warnBox = document.getElementById('save-measure-warning-box');
    const warnText = document.getElementById('save-warning-text');
    if (warnBox && warnText) {
      if (badCount > 0) {
        warnBox.classList.remove('hidden');
        warnText.textContent = `Phát hiện ${badCount} ô nhịp chưa chuẩn phách!`;
      } else {
        warnBox.classList.add('hidden');
      }
    }

    const overwriteOption = document.getElementById('label-choice-overwrite');
    const overwriteRadio = document.getElementById('radio-save-overwrite');
    const newRadio = document.getElementById('radio-save-new');
    const nameInput = document.getElementById('input-version-name');

    if (_currentVersion) {
      overwriteOption?.classList.remove('hidden');
      if (overwriteRadio) overwriteRadio.checked = true;
      if (nameInput) nameInput.value = _currentVersion.version_name;
    } else {
      overwriteOption?.classList.add('hidden');
      if (newRadio) newRadio.checked = true;
      if (nameInput) nameInput.value = `Bản chỉnh sửa ngày ${new Date().toLocaleDateString('vi-VN')}`;
    }
    modal.classList.remove('hidden');
  }

  function closeSaveVersionModal() {
    document.getElementById('save-version-modal')?.classList.add('hidden');
  }

  async function confirmSaveVersion() {
    if (!_currentSong || !_xmlDoc) return;
    const isOverwrite = document.getElementById('radio-save-overwrite')?.checked;
    const versionName = document.getElementById('input-version-name')?.value?.trim() || '';
    const description = document.getElementById('input-version-desc')?.value?.trim() || '';
    const confirmBtn = document.getElementById('btn-confirm-save-version');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
      const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
      const payload = {
        song_id: _currentSong.id,
        xml: xmlString,
        version_name: versionName,
        description: description,
        version_id: (isOverwrite && _currentVersion) ? _currentVersion.id : null
      };

      const data = await window.ApiService.songs.saveVersion(payload);

      if (data.success) {
        _setDirty(false);
        closeSaveVersionModal();
        showToast(data.message || '✅ Đã lưu phiên bản thành công!', 'success', 2500);

        if (data.data) _currentVersion = data.data;

        // Xóa cache Service Worker cho MusicXML khi lưu phiên bản mới
        if ('caches' in window) {
          caches.open('sheetapp-musicxml-v4').then(c => {
            if (_currentSong?.xmlPath) c.delete(_currentSong.xmlPath);
            if (data.data?.xml_path) c.delete(data.data.xml_path);
          }).catch(() => {});
        }
        await fetchSongVersions(_currentSong.id);
      } else {
        showToast(`❌ ${data.error || 'Lưu thất bại'}`, 'error', 3000);
      }
    } catch (e) {
      console.error('[Editor] Lưu phiên bản lỗi:', e);
      showToast('Lỗi kết nối khi lưu phiên bản!', 'error');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  /* ─── Tải Bài Hát & Xử Lý Nạp File ────────────────────────────── */
  async function fetchSongsList() {
    try {
      const data = await window.ApiService.songs.list();
      _songsList = Array.isArray(data) ? data : (data.data || []);
      _renderSongListModal();

      const params = new URLSearchParams(window.location.search);
      const songParam = params.get('song') || params.get('id');
      if (songParam) {
        const pClean = String(songParam).trim().toLowerCase();
        const found = _songsList.find(s => {
          const sId = String(s.id || '').toLowerCase();
          const httlvnId = String(s.httlvnId || '');
          return sId === pClean || httlvnId === pClean || sId === `thanh-ca-${pClean.padStart(3, '0')}` || sId.includes(pClean);
        });
        if (found) {
          await loadSong(found);
          return;
        }
      }
      if (_songsList.length > 0) await loadSong(_songsList[0]);
    } catch (e) {
      console.error('[Editor] Tải danh sách bài hát lỗi:', e);
      showToast('Không tải được danh sách bài hát!', 'error');
    }
  }

  async function fetchSongVersions(songId) {
    if (!songId) return;
    try {
      const data = await window.ApiService.songs.getVersions(songId);
      _songVersionsList = data.success ? (data.data || []) : (Array.isArray(data) ? data : []);
      _renderVersionsDropdown();
    } catch (e) {
      console.warn('[Editor] Lỗi tải phiên bản:', e);
    }
  }

  function _renderVersionsDropdown() {
    const listEl = document.getElementById('version-dropdown-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const masterItem = document.createElement('div');
    masterItem.className = `version-dropdown-item ${_currentVersion === null ? 'active' : ''}`;
    masterItem.innerHTML = '<span>🎼 Bản Gốc (Master)</span>';
    masterItem.onclick = async () => {
      document.getElementById('editor-version-dropdown')?.classList.add('hidden');
      await loadSong(_currentSong, null);
    };
    listEl.appendChild(masterItem);

    _songVersionsList.forEach(v => {
      const item = document.createElement('div');
      item.className = `version-dropdown-item ${_currentVersion?.id === v.id ? 'active' : ''}`;
      item.innerHTML = `<span>📝 ${window.SafeHtml.escape(v.version_name)}</span>`;
      item.onclick = async () => {
        document.getElementById('editor-version-dropdown')?.classList.add('hidden');
        await loadSong(_currentSong, v);
      };
      listEl.appendChild(item);
    });
  }

  async function loadSong(song, version = null) {
    if (!song) return;
    _currentSong = song;
    _currentVersion = version;

    const label = document.getElementById('current-song-label');
    if (label) label.textContent = `${song.title} (${song.id})`;

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    try {
      const rawPath = version ? (version.xml_path || version.xmlPath) : (song.xmlPath || song.xml_path);
      if (!rawPath) throw new Error('Không tìm thấy đường dẫn XML!');
      const cleanPath = rawPath.replace(/^\//, '');
      const base = (typeof window.__APP_BASE__ === 'string') ? window.__APP_BASE__ : '';
      const fetchUrl = `${base}/` + encodeURI(cleanPath);
      // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xmlText = await res.text();

      _selectedPosition.measureNumber = 1;
      _selectedPosition.beatIndex = 0;
      await _parseAndLoadXml(xmlText, true);

      const url = new URL(window.location);
      url.searchParams.set('song', song.id);
      window.history.replaceState({}, '', url);

      await fetchSongVersions(song.id);
      showToast(`Đã nạp: "${song.title}" (${version ? version.version_name : 'Bản Gốc'})`, 'success', 1500);
    } catch (e) {
      console.error('[Editor] Load XML error:', e);
      showToast('Lỗi khi tải file MusicXML: ' + e.message, 'error');
    } finally {
      if (overlay) overlay.classList.add('hidden');
    }
  }

  function _renderSongListModal(filterText = '') {
    const listEl = document.getElementById('modal-song-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const filter = filterText.toLowerCase().trim();
    const filtered = _songsList.filter(s => {
      if (!filter) return true;
      return s.title.toLowerCase().includes(filter) || String(s.id).includes(filter);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="padding:1rem;color:#94a3b8;text-align:center;">Không tìm thấy bài hát phù hợp.</div>';
      return;
    }

    filtered.slice(0, 100).forEach(song => {
      const btn = document.createElement('button');
      btn.className = 'song-list-item';
      if (_currentSong && String(_currentSong.id) === String(song.id)) {
        btn.classList.add('selected');
      }
      btn.innerHTML = `
        <span class="item-title">${window.SafeHtml.escape(song.title)}</span>
        <span class="item-meta">MS: ${window.SafeHtml.escape(song.id)}</span>
      `;
      btn.onclick = async () => {
        document.getElementById('song-picker-modal')?.classList.add('hidden');
        await loadSong(song);
      };
      listEl.appendChild(btn);
    });
  }

  function showToast(msg, type = 'info', timeout = 2000) {
    const toast = document.getElementById('editor-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `editor-toast ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), timeout);
  }

  function _applyZoom(delta) {
    if (!_osmd) return;
    _zoom = Math.max(0.4, Math.min(2.0, _zoom + delta));
    _osmd.zoom = _zoom;
    _osmd.render();
    if (window.EditorHealth) {
      _measureHealth = window.EditorHealth.validateAllMeasures(_xmlDoc, _selectedPosition);
      window.EditorHealth.applyMeasureSvgHighlights(_osmd, _measureHealth, _selectedPosition);
    }
    const lbl = document.getElementById('zoom-label');
    if (lbl) lbl.textContent = `${Math.round(_zoom * 100)}%`;
  }

  /* ─── Khởi Tạo Khi Tải Trang ─────────────────────────────────── */
  async function init() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    _osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawLyricist: true,
      drawMetronomeMarks: true,
      drawPartNames: false
    });

    if (window.EditorUI) {
      window.EditorUI.bindEditorEvents({
        onZoom: (delta) => _applyZoom(delta),
        onUndo: undo,
        onRedo: redo,
        onOpenSaveModal: openSaveVersionModal,
        onCloseSaveModal: closeSaveVersionModal,
        onConfirmSave: confirmSaveVersion,
        onAutoFillAllRests: () => window.EditorHealth?.autoFillAllRests(_xmlDoc, _measureHealth, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast),
        onSelectSongModal: () => {
          document.getElementById('song-picker-modal')?.classList.remove('hidden');
          _renderSongListModal();
        },
        onCloseSongModal: () => document.getElementById('song-picker-modal')?.classList.add('hidden'),
        onSearchSongs: (q) => _renderSongListModal(q),
        onPrevSong: () => {
          if (!_songsList.length || !_currentSong) return;
          const idx = _songsList.findIndex(s => String(s.id) === String(_currentSong.id));
          if (idx > 0) loadSong(_songsList[idx - 1]);
        },
        onNextSong: () => {
          if (!_songsList.length || !_currentSong) return;
          const idx = _songsList.findIndex(s => String(s.id) === String(_currentSong.id));
          if (idx >= 0 && idx < _songsList.length - 1) loadSong(_songsList[idx + 1]);
        },
        onSelectVoice: (v) => {
          _selectedPosition.voice = v;
          _refreshInspectorUI();
          const cur = _selectedPosition.activeVoiceMap[v];
          if (cur && !cur.isRest) window.EditorAudio.playSinglePitch(cur.step, cur.octave, cur.alter);
        },
        onModifyPitch: (step, oct, alt) => modifyPitch(step, oct, alt),
        onModifyOctave: (delta) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.modifyOctave(cur, delta, modifyPitch);
        },
        onModifyDuration: (type) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.modifyDuration(_xmlDoc, cur, type, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onToggleDot: () => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.toggleDot(_xmlDoc, cur, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onDeleteAsRest: () => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.deleteNoteAsRest(_xmlDoc, cur, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onSplitNote: () => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.splitCurrentNote(_xmlDoc, cur, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onToggleArticulation: (art) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.toggleArticulation(_xmlDoc, cur, art, '', _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onStepSemitone: (delta) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.stepSemitone(cur, _selectedPosition.voice, delta, window.EditorAudio.pitchToMidi, modifyPitch);
        },
        onSubdivideRests: (factor) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.subdivideNoteToRests(_xmlDoc, cur, factor, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onMergeRests: () => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.mergeWithNextRest(_xmlDoc, cur, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onModifyAccidental: (acc) => {
          const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
          window.EditorModifiers?.modifyAccidental(cur, acc, modifyPitch);
        },
        onAutoFillMeasureRests: () => {
          window.EditorHealth?.autoFillRestForMeasure(_xmlDoc, _selectedPosition.measureNumber, _measureHealth, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, showToast);
        },
        onTogglePlayback: () => window.EditorAudio?.toggleScorePlayback(_osmd, _mixerState, _selectedPosition, showToast),
        onRewindPlayback: () => window.EditorAudio?.rewindScorePlayback(_osmd, showToast),
        onOpenAiModal: () => window.EditorAI?.openAiHarmonizeModal(),
        onCloseAiModal: () => window.EditorAI?.closeAiHarmonizeModal(),
        onConfirmAiHarmonize: () => {
          window.EditorAI?.executeAiHarmonization(_xmlDoc, _selectedPosition, _saveSnapshotForUndo, _renderOsmdFromXmlDoc, 
            (mNum) => window.EditorParser.getMeasureChordsSATB(_xmlDoc, mNum),
            (mNum, bIdx) => window.EditorParser.extractSatbNotesAt(_xmlDoc, mNum, bIdx),
            window.EditorModifiers.setNotePitchInXml, 
            () => window.EditorAudio.playSatbChord(_selectedPosition), 
            showToast);
        },
        onToggleRehearsal: () => {
          window.EditorAI?.toggleRehearsalMode(window.EditorAudio.getPlaybackState(), _selectedPosition, () => window.EditorAudio.playSatbChord(_selectedPosition), showToast);
        },
        onOpenExportModal: () => window.EditorExport?.openExportModal(),
        onCloseExportModal: () => window.EditorExport?.closeExportModal(),
        onExportPdf: () => window.EditorExport?.exportPdfScore(showToast),
        onExportXml: () => window.EditorExport?.exportMusicXmlScore(_xmlDoc, _currentSong, showToast),
        onExportMidi: () => window.EditorExport?.exportMidiScore(_xmlDoc, _currentSong, _mixerState, 
          (mNum) => window.EditorParser.getMeasureChordsSATB(_xmlDoc, mNum), 
          window.EditorAudio.pitchToMidi, 
          showToast),
        getCurrentNote: () => _selectedPosition.activeVoiceMap[_selectedPosition.voice],
        getSelectedPosition: () => _selectedPosition
      });
    }

    if (window.EditorMidi) {
      window.EditorMidi.buildMiniPiano((step, oct, alt) => modifyPitch(step, oct, alt));
      window.EditorMidi.initWebMidi((step, oct, alt) => modifyPitch(step, oct, alt));
    }
    await fetchSongsList();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Xuất API toàn cục
  window.SheetEditor = {
    loadSong,
    modifyPitch,
    undo,
    redo,
    toggleScorePlayback: () => window.EditorAudio?.toggleScorePlayback(_osmd, _mixerState, _selectedPosition, showToast),
    exportPdfScore: () => window.EditorExport?.exportPdfScore(showToast),
    exportMusicXmlScore: () => window.EditorExport?.exportMusicXmlScore(_xmlDoc, _currentSong, showToast),
    exportMidiScore: () => window.EditorExport?.exportMidiScore(_xmlDoc, _currentSong, _mixerState, 
      (mNum) => window.EditorParser.getMeasureChordsSATB(_xmlDoc, mNum), 
      window.EditorAudio.pitchToMidi, 
      showToast),
    saveVersion: confirmSaveVersion,
    getOsmd: () => _osmd,
    getSelectedPosition: () => _selectedPosition,
    getXmlDoc: () => _xmlDoc
  };
})();
