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

    const canEdit = (window.Auth?.isAdmin?.() || window.Auth?.isBanhat?.()) ?? false;
    const inSetlist = document.querySelector('.toolbar-left')?.classList.contains('in-setlist');

    if (!hasData && !inSetlist) {
      container.classList.add('si-notes-hidden');
      container.innerHTML = '';
      return;
    }

    const parts = [];

    if (inSetlist) {
      const setlist = window.SetlistUI?.getCurrentSetlist?.();
      const idx = window.SetlistUI?.getCurrentIndex?.();
      if (setlist && setlist.items && idx !== undefined && idx >= 0) {
        parts.push(`<span class="si-chip" style="background:rgba(109,40,217,0.12);color:var(--accent);font-weight:600;padding:1px 6px;border-radius:3px;">📋 Setlist: Bài ${idx + 1}/${setlist.items.length}</span>`);
      }
    }

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

    // Nút ✎ sửa ghi chú (admin & banhat)
    if (canEdit) {
      parts.push(`<button class="si-ni-edit" id="si-ni-edit-btn" title="Ghi chú & Nhật ký bài tập">✎ ${hasData ? 'sửa' : 'ghi chú'}</button>`);
      if (inSetlist) {
        parts.push(`<button class="si-ni-save-setlist" id="si-ni-save-setlist-btn" title="Lưu nhanh Tông và Tempo đang tập vào bài này trong Setlist" style="background:var(--accent);color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:0.75rem;cursor:pointer;margin-left:4px;font-weight:600;">💾 Lưu vào Setlist</button>`);
      }
    }

    container.innerHTML = parts.join('');
    container.classList.remove('si-notes-hidden');

    // Wire nút ✎ → mở panel chỉnh sửa
    document.getElementById('si-ni-edit-btn')?.addEventListener('click', () => {
      window.PerformanceNotes?.toggle?.();
    });

    // Wire nút Lưu vào Setlist
    document.getElementById('si-ni-save-setlist-btn')?.addEventListener('click', async () => {
      const setlist = window.SetlistUI?.getCurrentSetlist?.();
      const idx = window.SetlistUI?.getCurrentIndex?.();
      if (!setlist || !setlist.items || idx === undefined || idx < 0) return;
      const item = setlist.items[idx];
      const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      const curBpm = window.Metronome?.getBpm?.() ?? null;
      const curBeats = window.Metronome?.getBeatsPerMeasure?.() ?? 4;

      try {
        await window.ApiService.setlists.updateItem(item.id, {
          transpose_key: curTranspose,
          bpm: curBpm,
          beats_per_measure: curBeats
        });
        item.transpose_key = curTranspose;
        item.bpm = curBpm;
        item.beats_per_measure = curBeats;

        // Cập nhật PerformanceNotes để đồng bộ
        if (window.PerformanceNotes) {
          const origKey = _songData?.key || '';
          let practicedKey = origKey;
          if (origKey && curTranspose !== 0 && window.TransposeEngine) {
            practicedKey = window.TransposeEngine.transposeChord(origKey, curTranspose) || origKey;
          }
          const existing = window.PerformanceNotes.getNotes(item.song_id);
          const newNotes = {
            ...existing,
            key: practicedKey,
            bpm: curBpm ? String(curBpm) : (existing.bpm || ''),
            updatedAt: new Date().toISOString()
          };
          window.ApiService?.sessions?.savePerfNotes?.(item.song_id, newNotes).catch(() => {});
        }

        const origKey = _songData?.key || '';
        let practicedKey = origKey;
        if (origKey && curTranspose !== 0 && window.TransposeEngine) {
          practicedKey = window.TransposeEngine.transposeChord(origKey, curTranspose) || origKey;
        }
        const toneMsg = origKey ? `Tone: ${origKey} | Tập: ${practicedKey}` : `Tông: ${curTranspose > 0 ? '+' : ''}${curTranspose}`;
        window.App?.showToast?.(`✅ Đã lưu ${toneMsg}${curBpm ? ` & ♩${curBpm} BPM` : ''} vào Setlist!`, 'success');
        window.SetlistUI?.renderSetlistItems?.();
        _renderNotesInline();
      } catch (e) {
        window.App?.showToast?.('Lỗi lưu vào Setlist', 'error');
      }
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
