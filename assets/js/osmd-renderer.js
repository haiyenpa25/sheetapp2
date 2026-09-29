/**
 * osmd-renderer.js
 * Wrapper module cho OpenSheetMusicDisplay (OSMD).
 * Quản lý lifecycle: init → load → render → zoom → transpose.
 */
const OSMDRenderer = (() => {
  'use strict';

  let osmd = null, containerId = null, currentXmlString = null, currentZoom = 1.0;
  let isLoaded = false, _onReadyCallbacks = [], _isCompactMode = false, _titleCompacted = false;
  let _renderToken = 0;
  let _renderCount = 0, _lastContainerWidth = 0, _pendingRender = false;

  /** L5-5: Kiểm tra container có đang hiển thị và có bề rộng hợp lệ để render OSMD hay không */
  function _canRender() {
    if (!osmd || !containerId) return false;
    const c = document.getElementById(containerId);
    if (!c || c.clientWidth <= 0) return false;
    if (c.closest('.hidden') || c.classList.contains('hidden')) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(c) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  /**
   * Khởi tạo OSMD vào một container DOM.
   */
  function init(id, options = {}) {
    containerId = id;
    const container = document.getElementById(id);
    if (!container) throw new Error(`Container #${id} không tồn tại`);

    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: false, // L5-1: Tắt autoResize nội bộ của OSMD, giao ResizeObserver duy nhất làm chủ
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true,
      coloringEnabled: true,
      pageFormat: 'Endless',  // Scroll vertically, no page breaks
      engravingRules: {
        ChordSymbolFontFamily: "OSMDChordFont, sans-serif",
        ChordSymbolTextHeight: 2.85, ChordSymbolYOffset: 1.2, DefaultColorChordSymbol: '#dc2626',
        StaffLineWidth: 0.1, StemWidth: 0.15, TupletNumberTextHeight: 1.5,
        TitleTopDistance: 1.5, SheetTitleHeight: 2.0, SheetComposerHeight: 1.5, SheetAuthorHeight: 1.5
      },
      ...options
    });

    if (osmd.rules) {
        refreshRules();
        osmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif";
    }

    // L5-1 + L5-5: ResizeObserver làm chủ layout, chặn đứng render khi khung ẩn
    _lastContainerWidth = container.clientWidth;
    const resizeObserver = new ResizeObserver(_debounce(async () => {
      if (!_canRender()) return; // L5-5: Tuyệt đối không render khi khung ẩn
      const currentWidth = container.clientWidth;
      if (!_pendingRender && Math.abs(currentWidth - _lastContainerWidth) < 8) {
          return;
      }
      _lastContainerWidth = currentWidth;

      if (window.ChordCanvas?.isPopupOpen?.()) return; // KHÔNG re-render nếu đang nhập popup hợp âm
      if (isLoaded || _pendingRender) {
        _pendingRender = false;
        _renderCount++;
        await osmd.render();
        _titleCompacted = false;
        _compactTitleSVG();
        _tagChordSymbols();
        if (window.ChordCanvas) window.ChordCanvas.reposition();
        if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
        if (!isLoaded) {
          isLoaded = true;
          _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
        }
      }
    }, 400));
    resizeObserver.observe(container);

    // Pinch-to-Zoom (Multi-touch) using GPU scale transform for buttery 60fps feeling on iPad/Mobile
    let initTouchDist = 0, initZoom = 1.0, isPinching = false, currentScaleRatio = 1.0;
    container.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && isLoaded) {
        isPinching = true;
        initTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        initZoom = currentZoom;
        currentScaleRatio = 1.0;
        const svg = container.querySelector('svg');
        if (svg) { svg.style.transition = 'none'; svg.style.transformOrigin = 'top center'; }
      }
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if (isPinching && e.touches.length === 2 && isLoaded) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (initTouchDist > 0) {
          currentScaleRatio = dist / initTouchDist;
          const svg = container.querySelector('svg');
          if (svg) svg.style.transform = `scale(${currentScaleRatio})`;
        }
      }
    }, { passive: false });
    container.addEventListener('touchend', async () => {
      if (isPinching) {
        isPinching = false;
        const svg = container.querySelector('svg');
        if (svg) svg.style.transform = '';
        const finalZoomPercent = Math.round(Math.max(0.3, Math.min(2.5, initZoom * currentScaleRatio)) * 20) * 5;
        if (window.App?.setZoom) await App.setZoom(finalZoomPercent);
      }
    });
    return osmd;
  }

  /** Buộc container tính lại chiều rộng thực trước khi render */
  function _forceLayoutRecalc() {
    const container = document.getElementById(containerId);
    if (!container) return;
    const w = container.clientWidth;
    const svg = container.querySelector('svg');
    if (svg && w > 0) { svg.style.maxWidth = w + 'px'; svg.style.width = '100%'; }
    return w;
  }

  /** Cập nhật lại Engraving Rules trước khi render */
  function refreshRules() {
    if (osmd && osmd.rules) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 680;
        let prefs = { size: 2.85, yOffset: isMobile ? 1.8 : 1.4, color: '#dc2626' };
        if (window.DisplaySettings) prefs = DisplaySettings.getChordPrefs();
        osmd.rules.DefaultColorChordSymbol = prefs.color;
        osmd.rules.ChordSymbolTextHeight   = (prefs.size && prefs.size >= 2.6) ? Math.max(2.85, prefs.size) : 2.85;
        osmd.rules.ChordSymbolYOffset      = Math.max(isMobile ? 1.8 : 1.4, prefs.yOffset ?? 1.4);
        osmd.rules.ChordSymbolYPadding     = 0.0;
        osmd.rules.ChordSymbolYSpacing     = 0.0;
        osmd.rules.ChordOverlapAllowedIntoNextMeasure = true;
        if (osmd.rules.SheetTitleHeight !== undefined)    osmd.rules.SheetTitleHeight   = 2.0;
        if (osmd.rules.SheetComposerHeight !== undefined) osmd.rules.SheetComposerHeight = 1.5;
        if (osmd.rules.SheetAuthorHeight !== undefined)   osmd.rules.SheetAuthorHeight   = 1.5;
        if (osmd.rules.TitleTopDistance !== undefined)    osmd.rules.TitleTopDistance    = 1.5;
    }
  }

  /** Cắt tỉa XML gốc ngay từ trong trứng nước (Xoá thẻ DOM) để dẹp sạch nốt bè/chùm */
  function preprocessXML(xml) {
      if (!window.DisplaySettings || !_isCompactMode) return xml;
      const prefs = DisplaySettings.getCompactPrefs();
      if (!prefs.hideVoices && !prefs.hideChordNotes) return xml;
      try {
          const doc = window.XmlDocCache?.getClonedDoc(xml) || new DOMParser().parseFromString(xml, "application/xml");
          if (prefs.hideVoices) {
              doc.querySelectorAll("note voice").forEach(v => { if (parseInt(v.textContent) > 1) v.parentNode.remove(); });
              doc.querySelectorAll("notations slur, notations tied, note > tie").forEach(el => el.remove());
          }
          if (prefs.hideChordNotes) {
              doc.querySelectorAll("measure").forEach(measure => {
                  let currentPrimaryNote = null, maxPitchVal = -1, maxPitchNode = null;
                  measure.querySelectorAll("note").forEach(note => {
                      if (note.querySelector("rest")) return;
                      const pitchNode = note.querySelector("pitch");
                      if (!pitchNode) return;
                      const step = pitchNode.querySelector("step")?.textContent;
                      const alterNode = pitchNode.querySelector("alter");
                      const alter = alterNode ? parseInt(alterNode.textContent) : 0;
                      const octave = parseInt(pitchNode.querySelector("octave")?.textContent || "0");
                      const stepVals = { 'C':0, 'D':2, 'E':4, 'F':5, 'G':7, 'A':9, 'B':11 };
                      const pitchVal = octave * 12 + (stepVals[step] || 0) + alter;
                      if (note.querySelector("chord")) {
                          if (currentPrimaryNote) {
                              if (pitchVal > maxPitchVal) { maxPitchVal = pitchVal; maxPitchNode = pitchNode.cloneNode(true); }
                              note.parentNode.removeChild(note);
                          }
                      } else {
                          if (currentPrimaryNote && maxPitchNode) {
                              const pPitch = currentPrimaryNote.querySelector("pitch");
                              if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) pPitch.innerHTML = maxPitchNode.innerHTML;
                          }
                          currentPrimaryNote = note; maxPitchVal = pitchVal; maxPitchNode = pitchNode.cloneNode(true);
                      }
                  });
                  if (currentPrimaryNote && maxPitchNode) {
                      const pPitch = currentPrimaryNote.querySelector("pitch");
                      if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) pPitch.innerHTML = maxPitchNode.innerHTML;
                  }
              });
          }
          return window.XmlDocCache?.serializeDoc?.(doc) ?? new XMLSerializer().serializeToString(doc);
      } catch (err) {
          console.error("XML Preprocess error:", err);
          return xml;
      }
  }

  /**
   * Nạp XML string vào OSMD và render.
   * @param {string} xmlString - Nội dung MusicXML
   * @param {number} transposeValue - Số nửa cung để dịch (Mặc định: 0)
   */
  async function load(xmlInput, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    const token = ++_renderToken;
    let processedInput = xmlInput;
    if (typeof xmlInput === 'string') {
      currentXmlString = xmlInput; // Luôn giữ bản gốc
      processedInput = preprocessXML(xmlInput);
    }
    isLoaded = false;

    try {
      await osmd.load(processedInput);
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần load mới hơn

      osmd.zoom = currentZoom;
      _applyCompactMode();
      _applyTranspose(transposeValue);

      refreshRules();
      if (!_canRender()) {
        _pendingRender = true;
        return osmd;
      }
      _pendingRender = false;
      _renderCount++;
      await osmd.render();
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần render mới hơn
      window.SongPreloader?.markSvgReady?.();

      _forceLayoutRecalc(); // lần 2: sau render để clip SVG nếu vẫn rộng
      const containerEl = document.getElementById(containerId);
      if (containerEl) _lastContainerWidth = containerEl.clientWidth;
      _titleCompacted = false;
      _compactTitleSVG();
      _tagChordSymbols();
      isLoaded = true;
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== _renderToken) return osmd;
      console.error('[OSMD] Lỗi khi load:', err);
      throw err;
    }
  }

  /**
   * Reload lại OSMD với XML đã sửa (transpose, chord override, v.v.)
   * @param {string} xmlString - Nội dung XML đã được xử lý
   * @param {number} transposeValue - Số nửa cung để dịch
   */
  // osmd.load() đã dựng GraphicalMusicSheet: chỉ gán Transpose rồi render() thì nốt đổi
  // nhưng chữ hợp âm giữ tông cũ → phải updateGraphic() để TransposeCalculator áp lên hợp âm.
  function _applyTranspose(transposeValue, force = false) {
    if (!osmd?.Sheet || !opensheetmusicdisplay.TransposeCalculator) return;
    if (transposeValue === 0 && !force) return;
    if (!osmd.TransposeCalculator) {
      osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
    }
    osmd.Sheet.Transpose = transposeValue;
    osmd.updateGraphic?.();
  }

  async function reload(xmlString, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa init');
    const token = ++_renderToken;
    if (xmlString) currentXmlString = xmlString;
    try {
      const processedXml = preprocessXML(currentXmlString);
      await osmd.load(processedXml);
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần reload mới hơn

      osmd.zoom = currentZoom;
      if (window.InstrumentMixer?.restoreState) window.InstrumentMixer.restoreState();
      _applyCompactMode();
      _applyTranspose(transposeValue);

      refreshRules();
      _forceLayoutRecalc();
      if (!_canRender()) {
        _pendingRender = true;
        return osmd;
      }
      _pendingRender = false;
      _renderCount++;
      await osmd.render();
      if (token !== _renderToken) return osmd;

      _forceLayoutRecalc();
      const reloadCont = document.getElementById(containerId);
      if (reloadCont) _lastContainerWidth = reloadCont.clientWidth;
      _titleCompacted = false;
      _compactTitleSVG();
      _tagChordSymbols();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== _renderToken) return osmd;
      console.error('[OSMD] Lỗi reload:', err);
      throw err;
    }
  }

  /**
   * Dịch giọng in-memory không cần parse lại XML (L5-2)
   * Đặt osmd.Sheet.Transpose rồi render lại trực tiếp.
   */
  async function transpose(transposeValue = 0) {
    if (!osmd || !osmd.Sheet) throw new Error('OSMD chưa load Sheet để transpose');
    const token = ++_renderToken;
    try {
      _applyTranspose(transposeValue, true);
      refreshRules();
      _forceLayoutRecalc();
      if (!_canRender()) {
        _pendingRender = true;
        return osmd;
      }
      _pendingRender = false;
      _renderCount++;
      await osmd.render();
      if (token !== _renderToken) return osmd;

      _forceLayoutRecalc();
      const containerEl = document.getElementById(containerId);
      if (containerEl) _lastContainerWidth = containerEl.clientWidth;
      _titleCompacted = false;
      _compactTitleSVG();
      _tagChordSymbols();
      if (window.ChordCanvas) window.ChordCanvas.reposition();
      if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== _renderToken) return osmd;
      console.error('[OSMD] Lỗi transpose in-memory:', err);
      throw err;
    }
  }

  /** Thay đổi mức zoom — nhận decimal (0.1 → 2.5) */
  async function setZoom(level) {
    currentZoom = Math.max(0.1, Math.min(2.5, level));
    if (osmd && (isLoaded || _pendingRender)) {
      osmd.zoom = currentZoom;
      if (!_canRender()) {
        _pendingRender = true;
        return;
      }
      _pendingRender = false;
      _forceLayoutRecalc();
      _renderCount++;
      await osmd.render();
      _forceLayoutRecalc();
      const zoomCont = document.getElementById(containerId);
      if (zoomCont) _lastContainerWidth = zoomCont.clientWidth;
      _tagChordSymbols();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
    }
  }

  /** L5-5: Thực hiện render nếu đang có tác vụ render bị hoãn do khung ẩn */
  async function renderPending() {
    if (!_pendingRender || !_canRender()) return false;
    _pendingRender = false;
    _renderCount++;
    await osmd.render();
    _forceLayoutRecalc();
    const c = document.getElementById(containerId);
    if (c) _lastContainerWidth = c.clientWidth;
    _titleCompacted = false;
    _compactTitleSVG();
    _tagChordSymbols();
    if (window.ChordCanvas) window.ChordCanvas.reposition();
    if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
    if (!isLoaded) {
      isLoaded = true;
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
    }
    return true;
  }

  function setZoomSilent(level) {
    currentZoom = Math.max(0.5, Math.min(2.5, level));
    if (osmd) osmd.zoom = currentZoom;
  }

  function getCurrentZoom() { return currentZoom; }
  function getInstance() { return osmd; }
  function getIsLoaded() { return isLoaded; }
  function getCurrentXml() { return currentXmlString; }
  function onReady(cb) { _onReadyCallbacks.push(cb); }
  function destroy() {
    if (osmd) { const el = document.getElementById(containerId); if (el) el.innerHTML = ''; }
    osmd = null; isLoaded = false; currentXmlString = null;
  }
  function _debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  /** Tinh chỉnh title SVG sau render — ẩn title bị duplicate, style đẹp hơn */
  const _svgText = () => (typeof OSMDSvgText !== 'undefined' ? OSMDSvgText : null);
  const CHORD_TEXT_REGEX = { test: s => !!_svgText()?.CHORD_TEXT_REGEX.test(s) };
  const _getMetaTextNodes = () => _svgText()?.getMetaTextNodes(osmd) || { title: null, meta: [] };
  const _getLyricTextNodes = () => _svgText()?.getLyricTextNodes(osmd) || new Set();

  function _compactTitleSVG() {
    if (_titleCompacted) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const texts = Array.from(svg.querySelectorAll('text')).filter(t => !(t.getAttribute('font-family') || '').includes('OSMDChordFont'));
    if (!texts.length) { _titleCompacted = true; return; }

    // Ưu tiên node thật của OSMD. Đoán "chữ to nhất = tiêu đề" sai khi hợp âm
    // được phóng to (preset Sân khấu) — hợp âm đầu tiên bị gắn nhầm class tiêu đề.
    const { title: graphicTitle, meta: metaNodes } = _getMetaTextNodes();
    let titleEl = graphicTitle;
    let maxSize = titleEl ? parseFloat(titleEl.getAttribute('font-size') || '0') : 0;
    if (!titleEl) {
      // OSMD không vẽ tiêu đề (vd. chế độ điện thoại) → chỉ nhận chữ thật sự lớn hơn lời,
      // có ≥3 ký tự chữ; nếu không có thì bỏ qua (tránh gắn nhầm dấu "-" hay hợp âm).
      const lyricNodes = _getLyricTextNodes();
      const lyricFs = Math.max(0, ...[...lyricNodes].map(t => parseFloat(t.getAttribute('font-size') || '0')));
      texts.forEach(t => {
        const s = t.textContent.trim();
        if (lyricNodes.has(t) || CHORD_TEXT_REGEX.test(s) || s.length < 3 || !/\p{L}{2}/u.test(s)) return;
        const fs = parseFloat(t.getAttribute('font-size') || '0');
        if (fs > lyricFs + 2 && fs > maxSize) { maxSize = fs; titleEl = t; }
      });
    }

    if (titleEl) {
      titleEl.classList.add('osmd-title-text');
      const tspan = titleEl.querySelector('tspan');
      if (tspan) {
        const raw = tspan.textContent.trim();
        if (raw === raw.toUpperCase() && raw.length > 2 && !/^\d+$/.test(raw)) {
          tspan.textContent = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }

      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 680;
      const titleContent = (titleEl.querySelector('tspan') || titleEl).textContent.trim().toLowerCase();
      texts.forEach(t => {
        if (t === titleEl) return;
        const content = t.textContent.trim().toLowerCase(), fs = parseFloat(t.getAttribute('font-size') || '0');
        if (content === titleContent && fs < maxSize) t.style.display = 'none';
      });
      // Điện thoại: chỉ ẩn dòng tác giả/lời/bản quyền. Trước đây ẩn mọi chữ trong
      // vòng 160 đơn vị quanh tiêu đề → mất luôn khổ 1–3 của hàng nhạc đầu tiên.
      if (isMobile) metaNodes.forEach(t => { t.classList.add('osmd-meta-text'); t.style.display = 'none'; });
    }

    svg.querySelectorAll('rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height') || '999'), fill = rect.getAttribute('fill') || '', stroke = rect.getAttribute('stroke') || '';
      if (height < 40 && stroke && stroke !== 'none' && fill === 'none') rect.style.display = 'none';
    });
    _titleCompacted = true;
  }

  function _tagChordSymbols() {
    try {
      // 1. Gắn qua OSMD graphical model nếu có node
      osmd?.graphic?.measureList?.forEach(sys => sys?.forEach(m => m?.staffEntries?.forEach(se => {
        const containers = se?.graphicalChordContainers || se?.chordSymbolContainers || [];
        containers.forEach(gcc => {
          const node = gcc?.graphicalLabel?.SVGNode || gcc?.graphicalLabel?.svgElement || gcc?.graphicalLabel?.textElement;
          if (node) {
            node.classList.add('osmd-chord-symbol');
            node.setAttribute('data-chord-symbol', 'true');
            node.querySelectorAll?.('text, tspan')?.forEach(t => {
              t.classList.add('osmd-chord-text');
              t.setAttribute('data-chord-text', 'true');
            });
          }
        });
      })));

      // 2. Quét DOM SVG để gắn chắc chắn 100% bằng cách đối chiếu
      const container = document.getElementById(containerId);
      if (!container) return;
      const svg = container.querySelector('svg');
      if (!svg) return;

      const xmlChordMap = (typeof ChordCanvasXML !== 'undefined' && ChordCanvasXML.readXmlChords)
        ? ChordCanvasXML.readXmlChords()
        : {};
      const chordSet = new Set(Object.values(xmlChordMap).map(c => String(c).trim()));

      // Âm tiết lời như "A" (A-men) khớp regex hợp âm → phải loại trừ node lời trước.
      const lyricNodes = _getLyricTextNodes();

      const texts = Array.from(svg.querySelectorAll('text'));
      texts.forEach(t => {
        if (t.classList.contains('osmd-title-text')) return;
        if (lyricNodes.has(t)) return;
        if (t.parentElement && t.parentElement.classList.contains('vf-lyric')) return;

        const txt = t.textContent.trim();
        if (!txt) return;

        const ff = t.getAttribute('font-family') || '';
        const isChordFont = ff.includes('OSMDChordFont');
        const isKnownChord = chordSet.has(txt) || (CHORD_TEXT_REGEX.test(txt) && !/^\d+$/.test(txt));

        if (isChordFont || isKnownChord) {
          t.classList.add('osmd-chord-symbol', 'osmd-chord-text');
          t.setAttribute('data-chord-symbol', 'true');
          t.setAttribute('data-chord-text', 'true');
          if (t.parentElement && t.parentElement.tagName.toLowerCase() === 'g') {
            t.parentElement.classList.add('osmd-chord-symbol');
            t.parentElement.setAttribute('data-chord-symbol', 'true');
          }
        }
      });
    } catch (e) {
      console.warn('[OSMD] Error tagging chord symbols:', e);
    }
  }

  function setCompactMode(val) {
    _isCompactMode = !!val;
    if (isLoaded && osmd && currentXmlString) reload(currentXmlString);
  }
  function getCompactMode() { return _isCompactMode; }

  /**
   * Ẩn/hiện chữ Điệp Khúc, Coda, D.C., Fine... trong SVG khi compact mode bật.
   * Các text này xuất phát từ <rehearsal> hoặc <direction><words> trong MusicXML.
   */
  function _hideRepeatLabels(hide) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const REPEAT_PATTERN = /^(đi[eệ]p\s*kh[úu]c|coda|d\.?c\.?|da\s*capo|fine|segno|d\.?s\.?|chorus|refrain)/i;

    svg.querySelectorAll('text').forEach(t => {
      const txt = t.textContent.trim();
      if (REPEAT_PATTERN.test(txt)) {
        t.style.display = hide ? 'none' : '';
      }
    });
  }

  function _applyCompactMode() {
    if (!osmd || !osmd.Sheet) return;
    let compactPrefs = { hideBass: true, hideVoices: true, hideText: true };
    if (window.DisplaySettings) compactPrefs = DisplaySettings.getCompactPrefs();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 680;
    if (!_isCompactMode) {
      const drawMeta = !isMobile;
      osmd.setOptions({ drawComposer: drawMeta, drawCredits: drawMeta, drawSubtitle: drawMeta, drawLyricist: drawMeta });
      return;
    }
    osmd.Sheet.Instruments.forEach((ins, insIndex) => {
      if (!ins.Staves) return;
      if (compactPrefs.hideBass) {
        if (ins.Staves.length >= 2) for (let i = 1; i < ins.Staves.length; i++) ins.Staves[i].Visible = false;
        if (insIndex > 0) { ins.Visible = false; ins.Staves.forEach(st => st.Visible = false); }
      }
      if (compactPrefs.hideVoices && insIndex === 0 && ins.Voices) {
        ins.Voices.forEach(voice => { if (voice.VoiceId > 1) voice.Visible = false; });
      }
    });

    const drawCredits = !compactPrefs.hideText;
    osmd.setOptions({
      drawComposer: drawCredits, drawCredits, drawSubtitle: drawCredits, drawLyricist: drawCredits,
      drawTitle: !compactPrefs.hideTitle, drawLyrics: !compactPrefs.hideLyrics, drawMeasureNumbers: !compactPrefs.hideMeasureNumbers
    });
    setTimeout(() => _hideRepeatLabels(_isCompactMode), 400);
  }

  return {
    init, load, reload, transpose, setZoom, setZoomSilent, getInstance, getIsLoaded,
    getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode,
    refreshRules, tagChordSymbols: _tagChordSymbols, getRenderToken: () => _renderToken,
    getRenderCount: () => _renderCount, resetRenderCount: () => { _renderCount = 0; },
    canRender: _canRender, renderPending, hasPendingRender: () => _pendingRender
  };
})();

window.OSMDRenderer = OSMDRenderer;
