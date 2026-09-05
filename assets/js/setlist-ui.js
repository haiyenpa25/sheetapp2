/**
 * setlist-ui.js -> Quản lý tải và hiển thị danh sách mục Setlist
 */
const SetlistUI = (() => {
  'use strict';

  /** Escape HTML để tránh XSS khi chèn vào innerHTML */
  function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let _setlists = [];
  let _currentSetlist = null; // object setlist hiện tại
  let _currentIndex = -1;
  let _addingToSetlistId = null;

  async function fetchSetlists() {
    try {
      const data = await window.ApiService.setlists.list();
      if (data.success) {
        _setlists = Array.isArray(data.data) ? data.data : [];
        renderList();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderList() {
    const listEl = document.getElementById('setlist-list');
    if (!listEl) return;
    
    if (_setlists.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>Chưa có Setlist nào</p>
          <small>Chỉ Quản trị mới có thể tạo</small>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    _setlists.forEach(sl => {
      const item = document.createElement('div');
      item.className = 'song-item';
      item.innerHTML = `
        <div class="song-item-info">
          <div class="song-item-title">${_esc(sl.title)}</div>
          <div class="song-item-meta">${_esc(sl.scheduled_date)} • ${_esc(String(sl.item_count))} bài hát</div>
        </div>
        ${window.Auth && window.Auth.isAdmin() ? `<button class="icon-btn-xs text-danger btn-del" title="Xoá">✕</button>` : ''}
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del')) return;
        viewSetlistDetail(sl.id);
      });
      
      const delBtn = item.querySelector('.btn-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Bạn chắc muốn xoá setlist: ${sl.title}?`)) {
            await window.ApiService.setlists.delete(sl.id);
            if (_currentSetlist?.id === sl.id) backToSetlists();
            fetchSetlists();
          }
        });
      }
      listEl.appendChild(item);
    });
  }

  async function viewSetlistDetail(id) {
    window.App?.showLoading?.('Đang tải Setlist...');
    try {
      const data = await window.ApiService.setlists.get(id);
      if (data.success) {
        _currentSetlist = data.data;
        document.getElementById('setlist-list')?.classList.add('hidden');
        document.getElementById('setlist-detail')?.classList.remove('hidden');
        
        const titleEl = document.getElementById('setlist-detail-title');
        if (titleEl) titleEl.textContent = _currentSetlist.title;
        
        const addContainer = document.getElementById('setlist-add-container');
        if (addContainer) {
          addContainer.classList.remove('hidden');
        }
        
        renderSetlistItems();
      }
    } catch (e) {
      console.error(e);
    }
    window.App?.hideLoading?.();
  }

  function _calcTransposedKey(origKey, semitones) {
    if (!origKey) return null;
    const trimmed = String(origKey).trim();
    if (!trimmed) return null;
    if (!semitones || semitones === 0) return trimmed;

    if (window.TransposeEngine?.transposeChord) {
      try {
        const res = window.TransposeEngine.transposeChord(trimmed, semitones);
        if (res) return res;
      } catch (e) {}
    }

    const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const m = trimmed.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return trimmed;
    const root = m[1];
    const suffix = m[2] || '';
    const useFlats = trimmed.includes('b') || ['F', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'].includes(trimmed);
    const arr = useFlats ? NOTES_FLAT : NOTES_SHARP;
    let idx = NOTES_SHARP.indexOf(root);
    if (idx === -1) idx = NOTES_FLAT.indexOf(root);
    if (idx === -1) return trimmed;
    const newRoot = arr[((idx + semitones) % 12 + 12) % 12];
    return newRoot + suffix;
  }

  function _formatToneBadge(origKey, transposeKey, canEdit = false) {
    const semitones = parseInt(transposeKey, 10) || 0;
    const hasOrig = Boolean(origKey && String(origKey).trim());
    const cleanOrig = hasOrig ? String(origKey).trim() : '';

    const cursorStyle = canEdit ? 'cursor:pointer;' : '';
    const editHint = canEdit ? 'Click để đổi tông tập | ' : '';

    if (cleanOrig) {
      const practiced = _calcTransposedKey(cleanOrig, semitones) || cleanOrig;
      if (semitones !== 0) {
        const diffStr = semitones > 0 ? `+${semitones}` : `${semitones}`;
        return `<span class="tag tag-purple btn-edit-tone" style="font-weight:600;${cursorStyle}" title="${editHint}Tông gốc: ${cleanOrig} | Đã dịch: ${diffStr} cung">Tone: ${cleanOrig} | Tập: ${practiced}</span>`;
      } else {
        return `<span class="tag tag-purple btn-edit-tone" style="${cursorStyle}" title="${editHint}Tông gốc: ${cleanOrig} (Chơi đúng tông gốc)">Tone: ${cleanOrig} | Tập: ${cleanOrig}</span>`;
      }
    } else if (semitones !== 0) {
      const diffStr = semitones > 0 ? `+${semitones}` : `${semitones}`;
      return `<span class="tag tag-purple btn-edit-tone" style="${cursorStyle}" title="${editHint}Đã dịch ${diffStr} cung">Tập: ${diffStr}</span>`;
    }
    return '';
  }

  async function renderSetlistItems() {
    const itemsEl = document.getElementById('setlist-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    
    if (!_currentSetlist.items || _currentSetlist.items.length === 0) {
      itemsEl.innerHTML = '<p class="text-sm text-muted text-center py-2">Chưa có bài hát nào</p>';
      return;
    }

    await ensureSongsLoaded(); // Fix race condition cho danh sách đã lưu

    _currentSetlist.items.forEach((item, idx) => {
      const songObj = _allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : 'Bài hát không tồn tại';
      
      const el = document.createElement('div');
      el.className = 'song-item';
      if (_currentIndex === idx) el.classList.add('active');
      
      const numStr = String(idx + 1).padStart(2, '0');
      const isAdmin = window.Auth && (window.Auth.isAdmin?.() || window.Auth.isBanhat?.());
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const toneBadge = _formatToneBadge(origKey, item.transpose_key, isAdmin);
      const chordBadge = item.chord_profile && item.chord_profile !== 'default' ? `<span class="tag">🎸 ${_esc(item.chord_profile)}</span>` : '';
      const bpmBadge = item.bpm ? `<span class="tag tag-blue" title="${_esc(String(item.beats_per_measure || 4))}/4 nhịp">♩${_esc(String(item.bpm))} BPM</span>` : '';

      el.innerHTML = `
        <div class="song-item-info" style="flex:1;min-width:0;">
          <div class="song-item-title">${numStr} - ${_esc(title)}</div>
          <div class="song-item-meta text-xs" style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">
            ${toneBadge} ${chordBadge} ${bpmBadge}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          ${isAdmin ? `<button class="icon-btn-xs btn-save-bpm" title="Lưu Tone & BPM đang tập vào bài này" style="color:var(--accent);font-size:.7rem;padding:.2rem .4rem;font-weight:600;">💾 Lưu Tập</button>` : ''}
          <button class="icon-btn-xs text-danger btn-del-item" title="Xóa khỏi list">✕</button>
        </div>
      `;
      
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-del-item') || e.target.closest('.btn-save-bpm') || e.target.closest('.btn-edit-tone')) return;
        _currentIndex = idx;
        await renderSetlistItems();
        playCurrentItem();
      });

      // Cho phép click vào tag Tone để chỉnh nhanh số cung dịch giọng cho bài này
      const toneBadgeBtn = el.querySelector('.btn-edit-tone');
      if (toneBadgeBtn && isAdmin) {
        toneBadgeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (window.TransposePick) {
            const currentSemi = parseInt(item.transpose_key, 10) || 0;
            const newTranspose = await window.TransposePick.show(title, currentSemi);
            if (newTranspose !== null && newTranspose !== currentSemi) {
              try {
                await window.ApiService.setlists.updateItem(item.id, { transpose_key: newTranspose });
                item.transpose_key = newTranspose;
                window.App?.showToast?.(`✅ Đã đổi tông tập cho "${title}"`, 'success');
                await renderSetlistItems();
                if (_currentIndex === idx) {
                  playCurrentItem();
                }
              } catch (err) {
                window.App?.showToast?.('Lỗi cập nhật tông', 'error');
              }
            }
          }
        });
      }

      // Nút lưu Tone & BPM hiện tại vào item này
      const saveBpmBtn = el.querySelector('.btn-save-bpm');
      if (saveBpmBtn) {
        saveBpmBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currentBpm   = window.Metronome?.getBpm?.() ?? null;
          const currentBeats = window.Metronome?.getBeatsPerMeasure?.() ?? 4;
          const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;

          saveBpmBtn.textContent = '...';
          saveBpmBtn.disabled = true;
          try {
            const updatePayload = {
              bpm: currentBpm,
              beats_per_measure: currentBeats,
              transpose_key: currentTranspose
            };
            await window.ApiService.setlists.updateItem(item.id, updatePayload);
            item.bpm = currentBpm;
            item.beats_per_measure = currentBeats;
            item.transpose_key = currentTranspose;

            // Đồng bộ sang PerformanceNotes của bài
            if (window.PerformanceNotes) {
              const origKey = songObj?.defaultKey || '';
              const practicedKey = _calcTransposedKey(origKey, currentTranspose) || origKey;
              const existingNotes = window.PerformanceNotes.getNotes(item.song_id);
              const newNotes = {
                ...existingNotes,
                key: practicedKey,
                bpm: currentBpm ? String(currentBpm) : (existingNotes.bpm || ''),
                updatedAt: new Date().toISOString()
              };
              window.ApiService?.sessions?.savePerfNotes?.(item.song_id, newNotes).catch(() => {});
            }

            const origKey = songObj?.defaultKey || '';
            const practicedKey = _calcTransposedKey(origKey, currentTranspose) || origKey;
            const toneMsg = origKey ? `Tone: ${origKey} | Tập: ${practicedKey}` : `Tông: ${currentTranspose > 0 ? '+' : ''}${currentTranspose}`;
            window.App?.showToast?.(`✅ Đã lưu ${toneMsg}${currentBpm ? ` & ♩${currentBpm} BPM` : ''} vào Setlist!`, 'success');
            await renderSetlistItems();
          } catch(err) {
            window.App?.showToast?.('Lỗi lưu thông tin tập', 'error');
            saveBpmBtn.textContent = '💾 Lưu Tập';
            saveBpmBtn.disabled = false;
          }
        });
      }

      const delBtn = el.querySelector('.btn-del-item');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.ApiService.setlists.removeItem(item.id);
          viewSetlistDetail(_currentSetlist.id);
        });
      }
      itemsEl.appendChild(el);
    });
  }

  function backToSetlists() {
    document.getElementById('setlist-detail')?.classList.add('hidden');
    document.getElementById('setlist-list')?.classList.remove('hidden');
    document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
    _currentSetlist = null;
    _currentIndex = -1;
    fetchSetlists();
  }

  async function playCurrentItem() {
    if (!_currentSetlist || !_currentSetlist.items || _currentSetlist.items.length === 0) {
       window.App?.showToast?.('Setlist trống', 'error');
       return;
    }
    if (_currentIndex >= _currentSetlist.items.length) {
       window.App?.showToast?.('Đã kết thúc Setlist!', 'success');
       _currentIndex = -1;
       renderSetlistItems();
       document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
       return;
    }

    const item = _currentSetlist.items[_currentIndex];
    const songId = item.song_id;
    
    await ensureSongsLoaded();
    const songObj = _allSongsCache.find(s => String(s.id) === String(songId)) || window.LibraryUI?.getSongObj?.(songId);
    
    if (!songObj) {
      window.App?.showToast?.(`Lỗi: Không tìm thấy bài hát ID ${songId}`, 'error');
      return;
    }

    // Cập nhật URL trước khi load bài hát để đồng bộ state và tránh bị _restoreFromURL ghi đè
    if (window.URLState) {
      URLState.resetForNewSong(songId);
      URLState.update({ set: item.chord_profile || 'HD', t: item.transpose_key || 0 });
    }

    // Đưa cả profile lẫn transpose_key qua bên App
    window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key);
    document.querySelector('.toolbar-left')?.classList.add('in-setlist');

    // Apply BPM đã lưu cho bài này (nếu có)
    if (item.bpm && window.Metronome) {
      window.Metronome.setBpmAndBeats(parseInt(item.bpm), parseInt(item.beats_per_measure) || 4);
      window.App?.showToast?.(`♩ ${item.bpm} BPM`, 'info', 1800);
    }
  }

  function promptAddSong(songId) {
    if (!_setlists || _setlists.length === 0) {
      window.App?.showToast?.('Chưa có Setlist nào. Hãy tạo Setlist trước!', 'error');
      return;
    }
    
    const modal = document.getElementById('add-to-setlist-modal');
    const optionsContainer = document.getElementById('add-to-setlist-options');
    if (!modal || !optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    _setlists.forEach(sl => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost w-full text-left song-item';
      btn.style.justifyContent = 'flex-start';
      btn.textContent = sl.title;
      btn.addEventListener('click', async () => {
        await addSongToSetlist(sl.id, songId);
        modal.classList.add('hidden');
      });
      optionsContainer.appendChild(btn);
    });
    
    modal.classList.remove('hidden');
  }

  async function addSongToSetlist(setId, songId) {
    const songIndex = _currentSetlist && _currentSetlist.items ? _currentSetlist.items.length : 0;

    // INC-3 fix: dùng TransposePick modal thay vì prompt()
    const songName = _allSongsCache.find(s => String(s.id) === String(songId))?.title || 'Bài hát';
    const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;

    let transpose_key;
    if (window.TransposePick) {
      transpose_key = await window.TransposePick.show(songName, currentTranspose);
      if (transpose_key === null) return; // Hủy
    } else {
      // Fallback nếu modal chưa load
      const toneStr = prompt('Nhập số cung dịch giọng (vd: -2, 0, +1):', String(currentTranspose));
      if (toneStr === null) return;
      transpose_key = parseInt(toneStr) || 0;
    }

    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';

    try {
      const data = await window.ApiService.setlists.addItem({ setlist_id: setId, song_id: songId, order_index: songIndex, transpose_key: transpose_key, chord_profile: currentSet });
      if (data.success) {
        window.App?.showToast?.('Đã thêm vào Setlist!', 'success');
        if (_currentSetlist?.id === setId) viewSetlistDetail(setId); // Refresh detail
        fetchSetlists(); // Refresh count
      } else {
        window.App?.showToast?.(data.error || 'Lỗi thêm bài hát', 'error');
      }
    } catch(err) { console.error(err); }
  }

  function next() {
    if (_currentSetlist && _currentIndex >= 0 && _currentIndex < _currentSetlist.items.length - 1) {
      _currentIndex++;
      renderSetlistItems().then(() => playCurrentItem()); // await via .then() vì next() không async
    }
  }

  function prev() {
    if (_currentSetlist && _currentIndex > 0) {
      _currentIndex--;
      renderSetlistItems().then(() => playCurrentItem()); // await via .then() vì prev() không async
    }
  }

  let _allSongsCache = [];
  let _songsPromise = null;

  async function ensureSongsLoaded() {
    // Nếu LibraryUI đã có data (load xong) → dùng luôn, không gọi API thêm
    const libSongs = window.LibraryUI?.getSongs?.();
    if (libSongs && libSongs.length > 0) {
      _allSongsCache = libSongs;
      return;
    }
    if (_allSongsCache.length > 0) return;
    if (!_songsPromise) {
      _songsPromise = window.ApiService.songs.list().then(data => {
        _allSongsCache = Array.isArray(data) ? data : [];
      }).catch(e => console.error('Failed to load songs for SetlistUI', e));
    }
    await _songsPromise;
  }

  function init() {
    ensureSongsLoaded(); // Pre-load
    // Sụ kiện chuyển Tab
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(tt => {
          tt.classList.remove('active');
        });
        t.classList.add('active');
        
        document.getElementById('tab-content-library').classList.add('hidden');
        document.getElementById('tab-content-setlist').classList.add('hidden');
        
        // Hiện layout mới
        if (t.dataset.tab === 'library') {
          document.getElementById('tab-content-library').classList.remove('hidden');
          document.getElementById('btn-admin-console')?.classList.remove('hidden');
          document.getElementById('btn-create-setlist')?.classList.add('hidden');
          
          document.querySelector('.sidebar-search')?.classList.remove('hidden');
          document.querySelector('.quick-jump')?.classList.remove('hidden');
        } else {
          document.getElementById('tab-content-setlist').classList.remove('hidden');
          document.getElementById('btn-admin-console')?.classList.add('hidden');
          document.getElementById('btn-create-setlist')?.classList.remove('hidden');
          
          document.querySelector('.sidebar-search')?.classList.add('hidden');
          document.querySelector('.quick-jump')?.classList.add('hidden');
          fetchSetlists();
        }
      });
    });

    const modalCreate = document.getElementById('create-setlist-modal');
    const titleInp = document.getElementById('create-setlist-title-input');
    const dateInp = document.getElementById('create-setlist-date-input');
    const btnCloseModal = document.getElementById('btn-close-create-setlist-modal');
    const btnCancelModal = document.getElementById('btn-cancel-create-setlist');
    const formCreate = document.getElementById('form-create-setlist');

    function openCreateSetlistModal() {
      if (!modalCreate) {
        const title = prompt("Tên Setlist mới (VD: Worship CN 20/4):");
        if (!title) return;
        window.ApiService.setlists.create({ title, scheduled_date: new Date().toISOString().split('T')[0] }).then(data => {
          if (data.success) fetchSetlists();
        });
        return;
      }
      if (titleInp) titleInp.value = '';
      if (dateInp) dateInp.value = new Date().toISOString().split('T')[0];
      modalCreate.classList.remove('hidden');
      setTimeout(() => titleInp?.focus(), 50);
    }

    function closeCreateSetlistModal() {
      modalCreate?.classList.add('hidden');
    }

    async function submitCreateSetlist() {
      const title = titleInp?.value.trim();
      if (!title) {
        titleInp?.focus();
        return;
      }
      const scheduled_date = dateInp?.value || new Date().toISOString().split('T')[0];
      try {
        const data = await window.ApiService.setlists.create({ title, scheduled_date });
        if (data.success) {
          closeCreateSetlistModal();
          if (window.App?.showToast) {
            window.App.showToast(`✅ Đã tạo setlist "${title}"`, 'success');
          }
          fetchSetlists();
        } else {
          alert(data.error || 'Lỗi khi tạo setlist');
        }
      } catch (err) {
        console.error('Error creating setlist:', err);
      }
    }

    document.getElementById('btn-create-setlist')?.addEventListener('click', openCreateSetlistModal);
    btnCloseModal?.addEventListener('click', closeCreateSetlistModal);
    btnCancelModal?.addEventListener('click', closeCreateSetlistModal);
    formCreate?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitCreateSetlist();
    });
    modalCreate?.addEventListener('click', (e) => {
      if (e.target === modalCreate) closeCreateSetlistModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalCreate && !modalCreate.classList.contains('hidden')) {
        closeCreateSetlistModal();
      }
    });

    document.getElementById('btn-back-setlists')?.addEventListener('click', backToSetlists);
    
    document.getElementById('btn-play-setlist')?.addEventListener('click', async () => {
      if (_currentSetlist && _currentSetlist.items && _currentSetlist.items.length > 0) {
        _currentIndex = 0;
        await renderSetlistItems();
        playCurrentItem();
      }
    });

    const addInput = document.getElementById('setlist-search-song-input');
    const addResults = document.getElementById('setlist-search-results');
    if (addInput && addResults) {
      const normalize = (str) => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
      
      const renderSearchResults = (val) => {
        const allSongs = _allSongsCache;
        let matches = [];
        
        if (!val) {
          matches = allSongs.slice(0, 20); // Hiện 20 bài đầu tiên nếu chưa gõ
        } else {
          const num = parseInt(val, 10);
          matches = allSongs.filter(s => {
            if (!isNaN(num) && s.httlvnId === num) return true;
            const t = normalize(s.title || '');
            const i = normalize(s.id || '');
            const h = String(s.httlvnId || '');
            return t.includes(val) || i.includes(val) || h === val;
          }).slice(0, 20);
        }
        
        if (matches.length === 0) {
          addResults.innerHTML = '<div class="p-2 text-muted text-xs text-center">Không tìm thấy</div>';
        } else {
          let html = '';
          matches.forEach(m => {
            if (!m) return;
            const mId = _esc(m.id || '');
            const mHtt = m.httlvnId ? _esc(String(m.httlvnId)) + ' - ' : '';
            const mTitle = _esc(m.title || 'Bài hát');
            html += '<div class="song-item" style="cursor: pointer; padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border);" data-id="' + mId + '"><div style="font-size: 0.85rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">' + mHtt + mTitle + '</div></div>';
          });
          addResults.innerHTML = html;
          
          addResults.querySelectorAll('.song-item').forEach(el => {
            el.addEventListener('click', async () => {
              addInput.value = '';
              addResults.classList.add('hidden');
              if (_currentSetlist) await addSongToSetlist(_currentSetlist.id, el.dataset.id);
            });
          });
        }
        addResults.classList.remove('hidden');
      };

      addInput.addEventListener('input', (e) => {
        const val = normalize(e.target.value).trim();
        renderSearchResults(val);
      });
      
      addInput.addEventListener('focus', (e) => {
        const val = normalize(e.target.value).trim();
        renderSearchResults(val);
      });
      
      // Đóng kết quả khi click ra ngoài
      document.addEventListener('click', (e) => {
        if (!addInput.contains(e.target) && !addResults.contains(e.target)) {
          addResults.classList.add('hidden');
        }
      });
    }

    document.getElementById('btn-print-setlist')?.addEventListener('click', printSetlist);
    document.getElementById('btn-copy-setlist-slide')?.addEventListener('click', copySetlistSlide);

    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => {
      document.getElementById('add-to-setlist-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-next-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); next(); }
    }, true);
    document.getElementById('btn-prev-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); prev(); }
    }, true);
  }

  function printSetlist() {
    if (!_currentSetlist || !_currentSetlist.items || _currentSetlist.items.length === 0) {
      window.App?.showToast?.('Chưa có bài hát trong Setlist!', 'warning');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    let itemsHtml = _currentSetlist.items.map((item, idx) => {
      const songObj = _allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : item.song_id;
      const numStr = String(idx + 1).padStart(2, '0');
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const semitones = parseInt(item.transpose_key, 10) || 0;
      let key = '';
      if (origKey) {
        const practiced = _calcTransposedKey(origKey, semitones) || origKey;
        key = `(Tone: ${origKey} | Tập: ${practiced})`;
      } else if (semitones !== 0) {
        key = `(Tông: ${semitones > 0 ? '+' : ''}${semitones})`;
      }
      const bpm = item.bpm ? `• Tempo: ${item.bpm} BPM` : '';
      const chord = item.chord_profile && item.chord_profile !== 'default' ? `• Hợp âm: ${item.chord_profile}` : '';

      return `
        <tr style="border-bottom:1px solid #ddd;">
          <td style="padding:10px; font-weight:bold; width:40px;">${numStr}.</td>
          <td style="padding:10px;">
            <div style="font-size:16px; font-weight:bold; color:#1e1b4b;">${_esc(title)} ${key}</div>
            <div style="font-size:13px; color:#6b7280; margin-top:4px;">${bpm} ${chord}</div>
          </td>
        </tr>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chương Trình Tập & Biểu Diễn - ${_esc(_currentSetlist.title)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; }
          h2 { margin-bottom: 5px; color: #6d28d9; }
          .meta { font-size: 14px; color: #666; margin-bottom: 20px; border-bottom: 2px solid #6d28d9; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        </style>
      </head>
      <body>
        <h2>📋 CHƯƠNG TRÌNH BIỂU DIỄN & TẬP HÁT</h2>
        <div class="meta">
          <strong>Tên Setlist:</strong> ${_esc(_currentSetlist.title)} &nbsp;|&nbsp; 
          <strong>Ngày:</strong> ${_esc(_currentSetlist.scheduled_date || new Date().toLocaleDateString('vi-VN'))}
        </div>
        <table>
          <tbody>${itemsHtml}</tbody>
        </table>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  async function copySetlistSlide() {
    if (!_currentSetlist || !_currentSetlist.items || _currentSetlist.items.length === 0) {
      window.App?.showToast?.('Chưa có bài hát trong Setlist!', 'warning');
      return;
    }

    let slideText = `📋 CHƯƠNG TRÌNH: ${_currentSetlist.title}\n==============================\n\n`;

    _currentSetlist.items.forEach((item, idx) => {
      const songObj = _allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : item.song_id;
      const numStr = String(idx + 1).padStart(2, '0');
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const semitones = parseInt(item.transpose_key, 10) || 0;
      let key = '';
      if (origKey) {
        const practiced = _calcTransposedKey(origKey, semitones) || origKey;
        key = ` [Tone: ${origKey} | Tập: ${practiced}]`;
      } else if (semitones !== 0) {
        key = ` [Tông: ${semitones > 0 ? '+' : ''}${semitones}]`;
      }
      const bpm = item.bpm ? ` [♩${item.bpm} BPM]` : '';
      slideText += `${numStr}. ${title}${key}${bpm}\n`;
    });

    try {
      await navigator.clipboard.writeText(slideText);
      window.App?.showToast?.('📋 Đã copy danh sách bài hát cho Slide!', 'success');
    } catch (e) {
      window.App?.showToast?.('Lỗi copy bộ đệm', 'error');
    }
  }

  return { init, fetchSetlists, next, prev, getCurrentSetlist: () => _currentSetlist, getCurrentIndex: () => _currentIndex, promptAddSong, printSetlist, copySetlistSlide, renderSetlistItems };

})();

window.SetlistUI = SetlistUI;
