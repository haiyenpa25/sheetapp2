/**
 * osmd-renderer.js
 * Wrapper module cho OpenSheetMusicDisplay (OSMD).
 * Quản lý lifecycle: init → load → render → zoom → transpose.
 */
const OSMDRenderer = (() => {
  'use strict';

  let osmd = null;
  let containerId = null;
  let currentXmlString = null;
  let currentZoom = 1.0;
  // NOTE: currentTranspose không lưu ở đây — dùng Store.get('currentTranspose')
  let isLoaded = false;
  let _onReadyCallbacks = []; // BUG-C fix: array thay vì single callback
  let _isCompactMode = false;
  let _titleCompacted = false; // flag tránh compact title nhiều lần
  let _renderToken = 0; // Race-condition guard: ngăn các lần load/render cũ đè lên bài mới
  let _renderCount = 0; // L5-1: Bộ đếm số lần render OSMD thực tế
  let _lastContainerWidth = 0; // L5-1: Theo dõi bề rộng container để tránh render kép sau khi nạp

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

    // Force specific rules onto the rules object as some versions ignore constructor config
    if (osmd.rules) {
        refreshRules();
        osmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif";
    }

    // L5-1: ResizeObserver duy nhất làm chủ việc layout lại khi container thay đổi kích thước
    _lastContainerWidth = container.clientWidth;
    const resizeObserver = new ResizeObserver(_debounce(async () => {
      if (isLoaded) {
          const currentWidth = container.clientWidth;
          if (currentWidth > 0 && Math.abs(currentWidth - _lastContainerWidth) < 8) {
              return;
          }
          _lastContainerWidth = currentWidth;

          if (window.ChordCanvas?.isPopupOpen?.()) return; // KHÔNG re-render nếu đang nhập popup hợp âm (tránh mất focus)
          _renderCount++;
          await osmd.render();
          _titleCompacted = false; // reset để compact lại sau resize
          _compactTitleSVG();
          _tagChordSymbols();
          if (window.ChordCanvas) window.ChordCanvas.reposition();
          if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
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

  /**
   * Buộc container tính lại chiều rộng thực trước khi render
   * (fix SVG tràn phải sau khi chord canvas thêm elements)
   */
  function _forceLayoutRecalc() {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Đọc clientWidth để buộc browser flush layout
    const w = container.clientWidth;
    // Đảm bảo SVG không rộng hơn container
    const svg = container.querySelector('svg');
    if (svg && w > 0) {
      svg.style.maxWidth = w + 'px';
      svg.style.width    = '100%';
    }
    // Xóa overflow ẩn sau khi render (chỉ để clip trong quá trình render)
    return w;
  }

  /**
   * Cập nhật lại Engraving Rules trước khi render
   */
  function refreshRules() {
    if (osmd && osmd.rules) {
        let prefs = { size: 2.85, yOffset: 1.2, color: '#dc2626' }; // chuẩn hiện tại
        if (window.DisplaySettings) prefs = DisplaySettings.getChordPrefs();

        osmd.rules.DefaultColorChordSymbol = prefs.color;
        osmd.rules.ChordSymbolTextHeight   = (prefs.size && prefs.size >= 2.6) ? Math.max(2.85, prefs.size) : 2.85;
        osmd.rules.ChordSymbolYOffset      = prefs.yOffset ?? 1.2;
        osmd.rules.ChordSymbolYPadding     = 0.0;
        osmd.rules.ChordSymbolYSpacing     = 0.0;
        osmd.rules.ChordOverlapAllowedIntoNextMeasure = true;

        if (osmd.rules.SheetTitleHeight !== undefined)    osmd.rules.SheetTitleHeight   = 2.0;
        if (osmd.rules.SheetComposerHeight !== undefined) osmd.rules.SheetComposerHeight = 1.5;
        if (osmd.rules.SheetAuthorHeight !== undefined)   osmd.rules.SheetAuthorHeight   = 1.5;
        if (osmd.rules.TitleTopDistance !== undefined)    osmd.rules.TitleTopDistance    = 1.5;
    }
  }

  /**
   * Cắt tỉa XML gốc ngay từ trong trứng nước (Xoá thẻ DOM) để dẹp sạch nốt bè/chùm
   */
  function preprocessXML(xml) {
      if (!window.DisplaySettings || !_isCompactMode) return xml;
      const prefs = DisplaySettings.getCompactPrefs();
      if (!prefs.hideVoices && !prefs.hideChordNotes) return xml;

      try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "application/xml");

          if (prefs.hideVoices) {
              doc.querySelectorAll("note voice").forEach(v => {
                  if (parseInt(v.textContent) > 1) v.parentNode.remove();
              });
              doc.querySelectorAll("notations slur, notations tied, note > tie").forEach(el => el.remove());
          }

          if (prefs.hideChordNotes) {
              const measures = doc.querySelectorAll("measure");
              measures.forEach(measure => {
                  const notes = measure.querySelectorAll("note");
                  let currentPrimaryNote = null;
                  let maxPitchVal = -1;
                  let maxPitchNode = null;

                  notes.forEach(note => {
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
                              if (pitchVal > maxPitchVal) {
                                  maxPitchVal = pitchVal;
                                  maxPitchNode = pitchNode.cloneNode(true);
                              }
                              note.parentNode.removeChild(note);
                          }
                      } else {
                          if (currentPrimaryNote && maxPitchNode) {
                              const pPitch = currentPrimaryNote.querySelector("pitch");
                              if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) pPitch.innerHTML = maxPitchNode.innerHTML;
                          }
                          currentPrimaryNote = note;
                          maxPitchVal = pitchVal;
                          maxPitchNode = pitchNode.cloneNode(true);
                      }
                  });
                  
                  // Xử lý nốt cuối cùng trong ô nhịp
                  if (currentPrimaryNote && maxPitchNode) {
                      const pPitch = currentPrimaryNote.querySelector("pitch");
                      if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) {
                          pPitch.innerHTML = maxPitchNode.innerHTML;
                      }
                  }
              });
          }

          const serializer = new XMLSerializer();
          return serializer.serializeToString(doc);
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
      
      if (transposeValue !== 0 && osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
      }

      refreshRules();
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

      if (transposeValue !== 0 && osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
      }

      refreshRules();
      _forceLayoutRecalc();
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
      if (opensheetmusicdisplay.TransposeCalculator) {
        if (!osmd.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
        }
        osmd.Sheet.Transpose = transposeValue;
      }
      refreshRules();
      _forceLayoutRecalc();
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
    if (osmd && isLoaded) {
      osmd.zoom = currentZoom;
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

  /**
   * Tinh chỉnh title SVG sau render — ẩn title bị duplicate, style đẹp hơn.
   * XML Finale xuất ra: <movement-title> + <credit-words> cùng nội dung → OSMD vẽ chồng.
   */
  function _compactTitleSVG() {
    if (_titleCompacted) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Lấy tất cả text elements, bỏ chord symbols
    const texts = Array.from(svg.querySelectorAll('text')).filter(t => {
      const ff = t.getAttribute('font-family') || '';
      return !ff.includes('OSMDChordFont');
    });
    if (!texts.length) { _titleCompacted = true; return; }

    // --- Tìm title text (lớn nhất) ---
    let maxSize = 0;
    let titleEl = null;
    texts.forEach(t => {
      const fs = parseFloat(t.getAttribute('font-size') || '0');
      if (fs > maxSize) { maxSize = fs; titleEl = t; }
    });

    if (titleEl) {
      // 1. Style title đẹp hơn
      titleEl.classList.add('osmd-title-text');
      titleEl.setAttribute('class', (titleEl.getAttribute('class') || '') + ' osmd-title-text');

      // 2. Convert ALL CAPS → Title Case cho dễ đọc
      const tspan = titleEl.querySelector('tspan');
      if (tspan) {
        const raw = tspan.textContent.trim();
        if (raw === raw.toUpperCase() && raw.length > 2 && !/^\d+$/.test(raw)) {
          tspan.textContent = raw.split(' ').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');
        }
      }

      // 3. Tìm và ẩn các text TRÙNG NỘI DUNG với title hoặc tác giả/chú thích trên điện thoại (L1-8)
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 680;
      const titleContent = (titleEl.querySelector('tspan') || titleEl).textContent.trim().toLowerCase();
      const titleY = parseFloat(titleEl.getAttribute('y') || '0');
      texts.forEach(t => {
        if (t === titleEl) return;
        const content = t.textContent.trim().toLowerCase();
        const fs = parseFloat(t.getAttribute('font-size') || '0');
        const y = parseFloat(t.getAttribute('y') || '0');
        if (content === titleContent && fs < maxSize) t.style.display = 'none';
        if (isMobile && fs < maxSize && Math.abs(y - titleY) < 160) {
          t.classList.add('osmd-meta-text');
          t.style.display = 'none';
        }
      });
    }

    // 4. Ẩn các rect nhỏ trong header (nếu OSMD vẽ enclosure/box xung quanh credit)
    const svgY = parseFloat(svg.getAttribute('viewBox')?.split(' ')[1] || '0');
    svg.querySelectorAll('rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height') || '999');
      const fill   = rect.getAttribute('fill') || '';
      const stroke = rect.getAttribute('stroke') || '';
      // Rect nhỏ (< 40px) có stroke = enclosure box xấu → ẩn
      if (height < 40 && stroke && stroke !== 'none' && fill === 'none') {
        rect.style.display = 'none';
      }
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

      const CHORD_REGEX = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\/[A-G][b#]?)?$/;

      const texts = Array.from(svg.querySelectorAll('text'));
      texts.forEach(t => {
        if (t.classList.contains('osmd-title-text')) return;
        if (t.parentElement && t.parentElement.classList.contains('vf-lyric')) return;

        const txt = t.textContent.trim();
        if (!txt) return;

        const ff = t.getAttribute('font-family') || '';
        const isChordFont = ff.includes('OSMDChordFont');
        const isKnownChord = chordSet.has(txt) || (CHORD_REGEX.test(txt) && !/^\d+$/.test(txt));

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
    getRenderCount: () => _renderCount, resetRenderCount: () => { _renderCount = 0; }
  };
})();

window.OSMDRenderer = OSMDRenderer;
