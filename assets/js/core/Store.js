/**
 * core/Store.js — Centralized State Management (Ticket L5-7, ROADMAP4.md)
 *
 * Single source of truth cho app state:
 * - Quản lý tập trung: song / set / transpose / zoom / mode / verse / capo / role.
 * - Hỗ trợ alias 2 chiều tương thích ngược (transpose <-> currentTranspose, song <-> currentSong, ...).
 * - Cung cấp cơ chế Store.subscribe(keys, callback) với hàm unsubscribe linh hoạt.
 * - 4 bên đăng ký nghe tự động:
 *     1) URL: đồng bộ query params (t, set, v, verse, song) không reload.
 *     2) Toolbar: đồng bộ #song-key, #transpose-display, nút tăng/giảm, capo, zoom, chord set, verse.
 *     3) Stage HUD: đồng bộ #gig-hud-key, #gig-hud-trans, #gig-hud-zoom, #gig-hud-title.
 *     4) Chế độ Band: đồng bộ .lv-key, tự động nạp lại hợp âm chữ theo tông mới.
 * - Tự động emit EventBus khi state thay đổi.
 */
const Store = (() => {
  'use strict';

  // Bản đồ Alias 2 chiều: key ngắn (canonical) <-> key dài (legacy/descriptive)
  const KEY_MAP = {
    song: 'currentSong',
    currentSong: 'song',
    set: 'currentSet',
    currentSet: 'set',
    transpose: 'currentTranspose',
    currentTranspose: 'transpose',
    zoom: 'currentZoom',
    currentZoom: 'zoom',
    mode: 'currentMode',
    currentMode: 'mode',
    verse: 'currentVerse',
    currentVerse: 'verse',
    capo: 'capoLevel',
    capoLevel: 'capo',
    role: 'instrumentRole',
    instrumentRole: 'role',
    originalXml: 'originalXml',
  };

  const CANONICAL_KEYS = {
    song: 'song',
    currentSong: 'song',
    set: 'set',
    currentSet: 'set',
    transpose: 'transpose',
    currentTranspose: 'transpose',
    zoom: 'zoom',
    currentZoom: 'zoom',
    mode: 'mode',
    currentMode: 'mode',
    verse: 'verse',
    currentVerse: 'verse',
    capo: 'capo',
    capoLevel: 'capo',
    role: 'role',
    instrumentRole: 'role',
    originalXml: 'originalXml',
  };

  const DEFAULTS = {
    song: null,
    currentSong: null,
    set: 'HD',
    currentSet: 'HD',
    transpose: 0,
    currentTranspose: 0,
    zoom: 1.0,
    currentZoom: 1.0,
    mode: 'normal',
    currentMode: 'normal',
    verse: 'all',
    currentVerse: 'all',
    capo: 0,
    capoLevel: 0,
    role: 'guitar',
    instrumentRole: 'guitar',
    originalXml: null,
  };

  const _state = { ...DEFAULTS };
  const _subscribers = new Set();
  let _defaultListenersRegistered = false;

  function _toCanonical(key) {
    return CANONICAL_KEYS[key] || key;
  }

  function _toAlias(key) {
    return KEY_MAP[key] || key;
  }

  function get(key) {
    if (!key) return { ..._state };
    const canon = _toCanonical(key);
    return _state[canon] !== undefined ? _state[canon] : _state[key];
  }

  function getState() {
    return get();
  }

  function set(key, value, options = {}) {
    const canon = _toCanonical(key);
    const alias = _toAlias(key);

    if (!(canon in CANONICAL_KEYS) && !(key in _state)) {
      console.warn(`[Store] Unknown key: ${key}`);
      return;
    }

    const prev = _state[canon];
    if (prev === value && !options.force) {
      return;
    }

    _state[canon] = value;
    if (alias && alias !== canon) {
      _state[alias] = value;
    }

    const changePayload = {
      key: canon,
      alias,
      value,
      prev,
      state: get(),
    };

    // 1. Kích hoạt Store subscribers
    _subscribers.forEach(sub => {
      try {
        if (sub.keys === '*' || sub.keys.includes(canon) || (alias && sub.keys.includes(alias))) {
          sub.callback(changePayload);
        }
      } catch (err) {
        console.error('[Store] Subscriber callback error:', err);
      }
    });

    // 2. Kích hoạt EventBus events
    if (typeof window !== 'undefined' && window.EventBus) {
      try {
        window.EventBus.emit('state:changed', changePayload);
        window.EventBus.emit(`state:${canon}`, changePayload);
        if (alias && alias !== canon) {
          window.EventBus.emit(`state:${alias}`, changePayload);
        }
        if (canon === 'transpose') {
          window.EventBus.emit('transpose:changed', { value });
        } else if (canon === 'zoom') {
          window.EventBus.emit('zoom:changed', { value });
        }
      } catch (e) {
        console.warn('[Store] EventBus emit error:', e);
      }
    }
  }

  function subscribe(keys, callback) {
    if (typeof callback !== 'function') {
      throw new Error('[Store] Subscriber callback must be a function');
    }

    let keyList;
    if (keys === '*' || !keys) {
      keyList = '*';
    } else if (Array.isArray(keys)) {
      keyList = keys.map(_toCanonical);
    } else {
      keyList = [_toCanonical(keys)];
    }

    const sub = { keys: keyList, callback };
    _subscribers.add(sub);

    return function unsubscribe() {
      _subscribers.delete(sub);
    };
  }

  function getSubscribersCount() {
    return _subscribers.size;
  }

  function reset(keys = null) {
    const targets = keys ? (Array.isArray(keys) ? keys : [keys]) : Object.keys(CANONICAL_KEYS);
    targets.forEach(k => {
      const canon = _toCanonical(k);
      const defVal = DEFAULTS[canon];
      set(canon, defVal);
    });
  }

  /* ───────────────────────────────────────────────────────────
   * 4 BÊN ĐĂNG KÝ NGHE MẶC ĐỊNH (Ticket L5-7)
   * 1) URL State Sync
   * 2) Toolbar Controller Sync
   * 3) Stage HUD Sync
   * 4) Band Mode (Lyric View) Sync
   * ─────────────────────────────────────────────────────────── */

  // Helper tính display key an toàn
  function _computeSoundingKey(baseKey, transpose) {
    if (!baseKey) return '';
    const t = Number(transpose) || 0;
    if (typeof window !== 'undefined') {
      if (window.KeyService?.displayKey) {
        return window.KeyService.displayKey(baseKey, t) || baseKey;
      }
      if (window.TransposeEngine?.transposeChord && t !== 0) {
        return window.TransposeEngine.transposeChord(baseKey, t) || baseKey;
      }
    }
    return baseKey;
  }

  // 1) URL Listener: Đồng bộ query params khi state thay đổi
  function _syncToUrl({ key, value }) {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    try {
      if (window.URLState && typeof window.URLState.update === 'function') {
        if (key === 'transpose') {
          window.URLState.update({ t: Number(value) || 0 });
        } else if (key === 'set') {
          window.URLState.update({ set: value || 'HD' });
        } else if (key === 'mode') {
          window.URLState.update({ v: value === 'band' ? 'lyric' : 'sheet' });
        }
        return;
      }
      const url = new URL(window.location.href);
      const params = url.searchParams;
      if (key === 'transpose') {
        const t = Number(value) || 0;
        if (t === 0) params.delete('t');
        else params.set('t', String(t));
      } else if (key === 'set') {
        if (!value || value === 'HD' || value === 'default') params.delete('set');
        else params.set('set', String(value));
      } else if (key === 'song') {
        const songId = value?.id || (typeof value === 'string' ? value : null);
        if (songId) params.set('song', songId);
      } else if (key === 'mode') {
        if (value === 'band') params.set('v', 'lyric');
        else params.delete('v');
      } else if (key === 'verse') {
        if (!value || value === 'all') params.delete('verse');
        else params.set('verse', String(value));
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  // 2) Toolbar Listener: Cập nhật DOM thanh công cụ
  function _syncToToolbar({ key, value, state }) {
    if (typeof document === 'undefined') return;

    if (key === 'transpose' || key === 'song') {
      const curSong = state.song;
      const baseKey = curSong?.defaultKey || (window.SongInfoBar?.getSongKey?.()) || '';
      const tVal = Number(state.transpose) || 0;
      const sounding = _computeSoundingKey(baseKey, tVal);

      // Cập nhật Badge tông trên toolbar
      const keyEl = document.getElementById('song-key');
      if (keyEl && sounding) {
        keyEl.textContent = sounding;
        keyEl.style.display = 'inline-block';
        keyEl.title = tVal !== 0 ? `Tông gốc: ${baseKey} (đang dịch ${tVal > 0 ? '+' : ''}${tVal})` : `Tông gốc: ${baseKey}`;
      }

      // Cập nhật giá trị hiển thị số nửa cung đang dịch
      const dispEl = document.getElementById('transpose-display');
      if (dispEl) {
        dispEl.textContent = tVal === 0 ? '0' : (tVal > 0 ? `+${tVal}` : `${tVal}`);
        dispEl.style.color = tVal === 0 ? 'var(--text-muted)' : (tVal > 0 ? 'var(--success)' : 'var(--danger)');
      }

      const soundBadge = document.getElementById('transpose-sounding-badge');
      if (soundBadge) {
        if (tVal !== 0 && sounding) {
          soundBadge.textContent = `(${sounding})`;
          soundBadge.classList.remove('hidden');
          soundBadge.title = `Tông phát ra: ${sounding} (gốc: ${baseKey})`;
        } else {
          soundBadge.textContent = '';
          soundBadge.classList.add('hidden');
        }
      }

      // Cập nhật độ mờ nút bấm
      const btnUp = document.getElementById('btn-transpose-up');
      const btnDown = document.getElementById('btn-transpose-down');
      if (btnUp) btnUp.style.opacity = tVal >= 8 ? '.35' : '';
      if (btnDown) btnDown.style.opacity = tVal <= -8 ? '.35' : '';

      // Cập nhật Capo badge
      if (window.AppUI?.updateCapoBadge) {
        window.AppUI.updateCapoBadge(state.capo || 0);
      }
    }

    if (key === 'song') {
      const titleEl = document.getElementById('song-title');
      if (titleEl && value?.title) {
        titleEl.textContent = value.title;
      }
    }

    if (key === 'zoom') {
      const zoomPct = Math.round((Number(value) || 1.0) * 100);
      const zoomSel = document.getElementById('zoom-slider');
      if (zoomSel) {
        const strVal = String(zoomPct);
        const optionsArr = zoomSel.options ? Array.from(zoomSel.options) : [];
        const hasOption = optionsArr.some(o => o.value === strVal);
        if (hasOption) {
          zoomSel.value = strVal;
        } else if (optionsArr.length > 0) {
          // Khớp option gần nhất nếu mức zoom tuỳ biến
          const optValues = optionsArr.map(o => parseInt(o.value, 10)).filter(n => !isNaN(n));
          if (optValues.length > 0) {
            const nearest = optValues.reduce((prev, curr) => Math.abs(curr - zoomPct) < Math.abs(prev - zoomPct) ? curr : prev);
            zoomSel.value = String(nearest);
          }
        } else {
          zoomSel.value = strVal;
        }
      }
      const zoomLabel = document.getElementById('zoom-value-label');
      if (zoomLabel) zoomLabel.textContent = `${zoomPct}%`;
    }

    if (key === 'set') {
      const selector = document.getElementById('chord-set-selector');
      if (selector && selector.value !== value) {
        selector.value = value || 'HD';
      }
      const badge = document.getElementById('btn-chord-set-badge') || document.getElementById('chord-set-badge');
      if (badge) badge.textContent = value || 'HD';
    }

    if (key === 'verse') {
      const vLabel = document.getElementById('verse-mode-label');
      if (vLabel) {
        vLabel.textContent = value === 'all' ? 'Tất cả khổ' : (value === 'spread' ? 'Trải khổ' : `Khổ ${value}`);
      }
    }
  }

  // 3) Stage HUD Listener: Cập nhật DOM HUD Sân Khấu (gig-floating-hud)
  function _syncToHUD({ key, value, state }) {
    if (typeof document === 'undefined') return;

    if (key === 'transpose' || key === 'song') {
      const curSong = state.song;
      const baseKey = curSong?.defaultKey || (window.SongInfoBar?.getSongKey?.()) || '';
      const tVal = Number(state.transpose) || 0;
      const sounding = _computeSoundingKey(baseKey, tVal);

      const gigKey = document.getElementById('gig-hud-key');
      if (gigKey && sounding) {
        gigKey.textContent = sounding;
      }

      const gigTrans = document.getElementById('gig-hud-trans');
      if (gigTrans) {
        gigTrans.textContent = tVal === 0 ? '0' : (tVal > 0 ? `+${tVal}` : `${tVal}`);
        gigTrans.style.color = tVal === 0 ? 'rgba(255,255,255,0.7)' : (tVal > 0 ? '#4ade80' : '#f87171');
      }

      if (key === 'song' && curSong?.title) {
        const gigTitle = document.getElementById('gig-hud-title');
        if (gigTitle) gigTitle.textContent = curSong.title;
      }
    }

    if (key === 'zoom') {
      const gigZoom = document.getElementById('gig-hud-zoom');
      if (gigZoom) {
        gigZoom.textContent = `${Math.round((Number(value) || 1.0) * 100)}%`;
      }
    }
  }

  // 4) Band Mode Listener: Cập nhật Header & Re-render hợp âm chữ
  function _syncToBandMode({ key, state }) {
    if (typeof document === 'undefined') return;

    if (key === 'transpose' || key === 'song' || key === 'set' || key === 'verse' || key === 'role') {
      const curSong = state.song;
      const baseKey = curSong?.defaultKey || (window.SongInfoBar?.getSongKey?.()) || '';
      const tVal = Number(state.transpose) || 0;
      const sounding = _computeSoundingKey(baseKey, tVal);

      // Cập nhật tông hiển thị trong tiêu đề Band View (.lv-key strong)
      const lvKeyStrong = document.querySelector('#lyric-view-container .lv-key strong')
                       || document.querySelector('.lv-key strong');
      if (lvKeyStrong && sounding) {
        lvKeyStrong.textContent = sounding;
      }

      // Cập nhật badge dịch tông trong Band View nếu có
      const lvTransBadge = document.querySelector('#lyric-view-container .lv-trans-badge')
                        || document.querySelector('.lv-trans-badge');
      if (lvTransBadge) {
        if (tVal !== 0) {
          lvTransBadge.textContent = tVal > 0 ? `+${tVal}` : `${tVal}`;
          lvTransBadge.style.display = 'inline-block';
        } else {
          lvTransBadge.style.display = 'none';
        }
      }

      // Nếu container Band View đang hiển thị, kích hoạt nạp lại hợp âm chữ
      const container = document.getElementById('lyric-view-container');
      const isBandActive = container && !container.classList.contains('hidden') && container.style.display !== 'none';
      if (isBandActive) {
        if (window.DisplaySettings?.renderLyricViewIfActive) {
          window.DisplaySettings.renderLyricViewIfActive();
        } else if (window.LyricExtractor?.reloadIfActive) {
          window.LyricExtractor.reloadIfActive();
        }
      }
    }
  }

  function initDefaultListeners() {
    if (_defaultListenersRegistered) return;
    _defaultListenersRegistered = true;

    // Đăng ký 4 bên nghe
    subscribe(['song', 'set', 'transpose', 'mode', 'verse'], _syncToUrl);
    subscribe(['transpose', 'song', 'set', 'zoom', 'verse', 'mode', 'capo'], _syncToToolbar);
    subscribe(['transpose', 'song', 'zoom', 'verse', 'mode'], _syncToHUD);
    subscribe(['transpose', 'song', 'set', 'verse', 'mode', 'capo', 'role'], _syncToBandMode);
  }

  // Tự động khởi tạo listeners khi nạp file
  initDefaultListeners();

  return {
    get,
    getState,
    set,
    subscribe,
    reset,
    getSubscribersCount,
    initDefaultListeners,
  };
})();

// Global window attachment
if (typeof window !== 'undefined') {
  window.Store = Store;
}

// Module export nếu chạy trong Node.js / CLI
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
