/**
 * assets/js/core/VerseManager.js
 * Quản lý tính năng Chọn Khổ (Ticket L1-6 ⭐):
 * 1. 'all'    — Tất cả khổ (như sách in, mặc định)
 * 2. 'single' — Một khổ (chữ lớn, 1 dòng lời mỗi hàng nhạc, nút chuyển khổ ◀ ▶, bàn đạp)
 * 3. 'unroll' — Trải khổ (bài lặp lại lần lượt Khổ 1 → 2 → 3... để cuộn một chiều)
 */

const VerseManager = (() => {
  'use strict';

  const MODES = {
    ALL: 'all',
    SINGLE: 'single',
    UNROLL: 'unroll'
  };

  let _mode = MODES.ALL;
  let _currentVerse = 1;
  let _availableVerses = [];
  let _xmlCache = new Map();

  function init() {
    const savedMode = localStorage.getItem('sheetapp_verse_mode');
    if (savedMode && Object.values(MODES).includes(savedMode)) {
      _mode = savedMode;
    }
    _bindEvents();
    syncUI();
  }

  function _bindEvents() {
    // 1. Nút bấm đổi chế độ khổ trên Toolbar
    document.getElementById('btn-verse-mode')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      cycleMode();
    });

    // 2. Nút chuyển khổ trước / sau trên Toolbar
    document.getElementById('btn-verse-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      prevVerse();
    });

    document.getElementById('btn-verse-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      nextVerse();
    });

    // 3. Nút chuyển khổ trong Gig HUD
    document.getElementById('btn-gig-verse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      nextVerse();
    });

  }


  /**
   * Phát hiện các khổ có trong bài hát dựa trên thẻ <lyric number="...">
   */
  function detectVerses(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return [];
    const set = new Set();
    const matches = xmlString.matchAll(/<lyric\b[^>]*number="(\d+)"/g);
    for (const match of matches) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > 0) set.add(n);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function hasMultipleVerses() {
    return _availableVerses.length > 1;
  }

  function getAvailableVerses() {
    return [..._availableVerses];
  }

  function getMode() {
    return _mode;
  }

  function getCurrentVerse() {
    return _currentVerse;
  }

  /**
   * Gọi khi một bài hát mới được tải vào SongLoader
   */
  function onSongLoaded(xmlString) {
    _xmlCache.clear();
    _availableVerses = detectVerses(xmlString);
    _currentVerse = _availableVerses.length > 0 ? _availableVerses[0] : 1;
    syncUI();
  }

  /**
   * Xử lý lọc hoặc trải khổ MusicXML trước khi đưa vào OSMD render
   */
  function processXml(xmlString) {
    if (!xmlString || !hasMultipleVerses()) {
      return xmlString;
    }

    if (_mode === MODES.ALL) {
      return xmlString;
    }

    if (_mode === MODES.SINGLE) {
      const cacheKey = `single_${_currentVerse}`;
      if (_xmlCache.has(cacheKey)) {
        return _xmlCache.get(cacheKey);
      }
      const processed = _filterSingleVerseXml(xmlString, _currentVerse);
      _xmlCache.set(cacheKey, processed);
      return processed;
    }

    if (_mode === MODES.UNROLL) {
      const cacheKey = 'unroll';
      if (_xmlCache.has(cacheKey)) {
        return _xmlCache.get(cacheKey);
      }
      const processed = _unrollVersesXml(xmlString, _availableVerses);
      _xmlCache.set(cacheKey, processed);
      return processed;
    }

    return xmlString;
  }

  /**
   * Lọc chỉ giữ lại một khổ duy nhất
   */
  function _filterSingleVerseXml(xmlString, targetVerse) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      if (xmlDoc.querySelector('parsererror')) {
        return xmlString;
      }

      const lyrics = Array.from(xmlDoc.querySelectorAll('lyric'));
      lyrics.forEach(lyric => {
        const numAttr = lyric.getAttribute('number');
        if (numAttr !== null) {
          const n = parseInt(numAttr, 10);
          if (n === targetVerse) {
            lyric.setAttribute('number', '1');
            lyric.setAttribute('default-y', '-80');
          } else {
            lyric.parentNode?.removeChild(lyric);
          }
        }
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch (e) {
      console.warn('[VerseManager] filter error:', e);
      return xmlString;
    }
  }

  /**
   * Trải bài hát lặp lại từ Khổ 1 -> Khổ N
   */
  function _unrollVersesXml(xmlString, versesList) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      if (xmlDoc.querySelector('parsererror')) {
        return xmlString;
      }

      const parts = Array.from(xmlDoc.querySelectorAll('score-partwise > part'));
      parts.forEach(part => {
        const origMeasures = Array.from(part.querySelectorAll(':scope > measure'));
        const M = origMeasures.length;
        if (M === 0) return;

        // Xóa measures cũ
        origMeasures.forEach(m => part.removeChild(m));

        versesList.forEach((v, vIdx) => {
          origMeasures.forEach((origM, mIdx) => {
            const cloned = origM.cloneNode(true);
            const origNum = parseInt(cloned.getAttribute('number') || String(mIdx + 1), 10);
            const newNum = vIdx * M + origNum;
            cloned.setAttribute('number', String(newNum));

            // Lọc lyric trong measure clone này
            const lyrics = Array.from(cloned.querySelectorAll('lyric'));
            lyrics.forEach(l => {
              const numAttr = l.getAttribute('number');
              if (numAttr !== null) {
                const n = parseInt(numAttr, 10);
                if (n === v) {
                  l.setAttribute('number', '1');
                  l.setAttribute('default-y', '-80');
                } else {
                  l.parentNode?.removeChild(l);
                }
              }
            });

            // Xử lý vạch nhịp kết thúc ở các khổ trung gian
            if (vIdx < versesList.length - 1) {
              const barlines = Array.from(cloned.querySelectorAll('barline'));
              barlines.forEach(b => {
                const style = b.querySelector('bar-style');
                if (style && style.textContent.trim() === 'light-heavy') {
                  style.textContent = 'light-light';
                }
                const repeat = b.querySelector('repeat');
                if (repeat) b.parentNode?.removeChild(repeat);
              });
            }

            part.appendChild(cloned);
          });
        });
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch (e) {
      console.warn('[VerseManager] unroll error:', e);
      return xmlString;
    }
  }

  function setMode(newMode) {
    if (!Object.values(MODES).includes(newMode)) return;
    if (_mode === newMode) return;

    _mode = newMode;
    localStorage.setItem('sheetapp_verse_mode', newMode);
    syncUI();

    let toastMsg = 'Chế độ khổ: Tất cả khổ (như sách in)';
    if (newMode === MODES.SINGLE) toastMsg = `Chế độ Một khổ — Đang xem Khổ ${_currentVerse}/${_availableVerses.length || 1}`;
    if (newMode === MODES.UNROLL) toastMsg = 'Chế độ Trải khổ — Toàn bộ các khổ được trải ra để cuộn 1 chiều';
    window.AppUI?.showToast?.(toastMsg, 'info');

    _reRenderSheet();
  }

  function cycleMode() {
    if (_mode === MODES.ALL) {
      setMode(MODES.SINGLE);
    } else if (_mode === MODES.SINGLE) {
      setMode(MODES.UNROLL);
    } else {
      setMode(MODES.ALL);
    }
  }

  function setVerse(verseNum) {
    const v = parseInt(verseNum, 10);
    if (isNaN(v) || !_availableVerses.includes(v)) return;
    if (_mode !== MODES.SINGLE) {
      _mode = MODES.SINGLE;
      localStorage.setItem('sheetapp_verse_mode', MODES.SINGLE);
    }
    _currentVerse = v;
    syncUI();
    window.AppUI?.showToast?.(`Đã chuyển sang Khổ ${_currentVerse}/${_availableVerses.length}`, 'info');
    _reRenderSheet();
  }

  function nextVerse() {
    if (!hasMultipleVerses()) return;
    if (_mode !== MODES.SINGLE) {
      setMode(MODES.SINGLE);
      return;
    }
    const idx = _availableVerses.indexOf(_currentVerse);
    const nextIdx = (idx + 1) % _availableVerses.length;
    setVerse(_availableVerses[nextIdx]);
  }

  function prevVerse() {
    if (!hasMultipleVerses()) return;
    if (_mode !== MODES.SINGLE) {
      setMode(MODES.SINGLE);
      return;
    }
    const idx = _availableVerses.indexOf(_currentVerse);
    const prevIdx = (idx - 1 + _availableVerses.length) % _availableVerses.length;
    setVerse(_availableVerses[prevIdx]);
  }

  function _reRenderSheet() {
    if (window.SongLoader?.commitTranspose) {
      window.SongLoader.commitTranspose();
    }
  }

  function syncUI() {
    const pill = document.getElementById('verse-pill');
    const label = document.getElementById('verse-mode-label');
    const nav = document.getElementById('verse-nav-controls');
    const indicator = document.getElementById('verse-indicator');
    const gigVerse = document.getElementById('btn-gig-verse');

    const multiple = hasMultipleVerses();

    if (pill) {
      pill.classList.toggle('hidden', !multiple);
    }

    if (label) {
      if (_mode === MODES.ALL) {
        label.textContent = 'Tất cả khổ';
      } else if (_mode === MODES.SINGLE) {
        label.textContent = 'Một khổ';
      } else if (_mode === MODES.UNROLL) {
        label.textContent = 'Trải khổ';
      }
    }

    if (nav) {
      nav.classList.toggle('hidden', _mode !== MODES.SINGLE || !multiple);
    }

    if (indicator) {
      const total = _availableVerses.length || 1;
      indicator.textContent = `${_currentVerse}/${total}`;
    }

    if (gigVerse) {
      gigVerse.classList.toggle('hidden', !multiple);
      if (multiple) {
        if (_mode === MODES.SINGLE) {
          gigVerse.textContent = `Khổ ${_currentVerse}/${_availableVerses.length}`;
        } else if (_mode === MODES.UNROLL) {
          gigVerse.textContent = 'Trải khổ';
        } else {
          gigVerse.textContent = `${_availableVerses.length} Khổ`;
        }
      }
    }
  }

  return {
    MODES,
    init,
    detectVerses,
    hasMultipleVerses,
    getAvailableVerses,
    getMode,
    getCurrentVerse,
    onSongLoaded,
    processXml,
    setMode,
    cycleMode,
    setVerse,
    nextVerse,
    prevVerse,
    syncUI
  };
})();

// Gắn vào window và khởi tạo
if (typeof window !== 'undefined') {
  window.VerseManager = VerseManager;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', VerseManager.init);
    } else {
      VerseManager.init();
    }
  }
}
