/**
 * song-preloader.js — Tải trước bài kế tiếp cho Chế độ Chương trình Lễ (Ticket L3-2)
 *
 * Nhiệm vụ:
 * 1. Tải trước MusicXML + Bộ hợp âm (song song) cho bài tiếp theo trong setlist.
 * 2. Tiền xử lý & tiêm hợp âm (Inject Chords) sẵn trong bộ nhớ RAM (Pre-parsed XML).
 * 3. Chuyển bài tức thì (Instant Song Swap), không trắng màn hình, không hiện loading screen.
 * 4. Đo lường thời gian chuyển bài đảm bảo tiêu chí <= 150ms tới khi có SVG.
 */
const SongPreloader = (() => {
  'use strict';

  // Cache trong bộ nhớ RAM: key = `${songId}::${profile}`
  const _cache = new Map();
  const _inFlight = new Map();
  const MAX_CACHE_ENTRIES = 12;

  let _transitionStartTime = 0;
  let _lastTransitionDuration = 0;

  function _cacheKey(songId, profile) {
    return `${String(songId)}::${(profile || 'HD').toUpperCase()}`;
  }

  /**
   * Tải trước bài hát (XML + Hợp âm + Pre-parse)
   * @param {Object} songObj - Metadata bài hát ({ id, xmlPath, title, ... })
   * @param {string} profile - Profile hợp âm ('HD', 'default', 'TLH', ...)
   * @param {number} transpose - Số bán cung dịch giọng
   * @returns {Promise<Object|null>} Gói dữ liệu đã tải trước
   */
  async function preload(songObj, profile = 'HD', transpose = 0) {
    if (!songObj || !songObj.id) return null;
    const songId = songObj.id;
    const prof = (profile || 'HD').toUpperCase();
    const key = _cacheKey(songId, prof);

    // Đã có trong cache
    if (_cache.has(key)) {
      return _cache.get(key);
    }

    // Đang trong quá trình tải
    if (_inFlight.has(key)) {
      return _inFlight.get(key);
    }

    const xmlPath = songObj.xmlPath || `storage/Thanh ca/${songId}.xml`;
    const xmlUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
      ? window.ApiService.resolveUrl(xmlPath)
      : xmlPath;

    const loadPromise = (async () => {
      try {
        // Tải song song XML + Chords
        // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
        const fetchXmlPromise = fetch(xmlUrl).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        });

        const fetchChordsPromise = (prof !== 'DEFAULT' && window.ApiService?.chordSets?.load)
          ? window.ApiService.chordSets.load(songId, prof).catch(() => null)
          : Promise.resolve(null);

        const [xml, chordRes] = await Promise.all([fetchXmlPromise, fetchChordsPromise]);
        if (!xml) return null;

        // Xây dựng map hợp âm
        const chordsMap = {};
        if (chordRes && chordRes.success && Array.isArray(chordRes.chords)) {
          chordRes.chords.forEach(({ measureIdx, noteIdx, chord }) => {
            chordsMap[`${measureIdx}_${noteIdx}`] = chord;
          });
        } else if (window.OfflineSetlistManager?.hasOfflineChords?.(songId, prof)) {
          const offline = window.OfflineSetlistManager.getOfflineChords(songId, prof) || [];
          offline.forEach(({ measureIdx, noteIdx, chord }) => {
            chordsMap[`${measureIdx}_${noteIdx}`] = chord;
          });
        }

        // Tiêm hợp âm vào XML (Inject Chords)
        let processedXml = xml;
        if (prof !== 'DEFAULT' && Object.keys(chordsMap).length > 0 && window.ChordCanvasXML?.cloneAndInjectChords) {
          try {
            processedXml = window.ChordCanvasXML.cloneAndInjectChords(xml, chordsMap);
          } catch (e) {
            console.warn('[SongPreloader] cloneAndInjectChords failed:', e);
          }
        }

        // Tiền xử lý nếu có VerseManager
        if (window.VerseManager?.processXml) {
          try {
            processedXml = window.VerseManager.processXml(processedXml);
          } catch (e) {}
        }

        // Pre-parse XML Document trong RAM (giảm 30-50ms DOMParser lúc chuyển bài)
        let xmlDoc = null;
        try {
          xmlDoc = window.XmlDocCache?.getDoc(processedXml) || new DOMParser().parseFromString(processedXml, 'application/xml');
        } catch (e) {}

        const entry = {
          songId,
          song: songObj,
          profile: prof,
          transpose: parseInt(transpose || 0, 10),
          xml,
          processedXml,
          xmlDoc,
          chordsMap,
          timestamp: Date.now()
        };

        // Giới hạn bộ nhớ cache LRU
        if (_cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = _cache.keys().next().value;
          _cache.delete(oldestKey);
        }

        _cache.set(key, entry);
        return entry;
      } catch (err) {
        console.warn(`[SongPreloader] Không thể tải trước bài ${songId}:`, err.message);
        return null;
      } finally {
        _inFlight.delete(key);
      }
    })();

    _inFlight.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Tự động nạp trước bài kế tiếp trong setlist
   */
  async function preloadNextInSetlist(currentSetlist, currentIndex) {
    if (!currentSetlist || !currentSetlist.items || currentIndex < 0) return null;
    const total = currentSetlist.items.length;
    if (currentIndex >= total - 1) return null; // Đã ở bài cuối

    const nextItem = currentSetlist.items[currentIndex + 1];
    if (!nextItem || !nextItem.song_id) return null;

    // Tìm songObj từ các nguồn cache có sẵn
    const allSongs = window.SetlistUI?._context?.getAllSongsCache?.()
                  || window.LibraryUI?.getSongs?.()
                  || [];
    let nextSongObj = allSongs.find(s => String(s.id) === String(nextItem.song_id))
                   || window.LibraryUI?.getSongObj?.(nextItem.song_id)
                   || window.OfflineSetlistManager?.getOfflineSong?.(nextItem.song_id);

    if (!nextSongObj) {
      nextSongObj = {
        id: nextItem.song_id,
        title: nextItem.title || `Bài #${nextItem.song_id}`,
        xmlPath: `storage/Thanh ca/${nextItem.song_id}.xml`
      };
    }

    const profile = nextItem.chord_profile || 'HD';
    const transpose = parseInt(nextItem.transpose_key || 0, 10);
    return preload(nextSongObj, profile, transpose);
  }

  function get(songId, profile = 'HD') {
    const key = _cacheKey(songId, profile);
    return _cache.get(key) || null;
  }

  function has(songId, profile = 'HD') {
    const key = _cacheKey(songId, profile);
    return _cache.has(key);
  }

  function clear() {
    _cache.clear();
    _inFlight.clear();
  }

  /* ── Đồng hồ đo lường thời gian chuyển bài (Ticket L3-2: <= 150ms tới khi có SVG) ── */
  let _svgReadyTime = 0;

  function startTransitionTimer() {
    _transitionStartTime = performance.now();
    _svgReadyTime = 0;
  }

  function markSvgReady() {
    if (_transitionStartTime > 0 && _svgReadyTime === 0) {
      _svgReadyTime = performance.now();
    }
  }

  function endTransitionTimer() {
    if (_transitionStartTime > 0) {
      const endTime = (_svgReadyTime > 0) ? _svgReadyTime : performance.now();
      _lastTransitionDuration = endTime - _transitionStartTime;
      _transitionStartTime = 0;
      _svgReadyTime = 0;
      window.__lastTransitionTime = Math.round(_lastTransitionDuration * 10) / 10;
    }
    return _lastTransitionDuration;
  }

  function getLastTransitionTime() {
    return _lastTransitionDuration;
  }

  return {
    preload,
    preloadNextInSetlist,
    get,
    has,
    clear,
    startTransitionTimer,
    markSvgReady,
    endTransitionTimer,
    getLastTransitionTime,
    getCacheSize: () => _cache.size
  };
})();

window.SongPreloader = SongPreloader;
