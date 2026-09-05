/**
 * song-info-bar.js — Sprint A1 & Consolidated Single Row
 * Strip thông tin bài nhạc hiển thị trên 1 DÒNG DUY NHẤT:
 * - Tông gốc & Tông tập (Tone: G | Tập: A (+2))
 * - Số chỉ nhịp (2/4, 4/4)
 * - Tốc độ (BPM)
 * - Số ô nhịp
 * - Bộ hợp âm đang chọn
 * - Ghi chú vắn tắt
 * - Nút ✎ Nhật ký
 * - Nút 💾 Lưu vào Setlist (khi đang trong Setlist)
 *
 * Tự động cập nhật Tông tập realtime khi người dùng bấm dịch giọng trên toolbar.
 */
const SongInfoBar = (() => {
  'use strict';

  let _songData  = null;
  let _songId    = null;

  function init() {
    document.getElementById('btn-song-info-toggle')?.addEventListener('click', _toggle);

    // Lắng nghe sự kiện đổi tông từ App / Store để cập nhật Tông tập tức thì
    if (typeof EventBus !== 'undefined') {
      EventBus.on('transpose:changed', ({ value }) => {
        _updateToneChip(value);
      });
      EventBus.on('state:currentTranspose', ({ value }) => {
        _updateToneChip(value);
      });
    }
  }

  function loadSong(xmlString, song) {
    if (!xmlString) { clearSong(); return; }
    _songId   = song?.id || song?.httlvnId || null;
    _songData = _parseXml(xmlString, song);
    if (!_songData.key && song?.defaultKey) {
      _songData.key = song.defaultKey;
    }
    _render();
    document.getElementById('song-info-strip')?.classList.remove('si-hidden');
  }

  function clearSong() {
    _songData = null;
    _songId   = null;
    const strip = document.getElementById('song-info-strip');
    if (strip) strip.classList.add('si-hidden');
    const inner = document.getElementById('si-inner');
    if (inner) inner.innerHTML = '';
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
        const fifths = parseInt(keyEl.querySelector('fifths')?.textContent || '0', 10);
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

  /* Tính Tông tập từ Tông gốc và semitones */
  function _calcPracticedKey(origKey, semitones) {
    if (!origKey) {
      if (!semitones || semitones === 0) return 'Gốc';
      return semitones > 0 ? `+${semitones}` : `${semitones}`;
    }
    const cleanOrig = String(origKey).trim();
    if (!semitones || semitones === 0) return cleanOrig;
    if (window.TransposeEngine?.calcKey) {
      return window.TransposeEngine.calcKey(cleanOrig, semitones) || cleanOrig;
    }
    if (window.TransposeEngine?.transposeChord) {
      return window.TransposeEngine.transposeChord(cleanOrig, semitones) || cleanOrig;
    }
    return cleanOrig;
  }

  /* ─── Render toàn bộ thông tin trên 1 DÒNG DUY NHẤT ──────── */
  function _render() {
    const inner = document.getElementById('si-inner');
    if (!inner || !_songData) return;

    const notes = _loadNotes();
    const canEdit = (window.Auth?.isAdmin?.() || window.Auth?.isBanhat?.()) ?? false;
    const inSetlist = document.querySelector('.toolbar-left')?.classList.contains('in-setlist');
    const setlist = window.SetlistUI?.getCurrentSetlist?.();
    const idx = window.SetlistUI?.getCurrentIndex?.();

    const chips = [];

    // 1. Setlist Badge (khi đang xem bài trong setlist)
    if (inSetlist && setlist && setlist.items && idx !== undefined && idx >= 0) {
      chips.push(`<span class="si-chip si-setlist-chip" title="Bài trong Setlist: ${_esc(setlist.title)}">📋 Setlist: Bài ${idx + 1}/${setlist.items.length}</span>`);
    }

    // 2. Chip Tông: TÔNG GỐC VÀ TÔNG TẬP
    const origKey = _songData.key || window.Store?.get?.('currentSong')?.defaultKey || '';
    const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
    const practicedKey = _calcPracticedKey(origKey, curTranspose);

    let toneHtml = '';
    if (origKey) {
      if (curTranspose !== 0) {
        const diffStr = curTranspose > 0 ? `+${curTranspose}` : `${curTranspose}`;
        toneHtml = `🎵 Tone: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(practicedKey)}</strong> <span class="si-tone-diff">(${diffStr})</span>`;
      } else {
        toneHtml = `🎵 Tone: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(origKey)}</strong>`;
      }
    } else {
      toneHtml = `🎵 Tập: <strong>${_esc(practicedKey)}</strong>`;
    }
    chips.push(`<span class="si-chip si-key" id="si-tone-chip" title="Click để chọn tông tập nhanh">${toneHtml}</span>`);

    // 3. Số chỉ nhịp
    if (_songData.timeBeats && _songData.timeBeatType) {
      chips.push(`<span class="si-chip si-time" title="Số chỉ nhịp">♩ ${_songData.timeBeats}/${_songData.timeBeatType}</span>`);
    }

    // 4. Tempo / BPM
    let effectiveBpm = null;
    if (inSetlist && setlist?.items?.[idx]?.bpm) {
      effectiveBpm = setlist.items[idx].bpm;
    } else if (notes.bpm) {
      effectiveBpm = notes.bpm;
    } else if (_songData.tempo) {
      effectiveBpm = _songData.tempo;
    }
    if (effectiveBpm) {
      chips.push(`<span class="si-chip si-tempo" title="Tốc độ nhịp">♩ = ${effectiveBpm} bpm</span>`);
    }

    // 5. Số ô nhịp
    if (_songData.measureCount) {
      chips.push(`<span class="si-chip si-measures" title="Tổng số ô nhịp">${_songData.measureCount} nhịp</span>`);
    }

    // 6. Bộ hợp âm
    const currentSet = window.ChordCanvas?.getCurrentSet?.();
    const chordCount = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    if (currentSet && currentSet !== 'default') {
      const countLabel = chordCount > 0 ? ` · ● ${chordCount}` : ' · ○ 0';
      const chipClass  = chordCount > 0 ? 'si-chip si-chord-set si-chord-has' : 'si-chip si-chord-set si-chord-empty';
      chips.push(`<span class="${chipClass}" title="Bộ hợp âm: ${currentSet}">🎸 ${currentSet}${countLabel}</span>`);
    } else if (currentSet === 'default') {
      chips.push(`<span class="si-chip si-chord-set" title="Hợp âm từ TLH (gốc)">🎸 TLH (gốc)</span>`);
    }

    // 7. Ghi chú vắn tắt (nếu có)
    if (notes.text) {
      const cleanNote = _esc(notes.text.replace(/\r?\n/g, ' '));
      chips.push(`<span class="si-chip si-notes" title="${_esc(notes.text)}">📝 ${cleanNote}</span>`);
    }

    // 8. Nút ✎ Nhật ký
    if (canEdit) {
      const hasData = Boolean(notes.key || notes.bpm || notes.text);
      chips.push(`<button class="si-chip-btn si-btn-edit" id="si-ni-edit-btn" title="Ghi chú & Nhật ký bài tập">✎ ${hasData ? 'Sửa nhật ký' : 'Nhật ký'}</button>`);
      
      // 9. Nút 💾 Lưu vào Setlist (khi đang trong Setlist)
      if (inSetlist) {
        chips.push(`<button class="si-chip-btn si-btn-save-setlist" id="si-ni-save-setlist-btn" title="Lưu nhanh Tông và Tempo đang tập vào bài này trong Setlist">💾 Lưu vào Setlist</button>`);
      }
    }

    inner.innerHTML = chips.join('');

    // Wire sự kiện click vào Chip Tông để đổi nhanh
    document.getElementById('si-tone-chip')?.addEventListener('click', async () => {
      const curSong = window.Store?.get?.('currentSong');
      const songTitle = curSong?.title || _songData.title || 'Bài hát';
      const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      const oKey = _songData.key || curSong?.defaultKey || '';

      if (window.TransposePick) {
        const newTrans = await window.TransposePick.show(songTitle, currentTranspose, oKey);
        if (newTrans !== null && newTrans !== currentTranspose) {
          if (window.App?.setTransposeDirect) {
            window.App.setTransposeDirect(newTrans);
          } else if (window.App?.transposeBy) {
            window.App.transposeBy(newTrans - currentTranspose);
          }
        }
      }
    });

    // Wire nút ✎ Nhật ký
    document.getElementById('si-ni-edit-btn')?.addEventListener('click', () => {
      window.PerformanceNotes?.toggle?.();
    });

    // Wire nút 💾 Lưu vào Setlist
    document.getElementById('si-ni-save-setlist-btn')?.addEventListener('click', async () => {
      const curSetlist = window.SetlistUI?.getCurrentSetlist?.();
      const currentIdx = window.SetlistUI?.getCurrentIndex?.();
      if (!curSetlist || !curSetlist.items || currentIdx === undefined || currentIdx < 0) return;
      const item = curSetlist.items[currentIdx];
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

        // Cập nhật PerformanceNotes để đồng bộ 2 chiều
        if (window.PerformanceNotes) {
          const oKey = _songData?.key || '';
          const pKey = _calcPracticedKey(oKey, curTranspose);
          const existing = window.PerformanceNotes.getNotes(item.song_id);
          const newNotes = {
            ...existing,
            key: pKey,
            bpm: curBpm ? String(curBpm) : (existing.bpm || ''),
            updatedAt: new Date().toISOString()
          };
          window.ApiService?.sessions?.savePerfNotes?.(item.song_id, newNotes).catch(() => {});
        }

        const oKey = _songData?.key || '';
        const pKey = _calcPracticedKey(oKey, curTranspose);
        const toneMsg = oKey ? `Tone: ${oKey} | Tập: ${pKey}` : `Tông: ${curTranspose > 0 ? '+' : ''}${curTranspose}`;
        window.App?.showToast?.(`✅ Đã lưu ${toneMsg}${curBpm ? ` & ♩${curBpm} BPM` : ''} vào Setlist!`, 'success');
        window.SetlistUI?.renderSetlistItems?.();
        _render();
      } catch (e) {
        window.App?.showToast?.('Lỗi lưu vào Setlist', 'error');
      }
    });
  }

  /* Cập nhật chip Tông khi bấm nút dịch giọng trên toolbar */
  function _updateToneChip(semitones) {
    const toneChip = document.getElementById('si-tone-chip');
    if (!toneChip || !_songData) return;

    const origKey = _songData.key || window.Store?.get?.('currentSong')?.defaultKey || '';
    const semi = semitones ?? (window.Store?.get?.('currentTranspose') ?? 0);
    const practicedKey = _calcPracticedKey(origKey, semi);

    let toneHtml = '';
    if (origKey) {
      if (semi !== 0) {
        const diffStr = semi > 0 ? `+${semi}` : `${semi}`;
        toneHtml = `🎵 Tone: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(practicedKey)}</strong> <span class="si-tone-diff">(${diffStr})</span>`;
      } else {
        toneHtml = `🎵 Tone: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(origKey)}</strong>`;
      }
    } else {
      toneHtml = `🎵 Tập: <strong>${_esc(practicedKey)}</strong>`;
    }

    toneChip.innerHTML = toneHtml;
  }

  /* Đọc notes từ PerformanceNotes cache */
  function _loadNotes() {
    if (!_songId) return {};
    return window.PerformanceNotes?.getNotes?.(_songId) || {};
  }

  /* Refresh khi đổi chord set */
  function refreshChordChip() {
    if (_songData) _render();
  }

  /* Refresh khi lưu ghi chú / nhật ký */
  function refreshNotesChip(songId) {
    if (songId && songId !== _songId) return;
    if (_songData) _render();
  }

  /* Bật / tắt thu gọn thanh thông tin */
  function _toggle() {
    const inner = document.getElementById('si-inner');
    const btn = document.getElementById('btn-song-info-toggle');
    if (!inner) return;
    const collapsed = inner.classList.toggle('si-collapsed');
    if (btn) {
      btn.title = collapsed ? 'Mở rộng thông tin bài' : 'Thu gọn';
      btn.textContent = collapsed ? '▶' : '▼';
    }
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
