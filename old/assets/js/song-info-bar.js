/**
 * song-info-bar.js — Sprint A1
 * Strip thông tin bài nhạc: tông, nhịp, BPM, số nhịp
 * Hiển thị ngay khi load bài để user biết context ngay lập tức.
 *
 * v2: Nội dung Nhật ký hiển thị INLINE ngay trên strip (không qua popup)
 *     Admin thấy nút ✎ để mở panel chỉnh sửa.
 */
const SongInfoBar = (() => {
  'use strict';

  let _songData  = null;
  let _songId    = null;

  function init() {
    document.getElementById('btn-song-info-toggle')?.addEventListener('click', _toggle);
  }

  function loadSong(xmlString, song) {
    if (!xmlString) { clearSong(); return; }
    _songId   = song?.id || song?.httlvnId || null;
    _songData = _parseXml(xmlString, song);
    _render(_songData);
    document.getElementById('song-info-strip')?.classList.remove('si-hidden');
  }

  function clearSong() {
    _songData = null;
    _songId   = null;
    document.getElementById('song-info-strip')?.classList.add('si-hidden');
    _clearNotesInline();
  }

  /* ─── Parse MusicXML ─────────────────────────────────────── */
  function _parseXml(xmlString, song) {
    const info = {
      number:       song?.httlvnId ? String(song.httlvnId).padStart(3, '0') : '',
      title:        song?.title || '',
      key:          '',
      mode:         '',
      timeBeats:    '',
      timeBeatType: '',
      tempo:        '',
      measureCount: 0,
    };

    try {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(xmlString, 'text/xml');

      // Key signature
      const keyEl = doc.querySelector('key');
      if (keyEl) {
        const fifths = parseInt(keyEl.querySelector('fifths')?.textContent || '0');
        const mode   = (keyEl.querySelector('mode')?.textContent || 'major').toLowerCase();
        info.key     = _fifthsToKeyName(fifths, mode);
        info.mode    = mode === 'minor' ? 'thứ' : 'trưởng';
      }

      // Time signature
      const timeEl = doc.querySelector('time');
      if (timeEl) {
        info.timeBeats    = timeEl.querySelector('beats')?.textContent || '';
        info.timeBeatType = timeEl.querySelector('beat-type')?.textContent || '';
      }

      // Tempo
      const perMin = doc.querySelector('per-minute');
      if (perMin) {
        info.tempo = Math.round(parseFloat(perMin.textContent));
      } else {
        const soundEl = doc.querySelector('sound[tempo]');
        if (soundEl) info.tempo = Math.round(parseFloat(soundEl.getAttribute('tempo')));
      }

      // Measure count (first part only)
      const part = doc.querySelector('part');
      if (part) info.measureCount = part.querySelectorAll('measure').length;

    } catch (e) {
      console.warn('[SongInfoBar] Parse error:', e);
    }

    return info;
  }

  /* Chuyển đổi fifths → tên key */
  function _fifthsToKeyName(fifths, mode) {
    const sharps = ['C','G','D','A','E','B','F#','C#'];
    const flats  = ['C','F','Bb','Eb','Ab','Db','Gb','Cb'];
    const key = fifths >= 0 ? sharps[Math.min(fifths, 7)] : flats[Math.min(-fifths, 7)];

    if (mode === 'minor') {
      const minorMap = {
        C:'Am', G:'Em', D:'Bm', A:'F#m', E:'C#m', B:'G#m', 'F#':'D#m', 'C#':'A#m',
        F:'Dm', Bb:'Gm', Eb:'Cm', Ab:'Fm', Db:'Bbm', Gb:'Ebm', Cb:'Abm',
      };
      return minorMap[key] || key + 'm';
    }
    return key;
  }

  /* ─── Render chips (hàng trên) ───────────────────────────── */
  function _render(info) {
    const inner = document.getElementById('si-inner');
    if (!inner) return;

    const chips = [];
    if (info.key)          chips.push(`<span class="si-chip si-key">🎵 ${info.key} ${info.mode}</span>`);
    if (info.timeBeats)    chips.push(`<span class="si-chip si-time">♩ ${info.timeBeats}/${info.timeBeatType}</span>`);
    if (info.tempo)        chips.push(`<span class="si-chip si-tempo">= ${info.tempo} bpm</span>`);
    if (info.measureCount) chips.push(`<span class="si-chip si-measures">${info.measureCount} nhịp</span>`);

    // Chord set chip
    const currentSet   = window.ChordCanvas?.getCurrentSet?.();
    const chordCount   = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    if (currentSet && currentSet !== 'default') {
      const countLabel = chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có';
      const chipClass  = chordCount > 0 ? 'si-chip si-chord-set si-chord-has' : 'si-chip si-chord-set si-chord-empty';
      chips.push(`<span class="${chipClass}" title="Bộ hợp âm: ${currentSet}">🎸 ${currentSet} · ${countLabel}</span>`);
    } else if (currentSet === 'default') {
      chips.push(`<span class="si-chip si-chord-set" title="Hợp âm từ TLH (gốc)">🎸 TLH (gốc)</span>`);
    }

    inner.innerHTML = chips.join('');

    // Render notes inline (hàng dưới)
    _renderNotesInline();
  }

  /* ─── Render nội dung nhật ký INLINE (hàng dưới strip) ───── */
  function _renderNotesInline() {
    const container = document.getElementById('si-notes-inline');
    if (!container) return;

    const notes = _loadNotes();
    const hasData = notes.key || notes.bpm || notes.text;

    if (!hasData) {
      container.classList.add('si-notes-hidden');
      container.innerHTML = '';
      return;
    }

    const isAdmin = window.Auth?.isAdmin?.() ?? false;
    const parts   = [];

    // Tông lưu
    if (notes.key) {
      parts.push(`<span class="si-ni-key">🎵 ${_esc(notes.key)}</span>`);
    }

    // BPM
    if (notes.bpm) {
      if (parts.length) parts.push(`<span class="si-ni-dot">·</span>`);
      parts.push(`<span class="si-ni-bpm">♩ = ${_esc(notes.bpm)}</span>`);
    }

    // Ghi chú text
    if (notes.text) {
      if (parts.length) parts.push(`<span class="si-ni-dot">—</span>`);
      parts.push(`<span class="si-ni-text">${_esc(notes.text).replace(/\n/g, '  ·  ')}</span>`);
    }

    // Nút ✎ (chỉ admin mới thấy)
    if (isAdmin) {
      parts.push(`<button class="si-ni-edit" id="si-ni-edit-btn" title="Sửa nhật ký">✎ sửa</button>`);
    }

    container.innerHTML = parts.join('');
    container.classList.remove('si-notes-hidden');

    // Wire nút ✎ → mở panel chỉnh sửa
    document.getElementById('si-ni-edit-btn')?.addEventListener('click', () => {
      window.PerformanceNotes?.toggle?.();
    });
  }

  function _clearNotesInline() {
    const el = document.getElementById('si-notes-inline');
    if (el) { el.classList.add('si-notes-hidden'); el.innerHTML = ''; }
  }

  /* Gọi lại _render để cập nhật chord chip sau khi set switch */
  function refreshChordChip() {
    if (_songData) _render(_songData);
  }

  /* Đọc notes từ PerformanceNotes cache */
  function _loadNotes() {
    if (!_songId) return {};
    return window.PerformanceNotes?.getNotes?.(_songId) || {};
  }

  /* Gọi sau khi lưu Nhật Ký — cập nhật inline ngay */
  function refreshNotesChip(songId) {
    if (songId && songId !== _songId) return;
    if (_songData) _renderNotesInline();
  }

  function _toggle() {
    const topRow = document.querySelector('.si-top-row');
    const notesEl = document.getElementById('si-notes-inline');
    const btn = document.getElementById('btn-song-info-toggle');
    if (!topRow) return;
    const collapsed = topRow.classList.toggle('si-collapsed');
    // Ẩn cả notes inline khi collapse
    if (notesEl) notesEl.classList.toggle('si-notes-hidden', collapsed);
    if (btn) btn.title  = collapsed ? 'Hiện thông tin bài' : 'Thu gọn';
    if (btn) btn.textContent = collapsed ? '▶' : '▼';
  }

  /* Escape HTML */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSongInfo() { return _songData; }
  function getSongKey()  { return _songData?.key || ''; }

  return { init, loadSong, clearSong, getSongInfo, getSongKey, refreshChordChip, refreshNotesChip };
})();

window.SongInfoBar = SongInfoBar;
