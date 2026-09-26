/**
 * assets/js/learn/ui/learn-score.js — OSMD Score Viewer, Zoom & Measure Seeking
 * Part of SheetApp Learn Studio
 */
const LearnScore = (() => {
  'use strict';

  let _osmd = null;
  let _osmdZoom = 1.0;
  let _onSeekCallback = null;
  let _getSongMetaCallback = null;

  function init(options = {}) {
    _onSeekCallback = options.onSeek;
    _getSongMetaCallback = options.getSongMeta;
  }

  function initOsmd() {
    const container = document.getElementById('learn-score-container');
    if (!container || !window.opensheetmusicdisplay) return null;

    _osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawComposer: false,
      drawCredits: false,
      drawingParameters: 'compact',
      pageFormat: 'Endless',
    });
    return _osmd;
  }

  function getOsmd() {
    return _osmd;
  }

  function getZoom() {
    return _osmdZoom;
  }

  function setZoom(newZoom) {
    if (!_osmd) return;
    _osmdZoom = Math.max(0.4, Math.min(1.8, Math.round(newZoom * 100) / 100));
    _osmd.zoom = _osmdZoom;
    _osmd.render();
    const zoomLabel = document.getElementById('learn-zoom-val');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(_osmdZoom * 100)}%`;
  }

  function zoomIn() {
    setZoom(_osmdZoom + 0.1);
  }

  function zoomOut() {
    setZoom(_osmdZoom - 0.1);
  }

  function resetZoom() {
    setZoom(1.0);
  }

  function fitScore() {
    if (!_osmd) return;
    const container = document.getElementById('learn-score-container');
    const scoreSec = document.querySelector('.learn-score-section');
    if (!container || !scoreSec) return;

    const availableHeight = scoreSec.clientHeight - 60;
    const currentHeight = container.scrollHeight || 1600;
    if (availableHeight > 250 && currentHeight > 250) {
      const targetZoom = Math.min(1.0, Math.max(0.55, Math.round((availableHeight / currentHeight) * _osmdZoom * 100) / 100));
      setZoom(targetZoom);
    }
  }

  function scrollToMeasure(measure) {
    const scoreSec = document.querySelector('.learn-score-section');
    const container = document.getElementById('learn-score-container');
    if (!scoreSec || !container) return;

    const meta = _getSongMetaCallback ? _getSongMetaCallback() : { totalMeasures: 99 };
    const total = Math.max(1, meta.totalMeasures);
    const scrollableH = container.scrollHeight - scoreSec.clientHeight;
    if (scrollableH <= 0) return;

    const progress = Math.max(0, Math.min(1, (measure - 1) / total));
    const targetScrollTop = progress * container.scrollHeight;
    scoreSec.scrollTo({
      top: Math.max(0, targetScrollTop - 40),
      behavior: 'smooth'
    });
  }

  function jumpCursorToMeasure(measureNum) {
    if (!_osmd?.cursor) return;
    _osmd.cursor.reset();
    const targetIdx = measureNum - 1;
    while (_osmd.cursor.iterator && _osmd.cursor.iterator.currentMeasureIndex < targetIdx && !_osmd.cursor.iterator.EndReached) {
      _osmd.cursor.next();
    }
    _osmd.cursor.show();
  }

  function findMeasureAtCoords(x, y) {
    if (!_osmd?.graphic?.measureList) return null;
    const list = _osmd.graphic.measureList;
    for (let i = 0; i < list.length; i++) {
      const staff0 = list[i][0];
      if (!staff0?.PositionAndShape) continue;
      const pos = staff0.PositionAndShape.AbsolutePosition;
      const size = staff0.PositionAndShape.Size;
      const mx = pos.x * 10;
      const my = pos.y * 10;
      const mw = size.width * 10;
      const mh = Math.max(260, (size.height || 25) * 10);
      if (x >= mx && x <= mx + mw && y >= my - 30 && y <= my + mh + 40) {
        return i + 1;
      }
    }
    return null;
  }

  function setupScoreClickHandler(onSeek) {
    const container = document.getElementById('learn-score-container');
    if (!container || container._hasClickHandler) return;
    container._hasClickHandler = true;

    container.addEventListener('click', (e) => {
      if (!_osmd?.graphic?.measureList) return;
      const svg = container.querySelector('svg');
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / _osmdZoom;
      const clickY = (e.clientY - rect.top) / _osmdZoom;

      const measureNum = findMeasureAtCoords(clickX, clickY);
      if (measureNum) {
        if (onSeek) onSeek(measureNum);
        else if (_onSeekCallback) _onSeekCallback(measureNum);
      }
    });
  }

  async function loadScore(xmlString, transpose = 0) {
    if (!_osmd) initOsmd();
    if (!_osmd) return null;

    await _osmd.load(xmlString);
    if (transpose !== 0 && window.opensheetmusicdisplay?.TransposeCalculator) {
      try {
        _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
        _osmd.Sheet.Transpose = transpose;
        _osmd.updateGraphic();
      } catch (e) {}
    }
    await _osmd.render();
    if (_osmd.cursor) {
      _osmd.cursor.reset();
      _osmd.cursor.hide();
    }
    return _osmd;
  }

  function prepareEffectiveXml(xml, chordData, profile) {
    if (!xml) return { xmlString: '', xmlDoc: null, rawChordData: [] };
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(xml, 'application/xml');
    const xmlHarmonies = window.ChordTimelineNormalizer ? window.ChordTimelineNormalizer._extractHarmoniesFromXml(originalDoc, 0) : [];
    const isStubProfile = (xmlHarmonies.length >= 6 && (!chordData || chordData.length <= 5));
    const shouldInject = window.ChordCanvasXML?.cloneAndInjectChords 
      && profile !== 'default' 
      && profile?.toUpperCase() !== 'TLH'
      && !isStubProfile;

    let effectiveXml = xml;
    if (shouldInject && Array.isArray(chordData)) {
      const chordsMap = {};
      chordData.forEach(item => {
        if (item?.chord) chordsMap[`${item.measureIdx}_${item.noteIdx}`] = item.chord;
      });
      if (Object.keys(chordsMap).length > 0) {
        effectiveXml = window.ChordCanvasXML.cloneAndInjectChords(xml, chordsMap);
      }
    }
    const finalDoc = shouldInject ? parser.parseFromString(effectiveXml, 'application/xml') : originalDoc;
    return {
      xmlDoc: finalDoc,
      xmlString: effectiveXml,
      rawChordData: isStubProfile ? [] : (chordData || [])
    };
  }

  return {
    init,
    initOsmd,
    getOsmd,
    getZoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitScore,
    scrollToMeasure,
    jumpCursorToMeasure,
    findMeasureAtCoords,
    setupScoreClickHandler,
    loadScore,
    prepareEffectiveXml,
  };
})();

if (typeof window !== 'undefined') {
  window.LearnScore = LearnScore;
}
