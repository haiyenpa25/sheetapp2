/**
 * assets/js/core/SongLoaderCore.js
 *
 * Bộ tải dữ liệu bài hát và xử lý MusicXML dùng chung (Unified Song Loader Core):
 * 1. Chuẩn hóa đường dẫn XML (URL sanitation) an toàn trên mọi sub-app
 * 2. Tải song song XML bài hát và bộ hợp âm tùy chỉnh (HD, cá nhân)
 * 3. Tự động bơm hợp âm vào MusicXML bằng ChordCanvasXML trước khi nạp vào bộ dựng OSMD
 * 4. Áp dụng dịch giọng TransposeCalculator chuẩn vào OpenSheetMusicDisplay
 *
 * Expose: window.SongLoaderCore
 */
(function(window) {
  'use strict';

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

    // Sử dụng ApiService.resolveUrl nếu có
    if (window.ApiService && typeof window.ApiService.resolveUrl === 'function') {
      return window.ApiService.resolveUrl(path);
    }

    if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') {
      const base = window.__APP_BASE__.replace(/\/+$/, '');
      const clean = path.replace(/^\/+/, '');
      return base ? `${base}/${clean}` : `/${clean}`;
    }

    // Chuẩn hóa dấu gạch chéo đầu nếu không phải URL tuyệt đối
    if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('/')) {
      path = '/' + path;
    }

    return path;
  }

  /**
   * Tải MusicXML và đồng thời nạp bộ hợp âm tùy chỉnh
   * @param {Object|string} song Thông tin bài hát hoặc đường dẫn
   * @param {string} [chordSet='HD'] Tên bộ hợp âm ('HD' | 'default' | 'TLH' | user custom)
   * @param {AbortSignal} [signal=null] Abort signal để hủy request nếu người dùng chuyển bài
   * @returns {Promise<{ rawXml: string, effectiveXml: string, songId: string, chordSet: string }>}
   */
  async function fetchXmlWithChords(song, chordSet = 'HD', signal = null) {
    const songId = (typeof song === 'object' ? (song.id || '') : '').toString();
    const xmlUrl = sanitizeXmlPath(song, songId);

    if (!xmlUrl) {
      throw new Error('Đường dẫn file MusicXML không hợp lệ');
    }

    const fetchOpts = signal ? { signal } : {};

    // 1. Fetch XML và nạp bộ hợp âm SONG SONG
    const shouldLoadCustomChords = chordSet && chordSet !== 'default' && chordSet.toUpperCase() !== 'TLH';
    
    // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
    const xmlPromise = fetch(xmlUrl, fetchOpts).then(async (res) => {
      if (!res.ok) throw new Error(`Không thể tải XML: HTTP ${res.status}`);
      return res.text();
    });

    const chordsPromise = (shouldLoadCustomChords && songId && window.ApiService?.chordSets?.load)
      ? window.ApiService.chordSets.load(songId, chordSet).catch(() => null)
      : Promise.resolve(null);

    const [rawXml, chordRes] = await Promise.all([xmlPromise, chordsPromise]);

    let effectiveXml = rawXml;

    // 2. Bơm hợp âm vào XML nếu có bản đồ hợp âm
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
      chordSet
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
    sanitizeXmlPath,
    fetchXmlWithChords,
    applyTransposeToOsmd
  };

  window.SongLoaderCore = SongLoaderCore;

})(window);
