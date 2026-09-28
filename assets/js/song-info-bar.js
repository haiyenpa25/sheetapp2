/**
 * song-info-bar.js — Sprint A1 & Consolidated Single Row
 * Strip thông tin bài nhạc hiển thị trên 1 DÒNG DUY NHẤT:
 * - Tông gốc & Tông tập (Tone: G | Tập: A (+2)) -> Click để đổi tông
 * - Tốc độ (♩ = 104 bpm ✎) -> Click để đổi Tempo / mở Gõ Nhịp
 * - Nút 💾 Lưu vào Setlist (Luôn ưu tiên hiển thị ngay đầu trên mobile/iPad khi đang trong Setlist)
 * - Nút ✎ Sửa nhật ký
 * - Số chỉ nhịp (2/4, 4/4), Số ô nhịp, Bộ hợp âm, Ghi chú
 *
 * Tự động cập nhật Tông tập và Tempo realtime khi người dùng bấm dịch giọng hoặc chỉnh nhịp.
 */
const SongInfoBar = (() => {
  'use strict';

  let _songData  = null;
  let _songId    = null;

  function init() {
    document.getElementById('btn-song-info-toggle')?.addEventListener('click', _toggle);

    // Gắn sự kiện cho Popover Thông Tin Bài Hát (Ticket L1-3: Gộp vào thanh công cụ)
    const btnPopover = document.getElementById('btn-song-info-popover');
    const popover = document.getElementById('song-info-popover');
    const btnClosePopover = document.getElementById('btn-close-song-info-popover');

    if (btnPopover && popover) {
      btnPopover.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
        if (!popover.classList.contains('hidden')) {
          _updatePopoverContent();
        }
      });
      btnClosePopover?.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.add('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!popover.classList.contains('hidden') && !popover.contains(e.target) && !btnPopover.contains(e.target)) {
          popover.classList.add('hidden');
        }
      });
    }

    // Lắng nghe sự kiện đổi tông từ App / Store để cập nhật Tông tập tức thì
    if (typeof EventBus !== 'undefined') {
      EventBus.on('transpose:changed', ({ value }) => {
        _updateToneChip(value);
      });
      EventBus.on('state:currentTranspose', ({ value }) => {
        _updateToneChip(value);
      });
      // Lắng nghe sự kiện đổi BPM từ Metronome / TempoPick để cập nhật tức thì
      EventBus.on('metronome:bpm', ({ bpm }) => {
        _updateTempoChip(bpm);
      });
    }
  }

  function _updatePopoverContent() {
    if (!_songData) return;
    const titleEl = document.getElementById('si-pop-title');
    const keyEl = document.getElementById('si-pop-key');
    const prKeyEl = document.getElementById('si-pop-practice-key');
    const timeEl = document.getElementById('si-pop-time');
    const tempoEl = document.getElementById('si-pop-tempo');
    const measuresEl = document.getElementById('si-pop-measures');
    const chordsetEl = document.getElementById('si-pop-chordset');

    if (titleEl) titleEl.textContent = _songData.title || '--';
    if (keyEl) keyEl.textContent = _songData.key ? `${_songData.key} ${_songData.mode}` : '--';
    if (prKeyEl) prKeyEl.textContent = _calcPracticedKey();
    if (timeEl) timeEl.textContent = _songData.timeBeats ? `${_songData.timeBeats}/${_songData.timeBeatType}` : '--';
    if (tempoEl) tempoEl.textContent = _songData.tempo ? `♩ = ${_songData.tempo} bpm` : '♩ —';
    if (measuresEl) measuresEl.textContent = _songData.measureCount ? `${_songData.measureCount} ô nhịp` : '--';
    if (chordsetEl) {
      const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
      chordsetEl.textContent = curSet === 'default' ? 'TLH (Gốc)' : curSet;
    }
  }

  function loadSong(xmlString, song) {
    if (!xmlString) { clearSong(); return; }
    _songId   = song?.id || song?.httlvnId || null;
    _songData = _parseXml(xmlString, song);
    if (!_songData.key && song?.defaultKey) {
      _songData.key = song.defaultKey;
    }
    const realSongTempo = Number.parseInt(song?.tempo, 10);
    if (realSongTempo && realSongTempo !== 104) {
      _songData.tempo = realSongTempo;
    }
    _render();
    const strip = document.getElementById('song-info-strip');
    if (strip) strip.classList.remove('si-hidden');
    // Ticket L1-3: Thông tin bài hát đã tích hợp vào Toolbar pill và popover ⓘ
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
      const doc = window.XmlDocCache?.getDoc(xmlString) || new DOMParser().parseFromString(xmlString, 'text/xml');

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

      // Tempo (Ticket L6-2: Bỏ qua tempo giả 104 từ XML)
      let parsedTempo = null;
      const perMin = doc.querySelector('per-minute');
      if (perMin) {
        parsedTempo = Math.round(parseFloat(perMin.textContent));
      } else {
        const soundEl = doc.querySelector('sound[tempo]');
        if (soundEl) parsedTempo = Math.round(parseFloat(soundEl.getAttribute('tempo')));
      }
      if (parsedTempo && parsedTempo !== 104) {
        info.tempo = parsedTempo;
      }

      // Measure count (first part only)
      const part = doc.querySelector('part');
      if (part) info.measureCount = part.querySelectorAll('measure').length;

      // Harmony / chord count (TLH gốc trong MusicXML)
      info.tlhChordCount = doc.querySelectorAll('harmony').length;
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
    if (window.KeyService?.displayKey) {
      return window.KeyService.displayKey(cleanOrig, semitones) || cleanOrig;
    }
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

    // 2. Chip Tông: TÔNG GỐC VÀ TÔNG TẬP (Click để đổi nhanh)
    const origKey = _songData.key || window.Store?.get?.('currentSong')?.defaultKey || '';
    const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
    const practicedKey = _calcPracticedKey(origKey, curTranspose);

    let toneHtml = '';
    if (origKey) {
      if (curTranspose !== 0) {
        const diffStr = curTranspose > 0 ? `+${curTranspose}` : `${curTranspose}`;
        toneHtml = `🎵 Tông: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(practicedKey)}</strong> <span class="si-tone-diff">(${diffStr})</span>`;
      } else {
        toneHtml = `🎵 Tông: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(origKey)}</strong>`;
      }
    } else {
      toneHtml = `🎵 Tập: <strong>${_esc(practicedKey)}</strong>`;
    }
    chips.push(`<span class="si-chip si-key" id="si-tone-chip" role="button" tabindex="0" title="Click để chọn tông tập nhanh">${toneHtml}</span>`);

    // 3. Chip Tempo / BPM (Ticket L0-15: coi 104 là "chưa có tempo", hiện "♩ —", bấm để đặt)
    let effectiveBpm = null;
    let hasRealTempo = false;
    if (inSetlist && setlist?.items?.[idx]?.bpm) {
      effectiveBpm = Number.parseInt(setlist.items[idx].bpm, 10);
      hasRealTempo = Boolean(effectiveBpm > 0 && effectiveBpm !== 104);
    } else if (notes.bpm) {
      effectiveBpm = Number.parseInt(notes.bpm, 10);
      hasRealTempo = Boolean(effectiveBpm > 0 && effectiveBpm !== 104);
    } else if (_songData.tempo) {
      const parsed = Number.parseInt(_songData.tempo, 10);
      if (parsed > 0 && parsed !== 104) {
        effectiveBpm = parsed;
        hasRealTempo = true;
      }
    }
    if (hasRealTempo && effectiveBpm) {
      chips.push(`<span class="si-chip si-tempo" id="si-tempo-chip" style="cursor:pointer;" title="Click để chỉnh Tempo (BPM) / Gõ nhịp">♩ = <strong>${effectiveBpm}</strong> bpm <span style="font-size:0.75em;opacity:0.8;">✎</span></span>`);
    } else {
      chips.push(`<span class="si-chip si-tempo" id="si-tempo-chip" style="cursor:pointer;" title="Chưa có tempo · Click để đặt Tempo (BPM) / Gõ nhịp">♩ — <span style="font-size:0.75em;opacity:0.8;">✎</span></span>`);
    }

    // 4. ⭐ NÚT LƯU VÀO SETLIST: ĐƯA LÊN NGAY SAU TÔNG & TEMPO ĐỂ HIỆN RÕ TRÊN MOBILE / IPAD
    if (inSetlist) {
      chips.push(`<button class="si-chip-btn si-btn-save-setlist" id="si-ni-save-setlist-btn" title="Lưu nhanh Tông và Tempo đang tập vào bài này trong Setlist">💾 Lưu vào Setlist</button>`);
    }

    // 5. Nút ✎ Nhật ký
    if (canEdit) {
      const hasData = Boolean(notes.key || notes.bpm || notes.text);
      chips.push(`<button class="si-chip-btn si-btn-edit" id="si-ni-edit-btn" title="Ghi chú & Nhật ký bài tập">✎ ${hasData ? 'Sửa nhật ký' : 'Nhật ký'}</button>`);
    }

    // 6. Số chỉ nhịp
    if (_songData.timeBeats && _songData.timeBeatType) {
      chips.push(`<span class="si-chip si-time" title="Số chỉ nhịp">♩ ${_songData.timeBeats}/${_songData.timeBeatType}</span>`);
    }

    // 7. Số ô nhịp
    if (_songData.measureCount) {
      chips.push(`<span class="si-chip si-measures" title="Tổng số ô nhịp">${_songData.measureCount} nhịp</span>`);
    }

    // 8. Bộ hợp âm (Ưu tiên HD thay cho TLH; L-D1 & Core Rule 1)
    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const chordCount = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    const tlhCount   = _songData?.tlhChordCount || Object.keys(window.ChordCanvasXML?.readXmlChords?.() ?? {}).length;
    const isHdEmpty  = (currentSet === 'HD' && chordCount === 0 && tlhCount > 0);
    const isHdSparse = (currentSet === 'HD' && chordCount > 0 && tlhCount > 0 && (chordCount / tlhCount) < 0.3);

    if (isHdEmpty) {
      chips.push(`<span id="si-chord-set-chip" class="si-chip si-chord-set si-chord-fallback" title="Bộ HD chưa có hợp âm cho bài này — đang hiển thị bản chuẩn TLH gốc (${tlhCount} hợp âm, Core Rule 1). Bấm để chuyển sang TLH" style="cursor:pointer;touch-action:manipulation;background:rgba(217,119,6,0.15);color:var(--warning,#d97706);border:1px solid rgba(217,119,6,0.3);">🎸 HD chưa có · đang hiện TLH</span>`);
    } else if (isHdSparse) {
      chips.push(`<span id="si-chord-set-chip" class="si-chip si-chord-set si-chord-sparse" title="Bộ HD chỉ có ${chordCount}/${tlhCount} hợp âm (<30%). Bấm 1 chạm để xem bộ TLH đầy đủ (HD còn thiếu — xem TLH)" style="cursor:pointer;touch-action:manipulation;background:rgba(217,119,6,0.15);color:var(--warning,#d97706);border:1px solid rgba(217,119,6,0.3);">🎸 HD còn thiếu — xem TLH (● ${chordCount}/${tlhCount})</span>`);
    } else if (currentSet && currentSet !== 'default') {
      const countLabel = chordCount > 0 ? ` · ● ${chordCount}` : ' · ○ Chưa có';
      const chipClass  = chordCount > 0 ? 'si-chip si-chord-set si-chord-has' : 'si-chip si-chord-set si-chord-empty';
      const label      = currentSet === 'HD' ? '⭐ HD' : currentSet;
      chips.push(`<span id="si-chord-set-chip" class="${chipClass}" title="Đang chọn ${_esc(label)}. Bấm để chuyển đổi nhanh sang TLH (gốc)" style="cursor:pointer;touch-action:manipulation;">🎸 ${_esc(label)}${countLabel}</span>`);
    } else if (currentSet === 'default') {
      const countLabel = tlhCount > 0 ? ` · ● ${tlhCount}` : '';
      chips.push(`<span id="si-chord-set-chip" class="si-chip si-chord-set" title="Đang chọn TLH (gốc). Bấm để chuyển đổi nhanh sang bộ HD (Ưu tiên)" style="cursor:pointer;touch-action:manipulation;">🎸 TLH (gốc)${countLabel}</span>`);
    }

    // 9. Nút 🖨️ In Lời & Hợp âm (D14)
    chips.push(`<button class="si-chip-btn si-btn-print" id="si-ni-print-btn" title="In hoặc lưu PDF bản Lời & Hợp âm chuẩn A4">🖨️ In Lời & Hợp âm</button>`);

    // 10. Ghi chú vắn tắt (nếu có)
    if (notes.text) {
      const cleanNote = _esc(notes.text.replace(/\r?\n/g, ' '));
      chips.push(`<span class="si-chip si-notes" title="${_esc(notes.text)}">📝 ${cleanNote}</span>`);
    }

    inner.innerHTML = chips.join('');
    _loadSongUsageChip(_songId);
    _updatePopoverContent();

    // Wire sự kiện click vào Chip Tông để đổi nhanh
    const toneChipEl = document.getElementById('si-tone-chip');
    toneChipEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toneChipEl.click();
      }
    });
    toneChipEl?.addEventListener('click', async () => {
      const curSong = window.Store?.get?.('currentSong');
      const songTitle = curSong?.title || _songData.title || 'Bài hát';
      const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      const oKey = _songData.key || curSong?.defaultKey || '';
      const curBpm = window.Metronome?.getBpm?.() || effectiveBpm || 100;

      if (window.TransposePick) {
        const res = await window.TransposePick.show(songTitle, currentTranspose, oKey, curBpm, toneChipEl);
        if (res !== null) {
          const newTrans = typeof res === 'object' ? res.transpose : res;
          if (newTrans !== null && newTrans !== currentTranspose) {
            if (window.App?.setTransposeDirect) {
              window.App.setTransposeDirect(newTrans);
            } else if (window.App?.transposeBy) {
              window.App.transposeBy(newTrans - currentTranspose);
            }
          }
          if (typeof res === 'object' && res.bpm) {
            window.Metronome?.setBpm?.(res.bpm);
            _updateTempoChip(res.bpm);
          }
        }
      }
    });

    // Wire sự kiện click vào Chip Tempo để đổi nhanh / gõ nhịp
    document.getElementById('si-tempo-chip')?.addEventListener('click', async () => {
      const curBpm = window.Metronome?.getBpm?.() || effectiveBpm || 80;
      if (!window.TempoPick && window.ScriptLoader?.loadModal) {
        await window.ScriptLoader.loadModal('tempo');
      }
      if (window.TempoPick) {
        const newBpm = await window.TempoPick.show(curBpm);
        if (newBpm && newBpm !== curBpm) {
          window.Metronome?.setBpm?.(newBpm);
          _updateTempoChip(newBpm);
          if (_songId && window.ApiService?.songs?.update) {
            try {
              await window.ApiService.songs.update(_songId, { tempo: newBpm });
              if (_songData) _songData.tempo = newBpm;
              window.App?.showToast?.(`⚡ Đã lưu Tempo: ♩ = ${newBpm} BPM vào bài hát`, 'success', 2000);
            } catch (err) {
              window.App?.showToast?.(`⚡ Đã đặt Tempo: ♩ = ${newBpm} BPM (phiên tập)`, 'info', 1500);
            }
          } else {
            window.App?.showToast?.(`⚡ Đã đặt Tempo: ♩ = ${newBpm} BPM`, 'info', 1500);
          }
        }
      } else if (window.Metronome) {
        window.Metronome.togglePanel();
      }
    });

    // Wire nút ✎ Nhật ký
    document.getElementById('si-ni-edit-btn')?.addEventListener('click', () => {
      window.PerformanceNotes?.toggle?.();
    });

    // Wire nút 💾 Lưu vào Setlist (luôn hoạt động trên cả mobile và iPad)
    document.getElementById('si-ni-save-setlist-btn')?.addEventListener('click', async () => {
      const curSetlist = window.SetlistUI?.getCurrentSetlist?.();
      const currentIdx = window.SetlistUI?.getCurrentIndex?.();
      if (!curSetlist || !curSetlist.items || currentIdx === undefined || currentIdx < 0) return;
      const item = curSetlist.items[currentIdx];
      const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      const curBpm = window.Metronome?.getBpm?.() ?? effectiveBpm ?? null;
      const curBeats = window.Metronome?.getBeatsPerMeasure?.() ?? 4;
      const curProfile = window.ChordCanvas?.getCurrentSet?.() || item.chord_profile || 'HD';

      try {
        await window.ApiService.setlists.updateItem(item.id, {
          transpose_key: curTranspose,
          bpm: curBpm,
          beats_per_measure: curBeats,
          chord_profile: curProfile
        });
        item.transpose_key = curTranspose;
        item.bpm = curBpm;
        item.beats_per_measure = curBeats;
        item.chord_profile = curProfile;

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

    // Wire sự kiện click vào Chip Hợp Âm để chuyển đổi nhanh giữa HD và TLH (gốc)
    document.getElementById('si-chord-set-chip')?.addEventListener('click', async () => {
      if (!window.ChordCanvas?.switchSet) return;
      const curSet = window.ChordCanvas.getCurrentSet() || 'HD';
      const targetSet = curSet === 'HD' ? 'default' : 'HD';
      await window.ChordCanvas.switchSet(targetSet);
      const setLabel = targetSet === 'HD' ? '⭐ Bộ HD (Ưu tiên)' : '🎸 Bộ TLH (gốc)';
      window.App?.showToast?.(`Đã chọn ${setLabel}`, 'info', 1800);
      _render();
    });

    // Wire sự kiện in Lời & Hợp âm (D14)
    document.getElementById('si-ni-print-btn')?.addEventListener('click', () => {
      const activeId = _songId || window.Store?.get?.('currentSong')?.id;
      if (!activeId) {
        window.App?.showToast?.('Chưa chọn bài hát để in!', 'warning');
        return;
      }
      const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
      const url = `print/chord-sheet.php?song=${encodeURIComponent(activeId)}&set=${encodeURIComponent(curSet)}&t=${curTranspose}`;
      window.open(url, '_blank');
    });
  }

  /* Cập nhật chip Tông khi bấm nút dịch giọng trên toolbar */
  function _updateToneChip(semitones) {
    const toneChip = document.getElementById('si-tone-chip');
    if (!toneChip) return;

    const origKey = _songData?.key || window.Store?.get?.('currentSong')?.defaultKey || '';
    if (!origKey && !_songData) return;

    const semi = semitones ?? (window.Store?.get?.('currentTranspose') ?? 0);
    const practicedKey = _calcPracticedKey(origKey, semi);

    let toneHtml = '';
    if (origKey) {
      if (semi !== 0) {
        const diffStr = semi > 0 ? `+${semi}` : `${semi}`;
        toneHtml = `🎵 Tông: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(practicedKey)}</strong> <span class="si-tone-diff">(${diffStr})</span>`;
      } else {
        toneHtml = `🎵 Tông: <strong>${_esc(origKey)}</strong> | Tập: <strong>${_esc(origKey)}</strong>`;
      }
    } else {
      toneHtml = `🎵 Tập: <strong>${_esc(practicedKey)}</strong>`;
    }

    toneChip.innerHTML = toneHtml;
  }

  /* Cập nhật chip Tempo khi BPM thay đổi từ Metronome / TempoPick (Ticket L0-15) */
  function _updateTempoChip(bpm) {
    const tempoChip = document.getElementById('si-tempo-chip');
    if (!tempoChip) return;
    const safeBpm = Number.parseInt(bpm, 10);
    if (!safeBpm || safeBpm === 104) {
      tempoChip.innerHTML = `♩ — <span style="font-size:0.75em;opacity:0.8;">✎</span>`;
      tempoChip.title = 'Chưa có tempo · Click để đặt Tempo (BPM) / Gõ nhịp';
    } else {
      tempoChip.innerHTML = `♩ = <strong>${safeBpm}</strong> bpm <span style="font-size:0.75em;opacity:0.8;">✎</span>`;
      tempoChip.title = 'Click để chỉnh Tempo (BPM) / Gõ nhịp';
    }
  }

  /* Nạp thông tin lịch sử sử dụng bài hát trong chương trình thờ phượng (Tránh nhân đôi chip) */
  async function _loadSongUsageChip(songId) {
    if (!songId || !window.ApiService?.setlists?.songUsage) return;
    try {
      const res = await window.ApiService.setlists.songUsage(songId);
      if (songId !== _songId) return;
      if (res.success && res.data && res.data.total_used > 0) {
        const inner = document.getElementById('si-inner');
        if (!inner) return;
        // Xóa chip usage cũ nếu đã tồn tại để chống nhân đôi (Ticket L0-6)
        inner.querySelectorAll('.si-usage, #si-usage-chip').forEach(el => el.remove());

        const count = res.data.total_used;
        const lastDate = res.data.last_used_date || '';
        const chip = document.createElement('span');
        chip.id = 'si-usage-chip';
        chip.className = 'si-chip si-usage';
        chip.style.cssText = 'background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#93c5fd;cursor:pointer;';
        chip.title = `Đã dùng ${count} lần trong chương trình thờ phượng (Gần nhất: ${lastDate}). Bấm để xem chi tiết`;
        chip.innerHTML = `📅 Dùng ${count} lần`;
        chip.addEventListener('click', () => {
          const historyList = (res.data.history || []).map(h => `• ${h.service_date}: ${h.service_title || 'Chương trình'} (Tone: ${h.transpose_key >= 0 ? '+' : ''}${h.transpose_key})`).join('\n');
          window.App?.showToast?.(`Lịch sử sử dụng bài hát:\n${historyList}`, 'info', 6000);
        });
        inner.appendChild(chip);
      }
    } catch(e) {}
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
    if (window.SafeHtml && typeof window.SafeHtml.escape === 'function') {
      return window.SafeHtml.escape(str);
    }
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSongInfo() { return _songData; }
  function getSongKey()  { return _songData?.key || ''; }

  return {
    init,
    loadSong,
    clearSong,
    getSongInfo,
    getSongKey,
    refreshChordChip,
    refreshNotesChip,
    updateTranspose: _updateToneChip,
    updatePopoverContent: _updatePopoverContent
  };
})();

window.SongInfoBar = SongInfoBar;
