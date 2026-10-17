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
      
      const toneBadge = item.transpose_key && item.transpose_key != 0 
        ? `<span class="tag tag-purple">Tone: ${item.transpose_key > 0 ? '+' : ''}${parseInt(item.transpose_key)}</span>` 
        : '';
      const chordBadge = item.chord_profile && item.chord_profile !== 'default' 
        ? `<span class="tag">🎸 ${_esc(item.chord_profile)}</span>` 
        : '';
      const bpmBadge = item.bpm 
        ? `<span class="tag tag-blue" title="Tempo đã lưu cho bài này">♩ ${_esc(String(item.bpm))} BPM</span>` 
        : '';
      // Fix: dùng Auth.isBanhat() (banhat + admin) thay vì canEdit() không tồn tại
      const canSaveBpm = window.Auth && (window.Auth.isAdmin?.() || window.Auth.isBanhat?.());

      el.innerHTML = `
        <div class="song-item-info" style="flex:1;min-width:0;">
          <div class="song-item-title">${idx + 1}. ${_esc(title)}</div>
          <div class="song-item-meta text-xs" style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">
            ${toneBadge} ${chordBadge} ${bpmBadge}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          ${canSaveBpm ? `<button class="btn-save-bpm" title="Lưu BPM máy gõ nhịp hiện tại vào bài này trong Setlist" style="background:none;border:1px solid var(--accent);border-radius:5px;color:var(--accent);font-size:.68rem;font-weight:700;padding:.15rem .4rem;cursor:pointer;white-space:nowrap;">♩ Lưu BPM</button>` : ''}
          <button class="icon-btn-xs text-danger btn-del-item" title="Xóa khỏi list">✕</button>
        </div>
      `;
      
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-del-item') || e.target.closest('.btn-save-bpm')) return;
        _currentIndex = idx;
        await renderSetlistItems();
        playCurrentItem();
      });

      // Nút lưu BPM hiện tại vào item này
      const saveBpmBtn = el.querySelector('.btn-save-bpm');
      if (saveBpmBtn) {
        saveBpmBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currentBpm   = window.Metronome?.getBpm?.() ?? null;
          const currentBeats = window.Metronome?.getBeatsPerMeasure?.() ?? 4;
          if (!currentBpm) {
            window.App?.showToast?.('Chưa có BPM. Mở máy gõ nhịp trước!', 'warning');
            return;
          }
          saveBpmBtn.textContent = '...';
          saveBpmBtn.disabled = true;
          try {
            await window.ApiService.setlists.updateItem(item.id, { bpm: currentBpm, beats_per_measure: currentBeats });
            item.bpm = currentBpm;
            item.beats_per_measure = currentBeats;
            window.App?.showToast?.(`✅ Đã lưu ♩${currentBpm} BPM cho "${title}"`, 'success');
            await renderSetlistItems();
          } catch(err) {
            window.App?.showToast?.('Lỗi lưu BPM', 'error');
            saveBpmBtn.textContent = '♩Lưu BPM';
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
    _syncMetronomeSaveBtnVisibility(); // Ẩn nút luưu BPM khi thoát setlist
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
    // Cập nhật nút Lưu BPM trong metronome panel
    _syncMetronomeSaveBtnVisibility();
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

    document.getElementById('btn-create-setlist')?.addEventListener('click', async () => {
      const title = prompt("Tên Setlist mới (VD: Worship CN 20/4):");
      if (!title) return;
      const data = await window.ApiService.setlists.create({ title, scheduled_date: new Date().toISOString().split('T')[0] });
      if (data.success) fetchSetlists();
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

    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => {
      document.getElementById('add-to-setlist-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-next-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); next(); }
    }, true);
    document.getElementById('btn-prev-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); prev(); }
    }, true);

    // ── Nút "💾 Lưu BPM" trong Metronome Panel ──
    // Chỉ hiện khi đang play một bài trong setlist
    const saveBpmPanelBtn = document.getElementById('btn-metronome-save-bpm');
    const saveBpmPanelRow = document.getElementById('metronome-save-bpm-row');
    if (saveBpmPanelBtn && saveBpmPanelRow) {
      saveBpmPanelBtn.addEventListener('click', async () => {
        if (!_currentSetlist || _currentIndex < 0 || _currentIndex >= _currentSetlist.items.length) {
          window.App?.showToast?.('Chưa chọn bài nào trong Setlist', 'warning');
          return;
        }
        const item    = _currentSetlist.items[_currentIndex];
        const bpm     = window.Metronome?.getBpm?.() ?? null;
        const beats   = window.Metronome?.getBeatsPerMeasure?.() ?? 4;
        if (!bpm) {
          window.App?.showToast?.('Chưa có BPM. Dùng slider hoặc TAP để chỉnh trước!', 'warning');
          return;
        }
        const songTitle = _allSongsCache.find(s => String(s.id) === String(item.song_id))?.title || 'Bài hát';
        saveBpmPanelBtn.textContent = '...';
        saveBpmPanelBtn.disabled = true;
        try {
          await window.ApiService.setlists.updateItem(item.id, { bpm, beats_per_measure: beats });
          item.bpm = bpm;
          item.beats_per_measure = beats;
          saveBpmPanelBtn.textContent = `✅ Đã lưu ${bpm} BPM`;
          setTimeout(() => {
            saveBpmPanelBtn.textContent = '💾 Lưu BPM';
            saveBpmPanelBtn.disabled = false;
          }, 2000);
          window.App?.showToast?.(`✅ Đã lưu ♩${bpm} BPM cho "${songTitle}"`, 'success');
          // Cập nhật badge trong setlist sidebar
          renderSetlistItems();
        } catch (err) {
          window.App?.showToast?.('Lỗi lưu BPM', 'error');
          saveBpmPanelBtn.textContent = '💾 Lưu BPM';
          saveBpmPanelBtn.disabled = false;
        }
      });
    }
  }

  /** Cập nhật hiển thị nút Lưu BPM trong metronome panel */
  function _syncMetronomeSaveBtnVisibility() {
    const row = document.getElementById('metronome-save-bpm-row');
    if (!row) return;
    const inSetlist = _currentSetlist && _currentIndex >= 0 && _currentIndex < (_currentSetlist.items?.length ?? 0);
    const canSave = inSetlist && window.Auth && (window.Auth.isAdmin?.() || window.Auth.isBanhat?.());
    row.style.display = canSave ? 'flex' : 'none';
    // Cập nhật tooltip với tên bài đang phát
    if (canSave) {
      const item = _currentSetlist.items[_currentIndex];
      const songName = _allSongsCache.find(s => String(s.id) === String(item.song_id))?.title || '';
      const btn = document.getElementById('btn-metronome-save-bpm');
      if (btn && songName) btn.title = `Lưu BPM vào: "${songName}"`;
    }
  }

  return { 
    init, fetchSetlists, next, prev, 
    getCurrentSetlist: () => _currentSetlist, 
    getCurrentIndex: () => _currentIndex, 
    promptAddSong,
    syncMetronomeSaveBtn: _syncMetronomeSaveBtnVisibility
  };
})();

window.SetlistUI = SetlistUI;
