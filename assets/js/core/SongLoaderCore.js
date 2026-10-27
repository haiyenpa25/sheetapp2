/**
 * assets/js/core/SongLoaderCore.js
 *
 * Bộ tải dữ liệu bài hát và xử lý MusicXML dùng chung (Unified Song Loader Core):
 * 1. Chuẩn hóa đường dẫn XML (URL sanitation) an toàn trên mọi sub-app
 * 2. Quản lý token chống chồng lệnh, timeout (12s) và abort khi đổi bài (M2-3)
 * 3. Tải XML bài hát với fallback OfflineVault / CacheStorage, trả {xml, source}
 * 4. Tự động bơm hợp âm vào MusicXML bằng ChordCanvasXML trước khi nạp vào bộ dựng OSMD
 * 5. Áp dụng dịch giọng TransposeCalculator chuẩn vào OpenSheetMusicDisplay
 *
 * Expose: window.SongLoaderCore
 */
(function(window) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 12000;
  let _currentLoadToken = 0;
  let _currentAbortController = null;

  function beginLoad() {
    const token = ++_currentLoadToken;
    if (_currentAbortController) {
      try { _currentAbortController.abort(); } catch (_) {}
    }
    const AC = (typeof AbortController !== 'undefined')
      ? AbortController
      : (window && window.AbortController ? window.AbortController : null);
    _currentAbortController = AC ? new AC() : null;
    return {
      token,
      controller: _currentAbortController,
      signal: _currentAbortController ? _currentAbortController.signal : null,
      isCurrent: () => token === _currentLoadToken,
    };
  }

  function getCurrentToken() {
    return _currentLoadToken;
  }

  function isCurrentToken(token) {
    return token === _currentLoadToken;
  }

  function abortCurrent() {
    if (_currentAbortController) {
      try { _currentAbortController.abort(); } catch (_) {}
      _currentAbortController = null;
    }
  }

  /**
   * Chuẩn hóa đường dẫn file XML của bài hát
   * @param {string|Object} songOrPath
   * @param {string|number} [fallbackId='']
   * @returns {string}
   */
  function sanitizeXmlPath(songOrPath, fallbackId = '') {
    let path = '';
    if (typeof songOrPath === 'string') {
      path = songOrPath;
    } else if (songOrPath && typeof songOrPath === 'object') {
      path = songOrPath.xmlPath || songOrPath.xml_path || '';
    }

    if (!path && fallbackId) {
      path = `storage/Thanh ca/${fallbackId}.xml`;
    }

    if (!path) return '';

    if (window.ApiService && typeof window.ApiService.resolveUrl === 'function') {
      return window.ApiService.resolveUrl(path);
    }

    if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') {
      const base = window.__APP_BASE__.replace(/\/+$/, '');
      const clean = path.replace(/^\/+/, '');
      return base ? `${base}/${clean}` : `/${clean}`;
    }

    if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('/')) {
      path = '/' + path;
    }

    return path;
  }

  /**
   * M2-3: Tải MusicXML dùng chung cho cả Modern và Classic.
   * Hỗ trợ token chống chồng lệnh, timeout, abort khi đổi bài, OfflineVault fallback.
   * @param {Object|string} song
   * @param {Object} [options={}]
   * @returns {Promise<{ xml: string, source: string, token: number }>}
   */
  async function loadXml(song, options = {}) {
    const hasCallerSession = typeof options.token === 'number';
    const session = hasCallerSession
      ? {
          token: options.token,
          signal: options.signal || (_currentAbortController ? _currentAbortController.signal : null),
          isCurrent: () => !hasCallerSession || options.token === _currentLoadToken || _currentLoadToken === 0,
        }
      : beginLoad();

    if (typeof options.xml === 'string' && options.xml) {
      return { xml: options.xml, source: 'preloaded', token: session.token };
    }

    const songObj = (song && typeof song === 'object') ? song : { xmlPath: String(song || '') };
    const rawXmlPath = songObj.xmlPath || songObj.xml_path || '';
    const xmlSource = songObj.versionId
      ? `api/index.php?route=songs&action=version_xml&version_id=${encodeURIComponent(songObj.versionId)}`
      : rawXmlPath;
    const xmlUrl = sanitizeXmlPath(xmlSource, songObj.id || '');
    if (!xmlUrl) {
      throw new Error('Đường dẫn file MusicXML không hợp lệ');
    }

    const timeoutMs = Number(options.timeoutMs ?? (window && window.__API_TIMEOUT_MS__)) || DEFAULT_TIMEOUT_MS;
    const fetchOpts = { timeoutMs };
    if (session.signal) fetchOpts.signal = session.signal;

    try {
      // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
      const xml = (window.ApiService && typeof window.ApiService.fetchXml === 'function')
        ? await window.ApiService.fetchXml(xmlUrl, fetchOpts) // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
        : await fetch(xmlUrl, fetchOpts).then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          });

      if (session.signal && session.signal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      if (!songObj.versionId && rawXmlPath && window.OfflineVault?.saveXml) {
        try { window.OfflineVault.saveXml(rawXmlPath, xml); } catch (_) {}
      }
      return { xml, source: 'network', token: session.token };
    } catch (err) {
      if (err?.name === 'AbortError' || (session.signal && session.signal.aborted)) {
        const abortErr = err instanceof Error ? err : new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      if (!songObj.versionId) {
        try {
          const vaultXml = await window.OfflineVault?.getXml?.(rawXmlPath || xmlUrl);
          if (vaultXml) {
            return { xml: vaultXml, source: 'offline', token: session.token };
          }
        } catch (_) {}

        if (typeof caches !== 'undefined' && caches && typeof caches.match === 'function') {
          try {
            const cachedResp = await caches.match(xmlUrl);
            if (cachedResp) {
              const cachedText = await cachedResp.text();
              if (cachedText) {
                return { xml: cachedText, source: 'offline', token: session.token };
              }
            }
          } catch (_) {}
        }
      }

      throw err instanceof Error
        ? err
        : new Error('Không thể nạp file XML (Mất mạng và chưa lưu ngoại tuyến)');
    }
  }

  /**
   * Tải MusicXML và đồng thời nạp bộ hợp âm tùy chỉnh
   * @param {Object|string} song Thông tin bài hát hoặc đường dẫn
   * @param {string} [chordSet='HD'] Tên bộ hợp âm ('HD' | 'default' | 'TLH' | user custom)
   * @param {AbortSignal} [signal=null] Abort signal để hủy request nếu người dùng chuyển bài
   * @returns {Promise<{ rawXml: string, effectiveXml: string, songId: string, chordSet: string, source: string }>}
   */
  async function fetchXmlWithChords(song, chordSet = 'HD', signal = null) {
    const songId = (typeof song === 'object' ? (song.id || '') : '').toString();
    const shouldLoadCustomChords = chordSet && chordSet !== 'default' && chordSet.toUpperCase() !== 'TLH';

    const xmlPromise = loadXml(song, signal ? { signal, token: _currentLoadToken } : {});
    const chordsPromise = (shouldLoadCustomChords && songId && window.ApiService?.chordSets?.load)
      ? window.ApiService.chordSets.load(songId, chordSet).catch(() => null)
      : Promise.resolve(null);

    const [xmlRes, chordRes] = await Promise.all([xmlPromise, chordsPromise]);
    const rawXml = xmlRes.xml;
    let effectiveXml = rawXml;

    if (rawXml && window.ChordCanvasXML?.cloneAndInjectChords) {
      const chordsMap = {};
      if (chordRes && chordRes.success && Array.isArray(chordRes.chords)) {
        chordRes.chords.forEach(c => {
          if (c && c.chord && c.measureIdx !== undefined && c.noteIdx !== undefined) {
            chordsMap[`${c.measureIdx}_${c.noteIdx}`] = c.chord;
          }
        });
      }
      if (Object.keys(chordsMap).length > 0) {
        effectiveXml = window.ChordCanvasXML.cloneAndInjectChords(rawXml, chordsMap);
      }
    }

    return {
      rawXml,
      effectiveXml,
      songId,
      chordSet,
      source: xmlRes.source,
    };
  }

  /**
   * Áp dụng dịch giọng TransposeCalculator chuẩn vào OpenSheetMusicDisplay
   * @param {Object} osmd Đối tượng OSMD
   * @param {number} transposeValue Số nửa cung (-12 đến +12)
   */
  function applyTransposeToOsmd(osmd, transposeValue = 0) {
    if (!osmd || !osmd.Sheet) return false;

    try {
      const OSMDLib = window.opensheetmusicdisplay;
      if (OSMDLib && OSMDLib.TransposeCalculator) {
        osmd.TransposeCalculator = new OSMDLib.TransposeCalculator();
      }

      osmd.Sheet.Transpose = Number(transposeValue) || 0;
      if (typeof osmd.updateGraphic === 'function') osmd.updateGraphic();
      if (typeof osmd.render === 'function') osmd.render();
      return true;
    } catch (err) {
      console.warn('[SongLoaderCore] Transpose application error:', err);
      return false;
    }
  }

  const SongLoaderCore = {
    DEFAULT_TIMEOUT_MS,
    beginLoad,
    getCurrentToken,
    isCurrentToken,
    abortCurrent,
    loadXml,
    sanitizeXmlPath,
    fetchXmlWithChords,
    applyTransposeToOsmd
  };

  window.SongLoaderCore = SongLoaderCore;

})(window);
